import { createHash } from "node:crypto";

import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createUuidV7, isUuidV7 } from "@wechat-layout/database";
import { ObjectStorageError, type ObjectStorage } from "@wechat-layout/storage-adapter";

import { ApiException } from "../common/http/api.exception.js";
import type { RequestContext } from "../common/http/request-context.js";
import { OBJECT_STORAGE } from "../storage/storage.module.js";
import {
  RESOURCE_REPOSITORY,
  RESOURCE_RUNTIME_OPTIONS,
  RESOURCE_UPLOAD_SESSION_STORE,
  RESOURCE_UPLOAD_TTL_SECONDS,
} from "./resource.constants.js";
import type {
  CompleteResourceUploadDto,
  CreateResourceAccessUrlDto,
  CreateResourceUploadDto,
  ResourceDto,
} from "./resource.dto.js";
import { ImageInspectionError, inspectImage } from "./image-inspector.js";
import type {
  ResourceRecord,
  ResourceRepository,
  ResourceRuntimeOptions,
  ResourceThumbnailMetadata,
  UploadSession,
  UploadSessionStore,
} from "./resource.types.js";

function apiError(
  status: number,
  code: string,
  message: string,
  retryable = false,
  details?: Readonly<Record<string, unknown>>,
): ApiException {
  return new ApiException(status, {
    code,
    message,
    ...(details === undefined ? {} : { details }),
    retryable,
  });
}

function invalid(path: string, message: string): ApiException {
  return apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "提交内容存在错误", false, {
    fields: [{ path, message }],
  });
}

