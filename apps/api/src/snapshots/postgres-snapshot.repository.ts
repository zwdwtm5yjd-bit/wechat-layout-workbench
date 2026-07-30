import { Inject, Injectable } from "@nestjs/common";
import {
  articleDocuments,
  articles,
  articleSnapshots,
  auditLogs,
  createUuidV7,
  type DatabaseConnection,
} from "@wechat-layout/database";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import { statisticsForDocument } from "../documents/document-statistics.js";
import { buildSnapshotManifests } from "./snapshot-manifest.js";
import type {
  ArticleSnapshotRecord,
  CreateSnapshotInput,
  CreateSnapshotResult,
  RestoreSnapshotInput,
  RestoreSnapshotResult,
  SnapshotListResult,
  SnapshotPackageManifestEntry,
  SnapshotReason,
  SnapshotRepository,
  SnapshotResourceManifestEntry,
} from "./snapshot.types.js";

type JsonObject = Record<string, unknown>;
type JsonValue = JsonObject | readonly unknown[];
type SnapshotTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

interface ArticleState {
  readonly id: string;
  readonly accountId: string | null;
  readonly themeId: string | null;
  readonly themeVersion: string | null;
  readonly brandVersionId: string | null;
  readonly compatibilityScore: number | null;
  readonly currentSnapshotId: string | null;
}

interface DocumentState {
  readonly id: string;
  readonly schemaVersion: string;
  readonly document: DocumentV1;
  readonly documentVersion: number;
  readonly currentTextHash: string | null;
  readonly lastTransactionId: string | null;
  readonly lastSavedAt: Date;
}

const snapshotSelection = {
  id: articleSnapshots.id,
  articleId: articleSnapshots.articleId,
  snapshotNumber: articleSnapshots.snapshotNumber,
  reason: articleSnapshots.reason,
  documentSchemaVersion: articleSnapshots.documentSchemaVersion,
  document: articleSnapshots.documentJson,
  themeId: articleSnapshots.themeId,
  themeVersion: articleSnapshots.themeVersion,
  brandVersionId: articleSnapshots.brandVersionId,
  compatibilityRuleVersion: articleSnapshots.compatibilityRuleVersion,
  rendererVersion: articleSnapshots.rendererVersion,
  resourceManifest: articleSnapshots.resourceManifest,
  packageManifest: articleSnapshots.packageManifest,
  textHash: articleSnapshots.textHash,
  compatibilityScore: articleSnapshots.compatibilityScore,
  htmlHash: articleSnapshots.htmlHash,
  note: articleSnapshots.note,
  createdBy: articleSnapshots.createdBy,
  createdAt: articleSnapshots.createdAt,
  currentSnapshotId: articles.currentSnapshotId,
};

function toSnapshotRecord(row: {
  readonly id: string;
  readonly articleId: string;
  readonly snapshotNumber: number;
  readonly reason: string;
  readonly documentSchemaVersion: string;
  readonly document: JsonObject;
  readonly themeId: string | null;
  readonly themeVersion: string | null;
  readonly brandVersionId: string | null;
  readonly compatibilityRuleVersion: string | null;
  readonly rendererVersion: string | null;
  readonly resourceManifest: JsonValue;
  readonly packageManifest: JsonValue;
  readonly textHash: string | null;
  readonly compatibilityScore: number | null;
  readonly htmlHash: string | null;
  readonly note: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly currentSnapshotId: string | null;
}): ArticleSnapshotRecord {
  return {
    id: row.id,
    articleId: row.articleId,
    snapshotNumber: row.snapshotNumber,
    reason: row.reason as SnapshotReason,
    documentSchemaVersion: row.documentSchemaVersion,
    document: row.document as unknown as DocumentV1,
    themeId: row.themeId,
    themeVersion: row.themeVersion,
    brandVersionId: row.brandVersionId,
    compatibilityRuleVersion: row.compatibilityRuleVersion,
    rendererVersion: row.rendererVersion,
    resourceManifest: row.resourceManifest as unknown as readonly SnapshotResourceManifestEntry[],
    packageManifest: row.packageManifest as unknown as readonly SnapshotPackageManifestEntry[],
    textHash: row.textHash,
    compatibilityScore: row.compatibilityScore,
    htmlHash: row.htmlHash,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    isCurrent: row.currentSnapshotId === row.id,
  };
}

