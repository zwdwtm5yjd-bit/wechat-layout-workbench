import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  getOfficialTheme,
  getOfficialThemeVersions,
  listOfficialThemes,
  type OfficialThemePackage,
} from "@wechat-layout/design-tokens";
import { isUuidV7 } from "@wechat-layout/database";
import { WechatCompatibilityEngine } from "@wechat-layout/wechat-renderer";

import { ApiException } from "../common/http/api.exception.js";
import { SnapshotService } from "../snapshots/snapshot.service.js";
import { THEME_REPOSITORY } from "./theme.constants.js";
import type {
  ApplyThemeRequestDto,
  ThemeListQueryDto,
  ThemePreviewRequestDto,
} from "./theme.dto.js";
import type { ThemeMutationContext, ThemeRepository } from "./theme.types.js";

function apiError(
  status: number,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ApiException {
  return new ApiException(status, {
    code,
    message,
    ...(details === undefined ? {} : { details }),
    retryable: false,
  });
}

function validateArticleId(articleId: string): void {
  if (!isUuidV7(articleId)) {
    throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "提交内容存在错误", {
      fields: [{ path: "articleId", message: "必须是 UUIDv7" }],
    });
  }
}

function themeDto(theme: OfficialThemePackage) {
  return {
    manifest: {
      ...theme.manifest,
      categories: [...theme.manifest.categories],
      recommendedContentTypes: [...theme.manifest.recommendedContentTypes],
      supportedPalettes: [...theme.manifest.supportedPalettes],
    },
    preview: {
      ...theme.preview,
      accentColors: [...theme.preview.accentColors],
    },
    componentRefs: [...theme.componentRefs],
    tokens: theme.tokens,
    compatibility: theme.compatibility,
    variants: theme.variants.map((variant) => ({
      ...variant,
      swatches: [...variant.swatches],
    })),
    installed: true,
  };
}

function expectedHash(hash: string | null): string | undefined {
  return hash === null ? undefined : `sha256:${hash}`;
}

@Injectable()
export class ThemeService {
  readonly #engine = new WechatCompatibilityEngine();

  constructor(
    @Inject(THEME_REPOSITORY)
    private readonly repository: ThemeRepository,
    @Inject(SnapshotService)
    private readonly snapshots: SnapshotService,
  ) {}

