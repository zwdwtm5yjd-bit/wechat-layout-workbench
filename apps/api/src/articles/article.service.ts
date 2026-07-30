import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { isUuidV7 } from "@wechat-layout/database";

import { ApiException } from "../common/http/api.exception.js";
import { ARTICLE_REPOSITORY } from "./article.constants.js";
import type {
  ArticleDetailDto,
  ArticleDto,
  ArticleListQueryDto,
  ArticleStatusHistoryDto,
  CreateArticleDto,
  DuplicateArticleDto,
  UpdateArticleDto,
} from "./article.dto.js";
import type {
  ArticleDetailRecord,
  ArticleMutationContext,
  ArticleRecord,
  ArticleRepository,
  ArticleStatus,
} from "./article.types.js";

const permittedStatusTransitions: Readonly<
  Partial<Record<ArticleStatus, readonly ArticleStatus[]>>
> = {
  pending_layout: ["layout_editing", "pending_check", "published"],
  layout_editing: ["pending_layout", "pending_check", "published"],
  pending_check: ["layout_editing", "published"],
  copied: ["pending_check", "published"],
  synced: ["pending_check", "published"],
  published: ["pending_check"],
};

function notFound(): ApiException {
  return new ApiException(HttpStatus.NOT_FOUND, {
    code: "ARTICLE_NOT_FOUND",
    message: "文章不存在",
    retryable: false,
  });
}

function stateConflict(message: string): ApiException {
  return new ApiException(HttpStatus.CONFLICT, {
    code: "ARTICLE_STATE_CONFLICT",
    message,
    retryable: false,
  });
}

function invalidRequest(message: string, path: string): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, {
    code: "VALIDATION_FAILED",
    message: "提交内容存在错误",
    details: {
      fields: [{ path, message }],
    },
    retryable: false,
  });
}

function validateArticleId(articleId: string): void {
  if (!isUuidV7(articleId)) {
    throw invalidRequest("必须是 UUIDv7", "articleId");
  }
}