async function nextSnapshotNumber(
  transaction: SnapshotTransaction,
  articleId: string,
): Promise<number> {
  const [latest] = await transaction
    .select({ snapshotNumber: articleSnapshots.snapshotNumber })
    .from(articleSnapshots)
    .where(eq(articleSnapshots.articleId, articleId))
    .orderBy(desc(articleSnapshots.snapshotNumber))
    .limit(1);
  return (latest?.snapshotNumber ?? 0) + 1;
}

async function insertSnapshot(
  transaction: SnapshotTransaction,
  input: {
    readonly id: string;
    readonly article: ArticleState;
    readonly document: DocumentV1;
    readonly documentSchemaVersion: string;
    readonly snapshotNumber: number;
    readonly reason: SnapshotReason;
    readonly note: string | null;
    readonly createdBy: string;
    readonly createdAt: Date;
    readonly textHash: string | null;
    readonly resourceManifest?: readonly SnapshotResourceManifestEntry[];
    readonly packageManifest?: readonly SnapshotPackageManifestEntry[];
    readonly themeId?: string | null;
    readonly themeVersion?: string | null;
    readonly brandVersionId?: string | null;
    readonly compatibilityScore?: number | null;
  },
): Promise<ArticleSnapshotRecord> {
  const generatedManifests = buildSnapshotManifests(input.document, input.article);
  const resourceManifest = input.resourceManifest ?? generatedManifests.resourceManifest;
  const packageManifest = input.packageManifest ?? generatedManifests.packageManifest;
  const themeId = input.themeId === undefined ? input.article.themeId : input.themeId;
  const themeVersion =
    input.themeVersion === undefined ? input.article.themeVersion : input.themeVersion;
  const brandVersionId =
    input.brandVersionId === undefined ? input.article.brandVersionId : input.brandVersionId;
  const compatibilityScore =
    input.compatibilityScore === undefined
      ? input.article.compatibilityScore
      : input.compatibilityScore;

  const [inserted] = await transaction
    .insert(articleSnapshots)
    .values({
      id: input.id,
      articleId: input.article.id,
      snapshotNumber: input.snapshotNumber,
      reason: input.reason,
      documentSchemaVersion: input.documentSchemaVersion,
      documentJson: input.document as unknown as JsonObject,
      themeId,
      themeVersion,
      brandVersionId,
      resourceManifest: resourceManifest as unknown as JsonValue,
      packageManifest: packageManifest as unknown as JsonValue,
      textHash: input.textHash,
      compatibilityScore,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
    })
    .returning();

  if (inserted === undefined) {
    throw new Error("快照创建失败");
  }

  return toSnapshotRecord({
    ...inserted,
    document: inserted.documentJson,
    currentSnapshotId: input.id,
  });
}

function auditSummary(snapshot: ArticleSnapshotRecord): JsonObject {
  return {
    snapshotId: snapshot.id,
    snapshotNumber: snapshot.snapshotNumber,
    reason: snapshot.reason,
    documentSchemaVersion: snapshot.documentSchemaVersion,
    textHash: snapshot.textHash,
  };
}

