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
import { SNAPSHOT_REPOSITORY } from "./snapshot.constants.js";
import { SnapshotController } from "./snapshot.controller.js";
import { buildSnapshotManifests } from "./snapshot-manifest.js";
import { SnapshotService } from "./snapshot.service.js";
import type {
  ArticleSnapshotRecord,
  CreateSnapshotInput,
  CreateSnapshotResult,
  RestoreSnapshotInput,
  RestoreSnapshotResult,
  SnapshotListResult,
  SnapshotReason,
  SnapshotRepository,
} from "./snapshot.types.js";

const ownerUserId = createUuidV7();
const otherUserId = createUuidV7();
const articleId = createUuidV7();
const documentId = createUuidV7();
const themeId = createUuidV7();
const brandVersionId = createUuidV7();
const now = new Date("2026-07-30T10:00:00.000Z");

function documentWithText(text: string): DocumentV1 {
  const document = structuredClone(documentV1Fixture) as DocumentV1;
  document.articleId = articleId;
  document.documentId = documentId;
  document.themeId = themeId;
  document.themeVersion = "2.0.0";
  document.brandVersion = "3.0.0";
  const heading = document.content.content.find((node) => node.type === "heading");
  const firstInline = heading?.content?.[0];
  if (firstInline?.type === "text") {
    firstInline.text = text;
  }
  return document;
}

@Injectable()
class SnapshotHttpTestGuard implements CanActivate {
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
class InMemorySnapshotRepository implements SnapshotRepository {
  readonly records: ArticleSnapshotRecord[] = [];
  currentDocument = documentWithText("初始快照内容");
  documentVersion = 1;
  lastTransactionId: string | null = null;
  lastSavedAt = now;
  currentSnapshotId: string | null = null;

  list(
    ownerId: string,
    requestedArticleId: string,
    page: number,
    pageSize: number,
  ): Promise<SnapshotListResult | null> {
    if (ownerId !== ownerUserId || requestedArticleId !== articleId) {
      return Promise.resolve(null);
    }
    const sorted = [...this.records]
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.snapshotNumber - left.snapshotNumber,
      )
      .map((snapshot) => ({
        ...snapshot,
        isCurrent: snapshot.id === this.currentSnapshotId,
      }));
    return Promise.resolve({
      items: sorted.slice((page - 1) * pageSize, page * pageSize),
      total: sorted.length,
    });
  }

  find(
    ownerId: string,
    requestedArticleId: string,
    snapshotId: string,
  ): Promise<ArticleSnapshotRecord | null> {
    const snapshot =
      ownerId === ownerUserId && requestedArticleId === articleId
        ? this.records.find((candidate) => candidate.id === snapshotId)
        : undefined;
    return Promise.resolve(
      snapshot === undefined
        ? null
        : {
            ...snapshot,
            isCurrent: snapshot.id === this.currentSnapshotId,
          },
    );
  }

  create(input: CreateSnapshotInput): Promise<CreateSnapshotResult> {
    if (input.ownerUserId !== ownerUserId || input.articleId !== articleId) {
      return Promise.resolve({ kind: "not_found" });
    }
    const snapshot = this.appendSnapshot(
      input.reason,
      input.note,
      this.currentDocument,
      new Date(now.getTime() + this.records.length * 1000),
    );
    this.currentSnapshotId = snapshot.id;
    return Promise.resolve({
      kind: "created",
      snapshot: { ...snapshot, isCurrent: true },
    });
  }

