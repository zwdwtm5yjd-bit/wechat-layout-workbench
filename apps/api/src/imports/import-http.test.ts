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
import { DocxImportController } from "./docx-import.controller.js";
import { DocxImportService } from "./docx-import.service.js";
import { IMPORT_REPOSITORY } from "./import.constants.js";
import { ImportController } from "./import.controller.js";
import { ImportService } from "./import.service.js";
import type {
  ConfirmImportInput,
  ConfirmImportResult,
  CreatePasteImportInput,
  ImportRepository,
  ImportStructureRecord,
} from "./import.types.js";

const ownerUserId = createUuidV7();
const otherUserId = createUuidV7();

@Injectable()
class TestAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      AuthenticatedHttpRequest & {
        readonly headers: Readonly<Record<string, string | string[] | undefined>>;
        readonly method: string;
      }
    >();
    const other = request.headers["x-test-user"] === "other";
    const userId = other ? otherUserId : ownerUserId;
    request.auth = {
      sessionId: createUuidV7(),
      sessionTokenHash: "a".repeat(64),
      rawSessionToken: "test-session",
      expiresAt: new Date("2026-08-30T00:00:00.000Z"),
      user: {
        id: userId,
        email: other ? "other@example.com" : "owner@example.com",
        username: null,
        displayName: other ? "Other" : "Owner",
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
class TestCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      AuthenticatedHttpRequest & {
        readonly headers: Readonly<Record<string, string | string[] | undefined>>;
        readonly method: string;
      }
    >();
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
    return true;
  }
}

class InMemoryImportRepository implements ImportRepository {
  readonly owners = new Map<string, string>();
  readonly records = new Map<string, ImportStructureRecord>();
  readonly snapshots = new Map<string, { id: string; number: number }>();

  async createPaste(input: CreatePasteImportInput): Promise<ImportStructureRecord> {
    const articleId = createUuidV7();
    const record: ImportStructureRecord = {
      articleId,
      sourceDocumentId: createUuidV7(),
      title: input.parsed.title,
      accountId: input.accountId,
      status: "pending_recognition",
      documentId: createUuidV7(),
      documentVersion: 1,
      lastTransactionId: null,
      lastSavedAt: new Date("2026-07-30T01:00:00.000Z"),
      detectedSource: input.parsed.detectedSource,
      cleaningMode: input.parsed.cleaningMode,
      originalText: input.parsed.originalText,
      blocks: input.parsed.blocks,
      warnings: input.parsed.warnings,
      statistics: input.parsed.statistics,
    };
    this.owners.set(articleId, input.ownerUserId);
    this.records.set(articleId, record);
    return record;
  }

  async findStructure(
    ownerUserId: string,
    articleId: string,
  ): Promise<ImportStructureRecord | null> {
    return this.owners.get(articleId) === ownerUserId
      ? (this.records.get(articleId) ?? null)
      : null;
  }

  async confirm(input: ConfirmImportInput): Promise<ConfirmImportResult> {
    const current = await this.findStructure(input.ownerUserId, input.articleId);
    if (current === null) {
      return { kind: "not_found" };
    }
    if (current.documentVersion !== input.baseVersion) {
      if (
        current.documentVersion === input.baseVersion + 1 &&
        current.lastTransactionId === input.lastTransactionId
      ) {
        const snapshot = this.snapshots.get(input.articleId);
        if (snapshot === undefined) {
          throw new Error("missing test snapshot");
        }
        return {
          kind: "confirmed",
          record: current,
          snapshotId: snapshot.id,
          snapshotNumber: snapshot.number,
        };
      }
      return {
        kind: "conflict",
        currentVersion: current.documentVersion,
        lastTransactionId: current.lastTransactionId,
        lastSavedAt: current.lastSavedAt,
      };
    }
    if (current.status !== "pending_recognition" || input.blocks.length !== current.blocks.length) {
      return { kind: "invalid_state" };
    }
    const roles = new Map(input.blocks.map((block) => [block.sourceBlockId, block.role] as const));
    if (current.blocks.some((block) => !roles.has(block.sourceBlockId))) {
      return { kind: "invalid_state" };
    }
    const snapshot = { id: createUuidV7(), number: 1 };
    const confirmed: ImportStructureRecord = {
      ...current,
      title:
        input.title ??
        current.blocks.find((block) => roles.get(block.sourceBlockId) === "title")?.text ??
        current.title,
      status: "pending_layout",
      documentVersion: current.documentVersion + 1,
      lastTransactionId: input.lastTransactionId,
      lastSavedAt: new Date("2026-07-30T01:05:00.000Z"),
      blocks: current.blocks.map((block) => ({
        ...block,
        role: roles.get(block.sourceBlockId) ?? block.role,
      })),
    };
    this.records.set(input.articleId, confirmed);
    this.snapshots.set(input.articleId, snapshot);
    return {
      kind: "confirmed",
      record: confirmed,
      snapshotId: snapshot.id,
      snapshotNumber: snapshot.number,
    };
  }
}

