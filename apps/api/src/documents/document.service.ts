import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { isUuidV7 } from "@wechat-layout/database";
import { DOCUMENT_SCHEMA_VERSION, validateDocument } from "@wechat-layout/document-schema";

import { ApiException } from "../common/http/api.exception.js";
import { DOCUMENT_REPOSITORY } from "./document.constants.js";
import { statisticsForDocument } from "./document-statistics.js";
import type {
  ArticleDocumentDto,
  SaveArticleDocumentDto,
  SaveArticleDocumentResultDto,
} from "./document.dto.js";
import type {
  ArticleDocumentRecord,
  ArticleDocumentRepository,
  DocumentMutationContext,
} from "./document.types.js";

function notFound(): ApiException {
  return new ApiException(HttpStatus.NOT_FOUND, {
    code: "ARTICLE_NOT_FOUND",
    message: "文章不存在",
    retryable: false,
  });
}

function invalidRequest(fields: readonly { readonly path: string; readonly message: string }[]) {
  return new ApiException(HttpStatus.BAD_REQUEST, {
    code: "VALIDATION_FAILED",
    message: "提交内容存在错误",
    details: { fields },
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
    message: "文章已在其他标签页更新",
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

function validateArticleId(articleId: string): void {
  if (!isUuidV7(articleId)) {
    throw invalidRequest([{ path: "articleId", message: "必须是 UUIDv7" }]);
  }
}

function toDto(record: ArticleDocumentRecord): ArticleDocumentDto {
  return {
    documentId: record.id,
    articleId: record.articleId,
    schemaVersion: record.schemaVersion,
    documentVersion: record.documentVersion,
    document: record.document as unknown as Readonly<Record<string, unknown>>,
    textLocked: record.textLocked,
    originalTextHash: record.originalTextHash,
    currentTextHash: record.currentTextHash,
    lastTransactionId: record.lastTransactionId,
    lastSavedBy: record.lastSavedBy,
    lastSavedAt: record.lastSavedAt.toISOString(),
  };
}

@Injectable()
export class DocumentService {
  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly repository: ArticleDocumentRepository,
  ) {}

  async get(ownerUserId: string, articleId: string): Promise<ArticleDocumentDto> {
    validateArticleId(articleId);
    const record = await this.repository.findCurrent(ownerUserId, articleId);
    if (record === null) {
      throw notFound();
    }
    return toDto(record);
  }

  async save(
    ownerUserId: string,
    articleId: string,
    body: SaveArticleDocumentDto,
    context: DocumentMutationContext,
  ): Promise<SaveArticleDocumentResultDto> {
    validateArticleId(articleId);

    const validation = validateDocument(body.document);
    if (!validation.success) {
      throw invalidRequest(
        validation.errors.map((error) => ({
          path: `document${error.path === "/" ? "" : error.path}`,
          message: error.message,
        })),
      );
    }
    if (
      body.schemaVersion !== DOCUMENT_SCHEMA_VERSION ||
      validation.data.schemaVersion !== body.schemaVersion
    ) {
      throw invalidRequest([
        {
          path: "schemaVersion",
          message: `当前仅支持 ${DOCUMENT_SCHEMA_VERSION}`,
        },
      ]);
    }
    if (validation.data.articleId !== articleId) {
      throw invalidRequest([
        {
          path: "document.articleId",
          message: "必须与路径中的文章 ID 一致",
        },
      ]);
    }

    const current = await this.repository.findCurrent(ownerUserId, articleId);
    if (current === null) {
      throw notFound();
    }
    if (validation.data.documentId !== current.id) {
      throw invalidRequest([
        {
          path: "document.documentId",
          message: "必须与当前文章文档 ID 一致",
        },
      ]);
    }

    const result = await this.repository.save({
      ownerUserId,
      articleId,
      baseVersion: body.baseVersion,
      schemaVersion: body.schemaVersion,
      document: validation.data,
      lastTransactionId: body.lastTransactionId,
      transactionOrigin: body.transactionOrigin,
      statistics: statisticsForDocument(validation.data),
      context,
    });

    if (result.kind === "not_found") {
      throw notFound();
    }
    if (result.kind === "conflict") {
      throw versionConflict(
        articleId,
        body.baseVersion,
        result.currentVersion,
        result.lastTransactionId,
        result.lastSavedAt,
      );
    }

    return {
      documentVersion: result.record.documentVersion,
      lastTransactionId: body.lastTransactionId,
      lastSavedAt: result.record.lastSavedAt.toISOString(),
      replayed: result.kind === "replayed",
    };
  }
}
