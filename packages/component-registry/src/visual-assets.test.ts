import { describe, expect, it } from "vitest";

import {
  OFFICIAL_DYNAMIC_VISUAL_ASSETS,
  OFFICIAL_STATIC_VISUAL_ASSETS,
  OFFICIAL_VISUAL_ASSETS,
  VISUAL_ASSET_EFFECTS,
  VISUAL_ASSET_FUNCTIONS,
  VISUAL_ASSET_STYLES,
  builtInVisualAssetPublicUrl,
} from "./index.js";

describe("official visual assets", () => {
  it("ships 130 static and 50 dynamic original SVG assets with unique identities", () => {
    expect(OFFICIAL_STATIC_VISUAL_ASSETS).toHaveLength(130);
    expect(OFFICIAL_DYNAMIC_VISUAL_ASSETS).toHaveLength(50);
    expect(OFFICIAL_VISUAL_ASSETS).toHaveLength(180);
    expect(new Set(OFFICIAL_VISUAL_ASSETS.map((asset) => asset.id)).size).toBe(180);
    expect(new Set(OFFICIAL_VISUAL_ASSETS.map((asset) => asset.resourceId)).size).toBe(180);
    expect(new Set(OFFICIAL_VISUAL_ASSETS.map((asset) => asset.previewPath)).size).toBe(180);
    expect(
      OFFICIAL_STATIC_VISUAL_ASSETS.filter((asset) => asset.function === "sticker"),
    ).toHaveLength(40);
  });

  it("covers every function, style and motion effect in the faceted taxonomy", () => {
    VISUAL_ASSET_FUNCTIONS.forEach((value) => {
      expect(OFFICIAL_STATIC_VISUAL_ASSETS.some((asset) => asset.function === value)).toBe(true);
    });
    VISUAL_ASSET_STYLES.forEach((value) => {
      expect(OFFICIAL_STATIC_VISUAL_ASSETS.some((asset) => asset.style === value)).toBe(true);
    });
    VISUAL_ASSET_EFFECTS.forEach((value) => {
      expect(OFFICIAL_DYNAMIC_VISUAL_ASSETS.filter((asset) => asset.effect === value)).toHaveLength(
        5,
      );
    });
  });

  it("provides public paths and static fallbacks for publishing", () => {
    OFFICIAL_VISUAL_ASSETS.forEach((asset) => {
      expect(asset.previewPath).toMatch(
        /^\/visual-assets\/library\/(static|dynamic)\/[\w-]+\.svg$/u,
      );
      expect(builtInVisualAssetPublicUrl(asset.resourceId)).toBe(
        `https://visual.ericmm.com${asset.previewPath}`,
      );
    });
    OFFICIAL_DYNAMIC_VISUAL_ASSETS.forEach((asset) => {
      expect(asset.fallbackResourceId).toMatch(/^builtin_visual_static_\d{3}$/u);
      expect(builtInVisualAssetPublicUrl(asset.fallbackResourceId!)).toBeTruthy();
    });
  });
});
