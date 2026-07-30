import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { isUuidV7 } from "@wechat-layout/database";

import { ApiException } from "../common/http/api.exception.js";
import { IMPORT_REPOSITORY } from "./import.constants.js";
import type {
  ConfirmImportResultDto,
  ConfirmImportStructureDto,
  ImportStructureDto,
  PasteImportDto,
} from "./import.dto.js";
import { parsePasteImport } from "./paste-parser.js";
import type {
  ImportMutationContext,
  ImportRepository,
  ImportStructureRecord,
} from "./import.types.js";

function validation(message: string, path: string): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, {
    code: "VALIDATION_FAILED",
    message: "提交内容存在错误",
    details: { fields: [{ path, message }] },
    retryable: false,
  });
}

function notFound(): ApiException {
  return new ApiException(HttpStatus.NOT_FOUND, {
    code: "IMPORT_NOT_FOUND",
    message: "导入文章或原文不存在",
    retryable: false,
  });
}

function stateConflict(message: string): ApiException {
  return new ApiException(HttpStatus.CONFLICT, {
    code: "IMPORT_STATE_CONFLICT",
    message,
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
    message: "文章已在其他标签页更新，未确认导入结构",
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

function toDto(record: ImportStructureRecord): ImportStructureDto {
  return {
    articleId: record.articleId,
    sourceDocumentId: record.sourceDocumentId,
    title: record.title,
    accountId: record.accountId,
    status: record.status,
    documentId: record.documentId,
    documentVersion: record.documentVersion,
    lastTransactionId: record.lastTransactionId,
    lastSavedAt: record.lastSavedAt.toISOString(),
    detectedSource: record.detectedSource,
    cleaningMode: record.cleaningMode,
    originalText: record.originalText,
    blocks: record.blocks.map((block) => ({
      sourceBlockId: block.sourceBlockId,
      role: block.role,
      text: block.text,
      orderIndex: block.orderIndex,
      originalTag: block.styleMetadata.originalTag ?? null,
      relation: {
        ...(block.relationMetadata.listDepth === undefined
          ? {}
          : { listDepth: block.relationMetadata.listDepth }),
        ...(block.relationMetadata.listStart === undefined
          ? {}
          : { listStart: block.relationMetadata.listStart }),
        ...(block.relationMetadata.originalNumberText === undefined
          ? {}
          : { originalNumberText: block.relationMetadata.originalNumberText }),
        ...(block.relationMetadata.sourceUrl === undefined
          ? {}
          : { sourceUrl: block.relationMetadata.sourceUrl }),
        ...(block.relationMetadata.alt === undefined ? {} : { alt: block.relationMetadata.alt }),
        ...(block.relationMetadata.tableCells === undefined
          ? {}
          : { tableCells: [...block.relationMetadata.tableCells] }),
      },
    })),
    warnings: record.warnings.map((warning) => ({ ...warning })),
    statistics: { ...record.statistics },
  };
}

@Injectable()
export class ImportService {
  constructor(
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
  ) {}

  async createPaste(
    ownerUserId: string,
    body: PasteImportDto,
    context: ImportMutationContext,
  ): Promise<ImportStructureDto> {
    const html = body.html?.trim();
    const plainText = body.plainText?.trim();
    if (!html && !plainText) {
      throw validation("html 与 plainText 至少提供一项", "body");
    }
    const parsed = parsePasteImport({
      ...(html === undefined ? {} : { html }),
      ...(plainText === undefined ? {} : { plainText }),
      cleaningMode: body.cleaningMode ?? "preserve_structure",
      detectedSourceHint: body.detectedSourceHint ?? "auto",
    });
    if (parsed.originalText === "" || parsed.blocks.length === 0) {
      throw validation("未识别到可导入的可见内容", "body");
    }
    const record = await this.repository.createPaste({
      ownerUserId,
      accountId: body.accountId ?? null,
      contentType: body.contentType ?? "general",
      layoutStrength: body.layoutStrength ?? "standard",
      parsed,
      context,
    });
    return toDto(record);
  }

  async getStructure(ownerUserId: string, articleId: string): Promise<ImportStructureDto> {
    this.validateArticleId(articleId);
    const record = await this.repository.findStructure(ownerUserId, articleId);
    if (record === null) {
      throw notFound();
    }
    return toDto(record);
  }

  async confirm(
    ownerUserId: string,
    articleId: string,
    body: ConfirmImportStructureDto,
    context: ImportMutationContext,
  ): Promise<ConfirmImportResultDto> {
    this.validateArticleId(articleId);
    const uniqueIds = new Set(body.blocks.map((block) => block.sourceBlockId));
    if (uniqueIds.size !== body.blocks.length) {
      throw validation("sourceBlockId 不能重复", "blocks");
    }
    if (body.blocks.every((block) => block.role === "excluded")) {
      throw validation("至少保留一个参与排版的区块", "blocks");
    }
    const result = await this.repository.confirm({
      ownerUserId,
      articleId,
      title: body.title?.trim() || null,
      baseVersion: body.baseVersion,
      lastTransactionId: body.lastTransactionId,
      blocks: body.blocks.map((block) => ({
        sourceBlockId: block.sourceBlockId,
        role: block.role,
      })),
      context,
    });
    if (result.kind === "not_found") {
      throw notFound();
    }
    if (result.kind === "invalid_state") {
      throw stateConflict("导入结构已确认，或区块集合与权威原文不一致");
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
      ...toDto(result.record),
      snapshotId: result.snapshotId,
      snapshotNumber: result.snapshotNumber,
      editorUrl: `/workspace/articles/${articleId}`,
    };
  }

  private validateArticleId(articleId: string): void {
    if (!isUuidV7(articleId)) {
      throw validation("必须是 UUIDv7", "articleId");
    }
  }
}
