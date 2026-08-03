import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { isUuidV7 } from "@wechat-layout/database";
import { DOCUMENT_SCHEMA_VERSION, validateDocument } from "@wechat-layout/document-schema";

import { ApiException } from "../common/http/api.exception.js";
import { SNAPSHOT_REPOSITORY } from "./snapshot.constants.js";
import type {
  RestoreSnapshotResultDto,
  SnapshotDetailDto,
  SnapshotListQueryDto,
  SnapshotSummaryDto,
} from "./snapshot.dto.js";
import type {
  ArticleSnapshotRecord,
  AutomaticSnapshotReason,
  SnapshotMutationContext,
  SnapshotRepository,
} from "./snapshot.types.js";

function invalidId(path: string): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, {
    code: "VALIDATION_FAILED",
    message: "提交内容存在错误",
    details: { fields: [{ path, message: "必须是 UUIDv7" }] },
    retryable: false,
  });
}

function notFound(): ApiException {
  return new ApiException(HttpStatus.NOT_FOUND, {
    code: "SNAPSHOT_NOT_FOUND",
    message: "文章或快照不存在",
    retryable: false,
  });
}

function invalidSnapshot(): ApiException {
  return new ApiException(HttpStatus.CONFLICT, {
    code: "SNAPSHOT_INVALID",
    message: "快照文档已损坏或版本不受支持，未修改当前文章",
    retryable: false,
  });
}

function unavailableResources(references: readonly { readonly path: string }[]): ApiException {
  return new ApiException(HttpStatus.CONFLICT, {
    code: "SNAPSHOT_RESOURCES_UNAVAILABLE",
    message: "快照包含不存在、不可用或不属于当前用户的资源，未修改当前文章",
    details: {
      fields: references.map((reference) => ({
        path: `document${reference.path}`,
        message: "资源不存在、不可用或不属于当前用户",
      })),
    },
    retryable: false,
  });
}

function versionConflict(
  articleId: string,
  submittedVersion: number,
  currentVersion: number,
  lastTransactionId: string | null,
  lastSavedAt: Date,
): ApiException {
  return new ApiException(HttpStatus.CONFLICT, {
    code: "ARTICLE_VERSION_CONFLICT",
    message: "文章已在其他标签页更新，未执行快照恢复",
    details: {
      articleId,
      currentVersion,
      submittedVersion,
      lastTransactionId,
      lastSavedAt: lastSavedAt.toISOString(),
    },
    retryable: false,
  });
}

function validateId(value: string, path: string): void {
  if (!isUuidV7(value)) {
    throw invalidId(path);
  }
}

function toSummary(snapshot: ArticleSnapshotRecord): SnapshotSummaryDto {
  return {
    id: snapshot.id,
    articleId: snapshot.articleId,
    snapshotNumber: snapshot.snapshotNumber,
    reason: snapshot.reason,
    documentSchemaVersion: snapshot.documentSchemaVersion,
    themeId: snapshot.themeId,
    themeVersion: snapshot.themeVersion,
    brandVersionId: snapshot.brandVersionId,
    compatibilityScore: snapshot.compatibilityScore,
    note: snapshot.note,
    resourceCount: snapshot.resourceManifest.length,
    packageCount: snapshot.packageManifest.length,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt.toISOString(),
    isCurrent: snapshot.isCurrent,
  };
}

function toDetail(snapshot: ArticleSnapshotRecord): SnapshotDetailDto {
  return {
    ...toSummary(snapshot),
    document: snapshot.document as unknown as Readonly<Record<string, unknown>>,
    resourceManifest: snapshot.resourceManifest.map((entry) => ({
      resourceId: entry.resourceId,
      references: entry.references.map((reference) => ({ ...reference })),
    })),
    packageManifest: snapshot.packageManifest.map((entry) => ({ ...entry })),
    textHash: snapshot.textHash,
    compatibilityRuleVersion: snapshot.compatibilityRuleVersion,
    rendererVersion: snapshot.rendererVersion,
    htmlHash: snapshot.htmlHash,
  };
}

