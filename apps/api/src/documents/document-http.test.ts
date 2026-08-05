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
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import type { AuthenticatedHttpRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/http/api.exception.js";
import { configureApplication } from "../configure-application.js";
import { DOCUMENT_REPOSITORY } from "./document.constants.js";
import { DocumentController } from "./document.controller.js";
import {
  collectDocumentResourceReferences,
  type DocumentResourceReference,
} from "./document-resource-references.js";
import { DocumentService } from "./document.service.js";
import type {
  ArticleDocumentRecord,
  ArticleDocumentRepository,
  DocumentStatistics,
  SaveArticleDocumentInput,
  SaveArticleDocumentResult,
} from "./document.types.js";

const ownerUserId = createUuidV7();
const otherUserId = createUuidV7();
const articleId = createUuidV7();
const documentId = createUuidV7();
const firstTransactionId = createUuidV7();
const secondTransactionId = createUuidV7();
const now = new Date("2026-07-30T08:00:00.000Z");

function documentWithText(text: string): DocumentV1 {
  const document = structuredClone(documentV1Fixture) as DocumentV1;
  document.articleId = articleId;
  document.documentId = documentId;
  document.accountId = null;
  const heading = document.content.content.find((node) => node.type === "heading");
  const firstInline = heading?.content?.[0];
  if (firstInline?.type === "text") {
    firstInline.text = text;
  }
  return document;
}

@Injectable()
class DocumentHttpTestGuard implements CanActivate {
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
class InMemoryDocumentRepository implements ArticleDocumentRepository {
  record: ArticleDocumentRecord = {
    id: documentId,
    articleId,
    accountId: null,
    schemaVersion: "1.0.0",
    sourceBlocks: [
      {
        blockType: "title",
        orderIndex: 0,
        sourceBlockId: "source_heading",
        text: "初始文档",
        textHash: "a".repeat(64),
      },
    ],
    document: documentWithText("初始文档"),
    documentVersion: 1,
    textLocked: true,
    originalTextHash: null,
    currentTextHash: null,
    lastTransactionId: null,
    lastSavedBy: ownerUserId,
    lastSavedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  lastStatistics: DocumentStatistics | null = null;
  invalidReferences: readonly DocumentResourceReference[] = [];

  findCurrent(ownerId: string, requestedArticleId: string) {
    return Promise.resolve(
      ownerId === ownerUserId && requestedArticleId === articleId ? this.record : null,
    );
  }

  save(input: SaveArticleDocumentInput): Promise<SaveArticleDocumentResult> {
    if (input.ownerUserId !== ownerUserId || input.articleId !== articleId) {
      return Promise.resolve({ kind: "not_found" });
    }
    if (
      this.record.lastTransactionId === input.lastTransactionId &&
      this.record.documentVersion === input.baseVersion + 1 &&
      this.record.schemaVersion === input.schemaVersion &&
      isDeepStrictEqual(this.record.document, input.document)
    ) {
      return Promise.resolve({ kind: "replayed", record: this.record });
    }
    if (this.record.documentVersion !== input.baseVersion) {
      return Promise.resolve({
        kind: "conflict",
        currentVersion: this.record.documentVersion,
        lastTransactionId: this.record.lastTransactionId,
        lastSavedAt: this.record.lastSavedAt,
      });
    }
    if (this.invalidReferences.length > 0) {
      return Promise.resolve({
        kind: "invalid_resources",
        invalidReferences: this.invalidReferences,
      });
    }

    const savedAt = new Date(this.record.lastSavedAt.getTime() + 1000);
    this.lastStatistics = input.statistics;
    this.record = {
      ...this.record,
      schemaVersion: input.schemaVersion,
      document: structuredClone(input.document),
      documentVersion: input.baseVersion + 1,
      currentTextHash: input.statistics.currentTextHash,
      lastTransactionId: input.lastTransactionId,
      lastSavedBy: input.context.actorUserId,
      lastSavedAt: savedAt,
      updatedAt: savedAt,
    };
    return Promise.resolve({ kind: "saved", record: this.record });
  }
}

@Module({
  imports: [AppModule],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    InMemoryDocumentRepository,
    {
      provide: DOCUMENT_REPOSITORY,
      useExisting: InMemoryDocumentRepository,
    },
    {
      provide: APP_GUARD,
      useClass: DocumentHttpTestGuard,
    },
  ],
})
class DocumentHttpTestModule {}

describe("document HTTP flow", () => {
  let application: INestApplication;
  let repository: InMemoryDocumentRepository;

  beforeAll(async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    application = await NestFactory.create(DocumentHttpTestModule, {
      abortOnError: false,
      logger: false,
    });
    configureApplication(application, "development");
    await application.init();
    repository = application.get(InMemoryDocumentRepository);
  });

  afterAll(async () => {
    await application.close();
    vi.restoreAllMocks();
  });

  it("publishes the read/save contract and protects writes", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    const documentPath = specification.body.paths?.["/api/v1/articles/{articleId}/document"];
    expect(documentPath?.get?.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ArticleDocumentResponseDto",
    });
    expect(documentPath?.put?.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/SaveArticleDocumentDto",
    });

    await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .send({})
      .expect(403);
    await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/document`)
      .set("x-test-user", "missing")
      .expect(401);
  });

  it("reads the current document and increments its version once", async () => {
    const initial = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/document`)
      .expect(200);
    expect(initial.body.data).toMatchObject({
      articleId,
      documentId,
      documentVersion: 1,
      schemaVersion: "1.0.0",
      sourceBlocks: [
        expect.objectContaining({
          sourceBlockId: "source_heading",
          text: "初始文档",
        }),
      ],
      textLocked: true,
    });

    const document = structuredClone(repository.record.document);
    const heading = document.content.content.find((node) => node.type === "heading");
    if (heading?.type === "heading") {
      heading.attrs.styleOverrides = {
        ...heading.attrs.styleOverrides,
        marginBottom: 28,
      };
    }
    const saved = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .set("x-request-id", "req_document_save")
      .send({
        baseVersion: 1,
        schemaVersion: "1.0.0",
        document,
        lastTransactionId: firstTransactionId,
        transactionOrigin: "user_style_change",
      })
      .expect(200);

    expect(saved.body).toMatchObject({
      success: true,
      data: {
        documentVersion: 2,
        lastTransactionId: firstTransactionId,
        replayed: false,
      },
      meta: {
        requestId: "req_document_save",
      },
    });
    expect(repository.record.document).toEqual(document);
    expect(repository.lastStatistics).toMatchObject({
      imageCount: 1,
      svgCount: 1,
    });
    expect(repository.lastStatistics?.currentTextHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns 409 to a stale tab without overwriting the winner", async () => {
    const winningDocument = structuredClone(repository.record.document);
    const staleDocument = documentWithText("第二个标签页的旧版本");
    const conflict = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 1,
        schemaVersion: "1.0.0",
        document: staleDocument,
        lastTransactionId: secondTransactionId,
        transactionOrigin: "autosave",
      })
      .expect(409);

    expect(conflict.body.error).toMatchObject({
      code: "ARTICLE_VERSION_CONFLICT",
      message: "文章已在其他标签页更新",
      retryable: false,
      details: {
        articleId,
        currentVersion: 2,
        submittedVersion: 1,
        lastTransactionId: firstTransactionId,
      },
    });
    expect(repository.record.document).toEqual(winningDocument);
    expect(repository.record.documentVersion).toBe(2);
  });

  it("replays the same transaction without incrementing twice", async () => {
    const replayed = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 1,
        schemaVersion: "1.0.0",
        document: repository.record.document,
        lastTransactionId: firstTransactionId,
        transactionOrigin: "network_retry",
      })
      .expect(200);

    expect(replayed.body.data).toMatchObject({
      documentVersion: 2,
      lastTransactionId: firstTransactionId,
      replayed: true,
    });
    expect(repository.record.documentVersion).toBe(2);
  });

  it("rejects a reused transaction ID when the document payload differs", async () => {
    const winningDocument = structuredClone(repository.record.document);
    const conflict = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 1,
        schemaVersion: "1.0.0",
        document: documentWithText("错误复用事务 ID 的新内容"),
        lastTransactionId: firstTransactionId,
        transactionOrigin: "network_retry",
      })
      .expect(409);

    expect(conflict.body.error).toMatchObject({
      code: "ARTICLE_VERSION_CONFLICT",
      details: {
        currentVersion: 2,
        submittedVersion: 1,
      },
    });
    expect(repository.record.document).toEqual(winningDocument);
    expect(repository.record.documentVersion).toBe(2);
  });

  it("rejects invalid schemas, document identity mismatches and hidden owners", async () => {
    const invalid = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 2,
        schemaVersion: "1.0.0",
        document: { script: "<script>alert(1)</script>" },
        lastTransactionId: createUuidV7(),
        transactionOrigin: "autosave",
      })
      .expect(400);
    expect(invalid.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      retryable: false,
    });

    const mismatched = documentWithText("错误文档身份");
    mismatched.documentId = createUuidV7();
    const identityError = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 2,
        schemaVersion: "1.0.0",
        document: mismatched,
        lastTransactionId: createUuidV7(),
        transactionOrigin: "autosave",
      })
      .expect(400);
    expect(identityError.body.error.details.fields).toEqual([
      expect.objectContaining({ path: "document.documentId" }),
    ]);

    const hidden = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/document`)
      .set("x-test-user", "other")
      .expect(404);
    expect(hidden.body.error.code).toBe("ARTICLE_NOT_FOUND");
  });

  it("rejects unavailable or foreign resources without saving the document", async () => {
    const document = structuredClone(repository.record.document);
    const image = document.content.content.find((node) => node.type === "imageBlock");
    if (image?.type !== "imageBlock") {
      throw new Error("Document fixture image is missing");
    }
    image.attrs.resourceId = createUuidV7();
    const invalidReference = collectDocumentResourceReferences(document).find(
      ({ resourceId }) => resourceId === image.attrs.resourceId,
    );
    if (invalidReference === undefined) {
      throw new Error("Updated image reference was not collected");
    }
    repository.invalidReferences = [invalidReference];
    const before = structuredClone(repository.record);

    const rejected = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: repository.record.documentVersion,
        schemaVersion: "1.0.0",
        document,
        lastTransactionId: createUuidV7(),
        transactionOrigin: "editor.image",
      })
      .expect(400);
    repository.invalidReferences = [];

    expect(rejected.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      details: {
        fields: [
          {
            path: `document${invalidReference.path}`,
            message: "资源不存在、不可用或不属于当前用户",
          },
        ],
      },
    });
    expect(repository.record).toEqual(before);
  });

  it("rejects locked text changes and accepts an explicit unlock before editing", async () => {
    const lockedDocument = documentWithText("不应写入的锁定文字");
    const rejected = await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 2,
        schemaVersion: "1.0.0",
        document: lockedDocument,
        lastTransactionId: createUuidV7(),
        transactionOrigin: "editor.input",
      })
      .expect(409);

    expect(rejected.body.error).toMatchObject({
      code: "ORIGINAL_TEXT_LOCKED",
      retryable: false,
      details: {
        violations: [
          expect.objectContaining({
            blockId: "block_heading",
            code: "LOCKED_TEXT_CHANGED",
          }),
        ],
      },
    });
    expect(repository.record.documentVersion).toBe(2);

    const unlockedDocument = structuredClone(repository.record.document);
    const unlockedHeading = unlockedDocument.content.content.find(
      (node) => node.type === "heading",
    );
    if (unlockedHeading?.type === "heading") {
      unlockedHeading.attrs.locked = false;
    }
    await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 2,
        schemaVersion: "1.0.0",
        document: unlockedDocument,
        lastTransactionId: createUuidV7(),
        transactionOrigin: "editor.lock",
      })
      .expect(200);

    const editableDocument = structuredClone(repository.record.document);
    const editableHeading = editableDocument.content.content.find(
      (node) => node.type === "heading",
    );
    const inline = editableHeading?.type === "heading" ? editableHeading.content?.[0] : undefined;
    if (inline?.type === "text") {
      inline.text = "显式解锁后允许修改";
    }
    await supertest(application.getHttpServer())
      .put(`/api/v1/articles/${articleId}/document`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 3,
        schemaVersion: "1.0.0",
        document: editableDocument,
        lastTransactionId: createUuidV7(),
        transactionOrigin: "editor.input",
      })
      .expect(200);

    expect(repository.record.documentVersion).toBe(4);
    expect(repository.record.document.content.content[0]).toMatchObject({
      attrs: { locked: false },
      content: [{ text: "显式解锁后允许修改", type: "text" }],
    });
  });
});
import { isDeepStrictEqual } from "node:util";
