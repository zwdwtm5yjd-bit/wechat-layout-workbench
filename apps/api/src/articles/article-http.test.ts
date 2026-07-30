import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { createUuidV7 } from "@wechat-layout/database";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import type { AuthenticatedHttpRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/http/api.exception.js";
import { configureApplication } from "../configure-application.js";
import { ARTICLE_REPOSITORY } from "./article.constants.js";
import { ArticleController } from "./article.controller.js";
import { ArticleService } from "./article.service.js";
import type {
  ArticleDetailRecord,
  ArticleListQuery,
  ArticleListResult,
  ArticleMutationContext,
  ArticleRepository,
  ArticleStatus,
  ArticleStatusHistoryRecord,
  CreateArticleInput,
  DuplicateArticleInput,
  UpdateArticleInput,
} from "./article.types.js";

const ownerUserId = createUuidV7();
const otherUserId = createUuidV7();

type MutableArticle = {
  -readonly [Key in keyof ArticleDetailRecord]: ArticleDetailRecord[Key];
};

function cloneArticle(article: ArticleDetailRecord): ArticleDetailRecord {
  return { ...article };
}

@Injectable()
class ArticleHttpTestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      AuthenticatedHttpRequest & {
        readonly method: string;
        readonly headers: Readonly<Record<string, string | string[] | undefined>>;
      }
    >();
    const requestedUser = request.headers["x-test-user"];
    if (requestedUser === "missing") {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: "AUTH_REQUIRED",
        message: "需要登录后继续",
        retryable: false,
      });
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers["x-csrf-token"] !== "test-csrf-token"
    ) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: "CSRF_INVALID",
        message: "CSRF 校验失败",
        retryable: false,
      });
    }

    const userId = requestedUser === "other" ? otherUserId : ownerUserId;
    request.auth = {
      sessionId: createUuidV7(),
      sessionTokenHash: "a".repeat(64),
      rawSessionToken: "test-session-token",
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: userId,
        email: "owner@example.com",
        username: "owner",
        displayName: "Owner",
        role: "owner",
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
        avatarResourceId: null,
      },
    };
    return true;
  }
}

@Injectable()
class InMemoryArticleRepository implements ArticleRepository {
  readonly articles = new Map<string, MutableArticle>();
  readonly histories = new Map<string, ArticleStatusHistoryRecord[]>();
  readonly documentIds = new Map<string, string>();

  list(ownerId: string, query: ArticleListQuery): Promise<ArticleListResult> {
    const items = [...this.articles.values()]
      .filter((article) => article.ownerUserId === ownerId)
      .filter((article) =>
        query.status === "trash" ? article.deletedAt !== null : article.deletedAt === null,
      )
      .filter((article) =>
        query.status === undefined || query.status === "trash"
          ? true
          : article.status === query.status,
      )
      .filter((article) =>
        query.search === undefined
          ? true
          : `${article.title} ${article.subtitle ?? ""}`
              .toLowerCase()
              .includes(query.search.toLowerCase()),
      );
    return Promise.resolve({
      items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: items.length,
    });
  }

  findDetail(ownerId: string, articleId: string): Promise<ArticleDetailRecord | null> {
    const article = this.articles.get(articleId);
    return Promise.resolve(article?.ownerUserId === ownerId ? cloneArticle(article) : null);
  }

  create(input: CreateArticleInput): Promise<ArticleDetailRecord> {
    const now = new Date();
    const article: MutableArticle = {
      id: createUuidV7(),
      ownerUserId: input.ownerUserId,
      accountId: input.accountId,
      contentGroupId: null,
      title: input.title,
      subtitle: null,
      slug: null,
      contentType: input.contentType,
      sourceType: "blank",
      status: "pending_layout",
      themeId: null,
      themeVersion: null,
      paletteId: null,
      brandVersionId: null,
      layoutStrength: input.layoutStrength,
      textLocked: true,
      wordCount: 0,
      imageCount: 0,
      svgCount: 0,
      compatibilityScore: null,
      compatibilityStatus: null,
      currentSnapshotId: null,
      copiedAt: null,
      syncedAt: null,
      publishedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletePurgeAfter: null,
      documentVersion: 1,
      lastSavedAt: now,
    };
    this.articles.set(article.id, article);
    this.documentIds.set(article.id, createUuidV7());
    this.addHistory(article.id, null, "pending_layout", "创建空白文章", "user", input.context);
    return Promise.resolve(cloneArticle(article));
  }

  update(
    ownerId: string,
    articleId: string,
    patch: UpdateArticleInput,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const article = this.ownedActive(ownerId, articleId);
    if (article === null) {
      return Promise.resolve(null);
    }
    const previousStatus = article.status;
    Object.assign(article, patch, {
      publishedAt: patch.status === "published" ? new Date() : article.publishedAt,
      updatedAt: new Date(),
    });
    if (patch.status !== undefined && patch.status !== previousStatus) {
      this.addHistory(articleId, previousStatus, patch.status, "更新文章阶段", "user", context);
    }
    return Promise.resolve(cloneArticle(article));
  }