  restore(input: RestoreSnapshotInput): Promise<RestoreSnapshotResult> {
    if (input.ownerUserId !== ownerUserId || input.articleId !== articleId) {
      return Promise.resolve({ kind: "not_found" });
    }
    const target = this.records.find((snapshot) => snapshot.id === input.snapshotId);
    if (target === undefined) {
      return Promise.resolve({ kind: "not_found" });
    }
    if (this.documentVersion !== input.baseVersion) {
      return Promise.resolve({
        kind: "conflict",
        currentVersion: this.documentVersion,
        lastTransactionId: this.lastTransactionId,
        lastSavedAt: this.lastSavedAt,
      });
    }

    const safetySnapshot = this.appendSnapshot(
      "before_restore",
      `恢复版本 #${target.snapshotNumber} 前自动保存`,
      this.currentDocument,
      new Date(now.getTime() + this.records.length * 1000),
    );
    const restoredDocument = structuredClone(target.document);
    restoredDocument.documentId = documentId;
    restoredDocument.articleId = articleId;
    restoredDocument.meta.updatedAt = new Date(
      now.getTime() + (this.records.length + 1) * 1000,
    ).toISOString();
    this.currentDocument = restoredDocument;
    this.documentVersion += 1;
    this.lastTransactionId = input.lastTransactionId;
    this.lastSavedAt = new Date(now.getTime() + (this.records.length + 1) * 1000);
    const restoredSnapshot = this.appendSnapshot(
      "restored",
      `由版本 #${target.snapshotNumber} 恢复`,
      restoredDocument,
      this.lastSavedAt,
      target,
    );
    this.currentSnapshotId = restoredSnapshot.id;

    return Promise.resolve({
      kind: "restored",
      documentVersion: this.documentVersion,
      lastTransactionId: input.lastTransactionId,
      lastSavedAt: this.lastSavedAt,
      safetySnapshot: { ...safetySnapshot, isCurrent: false },
      restoredSnapshot: { ...restoredSnapshot, isCurrent: true },
    });
  }

  private appendSnapshot(
    reason: SnapshotReason,
    note: string | null,
    document: DocumentV1,
    createdAt: Date,
    source?: ArticleSnapshotRecord,
  ): ArticleSnapshotRecord {
    const manifests = buildSnapshotManifests(document, {
      themeId,
      themeVersion: "2.0.0",
      brandVersionId,
    });
    const snapshot: ArticleSnapshotRecord = {
      id: createUuidV7(),
      articleId,
      snapshotNumber: this.records.length + 1,
      reason,
      documentSchemaVersion: "1.0.0",
      document: structuredClone(document),
      themeId: source?.themeId ?? themeId,
      themeVersion: source?.themeVersion ?? "2.0.0",
      brandVersionId: source?.brandVersionId ?? brandVersionId,
      compatibilityRuleVersion: null,
      rendererVersion: null,
      resourceManifest: source?.resourceManifest ?? manifests.resourceManifest,
      packageManifest: source?.packageManifest ?? manifests.packageManifest,
      textHash: "b".repeat(64),
      compatibilityScore: source?.compatibilityScore ?? 96,
      htmlHash: null,
      note,
      createdBy: ownerUserId,
      createdAt,
      isCurrent: false,
    };
    this.records.push(snapshot);
    return snapshot;
  }
}

@Module({
  imports: [AppModule],
  controllers: [SnapshotController],
  providers: [
    SnapshotService,
    InMemorySnapshotRepository,
    {
      provide: SNAPSHOT_REPOSITORY,
      useExisting: InMemorySnapshotRepository,
    },
    {
      provide: APP_GUARD,
      useClass: SnapshotHttpTestGuard,
    },
  ],
})
class SnapshotHttpTestModule {}

