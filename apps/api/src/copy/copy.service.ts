import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { getOfficialTheme } from "@wechat-layout/design-tokens";
import { isUuidV7 } from "@wechat-layout/database";
import type { ObjectStorage } from "@wechat-layout/storage-adapter";
import {
  WechatCompatibilityEngine,
  type WechatOutputMode,
  type WechatResourceMap,
} from "@wechat-layout/wechat-renderer";

import { ApiException } from "../common/http/api.exception.js";
import { OBJECT_STORAGE } from "../storage/storage.module.js";
import { COPY_PAYLOAD_TTL_SECONDS, COPY_REPOSITORY } from "./copy.constants.js";
import type { CreateCopyRecordDto, CreateWechatRenderDto } from "./copy.dto.js";
import type { CopyMutationContext, CopyRepository, RenderOutputRecord } from "./copy.types.js";

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

function validateId(value: string, path: string): void {
  if (!isUuidV7(value)) {
    throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "提交内容存在错误", {
      fields: [{ path, message: "必须是 UUIDv7" }],
    });
  }
}

function outputDto(output: RenderOutputRecord) {
  return {
    id: output.id,
    snapshotId: output.snapshotId,
    status: output.status,
    outputMode: output.mode,
    rendererVersion: output.rendererVersion,
    compatibilityRuleVersion: output.ruleVersion,
    outputHash: output.outputHash,
    canCopy: output.status === "ready" && output.compatibilityReport.canCopy,
    compatibilityReport: output.compatibilityReport,
    generatedAt: output.generatedAt.toISOString(),
    expiresAt: output.expiresAt.toISOString(),
  };
}

function expectedHash(hash: string | null): string | undefined {
  return hash === null ? undefined : `sha256:${hash}`;
}

function cleanBrowserInfo(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, string] =>
          /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(entry[0]) &&
          typeof entry[1] === "string" &&
          entry[1].length <= 300,
      )
      .slice(0, 12),
  );
}

@Injectable()
export class CopyService {
  readonly #engine = new WechatCompatibilityEngine();

  constructor(
    @Inject(COPY_REPOSITORY)
    private readonly repository: CopyRepository,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorage,
  ) {}

