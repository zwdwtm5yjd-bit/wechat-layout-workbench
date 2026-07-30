import { Inject, Injectable } from "@nestjs/common";
import {
  articleDocuments,
  articleSnapshots,
  articles,
  articleStatusHistory,
  auditLogs,
  createUuidV7,
  type DatabaseConnection,
} from "@wechat-layout/database";
import { DOCUMENT_SCHEMA_VERSION, type DocumentV1 } from "@wechat-layout/document-schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import { buildSnapshotManifests } from "../snapshots/snapshot-manifest.js";
import { ARTICLE_TRASH_RETENTION_DAYS } from "./article.constants.js";
import type {
  ArticleCompatibilityStatus,
  ArticleDetailRecord,
  ArticleListQuery,
  ArticleListResult,
  ArticleMutationContext,
  ArticleRecord,
  ArticleRepository,
  ArticleStatus,
  ArticleStatusHistoryRecord,
  CreateArticleInput,
  DuplicateArticleInput,
  UpdateArticleInput,
} from "./article.types.js";

type JsonObject = Record<string, unknown>;
type JsonValue = JsonObject | readonly unknown[];

function asJsonObject(value: unknown): JsonObject {
  return value as JsonObject;
}

function articleRecord<
  T extends {
    status: string;
    layoutStrength: string;
    compatibilityStatus: string | null;
  },
>(
  row: T,
): Omit<T, "status" | "layoutStrength" | "compatibilityStatus"> & {
  status: ArticleStatus;
  layoutStrength: ArticleRecord["layoutStrength"];
  compatibilityStatus: ArticleCompatibilityStatus | null;
} {
  const { status, layoutStrength, compatibilityStatus, ...record } = row;
  return {
    ...record,
    status: status as ArticleStatus,
    layoutStrength: layoutStrength as ArticleRecord["layoutStrength"],
    compatibilityStatus: compatibilityStatus as ArticleCompatibilityStatus | null,
  };
}

function articleSummary(article: {
  readonly title: string;
  readonly status: string;
  readonly accountId: string | null;
  readonly deletedAt: Date | null;
}): JsonObject {
  return {
    title: article.title,
    status: article.status,
    accountId: article.accountId,
    deletedAt: article.deletedAt?.toISOString() ?? null,
  };
}