function normalizedTitle(title: string): string {
  const normalized = title.trim();
  if (normalized.length === 0) {
    throw invalidRequest("标题不能为空", "title");
  }
  return normalized;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function toArticleDto(article: ArticleRecord): ArticleDto {
  return {
    id: article.id,
    accountId: article.accountId,
    contentGroupId: article.contentGroupId,
    title: article.title,
    subtitle: article.subtitle,
    contentType: article.contentType,
    sourceType: article.sourceType,
    status: article.status,
    themeId: article.themeId,
    themeVersion: article.themeVersion,
    layoutStrength: article.layoutStrength,
    textLocked: article.textLocked,
    wordCount: article.wordCount,
    imageCount: article.imageCount,
    svgCount: article.svgCount,
    compatibilityScore: article.compatibilityScore,
    compatibilityStatus: article.compatibilityStatus,
    publishedAt: iso(article.publishedAt),
    archivedAt: iso(article.archivedAt),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    deletedAt: iso(article.deletedAt),
    deletePurgeAfter: iso(article.deletePurgeAfter),
  };
}

function toArticleDetailDto(article: ArticleDetailRecord): ArticleDetailDto {
  return {
    ...toArticleDto(article),
    documentVersion: article.documentVersion,
    lastSavedAt: iso(article.lastSavedAt),
  };
}

@Injectable()
export class ArticleService {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly repository: ArticleRepository,
  ) {}

  async list(ownerUserId: string, query: ArticleListQueryDto) {
    // Nest 的查询参数转换不会为“未出现在请求中”的字段稳定保留类字段初始值，
    // 因此服务边界再次收敛默认值，避免把 undefined 传入 SQL 排序和分页。
    const sort = query.sort ?? "updated_desc";
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.repository.list(ownerUserId, {
      ...(query.accountId === undefined ? {} : { accountId: query.accountId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.contentType === undefined ? {} : { contentType: query.contentType }),
      ...(query.themeId === undefined ? {} : { themeId: query.themeId }),
      ...(query.hasSvg === undefined ? {} : { hasSvg: query.hasSvg }),
      ...(query.compatibilityStatus === undefined
        ? {}
        : { compatibilityStatus: query.compatibilityStatus }),
      ...(query.search === undefined ? {} : { search: query.search.trim() }),
      sort,
      page,
      pageSize,
    });

    return {
      items: result.items.map(toArticleDto),
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
      },
    };
  }

  async get(ownerUserId: string, articleId: string): Promise<ArticleDetailDto> {
    validateArticleId(articleId);
    const article = await this.repository.findDetail(ownerUserId, articleId);
    if (article === null) {
      throw notFound();
    }
    return toArticleDetailDto(article);
  }

  async create(
    ownerUserId: string,
    body: CreateArticleDto,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailDto> {
    const article = await this.repository.create({
      ownerUserId,
      title: normalizedTitle(body.title),
      accountId: body.accountId ?? null,
      contentType: body.contentType,
      layoutStrength: body.layoutStrength,
      context,
    });
    return toArticleDetailDto(article);
  }

  async update(
    ownerUserId: string,
    articleId: string,
    body: UpdateArticleDto,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailDto> {
    validateArticleId(articleId);
    if (body.status !== undefined && body.published !== undefined) {
      throw invalidRequest("status 与 published 不能同时提交", "published");
    }
    const existing = await this.requireArticle(ownerUserId, articleId);
    if (existing.deletedAt !== null) {
      throw stateConflict("回收站中的文章必须先恢复");
    }

    const requestedStatus =
      body.status ??
      (body.published === true
        ? "published"
        : body.published === false && existing.status === "published"
          ? "pending_check"
          : undefined);
    if (
      requestedStatus !== undefined &&
      requestedStatus !== existing.status &&
      !permittedStatusTransitions[existing.status]?.includes(requestedStatus)
    ) {
      throw stateConflict(`不能从 ${existing.status} 变更为 ${requestedStatus}`);
    }

    const patch = {
      ...(body.title === undefined ? {} : { title: normalizedTitle(body.title) }),
      ...(body.subtitle === undefined ? {} : { subtitle: body.subtitle?.trim() || null }),
      ...(body.accountId === undefined ? {} : { accountId: body.accountId }),
      ...(body.contentType === undefined ? {} : { contentType: body.contentType }),
      ...(body.layoutStrength === undefined ? {} : { layoutStrength: body.layoutStrength }),
      ...(requestedStatus === undefined ? {} : { status: requestedStatus }),
    };
    if (Object.keys(patch).length === 0) {
      throw invalidRequest("至少提交一个可更新字段", "body");
    }

    const article = await this.repository.update(ownerUserId, articleId, patch, context);
    if (article === null) {
      throw notFound();
    }
    return toArticleDetailDto(article);
  }

  async duplicate(
    ownerUserId: string,
    articleId: string,
    body: DuplicateArticleDto,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailDto> {
    validateArticleId(articleId);
    const existing = await this.requireArticle(ownerUserId, articleId);
    if (existing.deletedAt !== null) {
      throw stateConflict("回收站中的文章不能复制");
    }
    const article = await this.repository.duplicate(ownerUserId, articleId, {
      ...(body.title === undefined ? {} : { title: normalizedTitle(body.title) }),
      ...(body.targetAccountId === undefined ? {} : { targetAccountId: body.targetAccountId }),
      contentGroupMode: body.contentGroupMode,
      context,
    });
    if (article === null) {
      throw notFound();
    }
    return toArticleDetailDto(article);
  }

  async archive(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailDto> {
    validateArticleId(articleId);
    const existing = await this.requireActiveArticle(ownerUserId, articleId);
    if (existing.status === "archived") {
      throw stateConflict("文章已经归档");
    }
    const article = await this.repository.archive(ownerUserId, articleId, context);
    if (article === null) {
      throw notFound();
    }
    return toArticleDetailDto(article);
  }

  async unarchive(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailDto> {
    validateArticleId(articleId);
    const existing = await this.requireActiveArticle(ownerUserId, articleId);
    if (existing.status !== "archived") {
      throw stateConflict("只有已归档文章可以恢复归档");
    }
    const article = await this.repository.unarchive(ownerUserId, articleId, context);
    if (article === null) {
      throw notFound();
    }
    return toArticleDetailDto(article);
  }

  async trash(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailDto> {
    validateArticleId(articleId);
    const existing = await this.requireArticle(ownerUserId, articleId);
    if (existing.deletedAt !== null) {
      throw stateConflict("文章已在回收站中");
    }
    const article = await this.repository.trash(ownerUserId, articleId, context);
    if (article === null) {
      throw notFound();
    }
    return toArticleDetailDto(article);
  }

  async restore(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailDto> {
    validateArticleId(articleId);
    const existing = await this.requireArticle(ownerUserId, articleId);
    if (existing.deletedAt === null) {
      throw stateConflict("文章不在回收站中");
    }
    const article = await this.repository.restore(ownerUserId, articleId, context);
    if (article === null) {
      throw notFound();
    }
    return toArticleDetailDto(article);
  }

  async history(ownerUserId: string, articleId: string) {
    validateArticleId(articleId);
    const history = await this.repository.statusHistory(ownerUserId, articleId);
    if (history === null) {
      throw notFound();
    }
    return {
      items: history.map((entry): ArticleStatusHistoryDto => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason,
        source: entry.source,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  private async requireArticle(
    ownerUserId: string,
    articleId: string,
  ): Promise<ArticleDetailRecord> {
    const article = await this.repository.findDetail(ownerUserId, articleId);
    if (article === null) {
      throw notFound();
    }
    return article;
  }

  private async requireActiveArticle(
    ownerUserId: string,
    articleId: string,
  ): Promise<ArticleDetailRecord> {
    const article = await this.requireArticle(ownerUserId, articleId);
    if (article.deletedAt !== null) {
      throw stateConflict("回收站中的文章必须先恢复");
    }
    return article;
  }
}