@Injectable()
export class SnapshotService {
  constructor(
    @Inject(SNAPSHOT_REPOSITORY)
    private readonly repository: SnapshotRepository,
  ) {}

  async list(ownerUserId: string, articleId: string, query: SnapshotListQueryDto) {
    validateId(articleId, "articleId");
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.repository.list(ownerUserId, articleId, page, pageSize);
    if (result === null) {
      throw notFound();
    }
    return {
      items: result.items.map(toSummary),
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
      },
    };
  }

  async get(
    ownerUserId: string,
    articleId: string,
    snapshotId: string,
  ): Promise<SnapshotDetailDto> {
    validateId(articleId, "articleId");
    validateId(snapshotId, "snapshotId");
    const snapshot = await this.repository.find(ownerUserId, articleId, snapshotId);
    if (snapshot === null) {
      throw notFound();
    }
    return toDetail(snapshot);
  }

  preview(ownerUserId: string, articleId: string, snapshotId: string): Promise<SnapshotDetailDto> {
    return this.get(ownerUserId, articleId, snapshotId);
  }

  async createManual(
    ownerUserId: string,
    articleId: string,
    note: string | null,
    context: SnapshotMutationContext,
  ): Promise<SnapshotDetailDto> {
    return this.create(ownerUserId, articleId, "manual", note, context);
  }

  async createAutomatic(
    ownerUserId: string,
    articleId: string,
    reason: AutomaticSnapshotReason,
    note: string | null,
    context: SnapshotMutationContext,
  ): Promise<SnapshotDetailDto> {
    return this.create(ownerUserId, articleId, reason, note, context);
  }

  async restore(
    ownerUserId: string,
    articleId: string,
    snapshotId: string,
    baseVersion: number,
    lastTransactionId: string,
    context: SnapshotMutationContext,
  ): Promise<RestoreSnapshotResultDto> {
    validateId(articleId, "articleId");
    validateId(snapshotId, "snapshotId");

    const target = await this.repository.find(ownerUserId, articleId, snapshotId);
    if (target === null) {
      throw notFound();
    }
    const validation = validateDocument(target.document);
    if (
      !validation.success ||
      target.documentSchemaVersion !== DOCUMENT_SCHEMA_VERSION ||
      validation.data.schemaVersion !== target.documentSchemaVersion ||
      validation.data.articleId !== articleId
    ) {
      throw invalidSnapshot();
    }

    const result = await this.repository.restore({
      ownerUserId,
      articleId,
      snapshotId,
      baseVersion,
      lastTransactionId,
      context,
    });
    if (result.kind === "not_found") {
      throw notFound();
    }
    if (result.kind === "invalid_resources") {
      throw unavailableResources(result.invalidReferences);
    }
    if (result.kind === "conflict") {
      throw versionConflict(
        articleId,
        baseVersion,
        result.currentVersion,
        result.lastTransactionId,
        result.lastSavedAt,
      );
    }
    return {
      restoredFromSnapshotId: snapshotId,
      documentVersion: result.documentVersion,
      lastTransactionId: result.lastTransactionId,
      lastSavedAt: result.lastSavedAt.toISOString(),
      safetySnapshot: toSummary(result.safetySnapshot),
      restoredSnapshot: toSummary(result.restoredSnapshot),
    };
  }

  private async create(
    ownerUserId: string,
    articleId: string,
    reason: "manual" | AutomaticSnapshotReason,
    note: string | null,
    context: SnapshotMutationContext,
  ): Promise<SnapshotDetailDto> {
    validateId(articleId, "articleId");
    const result = await this.repository.create({
      ownerUserId,
      articleId,
      reason,
      note,
      context,
    });
    if (result.kind === "not_found") {
      throw notFound();
    }
    if (result.kind === "invalid_resources") {
      throw unavailableResources(result.invalidReferences);
    }
    return toDetail(result.snapshot);
  }
}
