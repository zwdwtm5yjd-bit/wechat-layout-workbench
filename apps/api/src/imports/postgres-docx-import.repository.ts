import { Inject, Injectable } from "@nestjs/common";
import {
  articles,
  articleStatusHistory,
  auditLogs,
  createUuidV7,
  resources,
  sourceDocuments,
  type DatabaseConnection,
} from "@wechat-layout/database";
import { and, eq, isNull } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import type {
  CreatePendingDocxImportInput,
  CreatePendingDocxImportResult,
  DocxImportRepository,
} from "./docx-import.types.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function titleFromFilename(filename: string | null): string {
  const title = filename?.replace(/\.docx$/i, "").trim();
  return title ? title.slice(0, 500) : "未命名 DOCX 导入";
}

@Injectable()
export class PostgresDocxImportRepository implements DocxImportRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async createPending(input: CreatePendingDocxImportInput): Promise<CreatePendingDocxImportResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [resource] = await transaction
        .select({
          id: resources.id,
          accountId: resources.accountId,
          filename: resources.originalFilename,
          mimeType: resources.mimeType,
          resourceType: resources.resourceType,
          sha256: resources.sha256,
          status: resources.status,
        })
        .from(resources)
        .where(
          and(
            eq(resources.id, input.resourceId),
            eq(resources.ownerUserId, input.ownerUserId),
            isNull(resources.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (resource === undefined) return { kind: "resource_not_found" };
      if (
        resource.resourceType !== "document" ||
        resource.mimeType !== DOCX_MIME ||
        resource.status !== "active"
      ) {
        return { kind: "resource_invalid" };
      }

      const now = new Date();
      const articleId = createUuidV7();
      const sourceDocumentId = createUuidV7();
      await transaction.insert(articles).values({
        id: articleId,
        ownerUserId: input.ownerUserId,
        accountId: input.accountId,
        title: titleFromFilename(resource.filename),
        contentType: input.contentType,
        sourceType: "docx",
        status: "pending_import",
        layoutStrength: input.layoutStrength,
        textLocked: true,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(sourceDocuments).values({
        id: sourceDocumentId,
        articleId,
        sourceType: "docx",
        originalResourceId: resource.id,
        originalText: null,
        originalTextHash: null,
        sourceMetadata: {
          cleaningMode: input.cleaningMode,
          intermediateSchemaVersion: "1.0.0",
          originalFilename: resource.filename,
          originalSha256: resource.sha256,
        },
        isPrimary: true,
        createdAt: now,
      });
      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId,
        fromStatus: null,
        toStatus: "pending_import",
        reason: "docx_import_requested",
        source: "import",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.import.docx.request",
        targetType: "source_document",
        targetId: sourceDocumentId,
        accountId: input.accountId,
        articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: null,
        afterSummary: {
          resourceId: resource.id,
          resourceSha256: resource.sha256,
          cleaningMode: input.cleaningMode,
          status: "pending_import",
        },
        metadataJson: {},
        createdAt: now,
      });
      return {
        kind: "created",
        articleId,
        sourceDocumentId,
        resourceSha256: resource.sha256,
      };
    });
  }

  async attachJob(sourceDocumentId: string, jobId: string): Promise<void> {
    const [updated] = await this.connection.db
      .update(sourceDocuments)
      .set({ importJobId: jobId })
      .where(and(eq(sourceDocuments.id, sourceDocumentId), isNull(sourceDocuments.importJobId)))
      .returning({ id: sourceDocuments.id });
    if (updated === undefined) throw new Error("DOCX 原文记录无法关联任务");
  }

  async markEnqueueFailed(
    articleId: string,
    context: CreatePendingDocxImportInput["context"],
  ): Promise<void> {
    const now = new Date();
    await this.connection.db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(articles)
        .set({ status: "import_failed", updatedAt: now })
        .where(and(eq(articles.id, articleId), eq(articles.status, "pending_import")))
        .returning({ id: articles.id });
      if (updated === undefined) return;
      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId,
        fromStatus: "pending_import",
        toStatus: "import_failed",
        reason: "docx_queue_enqueue_failed",
        source: "import",
        createdBy: context.actorUserId,
        createdAt: now,
      });
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: context.actorUserId,
        actorType: "user",
        action: "article.import.docx.enqueue_failed",
        targetType: "article",
        targetId: articleId,
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