  duplicate(
    ownerId: string,
    articleId: string,
    input: DuplicateArticleInput,
  ): Promise<ArticleDetailRecord | null> {
    const source = this.ownedActive(ownerId, articleId);
    if (source === null) {
      return Promise.resolve(null);
    }
    const now = new Date();
    const duplicate: MutableArticle = {
      ...source,
      id: createUuidV7(),
      accountId: input.targetAccountId === undefined ? source.accountId : input.targetAccountId,
      contentGroupId: input.contentGroupMode === "same_group" ? source.contentGroupId : null,
      title: input.title ?? `${source.title} 副本`,
      sourceType: "copy",
      status: "pending_layout",
      publishedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletePurgeAfter: null,
      documentVersion: 1,
      lastSavedAt: now,
    };
    this.articles.set(duplicate.id, duplicate);
    this.documentIds.set(duplicate.id, createUuidV7());
    this.addHistory(duplicate.id, null, "pending_layout", "复制文章", "copy", input.context);
    return Promise.resolve(cloneArticle(duplicate));
  }

  archive(
    ownerId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    return this.transition(ownerId, articleId, "archived", "归档文章", context);
  }

  unarchive(
    ownerId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const history = this.histories.get(articleId)?.find((entry) => entry.toStatus === "archived");
    return this.transition(
      ownerId,
      articleId,
      history?.fromStatus ?? "pending_check",
      "恢复归档文章",
      context,
    );
  }

  trash(ownerId: string, articleId: string): Promise<ArticleDetailRecord | null> {
    const article = this.ownedActive(ownerId, articleId);
    if (article === null) {
      return Promise.resolve(null);
    }
    article.deletedAt = new Date();
    article.deletePurgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    article.updatedAt = new Date();
    return Promise.resolve(cloneArticle(article));
  }

  restore(ownerId: string, articleId: string): Promise<ArticleDetailRecord | null> {
    const article = this.articles.get(articleId);
    if (article === undefined || article.ownerUserId !== ownerId || article.deletedAt === null) {
      return Promise.resolve(null);
    }
    article.deletedAt = null;
    article.deletePurgeAfter = null;
    article.updatedAt = new Date();
    return Promise.resolve(cloneArticle(article));
  }

  statusHistory(
    ownerId: string,
    articleId: string,
  ): Promise<readonly ArticleStatusHistoryRecord[] | null> {
    const article = this.articles.get(articleId);
    return Promise.resolve(
      article?.ownerUserId === ownerId ? (this.histories.get(articleId) ?? []) : null,
    );
  }

  private ownedActive(ownerId: string, articleId: string): MutableArticle | null {
    const article = this.articles.get(articleId);
    return article?.ownerUserId === ownerId && article.deletedAt === null ? article : null;
  }

  private transition(
    ownerId: string,
    articleId: string,
    status: ArticleStatus,
    reason: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null> {
    const article = this.ownedActive(ownerId, articleId);
    if (article === null) {
      return Promise.resolve(null);
    }
    const previous = article.status;
    article.status = status;
    article.archivedAt = status === "archived" ? new Date() : null;
    article.updatedAt = new Date();
    this.addHistory(articleId, previous, status, reason, "user", context);
    return Promise.resolve(cloneArticle(article));
  }

  private addHistory(
    articleId: string,
    fromStatus: ArticleStatus | null,
    toStatus: ArticleStatus,
    reason: string,
    source: ArticleStatusHistoryRecord["source"],
    context: ArticleMutationContext,
  ): void {
    const history = this.histories.get(articleId) ?? [];
    history.unshift({
      id: createUuidV7(),
      articleId,
      fromStatus,
      toStatus,
      reason,
      source,
      createdBy: context.actorUserId,
      createdAt: new Date(),
    });
    this.histories.set(articleId, history);
  }
}

@Module({
  imports: [AppModule],
  controllers: [ArticleController],
  providers: [
    ArticleService,
    InMemoryArticleRepository,
    {
      provide: ARTICLE_REPOSITORY,
      useExisting: InMemoryArticleRepository,
    },
    {
      provide: APP_GUARD,
      useClass: ArticleHttpTestGuard,
    },
  ],
})
class ArticleHttpTestModule {}

describe("article HTTP flow", () => {
  let application: INestApplication;
  let repository: InMemoryArticleRepository;

  beforeAll(async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    application = await NestFactory.create(ArticleHttpTestModule, {
      abortOnError: false,
      logger: false,
    });
    configureApplication(application, "development");
    await application.init();
    repository = application.get(InMemoryArticleRepository);
  });

  afterAll(async () => {
    await application.close();
    vi.restoreAllMocks();
  });

  it("publishes wrapped article contracts and protects write endpoints", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    expect(
      specification.body.paths?.["/api/v1/articles"]?.get?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ArticleListResponseDto",
    });
    expect(
      specification.body.paths?.["/api/v1/articles"]?.post?.requestBody?.content?.[
        "application/json"
      ]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/CreateArticleDto",
    });