const repository = new InMemoryImportRepository();
const docxJobId = createUuidV7();
const docxArticleId = createUuidV7();
const docxImports = {
  create: vi.fn().mockResolvedValue({ jobId: docxJobId, articleId: docxArticleId }),
};

@Module({
  imports: [AppModule],
  controllers: [DocxImportController, ImportController],
  providers: [
    ImportService,
    { provide: DocxImportService, useValue: docxImports },
    { provide: IMPORT_REPOSITORY, useValue: repository },
    { provide: APP_GUARD, useClass: TestAuthenticationGuard },
    { provide: APP_GUARD, useClass: TestCsrfGuard },
  ],
})
class ImportTestModule {}

describe("paste import HTTP flow", () => {
  let application: INestApplication;

  beforeAll(async () => {
    application = await NestFactory.create(ImportTestModule, { logger: false });
    configureApplication(application, "test", "http://localhost:3000");
    await application.init();
  });

  afterAll(async () => {
    await application.close();
  });

  it("publishes the import contracts and protects writes with CSRF", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    expect(specification.body.paths?.["/api/v1/imports/paste"]?.post).toBeDefined();
    expect(specification.body.paths?.["/api/v1/imports/docx"]?.post).toBeDefined();
    expect(specification.body.paths?.["/api/v1/imports/{articleId}/structure"]?.get).toBeDefined();
    expect(specification.body.paths?.["/api/v1/imports/{articleId}/structure"]?.put).toBeDefined();

    const rejected = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .send({ plainText: "未携带 CSRF" })
      .expect(403);
    expect(rejected.body.error.code).toBe("CSRF_INVALID");

    const resourceId = createUuidV7();
    const queued = await supertest(application.getHttpServer())
      .post("/api/v1/imports/docx")
      .set("x-csrf-token", "test-csrf-token")
      .send({ resourceId })
      .expect(201);
    expect(queued.body.data).toEqual({ jobId: docxJobId, articleId: docxArticleId });
    expect(docxImports.create).toHaveBeenCalledWith(
      ownerUserId,
      expect.objectContaining({
        resourceId,
        cleaningMode: "preserve_structure",
        contentType: "general",
        layoutStrength: "standard",
      }),
      expect.objectContaining({ actorUserId: ownerUserId }),
    );
  });

  it("imports Word HTML, preserves traceable plain text and never returns hidden scripts", async () => {
    const response = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({
        cleaningMode: "preserve_structure",
        detectedSourceHint: "auto",
        html: `
          <div xmlns:o="urn:schemas-microsoft-com:office:office">
            <script>window.secret = "must-not-survive"</script>
            <h1 class="MsoTitle">巡察整改报告</h1>
            <p style="mso-hide:all">隐藏批注</p>
            <p class="MsoNormal">第一段正文</p>
          </div>
        `,
        plainText: "巡察整改报告\n第一段正文",
      })
      .expect(201);

    expect(response.body.data.detectedSource).toBe("word");
    expect(response.body.data.originalText).toBe("巡察整改报告\n第一段正文");
    expect(response.body.data.blocks.map((block: { text: string }) => block.text)).toEqual([
      "巡察整改报告",
      "第一段正文",
    ]);
    expect(response.body.data.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SECURITY_CONTENT_REMOVED" }),
        expect.objectContaining({ code: "HIDDEN_CONTENT_REMOVED" }),
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain("must-not-survive");
    expect(JSON.stringify(response.body)).not.toContain("隐藏批注");
  });

  it("imports WPS lists and browser tables/images with explicit warnings", async () => {
    const wps = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({
        html: '<div class="wps-content"><h1>清单</h1><ul><li>事项一</li><li>事项二</li></ul></div>',
      })
      .expect(201);
    expect(wps.body.data.detectedSource).toBe("wps");
    expect(wps.body.data.blocks.map((block: { role: string }) => block.role)).toEqual([
      "title",
      "bullet_item",
      "bullet_item",
    ]);

    const web = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({
        detectedSourceHint: "web",
        html: `
          <h1>网页文章</h1>
          <table><tr><td>项目</td><td>数量</td></tr></table>
          <img src="https://cdn.example.com/a.png" alt="图片">
        `,
      })
      .expect(201);
    expect(web.body.data.statistics).toEqual(
      expect.objectContaining({ imageCount: 1, tableCount: 1 }),
    );
    expect(web.body.data.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_STRUCTURE_FLATTENED" }),
        expect.objectContaining({ code: "EXTERNAL_IMAGE_REFERENCE" }),
      ]),
    );
  });

  it("keeps uploaded image resources in the import structure", async () => {
    const resourceId = createUuidV7();
    const response = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({
        plainText: "活动回顾\n正文内容",
        images: [
          {
            resourceId,
            placementIndex: 1,
            alt: "现场照片.jpg",
            caption: "活动现场合影",
          },
        ],
      })
      .expect(201);

    expect(response.body.data.statistics.imageCount).toBe(1);
    expect(response.body.data.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "image_reference",
          relation: expect.objectContaining({
            resourceId,
            alt: "现场照片.jpg",
            caption: "活动现场合影",
          }),
        }),
      ]),
    );
  });

  it("restores structure state on refresh while hiding another owner's import", async () => {
    const created = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({ plainText: "标题\n正文" })
      .expect(201);
    const articleId = created.body.data.articleId as string;

    const loaded = await supertest(application.getHttpServer())
      .get(`/api/v1/imports/${articleId}/structure`)
      .expect(200);
    expect(loaded.body.data).toEqual(created.body.data);

    const hidden = await supertest(application.getHttpServer())
      .get(`/api/v1/imports/${articleId}/structure`)
      .set("x-test-user", "other")
      .expect(404);
    expect(hidden.body.error.code).toBe("IMPORT_NOT_FOUND");
  });

  it("confirms roles, increments the document version and returns an after-import snapshot", async () => {
    const created = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({ plainText: "原标题\n第一段\n第二段" })
      .expect(201);
    const articleId = created.body.data.articleId as string;
    const transactionId = createUuidV7();
    const blocks = created.body.data.blocks.map(
      (block: { sourceBlockId: string }, index: number) => ({
        sourceBlockId: block.sourceBlockId,
        role: index === 0 ? "title" : index === 1 ? "quote" : "excluded",
      }),
    );

    const confirmed = await supertest(application.getHttpServer())
      .put(`/api/v1/imports/${articleId}/structure`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 1,
        lastTransactionId: transactionId,
        title: "确认后的标题",
        blocks,
      })
      .expect(200);
    expect(confirmed.body.data).toEqual(
      expect.objectContaining({
        status: "pending_layout",
        title: "确认后的标题",
        documentVersion: 2,
        lastTransactionId: transactionId,
        snapshotNumber: 1,
        editorUrl: `/workspace/articles/${articleId}`,
      }),
    );
    expect(confirmed.body.data.snapshotId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const replayed = await supertest(application.getHttpServer())
      .put(`/api/v1/imports/${articleId}/structure`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 1,
        lastTransactionId: transactionId,
        title: "确认后的标题",
        blocks,
      })
      .expect(200);
    expect(replayed.body.data.snapshotId).toBe(confirmed.body.data.snapshotId);
  });

  it("rejects empty content, duplicate blocks and stale confirmation without silent overwrite", async () => {
    const empty = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({ plainText: "   " })
      .expect(400);
    expect(empty.body.error.code).toBe("VALIDATION_FAILED");

    const created = await supertest(application.getHttpServer())
      .post("/api/v1/imports/paste")
      .set("x-csrf-token", "test-csrf-token")
      .send({ plainText: "标题\n正文" })
      .expect(201);
    const articleId = created.body.data.articleId as string;
    const firstBlock = created.body.data.blocks[0] as { sourceBlockId: string; role: string };
    const first = {
      sourceBlockId: firstBlock.sourceBlockId,
      role: firstBlock.role,
    };
    const duplicate = await supertest(application.getHttpServer())
      .put(`/api/v1/imports/${articleId}/structure`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 1,
        lastTransactionId: createUuidV7(),
        blocks: [first, first],
      })
      .expect(400);
    expect(duplicate.body.error.details.fields[0].path).toBe("blocks");

    const stale = await supertest(application.getHttpServer())
      .put(`/api/v1/imports/${articleId}/structure`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseVersion: 99,
        lastTransactionId: createUuidV7(),
        blocks: created.body.data.blocks.map((block: { sourceBlockId: string; role: string }) => ({
          sourceBlockId: block.sourceBlockId,
          role: block.role,
        })),
      })
      .expect(409);
    expect(stale.body.error.code).toBe("ARTICLE_VERSION_CONFLICT");
    expect((await repository.findStructure(ownerUserId, articleId))?.documentVersion).toBe(1);
  });
});
