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
import type {
  ObjectStorage,
  ObjectStorageStat,
  SignedObjectRequest,
} from "@wechat-layout/storage-adapter";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import type { AuthenticatedHttpRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/http/api.exception.js";
import { configureApplication } from "../configure-application.js";
import { OBJECT_STORAGE } from "../storage/storage.module.js";
import { COPY_REPOSITORY } from "./copy.constants.js";
import { CopyController } from "./copy.controller.js";
import { CopyService } from "./copy.service.js";
import type {
  CopyRenderSource,
  CopyRepository,
  CreateCopyRecordInput,
  CreateCopyRecordResult,
  PersistRenderOutputInput,
  PersistRenderOutputResult,
  RenderOutputRecord,
} from "./copy.types.js";

const ownerUserId = createUuidV7();
const otherUserId = createUuidV7();
const articleId = createUuidV7();
const csrfToken = "copy-test-csrf";

function textDocument(): DocumentV1 {
  const document = structuredClone(documentV1Fixture);
  document.articleId = articleId;
  document.documentId = createUuidV7();
  document.content.content = document.content.content.filter(
    (node) => node.type === "heading" || node.type === "paragraph",
  );
  return document;
}

@Injectable()
class CopyHttpTestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      AuthenticatedHttpRequest & {
        readonly headers: Readonly<Record<string, string | string[] | undefined>>;
        readonly method: string;
      }
    >();
    if (request.headers["x-test-user"] === "missing") {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: "AUTH_REQUIRED",
        message: "需要登录后继续",
        retryable: false,
      });
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers["x-csrf-token"] !== csrfToken
    ) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: "CSRF_INVALID",
        message: "CSRF 校验失败",
        retryable: false,
      });
    }
    const userId = request.headers["x-test-user"] === "other" ? otherUserId : ownerUserId;
    request.auth = {
      sessionId: createUuidV7(),
      sessionTokenHash: "a".repeat(64),
      rawSessionToken: "copy-test-session",
      expiresAt: new Date("2026-08-31T00:00:00.000Z"),
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
class CopyHttpTestStorage implements ObjectStorage {
  readonly bucket = "copy-test";

  createDownloadUrl(input: {
    readonly key: string;
    readonly expiresInSeconds: number;
    readonly responseContentType?: string;
  }): Promise<SignedObjectRequest> {
    return Promise.resolve({
      url: `https://assets.example.com/${input.key}?signed=1`,
      headers: {},
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    });
  }

  createUploadUrl(): Promise<SignedObjectRequest> {
    throw new Error("not used");
  }

  statObject(): Promise<ObjectStorageStat> {
    throw new Error("not used");
  }

  getObject(): Promise<Uint8Array> {
    throw new Error("not used");
  }

  putObject(): Promise<ObjectStorageStat> {
    throw new Error("not used");
  }

  deleteObject(): Promise<void> {
    throw new Error("not used");
  }
}

@Injectable()
class InMemoryCopyRepository implements CopyRepository {
  lastRenderResult: PersistRenderOutputInput["renderResult"] = null;
  readonly outputs = new Map<string, RenderOutputRecord>();
  readonly records: CreateCopyRecordInput[] = [];
  source: CopyRenderSource = {
    accountId: null,
    articleId,
    brandVersionId: null,
    currentTextHash: null,
    document: textDocument(),
    documentSchemaVersion: "1.0.0",
    documentVersion: 4,
    resources: [],
    themeId: null,
    themeVersion: null,
  };

  findRenderSource(ownerId: string, requestedArticleId: string) {
    return Promise.resolve(
      ownerId === ownerUserId && requestedArticleId === articleId ? this.source : null,
    );
  }

  persistRenderOutput(input: PersistRenderOutputInput): Promise<PersistRenderOutputResult> {
    this.lastRenderResult = input.renderResult;
    if (input.ownerUserId !== ownerUserId || input.source.articleId !== articleId) {
      return Promise.resolve({ kind: "not_found" });
    }
    if (input.source.documentVersion !== this.source.documentVersion) {
      return Promise.resolve({
        kind: "version_conflict",
        currentVersion: this.source.documentVersion,
      });
    }
    const output: RenderOutputRecord = {
      id: createUuidV7(),
      articleId,
      snapshotId: createUuidV7(),
      mode: input.mode,
      rendererVersion: input.report.rendererVersion,
      ruleVersion: input.report.ruleVersion,
      html: input.renderResult?.html ?? null,
      plainText: input.renderResult?.plainText ?? null,
      outputHash: input.renderResult?.outputHash ?? null,
      status: input.renderResult === null ? "failed" : input.report.canCopy ? "ready" : "blocked",
      compatibilityReport: input.report,
      generatedAt: input.generatedAt,
      expiresAt: input.expiresAt,
    };
    this.outputs.set(output.id, output);
    return Promise.resolve({ kind: "created", output });
  }

  findOutput(ownerId: string, requestedArticleId: string, outputId: string) {
    return Promise.resolve(
      ownerId === ownerUserId && requestedArticleId === articleId
        ? (this.outputs.get(outputId) ?? null)
        : null,
    );
  }

  createRecord(input: CreateCopyRecordInput): Promise<CreateCopyRecordResult> {
    const output = this.outputs.get(input.renderOutputId);
    if (
      input.ownerUserId !== ownerUserId ||
      input.articleId !== articleId ||
      output === undefined
    ) {
      return Promise.resolve({ kind: "not_found" });
    }
    if (
      input.status === "success" &&
      (output.status !== "ready" || !output.compatibilityReport.canCopy)
    ) {
      return Promise.resolve({ kind: "output_blocked" });
    }
    this.records.push(input);
    return Promise.resolve({
      kind: "created",
      record: {
        id: createUuidV7(),
        renderOutputId: input.renderOutputId,
        status: input.status,
        copiedAt: new Date("2026-07-31T10:00:00.000Z"),
      },
    });
  }
}

@Module({
  imports: [AppModule],
  controllers: [CopyController],
  providers: [
    CopyService,
    InMemoryCopyRepository,
    {
      provide: COPY_REPOSITORY,
      useExisting: InMemoryCopyRepository,
    },
    {
      provide: OBJECT_STORAGE,
      useClass: CopyHttpTestStorage,
    },
    {
      provide: APP_GUARD,
      useClass: CopyHttpTestGuard,
    },
  ],
})
class CopyHttpTestModule {}

describe("wechat copy HTTP contract", () => {
  let application: INestApplication;
  let repository: InMemoryCopyRepository;

  beforeAll(async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    application = await NestFactory.create(CopyHttpTestModule, { logger: false });
    configureApplication(application, "production");
    await application.init();
    repository = application.get(InMemoryCopyRepository);
  });

  afterAll(async () => {
    await application.close();
    vi.restoreAllMocks();
  });

  it("creates a formal output, issues a dual-format payload, and records browser success", async () => {
    const server = application.getHttpServer();
    const rendered = await supertest(server)
      .post(`/api/v1/articles/${articleId}/render-wechat`)
      .set("x-csrf-token", csrfToken)
      .send({ documentVersion: 4, outputMode: "standard" })
      .expect(201);

    expect(rendered.body.data).toMatchObject({
      status: "ready",
      canCopy: true,
      outputMode: "standard",
      rendererVersion: "1.0.0",
      compatibilityRuleVersion: "1.1.0",
    });
    const renderOutputId = rendered.body.data.id as string;
    const payload = await supertest(server)
      .post(`/api/v1/articles/${articleId}/copy-payload`)
      .set("x-csrf-token", csrfToken)
      .send({ renderOutputId })
      .expect(200);
    expect(payload.body.data).toMatchObject({
      renderOutputId,
      html: expect.stringContaining("<section"),
      plainText: expect.stringContaining("Document Schema V1"),
    });

    const recorded = await supertest(server)
      .post(`/api/v1/articles/${articleId}/copy-records`)
      .set("x-csrf-token", csrfToken)
      .send({
        renderOutputId,
        status: "success",
        browserInfo: { browser: "Chrome" },
      })
      .expect(201);
    expect(recorded.body.data).toMatchObject({ renderOutputId, status: "success" });
    expect(repository.records.at(-1)).toMatchObject({
      status: "success",
      browserInfo: { browser: "Chrome" },
    });
  });

  it("enforces CSRF, ownership, and document-version boundaries", async () => {
    const server = application.getHttpServer();
    await supertest(server)
      .post(`/api/v1/articles/${articleId}/render-wechat`)
      .send({ documentVersion: 4, outputMode: "standard" })
      .expect(403);
    await supertest(server)
      .post(`/api/v1/articles/${articleId}/render-wechat`)
      .set("x-csrf-token", csrfToken)
      .set("x-test-user", "other")
      .send({ documentVersion: 4, outputMode: "standard" })
      .expect(404);
    const conflict = await supertest(server)
      .post(`/api/v1/articles/${articleId}/render-wechat`)
      .set("x-csrf-token", csrfToken)
      .send({ documentVersion: 3, outputMode: "standard" })
      .expect(409);
    expect(conflict.body.error.code).toBe("ARTICLE_VERSION_CONFLICT");
  });

  it("loads the bundled component registry in the formal copy path", async () => {
    const original = repository.source;
    const sentinel = "正式复制组件正文";
    const document = textDocument();
    document.content.content.push({
      type: "semanticCard",
      attrs: {
        blockId: "copy_official_component",
        componentId: "cmp_notice_info_blue_001",
        componentVariantId: "default",
        componentVersion: "1.0.0",
        locked: false,
        title: "阅读提示",
        variant: "default",
      },
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "copy_official_component_body", locked: false },
          content: [{ type: "text", text: sentinel }],
        },
      ],
    });
    repository.source = { ...original, document };

    const rendered = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/render-wechat`)
      .set("x-csrf-token", csrfToken)
      .send({ documentVersion: 4, outputMode: "wechat_safe" })
      .expect(201);
    expect(rendered.body.data).toMatchObject({ canCopy: true, status: "ready" });
    expect(repository.lastRenderResult?.manifest.componentVersions).toContain(
      "cmp_notice_info_blue_001@1.0.0",
    );

    const payload = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/copy-payload`)
      .set("x-csrf-token", csrfToken)
      .send({ renderOutputId: rendered.body.data.id })
      .expect(200);
    expect(payload.body.data.html).toContain(sentinel);
    repository.source = original;
  });

  it("blocks payload issuance when critical image compatibility checks fail", async () => {
    const original = repository.source;
    repository.source = {
      ...original,
      document: {
        ...structuredClone(documentV1Fixture),
        articleId,
        documentId: createUuidV7(),
      },
    };
    const rendered = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/render-wechat`)
      .set("x-csrf-token", csrfToken)
      .send({ documentVersion: 4, outputMode: "standard" })
      .expect(201);
    expect(rendered.body.data).toMatchObject({
      status: "blocked",
      canCopy: false,
      compatibilityReport: {
        summary: { critical: expect.any(Number) },
      },
    });
    await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/copy-payload`)
      .set("x-csrf-token", csrfToken)
      .send({ renderOutputId: rendered.body.data.id })
      .expect(409);
    repository.source = original;
  });

  it("publishes all copy endpoints and schemas in OpenAPI", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    const paths = Object.keys(specification.body.paths as Readonly<Record<string, unknown>>);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/v1/articles/{articleId}/render-wechat",
        "/api/v1/articles/{articleId}/copy-payload",
        "/api/v1/articles/{articleId}/copy-records",
      ]),
    );
    expect(specification.body.components.schemas).toMatchObject({
      CopyPayloadResponseDto: expect.any(Object),
      CreateCopyRecordDto: expect.any(Object),
      RenderOutputResponseDto: expect.any(Object),
    });
  });
});