  list(query: Readonly<Partial<ThemeListQueryDto>>) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const matches = listOfficialThemes({
      ...(query.category === undefined ? {} : { category: query.category }),
      ...(query.compatibilityLevel === undefined
        ? {}
        : { compatibilityLevel: query.compatibilityLevel }),
      ...(query.contentType === undefined ? {} : { contentType: query.contentType }),
      ...(query.search === undefined ? {} : { search: query.search }),
    });
    const offset = (page - 1) * pageSize;
    return {
      items: matches.slice(offset, offset + pageSize).map(themeDto),
      pagination: {
        page,
        pageSize,
        total: matches.length,
        totalPages: matches.length === 0 ? 0 : Math.ceil(matches.length / pageSize),
      },
    };
  }

  get(themeId: string, version?: string) {
    return themeDto(this.requireTheme(themeId, version));
  }

  versions(themeId: string) {
    const versions = getOfficialThemeVersions(themeId);
    if (versions.length === 0) {
      throw apiError(HttpStatus.NOT_FOUND, "THEME_NOT_FOUND", "主题不存在");
    }
    return {
      items: versions.map(themeDto),
      total: versions.length,
    };
  }

  async preview(
    ownerUserId: string,
    articleId: string,
    themeId: string,
    body: ThemePreviewRequestDto,
  ) {
    validateArticleId(articleId);
    const theme = this.requireTheme(themeId, body.themeVersion);
    const paletteId = this.resolvePalette(theme, body.paletteId);
    const source = await this.repository.findArticle(ownerUserId, articleId);
    if (source === null) {
      throw apiError(HttpStatus.NOT_FOUND, "ARTICLE_NOT_FOUND", "文章不存在");
    }
    const sourceTextHash = expectedHash(source.currentTextHash);
    const checked = this.#engine.check({
      document: source.document,
      ...(sourceTextHash === undefined ? {} : { expectedSourceTextHash: sourceTextHash }),
      mode: "wechat_safe",
      theme: theme.tokens,
    });
    if (checked.renderResult === null) {
      throw apiError(HttpStatus.CONFLICT, "THEME_PREVIEW_FAILED", "主题预览未通过兼容检查", {
        compatibilityReport: checked.report,
      });
    }
    return {
      articleId,
      documentVersion: source.documentVersion,
      themeId: theme.manifest.themeId,
      themeVersion: theme.manifest.version,
      paletteId,
      html: checked.renderResult.html,
      outputHash: checked.renderResult.outputHash,
      compatibilityReport: checked.report,
      textIntegrity: checked.renderResult.textIntegrity,
    };
  }

  async apply(
    ownerUserId: string,
    articleId: string,
    themeId: string,
    body: ApplyThemeRequestDto,
    context: ThemeMutationContext,
  ) {
    if (!body.preserveLockedBlocks) {
      throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "基础主题应用必须保留锁定区块", {
        fields: [{ path: "preserveLockedBlocks", message: "当前版本必须为 true" }],
      });
    }
    const preview = await this.preview(ownerUserId, articleId, themeId, body);
    if (preview.documentVersion !== body.baseDocumentVersion) {
      throw this.versionConflict(body.baseDocumentVersion, preview.documentVersion);
    }
    const safetySnapshot = await this.snapshots.createAutomatic(
      ownerUserId,
      articleId,
      "before_theme_apply",
      `应用主题 ${preview.themeId}@${preview.themeVersion} 前自动创建`,
      context,
    );
    const result = await this.repository.apply({
      articleId,
      baseDocumentVersion: body.baseDocumentVersion,
      context,
      ownerUserId,
      paletteId: preview.paletteId,
      themeId: preview.themeId,
      themeVersion: preview.themeVersion,
    });
    if (result.kind === "not_found") {
      throw apiError(HttpStatus.NOT_FOUND, "ARTICLE_NOT_FOUND", "文章不存在");
    }
    if (result.kind === "version_conflict") {
      throw this.versionConflict(body.baseDocumentVersion, result.currentVersion);
    }
    return {
      articleId,
      themeId: preview.themeId,
      themeVersion: preview.themeVersion,
      paletteId: preview.paletteId,
      documentVersion: result.documentVersion,
      lastTransactionId: result.lastTransactionId,
      safetySnapshotId: safetySnapshot.id,
      originalTextUnchanged: true as const,
      appliedAt: result.appliedAt.toISOString(),
    };
  }

  private requireTheme(themeId: string, version?: string): OfficialThemePackage {
    if (!isUuidV7(themeId)) {
      throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "主题 ID 必须是 UUIDv7");
    }
    const theme = getOfficialTheme(themeId, version);
    if (theme === null) {
      throw apiError(
        HttpStatus.NOT_FOUND,
        version === undefined ? "THEME_NOT_FOUND" : "THEME_VERSION_NOT_FOUND",
        version === undefined ? "主题不存在" : "主题版本不存在",
      );
    }
    return theme;
  }

  private resolvePalette(theme: OfficialThemePackage, requested?: string): string {
    const paletteId = requested ?? theme.manifest.defaultPaletteId;
    if (!theme.manifest.supportedPalettes.includes(paletteId)) {
      throw apiError(HttpStatus.BAD_REQUEST, "THEME_PALETTE_NOT_FOUND", "主题配色不存在");
    }
    return paletteId;
  }

  private versionConflict(submittedVersion: number, currentVersion: number): ApiException {
    return apiError(
      HttpStatus.CONFLICT,
      "ARTICLE_VERSION_CONFLICT",
      "文章版本已更新，请保存或刷新后重试",
      { currentVersion, submittedVersion },
    );
  }
}
