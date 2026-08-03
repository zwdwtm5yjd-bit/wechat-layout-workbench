import { Inject, Injectable } from "@nestjs/common";
import {
  articleResources,
  articles,
  auditLogs,
  createUuidV7,
  type Database,
  type DatabaseConnection,
  resources,
  sourceDocuments,
  users,
} from "@wechat-layout/database";
import { and, eq, getTableColumns, isNull } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import { RESOURCE_TRASH_RETENTION_DAYS } from "./resource.constants.js";
import type {
  CreateValidatedResourceInput,
  ResourceMetadata,
  ResourceRecord,
  ResourceReference,
  ResourceRepository,
  TrashResourceResult,
} from "./resource.types.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function recordFromRow(row: typeof resources.$inferSelect): ResourceRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    accountId: row.accountId,
    resourceType: row.resourceType,
    sourceType: row.sourceType,
    originalFilename: row.originalFilename,
    storageProvider: row.storageProvider,
    storageBucket: row.storageBucket,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    fileExtension: row.fileExtension,
    fileSize: row.fileSize,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    status: row.status,
    isPrivate: row.isPrivate,
    metadata: row.metadataJson as ResourceMetadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    purgeAfter: row.purgeAfter,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { readonly code?: unknown; readonly cause?: unknown };
  return candidate.code === "23505" || isUniqueViolation(candidate.cause);
}

async function referenceRows(
  database: Database | Transaction,
  resourceId: string,
): Promise<ResourceReference[]> {
  const [articleRows, sourceRows, avatarRows, childRows] = await Promise.all([
    database
      .select({
        id: articleResources.id,
        label: articles.title,
        usageType: articleResources.usageType,
        blockId: articleResources.blockId,
      })
      .from(articleResources)
      .innerJoin(articles, eq(articles.id, articleResources.articleId))
      .where(and(eq(articleResources.resourceId, resourceId), isNull(articleResources.deletedAt))),
    database
      .select({
        id: sourceDocuments.id,
        label: articles.title,
      })
      .from(sourceDocuments)
      .innerJoin(articles, eq(articles.id, sourceDocuments.articleId))
      .where(eq(sourceDocuments.originalResourceId, resourceId)),
    database
      .select({
        id: users.id,
        label: users.displayName,
      })
      .from(users)
      .where(and(eq(users.avatarResourceId, resourceId), isNull(users.deletedAt))),
    database
      .select({
        id: resources.id,
        label: resources.originalFilename,
      })
      .from(resources)
      .where(and(eq(resources.parentResourceId, resourceId), isNull(resources.deletedAt))),
  ]);

  return [
    ...articleRows.map((row): ResourceReference => ({
      kind: "article",
      id: row.id,
      label: row.label,
      usageType: row.usageType,
      blockId: row.blockId,
    })),
    ...sourceRows.map((row): ResourceReference => ({
      kind: "source_document",
      id: row.id,
      label: row.label,
      usageType: "original",
      blockId: null,
    })),
    ...avatarRows.map((row): ResourceReference => ({
      kind: "avatar",
      id: row.id,
      label: row.label,
      usageType: "avatar",
      blockId: null,
    })),
    ...childRows.map((row): ResourceReference => ({
      kind: "derived_resource",
      id: row.id,
      label: row.label ?? row.id,
      usageType: "parent",
      blockId: null,
    })),
  ];
}

@Injectable()
export class PostgresResourceRepository implements ResourceRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async findActiveByOwnerHash(ownerUserId: string, sha256: string): Promise<ResourceRecord | null> {
    const [row] = await this.connection.db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.ownerUserId, ownerUserId),
          eq(resources.sha256, sha256),
          isNull(resources.deletedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : recordFromRow(row);
  }

  async findOwnedById(ownerUserId: string, resourceId: string): Promise<ResourceRecord | null> {
    const [row] = await this.connection.db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.id, resourceId),
          eq(resources.ownerUserId, ownerUserId),
          isNull(resources.deletedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : recordFromRow(row);
  }

  async createValidated(input: CreateValidatedResourceInput): Promise<ResourceRecord> {
    const now = new Date();
    const resourceId = createUuidV7();
    try {
      const created = await this.connection.db.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(resources)
          .values({
            id: resourceId,
            ownerUserId: input.ownerUserId,
            accountId: input.accountId,
            resourceType: input.resourceType,
            sourceType: "upload",
            originalFilename: input.filename,
            storageProvider: input.storageProvider,
            storageBucket: input.storageBucket,
            storageKey: input.storageKey,
            mimeType: input.mimeType,
            fileExtension: input.fileExtension,
            fileSize: input.fileSize,
            width: input.width,
            height: input.height,
            sha256: input.sha256,
            status: "active",
            isPrivate: true,
            metadataJson: input.metadata as unknown as Record<string, unknown>,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (row === undefined) {
          throw new Error("资源元数据创建失败");
        }
        await transaction.insert(auditLogs).values({
          id: createUuidV7(),
          actorUserId: input.context.actorUserId,
          actorType: "user",
          action: "resource.upload.complete",
          targetType: "resource",
          targetId: resourceId,
          accountId: input.accountId,
          requestId: input.context.requestId,
          traceId: input.context.traceId,
          beforeSummary: null,
          afterSummary: {
            mimeType: input.mimeType,
            resourceType: input.resourceType,
            fileSize: input.fileSize,
            width: input.width,
            height: input.height,
            sha256: input.sha256,
            status: "active",
            isPrivate: true,
          },
          metadataJson: {},
          createdAt: now,
        });
        return row;
      });
      return recordFromRow(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.findActiveByOwnerHash(input.ownerUserId, input.sha256);
        if (existing !== null) {
          return existing;
        }
      }
      throw error;
    }
  }

  async listReferences(
    ownerUserId: string,
    resourceId: string,
  ): Promise<readonly ResourceReference[] | null> {
    const resource = await this.findOwnedById(ownerUserId, resourceId);
    if (resource === null) {
      return null;
    }
    return referenceRows(this.connection.db, resourceId);
  }

  async trashIfUnreferenced(
    ownerUserId: string,
    resourceId: string,
    context: CreateValidatedResourceInput["context"],
  ): Promise<TrashResourceResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({ ...getTableColumns(resources) })
        .from(resources)
        .where(
          and(
            eq(resources.id, resourceId),
            eq(resources.ownerUserId, ownerUserId),
            isNull(resources.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (row === undefined) {
        return { kind: "not_found" };
      }

      const references = await referenceRows(transaction, resourceId);
      if (references.length > 0) {
        return { kind: "in_use", references };
      }

      const now = new Date();
      const purgeAfter = new Date(
        now.valueOf() + RESOURCE_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
      );
      const [trashed] = await transaction
        .update(resources)
        .set({
          status: "trash",
          deletedAt: now,
          purgeAfter,
          updatedAt: now,
        })
        .where(eq(resources.id, resourceId))
        .returning();
      if (trashed === undefined) {
        throw new Error("资源移入回收站失败");
      }
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: context.actorUserId,
        actorType: "user",
        action: "resource.trash",
        targetType: "resource",
        targetId: resourceId,
        accountId: row.accountId,
        requestId: context.requestId,
        traceId: context.traceId,
        beforeSummary: {
          status: row.status,
          deletedAt: row.deletedAt?.toISOString() ?? null,
        },
        afterSummary: {
          status: "trash",
          deletedAt: now.toISOString(),
          purgeAfter: purgeAfter.toISOString(),
        },
        metadataJson: {},
        createdAt: now,
      });
      return { kind: "trashed", resource: recordFromRow(trashed) };
    });
  }
}