    await supertest(application.getHttpServer())
      .post("/api/v1/articles")
      .send({ title: "无 CSRF" })
      .expect(403);
    await supertest(application.getHttpServer())
      .get("/api/v1/articles")
      .set("x-test-user", "missing")
      .expect(401);
  });

  it("creates, searches, updates and records status history", async () => {
    const created = await supertest(application.getHttpServer())
      .post("/api/v1/articles")
      .set("x-csrf-token", "test-csrf-token")
      .set("x-request-id", "req_article_create")
      .send({
        title: "  巡察工作方法  ",
        contentType: "inspection",
        sourceType: "blank",
        layoutStrength: "standard",
      })
      .expect(201);
    const articleId = created.body.data.id as string;

    expect(created.body).toMatchObject({
      success: true,
      data: {
        id: articleId,
        title: "巡察工作方法",
        status: "pending_layout",
        documentVersion: 1,
      },
      meta: {
        requestId: "req_article_create",
      },
    });

    const listed = await supertest(application.getHttpServer())
      .get("/api/v1/articles?search=巡察")
      .expect(200);
    expect(listed.body.data).toMatchObject({
      items: [{ id: articleId }],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });

    const published = await supertest(application.getHttpServer())
      .patch(`/api/v1/articles/${articleId}`)
      .set("x-csrf-token", "test-csrf-token")
      .send({ published: true, subtitle: "状态流转验收" })
      .expect(200);
    expect(published.body.data).toMatchObject({
      id: articleId,
      subtitle: "状态流转验收",
      status: "published",
    });

    const history = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/status-history`)
      .expect(200);
    expect(history.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromStatus: "pending_layout", toStatus: "published" }),
        expect.objectContaining({ fromStatus: null, toStatus: "pending_layout" }),
      ]),
    );
  });

  it("duplicates an independent document, archives, trashes and restores", async () => {
    const source = [...repository.articles.values()][0];
    expect(source).toBeDefined();
    if (source === undefined) {
      return;
    }

    const duplicateResponse = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${source.id}/duplicate`)
      .set("x-csrf-token", "test-csrf-token")
      .send({ title: "独立副本", copyMode: "full", contentGroupMode: "independent" })
      .expect(201);
    const duplicateId = duplicateResponse.body.data.id as string;
    expect(duplicateResponse.body.data).toMatchObject({
      id: duplicateId,
      title: "独立副本",
      sourceType: "copy",
      status: "pending_layout",
      documentVersion: 1,
    });
    expect(repository.documentIds.get(duplicateId)).not.toBe(repository.documentIds.get(source.id));

    await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${duplicateId}/archive`)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    const unarchived = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${duplicateId}/unarchive`)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(unarchived.body.data.status).toBe("pending_layout");

    const trashed = await supertest(application.getHttpServer())
      .delete(`/api/v1/articles/${duplicateId}`)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(trashed.body.data.deletedAt).toEqual(expect.any(String));
    expect(trashed.body.data.deletePurgeAfter).toEqual(expect.any(String));

    const activeList = await supertest(application.getHttpServer())
      .get("/api/v1/articles?search=独立副本")
      .expect(200);
    const trashList = await supertest(application.getHttpServer())
      .get("/api/v1/articles?status=trash&search=独立副本")
      .expect(200);
    expect(activeList.body.data.pagination.total).toBe(0);
    expect(trashList.body.data.items).toEqual([expect.objectContaining({ id: duplicateId })]);

    const restored = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${duplicateId}/restore`)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(restored.body.data).toMatchObject({
      id: duplicateId,
      deletedAt: null,
      deletePurgeAfter: null,
    });
  });

  it("returns stable validation, ownership and missing-article errors", async () => {
    const article = [...repository.articles.values()][0];
    expect(article).toBeDefined();
    if (article === undefined) {
      return;
    }

    const invalid = await supertest(application.getHttpServer())
      .get("/api/v1/articles/not-a-uuid")
      .expect(400);
    expect(invalid.body.error.code).toBe("VALIDATION_FAILED");

    const hidden = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${article.id}`)
      .set("x-test-user", "other")
      .expect(404);
    expect(hidden.body.error.code).toBe("ARTICLE_NOT_FOUND");

    const missing = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${createUuidV7()}`)
      .expect(404);
    expect(missing.body.error).toMatchObject({
      code: "ARTICLE_NOT_FOUND",
      message: "文章不存在",
      retryable: false,
    });
  });
});