function notFound(message = "资源不存在"): ApiException {
  return apiError(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", message);
}

function validateUuid(value: string, path: string): void {
  if (!isUuidV7(value)) {
    throw invalid(path, "必须是 UUIDv7");
  }
}

function normalizeEtag(value: string): string {
  return value.trim().replaceAll('"', "").toLowerCase();
}

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeFilename(value: string): string {
  const normalized = [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("")
    .trim();
  if (normalized.length === 0) {
    throw invalid("filename", "文件名不能为空");
  }
  return normalized;
}

function thumbnailMetadata(record: ResourceRecord): ResourceThumbnailMetadata | null {
  return record.metadata.thumbnail ?? null;
}

function toDto(record: ResourceRecord): ResourceDto {
  const thumbnail = thumbnailMetadata(record);
  return {
    id: record.id,
    accountId: record.accountId,
    resourceType: record.resourceType,
    sourceType: record.sourceType,
    originalFilename: record.originalFilename,
    mimeType: record.mimeType,
    fileExtension: record.fileExtension,
    fileSize: record.fileSize,
    width: record.width,
    height: record.height,
    sha256: record.sha256,
    status: record.status,
    isPrivate: record.isPrivate,
    thumbnail:
      thumbnail === null
        ? null
        : {
            available: true,
            mimeType: thumbnail.mimeType,
            fileSize: thumbnail.fileSize,
            width: thumbnail.width,
            height: thumbnail.height,
          },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
    purgeAfter: record.purgeAfter?.toISOString() ?? null,
  };
}

@Injectable()
export class ResourceService {
  constructor(
    @Inject(RESOURCE_REPOSITORY)
    private readonly repository: ResourceRepository,
    @Inject(RESOURCE_UPLOAD_SESSION_STORE)
    private readonly uploadSessions: UploadSessionStore,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorage,
    @Inject(RESOURCE_RUNTIME_OPTIONS)
    private readonly options: ResourceRuntimeOptions,
  ) {}

  async createUpload(ownerUserId: string, body: CreateResourceUploadDto) {
    if (body.fileSize > this.options.maximumImageBytes) {
      throw invalid("fileSize", `图片不能超过 ${this.options.maximumImageBytes} 字节`);
    }
    const sha256 = body.sha256.toLowerCase();
    const filename = safeFilename(body.filename);
    const existing = await this.repository.findActiveByOwnerHash(ownerUserId, sha256);
    if (existing !== null) {
      if (existing.fileSize !== body.fileSize || existing.mimeType !== body.mimeType) {
        throw apiError(
          HttpStatus.CONFLICT,
          "RESOURCE_HASH_METADATA_CONFLICT",
          "相同摘要对应的资源元数据不一致",
        );
      }
      return {
        status: "deduplicated" as const,
        uploadId: null,
        uploadUrl: null,
        headers: {},
        expiresAt: null,
        resource: toDto(existing),
      };
    }

    const uploadId = createUuidV7();
    const now = new Date();
    const expiresAt = new Date(now.valueOf() + RESOURCE_UPLOAD_TTL_SECONDS * 1_000);
    const objectKey = `uploads/${ownerUserId}/${uploadId}`;
    const session: UploadSession = {
      id: uploadId,
      ownerUserId,
      accountId: body.accountId ?? null,
      filename,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      sha256,
      objectKey,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    await this.uploadSessions.save(session, RESOURCE_UPLOAD_TTL_SECONDS);
    try {
      const signed = await this.storage.createUploadUrl({
        key: objectKey,
        contentType: body.mimeType,
        expiresInSeconds: RESOURCE_UPLOAD_TTL_SECONDS,
        metadata: {
          "upload-id": uploadId,
          sha256,
        },
      });
      return {
        status: "upload_required" as const,
        uploadId,
        uploadUrl: signed.url,
        headers: signed.headers,
        expiresAt: signed.expiresAt.toISOString(),
        resource: null,
      };
    } catch (error) {
      await this.uploadSessions.delete(uploadId);
      throw this.storageUnavailable(error);
    }
  }

  async completeUpload(
    ownerUserId: string,
    uploadId: string,
    body: CompleteResourceUploadDto,
    context: RequestContext,
  ): Promise<ResourceDto> {
    validateUuid(uploadId, "uploadId");
    const session = await this.uploadSessions.find(uploadId);
    if (session === null || session.ownerUserId !== ownerUserId) {
      throw notFound("上传会话不存在或已过期");
    }

    let stat;
    try {
      stat = await this.storage.statObject(session.objectKey);
    } catch (error) {
      if (error instanceof ObjectStorageError && error.status === 404) {
        throw apiError(HttpStatus.CONFLICT, "RESOURCE_UPLOAD_NOT_READY", "上传对象尚未就绪", true);
      }
      throw this.storageUnavailable(error);
    }

    const contentType = stat.contentType?.split(";", 1)[0]?.trim().toLowerCase();
    if (
      stat.size !== session.fileSize ||
      contentType !== session.mimeType ||
      stat.metadata["upload-id"] !== uploadId ||
      stat.metadata.sha256 !== session.sha256 ||
      stat.etag === null ||
      normalizeEtag(stat.etag) !== normalizeEtag(body.etag)
    ) {
      await this.discardSession(session);
      throw apiError(
        HttpStatus.BAD_REQUEST,
        "RESOURCE_UPLOAD_MISMATCH",
        "上传对象与上传会话不一致",
      );
    }

    try {
      const bytes = await this.storage.getObject(session.objectKey, this.options.maximumImageBytes);
      if (bytes.byteLength !== session.fileSize || hash(bytes) !== session.sha256) {
        throw apiError(HttpStatus.BAD_REQUEST, "RESOURCE_HASH_MISMATCH", "文件摘要校验失败");
      }
      const inspected = await inspectImage(bytes, session.mimeType);
      const baseKey = `resources/${ownerUserId}/${session.sha256.slice(0, 2)}/${session.sha256}`;
      const originalKey = `${baseKey}/original.${inspected.extension}`;
      const thumbnailKey = `${baseKey}/thumbnail.webp`;
      await this.storage.putObject({
        key: originalKey,
        bytes,
        contentType: inspected.mimeType,
        metadata: {
          owner: ownerUserId,
          sha256: session.sha256,
        },
      });
      await this.storage.putObject({
        key: thumbnailKey,
        bytes: inspected.thumbnail.bytes,
        contentType: "image/webp",
        metadata: {
          owner: ownerUserId,
          parent_sha256: session.sha256,
          sha256: inspected.thumbnail.sha256,
        },
      });
      const resource = await this.repository.createValidated({
        ownerUserId,
        accountId: session.accountId,
        filename: session.filename,
        storageProvider: "s3_compatible",
        storageBucket: this.storage.bucket,
        storageKey: originalKey,
        mimeType: inspected.mimeType,
        fileExtension: inspected.extension,
        fileSize: bytes.byteLength,
        width: inspected.width,
        height: inspected.height,
        sha256: session.sha256,
        metadata: {
          ...(inspected.pages === undefined ? {} : { pages: inspected.pages }),
          thumbnail: {
            storageKey: thumbnailKey,
            mimeType: "image/webp",
            fileSize: inspected.thumbnail.bytes.byteLength,
            width: inspected.thumbnail.width,
            height: inspected.thumbnail.height,
            sha256: inspected.thumbnail.sha256,
          },
        },
        context: {
          actorUserId: ownerUserId,
          ...context,
        },
      });
      await this.discardSession(session);
      return toDto(resource);
    } catch (error) {
      if (error instanceof ApiException) {
        await this.discardSession(session);
        throw error;
      }
      if (error instanceof ImageInspectionError) {
        await this.discardSession(session);
        throw apiError(HttpStatus.BAD_REQUEST, error.code, error.message);
      }
      if (error instanceof ObjectStorageError) {
        throw this.storageUnavailable(error);
      }
      throw error;
    }
  }

  async get(ownerUserId: string, resourceId: string): Promise<ResourceDto> {
    validateUuid(resourceId, "resourceId");
    const resource = await this.repository.findOwnedById(ownerUserId, resourceId);
    if (resource === null) {
      throw notFound();
    }
    return toDto(resource);
  }

  async createAccessUrl(ownerUserId: string, resourceId: string, body: CreateResourceAccessUrlDto) {
    validateUuid(resourceId, "resourceId");
    const resource = await this.repository.findOwnedById(ownerUserId, resourceId);
    if (resource === null) {
      throw notFound();
    }
    const variant = body.variant ?? "original";
    const thumbnail = thumbnailMetadata(resource);
    if (variant === "thumbnail" && thumbnail === null) {
      throw apiError(HttpStatus.CONFLICT, "RESOURCE_VARIANT_UNAVAILABLE", "该资源没有缩略图");
    }
    try {
      const signed = await this.storage.createDownloadUrl({
        key:
          variant === "thumbnail"
            ? (thumbnail as ResourceThumbnailMetadata).storageKey
            : resource.storageKey,
        expiresInSeconds: body.expiresInSeconds ?? 300,
        responseContentType: variant === "thumbnail" ? "image/webp" : resource.mimeType,
      });
      return {
        url: signed.url,
        headers: signed.headers,
        expiresAt: signed.expiresAt.toISOString(),
      };
    } catch (error) {
      throw this.storageUnavailable(error);
    }
  }

  async references(ownerUserId: string, resourceId: string) {
    validateUuid(resourceId, "resourceId");
    const references = await this.repository.listReferences(ownerUserId, resourceId);
    if (references === null) {
      throw notFound();
    }
    return {
      total: references.length,
      items: [...references],
    };
  }

  async trash(
    ownerUserId: string,
    resourceId: string,
    context: RequestContext,
  ): Promise<ResourceDto> {
    validateUuid(resourceId, "resourceId");
    const result = await this.repository.trashIfUnreferenced(ownerUserId, resourceId, {
      actorUserId: ownerUserId,
      ...context,
    });
    if (result.kind === "not_found") {
      throw notFound();
    }
    if (result.kind === "in_use") {
      throw apiError(HttpStatus.CONFLICT, "RESOURCE_IN_USE", "资源仍被引用，不能删除", false, {
        referenceCount: result.references.length,
        referenceKinds: [...new Set(result.references.map((reference) => reference.kind))],
      });
    }
    return toDto(result.resource);
  }

  private async discardSession(session: UploadSession): Promise<void> {
    await Promise.allSettled([
      this.storage.deleteObject(session.objectKey),
      this.uploadSessions.delete(session.id),
    ]);
  }

  private storageUnavailable(error: unknown): ApiException {
    return apiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      "OBJECT_STORAGE_UNAVAILABLE",
      "对象存储暂时不可用",
      true,
      error instanceof ObjectStorageError
        ? { operation: error.operation, storageCode: error.storageCode }
        : undefined,
    );
  }
}