describe("snapshot HTTP flow", () => {
  let application: INestApplication;
  let repository: InMemorySnapshotRepository;
  let service: SnapshotService;
  let manualSnapshotId: string;

  beforeAll(async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    application = await NestFactory.create(SnapshotHttpTestModule, {
      abortOnError: false,
      logger: false,
    });
    configureApplication(application, "development");
    await application.init();
    repository = application.get(InMemorySnapshotRepository);
    service = application.get(SnapshotService);
  });

  afterAll(async () => {
    await application.close();
    vi.restoreAllMocks();
  });

  it("publishes snapshot contracts and protects writes", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    const collection = specification.body.paths?.["/api/v1/articles/{articleId}/snapshots"];
    const restore =
      specification.body.paths?.["/api/v1/articles/{articleId}/snapshots/{snapshotId}/restore"];
    expect(collection?.get?.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/SnapshotListResponseDto",
    });
    expect(collection?.post?.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CreateSnapshotDto",
    });
    expect(restore?.post?.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/RestoreSnapshotDto",
    });

    await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/snapshots`)
      .send({ reason: "manual" })
      .expect(403);
    await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/snapshots`)
      .set("x-test-user", "missing")
      .expect(401);
  });

  it("creates a manual immutable snapshot with theme, brand and manifests", async () => {
    const response = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/snapshots`)
      .set("x-csrf-token", "test-csrf-token")
      .set("x-request-id", "req_snapshot_manual")
      .send({
        reason: "manual",
        note: "第一轮排版完成",
      })
      .expect(201);

    manualSnapshotId = response.body.data.id;
    expect(response.body).toMatchObject({
      success: true,
      data: {
        snapshotNumber: 1,
        reason: "manual",
        themeId,
        themeVersion: "2.0.0",
        brandVersionId,
        note: "第一轮排版完成",
        isCurrent: true,
      },
      meta: {
        requestId: "req_snapshot_manual",
      },
    });
    expect(response.body.data.resourceManifest.length).toBeGreaterThan(0);
    expect(response.body.data.packageManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "theme", packageId: themeId, version: "2.0.0" }),
        expect.objectContaining({ kind: "brand", packageId: brandVersionId, version: "3.0.0" }),
      ]),
    );
  });

  it("supports import/theme automatic hooks and lists versions newest first", async () => {
    const context = {
      actorUserId: ownerUserId,
      requestId: "req_automatic_snapshots",
      traceId: "trace_automatic_snapshots",
    };
    await service.createAutomatic(ownerUserId, articleId, "after_import", "导入完成", context);
    await service.createAutomatic(
      ownerUserId,
      articleId,
      "before_theme_apply",
      "应用主题前",
      context,
    );

    const response = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/snapshots?page=1&pageSize=20`)
      .expect(200);
    expect(response.body.data.items.map((item: { reason: string }) => item.reason)).toEqual([
      "before_theme_apply",
      "after_import",
      "manual",
    ]);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 3,
      totalPages: 1,
    });
  });

  it("returns the same immutable document through detail and preview", async () => {
    const before = structuredClone(repository.records[0]?.document);
    const detail = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/snapshots/${manualSnapshotId}`)
      .expect(200);
    const preview = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/snapshots/${manualSnapshotId}/preview`)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);

    expect(detail.body.data.document).toEqual(before);
    expect(preview.body.data.document).toEqual(before);
    expect(repository.records[0]?.document).toEqual(before);
  });

  it("restores atomically by creating safety and restored snapshots", async () => {
    const originalTarget = structuredClone(repository.records[0]);
    repository.currentDocument = documentWithText("恢复前的较新内容");
    repository.documentVersion = 2;
    const transactionId = createUuidV7();

    const response = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/snapshots/${manualSnapshotId}/restore`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        mode: "replace_current",
        baseVersion: 2,
        lastTransactionId: transactionId,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      restoredFromSnapshotId: manualSnapshotId,
      documentVersion: 3,
      lastTransactionId: transactionId,
      safetySnapshot: {
        reason: "before_restore",
        isCurrent: false,
      },
      restoredSnapshot: {
        reason: "restored",
        isCurrent: true,
      },
    });
    expect(repository.currentDocument).toMatchObject({
      documentId,
      articleId,
    });
    expect(repository.currentDocument).toEqual(
      expect.objectContaining({
        content: originalTarget?.document.content,
      }),
    );
    expect(repository.records[0]).toEqual(originalTarget);
  });

  it("leaves the article unchanged when restore sees a stale version", async () => {
    const documentBefore = structuredClone(repository.currentDocument);
    const snapshotsBefore = structuredClone(repository.records);

    const response = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/snapshots/${manualSnapshotId}/restore`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        mode: "replace_current",
        baseVersion: 2,
        lastTransactionId: createUuidV7(),
      })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: "ARTICLE_VERSION_CONFLICT",
      details: {
        currentVersion: 3,
        submittedVersion: 2,
      },
    });
    expect(repository.currentDocument).toEqual(documentBefore);
    expect(repository.records).toEqual(snapshotsBefore);
  });

  it("hides snapshots owned by another user", async () => {
    const hidden = await supertest(application.getHttpServer())
      .get(`/api/v1/articles/${articleId}/snapshots/${manualSnapshotId}`)
      .set("x-test-user", "other")
      .expect(404);
    expect(hidden.body.error.code).toBe("SNAPSHOT_NOT_FOUND");
  });
});
