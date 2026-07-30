import { isDeepStrictEqual } from "node:util";

import { Inject, Injectable } from "@nestjs/common";
import {
  articleDocuments,
  articles,
  auditLogs,
  createUuidV7,
  type DatabaseConnection,
} from "@wechat-layout/database";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { and, eq, isNull } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import type {
  ArticleDocumentRecord,
  ArticleDocumentRepository,
  SaveArticleDocumentInput,
  SaveArticleDocumentResult,
} from "./document.types.js";

type JsonObject = Record<string, unknown>;

const currentDocumentSelection = {
  id: articleDocuments.id,
  articleId: articleDocuments.articleId,
  accountId: articles.accountId,
  schemaVersion: articleDocuments.schemaVersion,
  document: articleDocuments.documentJson,
  documentVersion: articleDocuments.documentVersion,
  textLocked: articles.textLocked,
  originalTextHash: articleDocuments.originalTextHash,
  currentTextHash: articleDocuments.currentTextHash,
  lastTransactionId: articleDocuments.lastTransactionId,
  lastSavedBy: articleDocuments.lastSavedBy,
  lastSavedAt: articleDocuments.lastSavedAt,
  createdAt: articleDocuments.createdAt,
  updatedAt: articleDocuments.updatedAt,
};

function toRecord(row: {
  readonly id: string;
  readonly articleId: string;
  readonly accountId: string | null;
  readonly schemaVersion: string;
  readonly document: JsonObject;
  readonly documentVersion: number;
  readonly textLocked: boolean;
  readonly originalTextHash: string | null;
  readonly currentTextHash: string | null;
  readonly lastTransactionId: string | null;
  readonly lastSavedBy: string;
  readonly lastSavedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): ArticleDocumentRecord {
  return {
    ...row,
    document: row.document as unknown as DocumentV1,
  };
}

function documentSummary(record: {
  readonly schemaVersion: string;
  readonly documentVersion: number;
  readonly currentTextHash: string | null;
}): JsonObject {
  return {
    schemaVersion: record.schemaVersion,
    documentVersion: record.documentVersion,
    currentTextHash: record.currentTextHash,
  };
}

function isReplay(record: ArticleDocumentRecord, input: SaveArticleDocumentInput): boolean {
  return (
    record.lastTransactionId === input.lastTransactionId &&
    record.documentVersion === input.baseVersion + 1 &&
    record.schemaVersion === input.schemaVersion &&
    isDeepStrictEqual(record.document, input.document)
  );
}

@Injectable()
export class PostgresDocumentRepository implements ArticleDocumentRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async findCurrent(ownerUserId: string, articleId: string): Promise<ArticleDocumentRecord | null> {
    const [row] = await this.connection.db
      .select(currentDocumentSelection)
      .from(articleDocuments)
      .innerJoin(articles, eq(articles.id, articleDocuments.articleId))
      .where(
        and(
          eq(articleDocuments.articleId, articleId),
          eq(articles.ownerUserId, ownerUserId),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);

    return row === undefined ? null : toRecord(row);
  }

  async save(input: SaveArticleDocumentInput): Promise<SaveArticleDocumentResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [currentRow] = await transaction
        .select(currentDocumentSelection)
        .from(articleDocuments)
        .innerJoin(articles, eq(articles.id, articleDocuments.articleId))
        .where(
          and(
            eq(articleDocuments.articleId, input.articleId),
            eq(articles.ownerUserId, input.ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1);

      if (currentRow === undefined) {
        return { kind: "not_found" };
      }

      const current = toRecord(currentRow);
      if (isReplay(current, input)) {
        return {
          kind: "replayed",
          record: current,
        };
      }
      if (current.documentVersion !== input.baseVersion) {
        return {
          kind: "conflict",
          currentVersion: current.documentVersion,
          lastTransactionId: current.lastTransactionId,
          lastSavedAt: current.lastSavedAt,
        };
      }

      const now = new Date();
      const [updated] = await transaction
        .update(articleDocuments)
        .set({
          schemaVersion: input.schemaVersion,
          documentJson: input.document as unknown as JsonObject,
          documentVersion: input.baseVersion + 1,
          currentTextHash: input.statistics.currentTextHash,
          lastTransactionId: input.lastTransactionId,
          lastSavedBy: input.context.actorUserId,
          lastSavedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(articleDocuments.id, current.id),
            eq(articleDocuments.documentVersion, input.baseVersion),
          ),
        )
        .returning();

      if (updated === undefined) {
        const [latest] = await transaction
          .select(currentDocumentSelection)
          .from(articleDocuments)
          .innerJoin(articles, eq(articles.id, articleDocuments.articleId))
          .where(
            and(
              eq(articleDocuments.id, current.id),
              eq(articles.ownerUserId, input.ownerUserId),
              isNull(articles.deletedAt),
            ),
          )
          .limit(1);

        if (latest === undefined) {
          return { kind: "not_found" };
        }
        const latestRecord = toRecord(latest);
        if (isReplay(latestRecord, input)) {
          return {
            kind: "replayed",
            record: latestRecord,
          };
        }
        return {
          kind: "conflict",
          currentVersion: latest.documentVersion,
          lastTransactionId: latest.lastTransactionId,
          lastSavedAt: latest.lastSavedAt,
        };
      }

      await transaction
        .update(articles)
        .set({
          wordCount: input.statistics.wordCount,
          imageCount: input.statistics.imageCount,
          svgCount: input.statistics.svgCount,
          currentSnapshotId: null,
          updatedAt: now,
        })
        .where(and(eq(articles.id, input.articleId), eq(articles.ownerUserId, input.ownerUserId)));

      const saved = toRecord({
        ...updated,
        accountId: current.accountId,
        textLocked: current.textLocked,
        document: updated.documentJson,
      });
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.document.save",
        targetType: "article_document",
        targetId: current.id,
        accountId: current.accountId,
        articleId: input.articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: documentSummary(current),
        afterSummary: documentSummary(saved),
        metadataJson: {
          lastTransactionId: input.lastTransactionId,
          transactionOrigin: input.transactionOrigin,
        },
      });

      return {
        kind: "saved",
        record: saved,
      };
    });
  }
}