@Injectable()
export class PostgresSnapshotRepository implements SnapshotRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async list(
    ownerUserId: string,
    articleId: string,
    page: number,
    pageSize: number,
  ): Promise<SnapshotListResult | null> {
    const [article] = await this.connection.db
      .select({ id: articles.id })
      .from(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.ownerUserId, ownerUserId),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);
    if (article === undefined) {
      return null;
    }

    const where = eq(articleSnapshots.articleId, articleId);
    const [rows, totalRows] = await Promise.all([
      this.connection.db
        .select(snapshotSelection)
        .from(articleSnapshots)
        .innerJoin(articles, eq(articles.id, articleSnapshots.articleId))
        .where(where)
        .orderBy(desc(articleSnapshots.createdAt), desc(articleSnapshots.snapshotNumber))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.connection.db.select({ total: count() }).from(articleSnapshots).where(where),
    ]);

    return {
      items: rows.map(toSnapshotRecord),
      total: totalRows[0]?.total ?? 0,
    };
  }

  async find(
    ownerUserId: string,
    articleId: string,
    snapshotId: string,
  ): Promise<ArticleSnapshotRecord | null> {
    const [row] = await this.connection.db
      .select(snapshotSelection)
      .from(articleSnapshots)
      .innerJoin(articles, eq(articles.id, articleSnapshots.articleId))
      .where(
        and(
          eq(articleSnapshots.id, snapshotId),
          eq(articleSnapshots.articleId, articleId),
          eq(articles.ownerUserId, ownerUserId),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : toSnapshotRecord(row);
  }

  async create(input: CreateSnapshotInput): Promise<CreateSnapshotResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [article] = await transaction
        .select({
          id: articles.id,
          accountId: articles.accountId,
          themeId: articles.themeId,
          themeVersion: articles.themeVersion,
          brandVersionId: articles.brandVersionId,
          compatibilityScore: articles.compatibilityScore,
          currentSnapshotId: articles.currentSnapshotId,
        })
        .from(articles)
        .where(
          and(
            eq(articles.id, input.articleId),
            eq(articles.ownerUserId, input.ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (article === undefined) {
        return { kind: "not_found" };
      }

      const [documentRow] = await transaction
        .select({
          id: articleDocuments.id,
          schemaVersion: articleDocuments.schemaVersion,
          document: articleDocuments.documentJson,
          currentTextHash: articleDocuments.currentTextHash,
        })
        .from(articleDocuments)
        .where(eq(articleDocuments.articleId, input.articleId))
        .limit(1)
        .for("update");
      if (documentRow === undefined) {
        return { kind: "not_found" };
      }

      const snapshotId = createUuidV7();
      const now = new Date();
      const snapshot = await insertSnapshot(transaction, {
        id: snapshotId,
        article,
        document: documentRow.document as unknown as DocumentV1,
        documentSchemaVersion: documentRow.schemaVersion,
        snapshotNumber: await nextSnapshotNumber(transaction, input.articleId),
        reason: input.reason,
        note: input.note,
        createdBy: input.context.actorUserId,
        createdAt: now,
        textHash: documentRow.currentTextHash,
      });

      await transaction
        .update(articles)
        .set({
          currentSnapshotId: snapshotId,
          updatedAt: now,
        })
        .where(eq(articles.id, input.articleId));
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.snapshot.create",
        targetType: "article_snapshot",
        targetId: snapshotId,
        accountId: article.accountId,
        articleId: input.articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: null,
        afterSummary: auditSummary(snapshot),
        metadataJson: {},
      });

      return {
        kind: "created",
        snapshot,
      };
    });
  }

  async restore(input: RestoreSnapshotInput): Promise<RestoreSnapshotResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [article] = await transaction
        .select({
          id: articles.id,
          accountId: articles.accountId,
          themeId: articles.themeId,
          themeVersion: articles.themeVersion,
          brandVersionId: articles.brandVersionId,
          compatibilityScore: articles.compatibilityScore,
          currentSnapshotId: articles.currentSnapshotId,
        })
        .from(articles)
        .where(
          and(
            eq(articles.id, input.articleId),
            eq(articles.ownerUserId, input.ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (article === undefined) {
        return { kind: "not_found" };
      }

      const [documentRow] = await transaction
        .select({
          id: articleDocuments.id,
          schemaVersion: articleDocuments.schemaVersion,
          document: articleDocuments.documentJson,
          documentVersion: articleDocuments.documentVersion,
          currentTextHash: articleDocuments.currentTextHash,
          lastTransactionId: articleDocuments.lastTransactionId,
          lastSavedAt: articleDocuments.lastSavedAt,
        })
        .from(articleDocuments)
        .where(eq(articleDocuments.articleId, input.articleId))
        .limit(1)
        .for("update");
      if (documentRow === undefined) {
        return { kind: "not_found" };
      }
      const currentDocument: DocumentState = {
        ...documentRow,
        document: documentRow.document as unknown as DocumentV1,
      };
      if (currentDocument.documentVersion !== input.baseVersion) {
        return {
          kind: "conflict",
          currentVersion: currentDocument.documentVersion,
          lastTransactionId: currentDocument.lastTransactionId,
          lastSavedAt: currentDocument.lastSavedAt,
        };
      }

      const [targetRow] = await transaction
        .select(snapshotSelection)
        .from(articleSnapshots)
        .innerJoin(articles, eq(articles.id, articleSnapshots.articleId))
        .where(
          and(
            eq(articleSnapshots.id, input.snapshotId),
            eq(articleSnapshots.articleId, input.articleId),
          ),
        )
        .limit(1);
      if (targetRow === undefined) {
        return { kind: "not_found" };
      }
      const target = toSnapshotRecord(targetRow);
      const now = new Date();
      const restoredDocument: DocumentV1 = {
        ...target.document,
        documentId: currentDocument.id,
        articleId: input.articleId,
        accountId: article.accountId,
        meta: {
          ...target.document.meta,
          updatedAt: now.toISOString(),
        },
      };
      const statistics = statisticsForDocument(restoredDocument);
      const [updatedDocument] = await transaction
        .update(articleDocuments)
        .set({
          schemaVersion: target.documentSchemaVersion,
          documentJson: restoredDocument as unknown as JsonObject,
          documentVersion: currentDocument.documentVersion + 1,
          currentTextHash: statistics.currentTextHash,
          lastTransactionId: input.lastTransactionId,
          lastSavedBy: input.context.actorUserId,
          lastSavedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(articleDocuments.id, currentDocument.id),
            eq(articleDocuments.documentVersion, input.baseVersion),
          ),
        )
        .returning({ documentVersion: articleDocuments.documentVersion });
      if (updatedDocument === undefined) {
        return {
          kind: "conflict",
          currentVersion: currentDocument.documentVersion,
          lastTransactionId: currentDocument.lastTransactionId,
          lastSavedAt: currentDocument.lastSavedAt,
        };
      }

      const firstSnapshotNumber = await nextSnapshotNumber(transaction, input.articleId);
      const safetySnapshot = await insertSnapshot(transaction, {
        id: createUuidV7(),
        article,
        document: currentDocument.document,
        documentSchemaVersion: currentDocument.schemaVersion,
        snapshotNumber: firstSnapshotNumber,
        reason: "before_restore",
        note: `恢复版本 #${target.snapshotNumber} 前自动保存`,
        createdBy: input.context.actorUserId,
        createdAt: now,
        textHash: currentDocument.currentTextHash,
      });
      const restoredSnapshotId = createUuidV7();
      const restoredSnapshot = await insertSnapshot(transaction, {
        id: restoredSnapshotId,
        article,
        document: restoredDocument,
        documentSchemaVersion: target.documentSchemaVersion,
        snapshotNumber: firstSnapshotNumber + 1,
        reason: "restored",
        note: `由版本 #${target.snapshotNumber} 恢复`,
        createdBy: input.context.actorUserId,
        createdAt: now,
        textHash: statistics.currentTextHash,
        resourceManifest: target.resourceManifest,
        packageManifest: target.packageManifest,
        themeId: target.themeId,
        themeVersion: target.themeVersion,
        brandVersionId: target.brandVersionId,
        compatibilityScore: target.compatibilityScore,
      });

      await transaction
        .update(articles)
        .set({
          themeId: target.themeId,
          themeVersion: target.themeVersion,
          brandVersionId: target.brandVersionId,
          compatibilityScore: target.compatibilityScore,
          wordCount: statistics.wordCount,
          imageCount: statistics.imageCount,
          svgCount: statistics.svgCount,
          currentSnapshotId: restoredSnapshotId,
          updatedAt: now,
        })
        .where(eq(articles.id, input.articleId));
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.snapshot.restore",
        targetType: "article_snapshot",
        targetId: input.snapshotId,
        accountId: article.accountId,
        articleId: input.articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: {
          documentVersion: currentDocument.documentVersion,
          safetySnapshotId: safetySnapshot.id,
          textHash: currentDocument.currentTextHash,
        },
        afterSummary: {
          documentVersion: updatedDocument.documentVersion,
          restoredSnapshotId,
          restoredFromSnapshotId: input.snapshotId,
          textHash: statistics.currentTextHash,
        },
        metadataJson: {
          lastTransactionId: input.lastTransactionId,
        },
      });

      return {
        kind: "restored",
        documentVersion: updatedDocument.documentVersion,
        lastTransactionId: input.lastTransactionId,
        lastSavedAt: now,
        safetySnapshot: {
          ...safetySnapshot,
          isCurrent: false,
        },
        restoredSnapshot,
      };
    });
  }
}
