import { Inject, Injectable } from "@nestjs/common";
import {
  articles,
  articleStatusHistory,
  auditLogs,
  createUuidV7,
  sourceDocuments,
  type DatabaseConnection,
} from "@wechat-layout/database";
import { and, eq, isNull } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import type {
  CreatePendingWebpageImportInput,
  PendingWebpageImport,
  WebpageImportRepository,
} from "./webpage-import.types.js";

function initialTitle(rawUrl: string): string {
  const url = new URL(rawUrl);
  return `${url.hostname} 网页导入`.slice(0, 500);
}

@Injectable()
export class PostgresWebpageImportRepository implements WebpageImportRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async createPending(input: CreatePendingWebpageImportInput): Promise<PendingWebpageImport> {
    return this.connection.db.transaction(async (transaction) => {
      const now = new Date();
      const articleId = createUuidV7();
      const sourceDocumentId = createUuidV7();
      await transaction.insert(articles).values({
        id: articleId,
        ownerUserId: input.ownerUserId,
        accountId: input.accountId,
        title: initialTitle(input.url),
        contentType: input.contentType,
        sourceType: "web",
        status: "pending_import",
        layoutStrength: input.layoutStrength,
        textLocked: true,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(sourceDocuments).values({
        id: sourceDocumentId,
        articleId,
        sourceType: "web",
        originalUrl: input.url,
        sourceMetadata: {
          cleaningMode: input.cleaningMode,
          detectedSource: "web",
          documentSourceType: "html",
          intermediateSchemaVersion: "1.0.0",
          requestedUrl: input.url,
        },
        isPrimary: true,
        createdAt: now,
      });
      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId,
        fromStatus: null,
        toStatus: "pending_import",
        reason: "webpage_import_requested",
        source: "import",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.import.webpage.request",
        targetType: "source_document",
        targetId: sourceDocumentId,
        accountId: input.accountId,
        articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: null,
        afterSummary: {
          requestedUrl: input.url,
          cleaningMode: input.cleaningMode,
          status: "pending_import",
        },
        metadataJson: {},
        createdAt: now,
      });
      return { articleId, sourceDocumentId };
    });
  }

  async attachJob(sourceDocumentId: string, jobId: string): Promise<void> {
    const [updated] = await this.connection.db
      .update(sourceDocuments)
      .set({ importJobId: jobId })
      .where(and(eq(sourceDocuments.id, sourceDocumentId), isNull(sourceDocuments.importJobId)))
      .returning({ id: sourceDocuments.id });
    if (updated === undefined) throw new Error("网页原文记录无法关联任务");
  }

  async markEnqueueFailed(
    articleId: string,
    context: CreatePendingWebpageImportInput["context"],
  ): Promise<void> {
    const now = new Date();
    await this.connection.db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(articles)
        .set({ status: "import_failed", updatedAt: now })
        .where(and(eq(articles.id, articleId), eq(articles.status, "pending_import")))
        .returning({ id: articles.id, accountId: articles.accountId });
      if (updated === undefined) return;
      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId,
        fromStatus: "pending_import",
        toStatus: "import_failed",
        reason: "webpage_queue_enqueue_failed",
        source: "import",
        createdBy: context.actorUserId,
        createdAt: now,
      });
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: context.actorUserId,
        actorType: "user",
        action: "article.import.webpage.enqueue_failed",
        targetType: "article",
        targetId: articleId,
        accountId: updated.accountId,
        articleId,
        requestId: context.requestId,
        traceId: context.traceId,
        beforeSummary: { status: "pending_import" },
        afterSummary: { status: "import_failed" },
        metadataJson: {},
        createdAt: now,
      });
    });
  }
}