  async createRender(
    ownerUserId: string,
    articleId: string,
    body: CreateWechatRenderDto,
    context: CopyMutationContext,
  ) {
    validateId(articleId, "articleId");
    const source = await this.repository.findRenderSource(ownerUserId, articleId);
    if (source === null) {
      throw apiError(HttpStatus.NOT_FOUND, "ARTICLE_NOT_FOUND", "文章不存在");
    }
    if (source.documentVersion !== body.documentVersion) {
      throw apiError(
        HttpStatus.CONFLICT,
        "ARTICLE_VERSION_CONFLICT",
        "文章版本已更新，请保存后重试",
        {
          currentVersion: source.documentVersion,
          submittedVersion: body.documentVersion,
        },
      );
    }

    const resources = await this.resolveResources(source.resources);
    const sourceTextHash = expectedHash(source.currentTextHash);
    const theme =
      source.themeId === null
        ? null
        : getOfficialTheme(source.themeId, source.themeVersion ?? undefined);
    if (source.themeId !== null && theme === null) {
      throw apiError(
        HttpStatus.CONFLICT,
        "THEME_VERSION_NOT_FOUND",
        "文章绑定的主题版本不可用，请重新应用主题",
        { themeId: source.themeId, themeVersion: source.themeVersion },
      );
    }
    const checked = this.#engine.check({
      document: source.document,
      ...(sourceTextHash === undefined ? {} : { expectedSourceTextHash: sourceTextHash }),
      mode: body.outputMode,
      resources,
      ...(theme === null ? {} : { theme: theme.tokens }),
    });
    const generatedAt = new Date();
    const persisted = await this.repository.persistRenderOutput({
      context,
      expiresAt: new Date(generatedAt.getTime() + COPY_PAYLOAD_TTL_SECONDS * 1_000),
      generatedAt,
      mode: body.outputMode as WechatOutputMode,
      ownerUserId,
      report: checked.report,
      renderResult: checked.renderResult,
      source,
    });
    if (persisted.kind === "not_found") {
      throw apiError(HttpStatus.NOT_FOUND, "ARTICLE_NOT_FOUND", "文章不存在");
    }
    if (persisted.kind === "version_conflict") {
      throw apiError(
        HttpStatus.CONFLICT,
        "ARTICLE_VERSION_CONFLICT",
        "文章版本已更新，请重新生成",
        {
          currentVersion: persisted.currentVersion,
          submittedVersion: body.documentVersion,
        },
      );
    }
    return outputDto(persisted.output);
  }

  async getRender(ownerUserId: string, articleId: string, outputId: string) {
    return outputDto(await this.requireOutput(ownerUserId, articleId, outputId));
  }

  async payload(ownerUserId: string, articleId: string, outputId: string) {
    const output = await this.requireOutput(ownerUserId, articleId, outputId);
    if (
      output.status !== "ready" ||
      !output.compatibilityReport.canCopy ||
      output.html === null ||
      output.plainText === null
    ) {
      throw apiError(
        HttpStatus.CONFLICT,
        "COPY_BLOCKED_BY_COMPATIBILITY",
        "兼容检查存在严重问题，正式复制已阻止",
        {
          report: output.compatibilityReport,
        },
      );
    }
    if (output.expiresAt.getTime() <= Date.now()) {
      throw apiError(HttpStatus.GONE, "COPY_PAYLOAD_EXPIRED", "复制内容已过期，请重新生成");
    }
    return {
      renderOutputId: output.id,
      html: output.html,
      plainText: output.plainText,
      expiresAt: output.expiresAt.toISOString(),
    };
  }

  async record(
    ownerUserId: string,
    articleId: string,
    body: CreateCopyRecordDto,
    context: CopyMutationContext,
  ) {
    validateId(articleId, "articleId");
    validateId(body.renderOutputId, "renderOutputId");
    const failureReason = body.failureReason?.trim() || null;
    if (
      (body.status === "success" && failureReason !== null) ||
      (body.status === "failed" && failureReason === null)
    ) {
      throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "提交内容存在错误", {
        fields: [
          {
            path: "failureReason",
            message:
              body.status === "failed" ? "复制失败时必须提供原因" : "复制成功时不能提供失败原因",
          },
        ],
      });
    }
    const result = await this.repository.createRecord({
      articleId,
      browserInfo: cleanBrowserInfo(body.browserInfo),
      context,
      failureReason,
      ownerUserId,
      renderOutputId: body.renderOutputId,
      status: body.status,
    });
    if (result.kind === "not_found") {
      throw apiError(HttpStatus.NOT_FOUND, "RENDER_OUTPUT_NOT_FOUND", "渲染输出不存在");
    }
    if (result.kind === "output_blocked") {
      throw apiError(
        HttpStatus.CONFLICT,
        "COPY_BLOCKED_BY_COMPATIBILITY",
        "被兼容检查阻止的输出不能记录为复制成功",
      );
    }
    return {
      id: result.record.id,
      renderOutputId: result.record.renderOutputId,
      status: result.record.status,
      copiedAt: result.record.copiedAt.toISOString(),
    };
  }

  private async requireOutput(ownerUserId: string, articleId: string, outputId: string) {
    validateId(articleId, "articleId");
    validateId(outputId, "renderOutputId");
    const output = await this.repository.findOutput(ownerUserId, articleId, outputId);
    if (output === null) {
      throw apiError(HttpStatus.NOT_FOUND, "RENDER_OUTPUT_NOT_FOUND", "渲染输出不存在");
    }
    return output;
  }

  private async resolveResources(
    sources: readonly {
      readonly id: string;
      readonly mimeType: string;
      readonly storageKey: string;
    }[],
  ): Promise<WechatResourceMap> {
    const entries = await Promise.all(
      sources.map(async (resource) => {
        try {
          const signed = await this.storage.createDownloadUrl({
            key: resource.storageKey,
            expiresInSeconds: COPY_PAYLOAD_TTL_SECONDS,
            responseContentType: resource.mimeType,
          });
          return [resource.id, { url: signed.url }] as const;
        } catch {
          return null;
        }
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== null));
  }
}
