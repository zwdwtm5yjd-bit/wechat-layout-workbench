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
  ApplyThemeInput,
  ApplyThemeResult,
  ThemeArticleSource,
  ThemeRepository,
} from "./theme.types.js";

type JsonObject = Record<string, unknown>;

const sourceSelection = {
  accountId: articles.accountId,
  articleId: articles.id,
  currentTextHash: articleDocuments.currentTextHash,
  document: articleDocuments.documentJson,
  documentVersion: articleDocuments.documentVersion,
  themeId: articles.themeId,
  themeVersion: articles.themeVersion,
};

function toSource(row: {
  readonly accountId: string | null;
  readonly articleId: string;
  readonly currentTextHash: string | null;
  readonly document: JsonObject;
  readonly documentVersion: number;
  readonly themeId: string | null;
  readonly themeVersion: string | null;
}): ThemeArticleSource {
  return {
    ...row,
    document: row.document as unknown as DocumentV1,
  };
}

@Injectable()
export class PostgresThemeRepository implements ThemeRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async findArticle(ownerUserId: string, articleId: string): Promise<ThemeArticleSource | null> {
    const [row] = await this.connection.db
      .select(sourceSelection)
      .from(articles)
      .innerJoin(articleDocuments, eq(articleDocuments.articleId, articles.id))
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.ownerUserId, ownerUserId),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : toSource(row);
  }

  async apply(input: ApplyThemeInput): Promise<ApplyThemeResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select(sourceSelection)
        .from(articles)
        .innerJoin(articleDocuments, eq(articleDocuments.articleId, articles.id))
        .where(
          and(
            eq(articles.id, input.articleId),
            eq(articles.ownerUserId, input.ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (row === undefined) {
        return { kind: "not_found" };
      }
      if (row.documentVersion !== input.baseDocumentVersion) {
        return { kind: "version_conflict", currentVersion: row.documentVersion };
      }

      const now = new Date();
      const lastTransactionId = createUuidV7();
      const themedDocument: DocumentV1 = {
        ...(row.document as unknown as DocumentV1),
        themeId: input.themeId,
        themeVersion: input.themeVersion,
      };
      const [updatedDocument] = await transaction
        .update(articleDocuments)
        .set({
          documentJson: themedDocument as unknown as JsonObject,
          documentVersion: input.baseDocumentVersion + 1,
          lastTransactionId,
          lastSavedBy: input.context.actorUserId,
          lastSavedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(articleDocuments.articleId, input.articleId),
            eq(articleDocuments.documentVersion, input.baseDocumentVersion),
          ),
        )
        .returning({ documentVersion: articleDocuments.documentVersion });
      if (updatedDocument === undefined) {
        return { kind: "version_conflict", currentVersion: row.documentVersion };
      }

      await transaction
        .update(articles)
        .set({
          currentSnapshotId: null,
          paletteId: input.paletteId,
          themeId: input.themeId,
          themeVersion: input.themeVersion,
          updatedAt: now,
        })
        .where(and(eq(articles.id, input.articleId), eq(articles.ownerUserId, input.ownerUserId)));

      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.theme.apply",
        targetType: "article",
        targetId: input.articleId,
        accountId: row.accountId,
        articleId: input.articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: {
          documentVersion: row.documentVersion,
          themeId: row.themeId,
          themeVersion: row.themeVersion,
        },
        afterSummary: {
          documentVersion: updatedDocument.documentVersion,
          paletteId: input.paletteId,
          themeId: input.themeId,
          themeVersion: input.themeVersion,
        },
        metadataJson: {
          currentTextHash: row.currentTextHash,
          originalTextUnchanged: true,
        },
      });

      return {
        kind: "applied",
        appliedAt: now,
        documentVersion: updatedDocument.documentVersion,
        lastTransactionId,
      };
    });
  }
}
