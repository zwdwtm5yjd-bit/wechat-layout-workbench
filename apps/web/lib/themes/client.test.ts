import { afterEach, describe, expect, it, vi } from "vitest";

import * as authClient from "../auth/client";
import { applyTheme, listThemes, themePreviewKey, type OfficialTheme } from "./client";

const theme = {
  manifest: {
    themeId: "0198f8e1-7a01-7000-8000-000000000102",
    familyId: "family_government_modern",
    version: "1.0.0",
    name: "现代政务红",
    description: "正式主题",
    categories: ["government"],
    recommendedContentTypes: ["meeting"],
    defaultPaletteId: "0198f8e1-7a01-7000-8000-000000000202",
    supportedPalettes: ["0198f8e1-7a01-7000-8000-000000000202"],
    compatibilityLevel: "safe",
    isDefault: false,
    status: "published",
  },
  preview: {
    accentColors: ["#9F1D24", "#FFF8F2", "#2F2525"],
    heading1: "标题",
    heading2: "二级标题",
    heading3: "三级标题",
    body: "正文",
    quote: "引用",
    dataLabel: "数据",
    dataValue: "96%",
    footer: "文末",
    mobileViewportWidth: 375,
    wechatContentWidth: 677,
  },
  componentRefs: ["paragraph.default"],
  installed: true,
} as const satisfies OfficialTheme;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("theme client", () => {
  it("lists installed themes with credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { items: [theme], pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(listThemes()).resolves.toMatchObject({ items: [theme] });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/themes?page=1&pageSize=100",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("applies the exact theme version with CSRF and optimistic locking", async () => {
    vi.spyOn(authClient, "getCsrfToken").mockResolvedValue("csrf-theme");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            articleId: "article",
            themeId: theme.manifest.themeId,
            themeVersion: "1.0.0",
            paletteId: theme.manifest.defaultPaletteId,
            documentVersion: 8,
            lastTransactionId: "0198f8e1-7a01-7000-8000-000000000304",
            safetySnapshotId: "snapshot",
            originalTextUnchanged: true,
            appliedAt: "2026-08-01T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await applyTheme({ articleId: "article", baseDocumentVersion: 7, theme });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({ "X-CSRF-Token": "csrf-theme" });
    expect(JSON.parse(String(request.body))).toEqual({
      baseDocumentVersion: 7,
      brandMode: "soft",
      paletteId: theme.manifest.defaultPaletteId,
      preserveLockedBlocks: true,
      scope: "full",
      themeVersion: "1.0.0",
    });
    expect(themePreviewKey(theme)).toBe("modern-civic");
  });
});
