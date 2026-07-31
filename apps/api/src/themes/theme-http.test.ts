import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import {
  OFFICIAL_THEME_IDS,
  OFFICIAL_THEME_PALETTE_IDS,
  getOfficialTheme,
} from "@wechat-layout/design-tokens";
import { createUuidV7 } from "@wechat-layout/database";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import type { AuthenticatedHttpRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/http/api.exception.js";
import { configureApplication } from "../configure-application.js";
import { ThemeController } from "./theme.controller.js";
import { ThemeService } from "./theme.service.js";

const ownerUserId = createUuidV7();
const articleId = createUuidV7();
const safetySnapshotId = createUuidV7();
const packageAsset = getOfficialTheme(OFFICIAL_THEME_IDS.editorialMinimal)!;
const theme = {
  manifest: packageAsset.manifest,
  preview: packageAsset.preview,
  componentRefs: packageAsset.componentRefs,
  compatibility: packageAsset.compatibility,
  tokens: packageAsset.tokens,
  variants: packageAsset.variants,
  installed: true,
};

@Injectable()
class TestAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    request.auth = {
      sessionId: createUuidV7(),
      sessionTokenHash: "a".repeat(64),
      rawSessionToken: "test-session",
      expiresAt: new Date("2026-08-30T00:00:00.000Z"),
      user: {
        id: ownerUserId,
        email: "owner@example.com",
        username: null,
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
class TestCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest & { readonly method: string }>();
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

const themes = {
  list: vi.fn().mockReturnValue({
    items: [theme],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  }),
  get: vi.fn().mockReturnValue(theme),
  versions: vi.fn().mockReturnValue({ items: [theme], total: 1 }),
  preview: vi.fn().mockResolvedValue({
    articleId,
    documentVersion: 7,
    themeId: theme.manifest.themeId,
    themeVersion: theme.manifest.version,
    paletteId: theme.manifest.defaultPaletteId,
    html: "<section>预览</section>",
    outputHash: "sha256:preview",
    compatibilityReport: { canCopy: true, score: 100 },
    textIntegrity: { unchanged: true },
  }),
  apply: vi.fn().mockResolvedValue({
    articleId,
    themeId: theme.manifest.themeId,
    themeVersion: theme.manifest.version,
    paletteId: theme.manifest.defaultPaletteId,
    documentVersion: 8,
    lastTransactionId: createUuidV7(),
    safetySnapshotId,
    originalTextUnchanged: true,
    appliedAt: "2026-08-01T00:00:00.000Z",
  }),
};

@Module({
  imports: [AppModule],
  controllers: [ThemeController],
  providers: [
    { provide: ThemeService, useValue: themes },
    { provide: APP_GUARD, useClass: TestAuthenticationGuard },
    { provide: APP_GUARD, useClass: TestCsrfGuard },
  ],
})
class ThemeTestModule {}

describe("theme HTTP contracts", () => {
  let application: INestApplication;

  beforeAll(async () => {
    application = await NestFactory.create(ThemeTestModule, { logger: false });
    configureApplication(application, "test", "http://localhost:3000");
    await application.init();
  });

  afterAll(async () => {
    await application.close();
  });

  it("publishes catalog, immutable version, preview and apply contracts", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    const paths = specification.body.paths;
    expect(paths?.["/api/v1/themes"]?.get).toBeDefined();
    expect(paths?.["/api/v1/themes/{themeId}"]?.get).toBeDefined();
    expect(paths?.["/api/v1/themes/{themeId}/versions"]?.get).toBeDefined();
    expect(paths?.["/api/v1/themes/{themeId}/versions/{version}"]?.get).toBeDefined();
    expect(paths?.["/api/v1/articles/{articleId}/themes/{themeId}/preview"]?.post).toBeDefined();
    expect(paths?.["/api/v1/articles/{articleId}/themes/{themeId}/apply"]?.post).toBeDefined();
  });

  it("returns installed theme assets and protects preview/apply with CSRF", async () => {
    const catalog = await supertest(application.getHttpServer()).get("/api/v1/themes").expect(200);
    expect(catalog.body.data.items[0]).toMatchObject({
      installed: true,
      manifest: { name: "高级极简", version: "1.0.0" },
    });

    await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/themes/${theme.manifest.themeId}/preview`)
      .send({ themeVersion: "1.0.0" })
      .expect(403);

    const preview = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/themes/${theme.manifest.themeId}/preview`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        themeVersion: "1.0.0",
        paletteId: OFFICIAL_THEME_PALETTE_IDS.editorialMinimal,
        scope: "full",
        brandMode: "soft",
      })
      .expect(200);
    expect(preview.body.data.textIntegrity.unchanged).toBe(true);
  });

  it("passes optimistic-lock and original-text preservation settings to apply", async () => {
    const applied = await supertest(application.getHttpServer())
      .post(`/api/v1/articles/${articleId}/themes/${theme.manifest.themeId}/apply`)
      .set("x-csrf-token", "test-csrf-token")
      .send({
        baseDocumentVersion: 7,
        themeVersion: "1.0.0",
        paletteId: OFFICIAL_THEME_PALETTE_IDS.editorialMinimal,
        scope: "full",
        brandMode: "soft",
        preserveLockedBlocks: true,
      })
      .expect(200);
    expect(applied.body.data).toMatchObject({
      documentVersion: 8,
      originalTextUnchanged: true,
      safetySnapshotId,
    });
    expect(themes.apply).toHaveBeenCalledWith(
      ownerUserId,
      articleId,
      theme.manifest.themeId,
      expect.objectContaining({ baseDocumentVersion: 7, preserveLockedBlocks: true }),
      expect.objectContaining({ actorUserId: ownerUserId }),
    );
  });
});
