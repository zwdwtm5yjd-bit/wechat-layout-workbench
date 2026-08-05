import { OFFICIAL_THEME_IDS, OFFICIAL_THEME_PALETTE_IDS } from "@wechat-layout/design-tokens";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { describe, expect, it, vi } from "vitest";

import type { SnapshotService } from "../snapshots/snapshot.service.js";
import { ThemeService } from "./theme.service.js";
import type { ApplyThemeInput, ThemeArticleSource, ThemeRepository } from "./theme.types.js";

const articleId = "0198f8e1-7a01-7000-8000-000000000301";
const ownerUserId = "0198f8e1-7a01-7000-8000-000000000302";
const snapshotId = "0198f8e1-7a01-7000-8000-000000000303";

class FakeThemeRepository implements ThemeRepository {
  source: ThemeArticleSource | null = {
    accountId: null,
    articleId,
    currentTextHash: null,
    document: structuredClone(documentV1Fixture),
    documentVersion: 7,
    themeId: null,
    themeVersion: null,
  };

  readonly applyInputs: ApplyThemeInput[] = [];

  async findArticle(): Promise<ThemeArticleSource | null> {
    return this.source;
  }

  async apply(input: ApplyThemeInput) {
    this.applyInputs.push(input);
    return {
      kind: "applied" as const,
      appliedAt: new Date("2026-08-01T01:00:00+08:00"),
      documentVersion: input.baseDocumentVersion + 1,
      lastTransactionId: "0198f8e1-7a01-7000-8000-000000000304",
    };
  }
}

function serviceFixture() {
  const repository = new FakeThemeRepository();
  const createAutomatic = vi.fn().mockResolvedValue({ id: snapshotId });
  const snapshots = { createAutomatic } as unknown as SnapshotService;
  return {
    createAutomatic,
    repository,
    service: new ThemeService(repository, snapshots),
  };
}

describe("ThemeService", () => {
  it("lists ten installed immutable official themes", () => {
    const { service } = serviceFixture();
    const result = service.list({});
    expect(result.pagination).toMatchObject({ total: 10, totalPages: 1 });
    expect(result.items.map((theme) => theme.manifest.name)).toEqual([
      "高级极简",
      "现代政务红",
      "科技蓝金",
      "校园青春",
      "夏日森系",
      "旅行杂志",
      "食味暖橙",
      "人物专访",
      "节日红金",
      "国风雅韵",
    ]);
    expect(result.items.every((theme) => theme.installed)).toBe(true);
  });

  it("previews without mutating the authoritative document", async () => {
    const { repository, service } = serviceFixture();
    const before = JSON.stringify(repository.source?.document);
    const result = await service.preview(ownerUserId, articleId, OFFICIAL_THEME_IDS.modernCivic, {
      brandMode: "soft",
      paletteId: OFFICIAL_THEME_PALETTE_IDS.modernCivic,
      scope: "full",
      themeVersion: "1.0.0",
    });
    expect(result).toMatchObject({
      articleId,
      documentVersion: 7,
      themeId: OFFICIAL_THEME_IDS.modernCivic,
      themeVersion: "1.0.0",
      textIntegrity: { unchanged: true },
    });
    expect(result.html).toContain("#9F1D24");
    expect(JSON.stringify(repository.source?.document)).toBe(before);
  });

  it("creates a before-theme snapshot and applies an exact version", async () => {
    const { createAutomatic, repository, service } = serviceFixture();
    const result = await service.apply(
      ownerUserId,
      articleId,
      OFFICIAL_THEME_IDS.editorialMinimal,
      {
        baseDocumentVersion: 7,
        brandMode: "soft",
        paletteId: OFFICIAL_THEME_PALETTE_IDS.editorialMinimal,
        preserveLockedBlocks: true,
        scope: "full",
        themeVersion: "1.0.0",
      },
      {
        actorUserId: ownerUserId,
        requestId: "req_theme_apply",
        traceId: "trace_theme_apply",
      },
    );
    expect(createAutomatic).toHaveBeenCalledWith(
      ownerUserId,
      articleId,
      "before_theme_apply",
      expect.stringContaining("1.0.0"),
      expect.any(Object),
    );
    expect(repository.applyInputs[0]).toMatchObject({
      baseDocumentVersion: 7,
      themeId: OFFICIAL_THEME_IDS.editorialMinimal,
      themeVersion: "1.0.0",
    });
    expect(result).toMatchObject({
      documentVersion: 8,
      originalTextUnchanged: true,
      safetySnapshotId: snapshotId,
    });
  });

  it("rejects a stale document before creating the safety snapshot", async () => {
    const { createAutomatic, service } = serviceFixture();
    await expect(
      service.apply(
        ownerUserId,
        articleId,
        OFFICIAL_THEME_IDS.editorialMinimal,
        {
          baseDocumentVersion: 6,
          brandMode: "soft",
          preserveLockedBlocks: true,
          scope: "full",
          themeVersion: "1.0.0",
        },
        {
          actorUserId: ownerUserId,
          requestId: "req_theme_stale",
          traceId: "trace_theme_stale",
        },
      ),
    ).rejects.toMatchObject({
      status: 409,
      apiError: { code: "ARTICLE_VERSION_CONFLICT" },
    });
    expect(createAutomatic).not.toHaveBeenCalled();
  });
});