function emptyDocument(
  documentId: string,
  articleId: string,
  accountId: string | null,
  now: Date,
): DocumentV1 {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    documentId,
    articleId,
    accountId,
    content: {
      type: "doc",
      content: [],
    },
    meta: {
      sourceType: "manual",
      textLocked: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
}

function duplicateDocument(
  source: JsonObject,
  documentId: string,
  articleId: string,
  accountId: string | null,
  now: Date,
): DocumentV1 {
  const document = source as unknown as DocumentV1;

  return {
    ...document,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    documentId,
    articleId,
    accountId,
    meta: {
      ...document.meta,
      sourceType: "manual",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
}

function escapeSearch(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function mutationAuditValues(
  article: {
    readonly id: string;
    readonly accountId: string | null;
  },
  context: ArticleMutationContext,
  action: string,
  beforeSummary: JsonObject | null,
  afterSummary: JsonObject,
): typeof auditLogs.$inferInsert {
  return {
    id: createUuidV7(),
    actorUserId: context.actorUserId,
    actorType: "user",
    action,
    targetType: "article",
    targetId: article.id,
    accountId: article.accountId,
    articleId: article.id,
    requestId: context.requestId,
    traceId: context.traceId,
    beforeSummary,
    afterSummary,
    metadataJson: {},
  };
}

@Injectable()
export class PostgresArticleRepository implements ArticleRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async list(ownerUserId: string, query: ArticleListQuery): Promise<ArticleListResult> {
    const conditions: SQL[] = [eq(articles.ownerUserId, ownerUserId)];

    if (query.status === "trash") {
      conditions.push(isNotNull(articles.deletedAt));
    } else {
      conditions.push(isNull(articles.deletedAt));
      if (query.status !== undefined) {
        conditions.push(eq(articles.status, query.status));
      }
    }
    if (query.accountId !== undefined) {
      conditions.push(eq(articles.accountId, query.accountId));
    }
    if (query.contentType !== undefined) {
      conditions.push(eq(articles.contentType, query.contentType));
    }
    if (query.themeId !== undefined) {
      conditions.push(eq(articles.themeId, query.themeId));
    }
    if (query.hasSvg !== undefined) {
      conditions.push(query.hasSvg ? gt(articles.svgCount, 0) : eq(articles.svgCount, 0));
    }
    if (query.compatibilityStatus !== undefined) {
      conditions.push(eq(articles.compatibilityStatus, query.compatibilityStatus));
    }
    if (query.search !== undefined) {
      const pattern = `%${escapeSearch(query.search.trim())}%`;
      conditions.push(or(ilike(articles.title, pattern), ilike(articles.subtitle, pattern)) as SQL);
    }

    const where = and(...conditions);
    const ordering = {
      updated_desc: desc(articles.updatedAt),
      updated_asc: asc(articles.updatedAt),
      created_desc: desc(articles.createdAt),
      title_asc: asc(articles.title),
    }[query.sort];
    const [rows, totalRows] = await Promise.all([
      this.connection.db
        .select()
        .from(articles)
        .where(where)
        .orderBy(ordering, desc(articles.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.connection.db.select({ total: count() }).from(articles).where(where),
    ]);

    return {
      items: rows.map((row) => articleRecord(row)),
      total: totalRows[0]?.total ?? 0,
    };
  }

  async findDetail(ownerUserId: string, articleId: string): Promise<ArticleDetailRecord | null> {
    const [row] = await this.connection.db
      .select({
        ...getTableColumns(articles),
        documentVersion: articleDocuments.documentVersion,
        lastSavedAt: articleDocuments.lastSavedAt,
      })
      .from(articles)
      .leftJoin(articleDocuments, eq(articleDocuments.articleId, articles.id))
      .where(and(eq(articles.id, articleId), eq(articles.ownerUserId, ownerUserId)))
      .limit(1);

    return row === undefined ? null : articleRecord(row);
  }

  async create(input: CreateArticleInput): Promise<ArticleDetailRecord> {
    const now = new Date();
    const articleId = createUuidV7();
    const documentId = createUuidV7();

    await this.connection.db.transaction(async (transaction) => {
      const [article] = await transaction
        .insert(articles)
        .values({
          id: articleId,
          ownerUserId: input.ownerUserId,
          accountId: input.accountId,
          title: input.title,
          contentType: input.contentType,
          sourceType: "blank",
          status: "pending_layout",
          layoutStrength: input.layoutStrength,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (article === undefined) {
        throw new Error("文章创建失败");
      }

      await transaction.insert(articleDocuments).values({
        id: documentId,
        articleId,
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        documentJson: asJsonObject(emptyDocument(documentId, articleId, input.accountId, now)),
        documentVersion: 1,
        lastSavedBy: input.ownerUserId,
        lastSavedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId,
        fromStatus: null,
        toStatus: "pending_layout",
        reason: "创建空白文章",
        source: "user",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      await transaction
        .insert(auditLogs)
        .values(
          mutationAuditValues(
            article,
            input.context,
            "article.create",
            null,
            articleSummary(article),
          ),
        );
    });

    const created = await this.findDetail(input.ownerUserId, articleId);
    if (created === null) {
      throw new Error("已创建的文章无法读取");
    }
    return created;
  }

  async update(
    ownerUserId: string,
    articleId: string,
    patch: UpdateArticleInput,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const now = new Date();
    const changed = await this.connection.db.transaction(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.id, articleId),
            eq(articles.ownerUserId, ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1);

      if (before === undefined) {
        return false;
      }

      const [after] = await transaction
        .update(articles)
        .set({
          ...patch,
          publishedAt:
            patch.status === "published"
              ? (before.publishedAt ?? now)
              : patch.status !== undefined && before.status === "published"
                ? null
                : before.publishedAt,
          updatedAt: now,
        })
        .where(and(eq(articles.id, articleId), eq(articles.ownerUserId, ownerUserId)))
        .returning();

      if (after === undefined) {
        return false;
      }

      if (patch.status !== undefined && patch.status !== before.status) {
        await transaction.insert(articleStatusHistory).values({
          id: createUuidV7(),
          articleId,
          fromStatus: before.status,
          toStatus: patch.status,
          reason: patch.status === "published" ? "标记为已发布" : "更新文章阶段",
          source: "user",
          createdBy: context.actorUserId,
          createdAt: now,
        });
      }
      await transaction
        .insert(auditLogs)
        .values(
          mutationAuditValues(
            after,
            context,
            "article.update",
            articleSummary(before),
            articleSummary(after),
          ),
        );
      return true;
    });

    return changed ? this.findDetail(ownerUserId, articleId) : null;
  }

  async duplicate(
    ownerUserId: string,
    articleId: string,
    input: DuplicateArticleInput,
  ): Promise<ArticleDetailRecord | null> {
    const now = new Date();
    const duplicateArticleId = createUuidV7();
    const duplicateDocumentId = createUuidV7();
    const created = await this.connection.db.transaction(async (transaction) => {
      const [sourceArticle] = await transaction
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.id, articleId),
            eq(articles.ownerUserId, ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1)
        .for("update");

      if (sourceArticle === undefined) {
        return false;
      }

      const [sourceDocument] = await transaction
        .select()
        .from(articleDocuments)
        .where(eq(articleDocuments.articleId, articleId))
        .limit(1)
        .for("update");
      if (sourceDocument === undefined) {
        throw new Error("源文章文档不存在，无法创建复制前快照");
      }

      const sourceDocumentJson = sourceDocument.documentJson as unknown as DocumentV1;
      const manifests = buildSnapshotManifests(sourceDocumentJson, sourceArticle);
      const [latestSnapshot] = await transaction
        .select({ snapshotNumber: articleSnapshots.snapshotNumber })
        .from(articleSnapshots)
        .where(eq(articleSnapshots.articleId, articleId))
        .orderBy(desc(articleSnapshots.snapshotNumber))
        .limit(1);
      const sourceSnapshotId = createUuidV7();
      const sourceSnapshotNumber = (latestSnapshot?.snapshotNumber ?? 0) + 1;
      await transaction.insert(articleSnapshots).values({
        id: sourceSnapshotId,
        articleId,
        snapshotNumber: sourceSnapshotNumber,
        reason: "before_copy",
        documentSchemaVersion: sourceDocument.schemaVersion,
        documentJson: sourceDocument.documentJson,
        themeId: sourceArticle.themeId,
        themeVersion: sourceArticle.themeVersion,
        brandVersionId: sourceArticle.brandVersionId,
        resourceManifest: manifests.resourceManifest as unknown as JsonValue,
        packageManifest: manifests.packageManifest as unknown as JsonValue,
        textHash: sourceDocument.currentTextHash,
        compatibilityScore: sourceArticle.compatibilityScore,
        note: "复制文章前自动保存",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      await transaction
        .update(articles)
        .set({
          currentSnapshotId: sourceSnapshotId,
          updatedAt: now,
        })
        .where(eq(articles.id, articleId));
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.snapshot.create",
        targetType: "article_snapshot",
        targetId: sourceSnapshotId,
        accountId: sourceArticle.accountId,
        articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: null,
        afterSummary: {
          snapshotId: sourceSnapshotId,
          snapshotNumber: sourceSnapshotNumber,
          reason: "before_copy",
          documentSchemaVersion: sourceDocument.schemaVersion,
          textHash: sourceDocument.currentTextHash,
        },
        metadataJson: {},
      });

      const targetAccountId =
        input.targetAccountId === undefined ? sourceArticle.accountId : input.targetAccountId;
      const [duplicate] = await transaction
        .insert(articles)
        .values({
          id: duplicateArticleId,
          ownerUserId,
          accountId: targetAccountId,
          contentGroupId:
            input.contentGroupMode === "same_group" ? sourceArticle.contentGroupId : null,
          title: input.title ?? `${sourceArticle.title} 副本`,
          subtitle: sourceArticle.subtitle,
          contentType: sourceArticle.contentType,
          sourceType: "copy",
          status: "pending_layout",
          themeId: sourceArticle.themeId,
          themeVersion: sourceArticle.themeVersion,
          paletteId: sourceArticle.paletteId,
          brandVersionId: sourceArticle.brandVersionId,
          layoutStrength: sourceArticle.layoutStrength,
          textLocked: sourceArticle.textLocked,
          wordCount: sourceArticle.wordCount,
          imageCount: sourceArticle.imageCount,
          svgCount: sourceArticle.svgCount,
          compatibilityScore: sourceArticle.compatibilityScore,
          compatibilityStatus: sourceArticle.compatibilityStatus,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (duplicate === undefined) {
        throw new Error("文章副本创建失败");
      }

      const document = duplicateDocument(
        sourceDocument.documentJson,
        duplicateDocumentId,
        duplicateArticleId,
        targetAccountId,
        now,
      );
      await transaction.insert(articleDocuments).values({
        id: duplicateDocumentId,
        articleId: duplicateArticleId,
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        documentJson: asJsonObject(document),
        documentVersion: 1,
        originalTextHash: sourceDocument?.originalTextHash ?? null,
        currentTextHash: sourceDocument?.currentTextHash ?? null,
        textChangeSummary: sourceDocument?.textChangeSummary ?? {},
        lastSavedBy: input.context.actorUserId,
        lastSavedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId: duplicateArticleId,
        fromStatus: null,
        toStatus: "pending_layout",
        reason: "复制文章",
        source: "copy",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      await transaction.insert(auditLogs).values(
        mutationAuditValues(duplicate, input.context, "article.duplicate", null, {
          ...articleSummary(duplicate),
          sourceArticleId: articleId,
          sourceSnapshotId,
        }),
      );
      return true;
    });

    return created ? this.findDetail(ownerUserId, duplicateArticleId) : null;
  }

  async archive(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    return this.transition(
      ownerUserId,
      articleId,
      "archived",
      "归档文章",
      "article.archive",
      context,
    );
  }

  async unarchive(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const [history] = await this.connection.db
      .select({ fromStatus: articleStatusHistory.fromStatus })
      .from(articleStatusHistory)
      .where(
        and(
          eq(articleStatusHistory.articleId, articleId),
          eq(articleStatusHistory.toStatus, "archived"),
        ),
      )
      .orderBy(desc(articleStatusHistory.createdAt))
      .limit(1);
    const previousStatus =
      history?.fromStatus === null ||
      history?.fromStatus === undefined ||
      history.fromStatus === "archived"
        ? "pending_check"
        : (history.fromStatus as ArticleStatus);

    return this.transition(
      ownerUserId,
      articleId,
      previousStatus,
      "恢复归档文章",
      "article.unarchive",
      context,
    );
  }

  async trash(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const now = new Date();
    const purgeAfter = new Date(now);
    purgeAfter.setUTCDate(purgeAfter.getUTCDate() + ARTICLE_TRASH_RETENTION_DAYS);
    const changed = await this.connection.db.transaction(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.id, articleId),
            eq(articles.ownerUserId, ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1);
      if (before === undefined) {
        return false;
      }
      const [after] = await transaction
        .update(articles)
        .set({
          deletedAt: now,
          deletePurgeAfter: purgeAfter,
          updatedAt: now,
        })
        .where(eq(articles.id, articleId))
        .returning();
      if (after === undefined) {
        return false;
      }
      await transaction
        .insert(auditLogs)
        .values(
          mutationAuditValues(
            after,
            context,
            "article.trash",
            articleSummary(before),
            articleSummary(after),
          ),
        );
      return true;
    });

    return changed ? this.findDetail(ownerUserId, articleId) : null;
  }

  async restore(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const now = new Date();
    const changed = await this.connection.db.transaction(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.id, articleId),
            eq(articles.ownerUserId, ownerUserId),
            isNotNull(articles.deletedAt),
          ),
        )
        .limit(1);
      if (before === undefined) {
        return false;
      }
      const [after] = await transaction
        .update(articles)
        .set({
          deletedAt: null,
          deletePurgeAfter: null,
          updatedAt: now,
        })
        .where(eq(articles.id, articleId))
        .returning();
      if (after === undefined) {
        return false;
      }
      await transaction
        .insert(auditLogs)
        .values(
          mutationAuditValues(
            after,
            context,
            "article.restore",
            articleSummary(before),
            articleSummary(after),
          ),
        );
      return true;
    });

    return changed ? this.findDetail(ownerUserId, articleId) : null;
  }

  async statusHistory(
    ownerUserId: string,
    articleId: string,
  ): Promise<readonly ArticleStatusHistoryRecord[] | null> {
    const [article] = await this.connection.db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.ownerUserId, ownerUserId)))
      .limit(1);
    if (article === undefined) {
      return null;
    }
    const rows = await this.connection.db
      .select()
      .from(articleStatusHistory)
      .where(eq(articleStatusHistory.articleId, articleId))
      .orderBy(desc(articleStatusHistory.createdAt), desc(articleStatusHistory.id))
      .limit(100);

    return rows.map((row) => ({
      ...row,
      fromStatus: row.fromStatus as ArticleStatus | null,
      toStatus: row.toStatus as ArticleStatus,
      source: row.source as ArticleStatusHistoryRecord["source"],
    }));
  }

  private async transition(
    ownerUserId: string,
    articleId: string,
    toStatus: ArticleStatus,
    reason: string,
    action: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const now = new Date();
    const changed = await this.connection.db.transaction(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.id, articleId),
            eq(articles.ownerUserId, ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1);
      if (before === undefined) {
        return false;
      }
      const [after] = await transaction
        .update(articles)
        .set({
          status: toStatus,
          archivedAt: toStatus === "archived" ? now : null,
          updatedAt: now,
        })
        .where(eq(articles.id, articleId))
        .returning();
      if (after === undefined) {
        return false;
      }
      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId,
        fromStatus: before.status,
        toStatus,
        reason,
        source: "user",
        createdBy: context.actorUserId,
        createdAt: now,
      });
      await transaction
        .insert(auditLogs)
        .values(
          mutationAuditValues(
            after,
            context,
            action,
            articleSummary(before),
            articleSummary(after),
          ),
        );
      return true;
    });

    return changed ? this.findDetail(ownerUserId, articleId) : null;
  }
}
