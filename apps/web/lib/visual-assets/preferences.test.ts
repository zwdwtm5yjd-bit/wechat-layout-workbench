import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_VISUAL_ASSET_PREFERENCES,
  MAX_RECENT_VISUAL_ASSETS,
  VISUAL_ASSET_PREFERENCES_CHANGE_EVENT,
  VISUAL_ASSET_PREFERENCES_STORAGE_KEY,
  parseVisualAssetPreferences,
  readVisualAssetPreferences,
  recordRecentVisualAsset,
  serializeVisualAssetPreferences,
  toggleVisualAssetFavorite,
  writeVisualAssetPreferences,
} from "./preferences";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("visual asset preferences", () => {
  it("recovers from corrupt, obsolete and malformed storage", () => {
    expect(parseVisualAssetPreferences("bad-json")).toEqual(DEFAULT_VISUAL_ASSET_PREFERENCES);
    expect(
      parseVisualAssetPreferences(
        JSON.stringify({
          favoriteVariantIds: ["static-001"],
          recentVariantIds: ["static-001"],
          version: 2,
        }),
      ),
    ).toEqual(DEFAULT_VISUAL_ASSET_PREFERENCES);
    expect(
      parseVisualAssetPreferences(
        JSON.stringify({
          favoriteVariantIds: [" static-001 ", "", "   ", 12, "static-001", "gone"],
          recentVariantIds: [null, "dynamic-001", "dynamic-001", "gone"],
          version: 1,
        }),
        new Set(["static-001", "dynamic-001"]),
      ),
    ).toEqual({
      favoriteVariantIds: ["static-001"],
      recentVariantIds: ["dynamic-001"],
    });
  });

  it("toggles favorites and serializes only normalized ids", () => {
    let preferences = toggleVisualAssetFavorite(
      {
        favoriteVariantIds: ["static-001", "", "static-001"],
        recentVariantIds: [],
      },
      " dynamic-001 ",
    );
    expect(preferences.favoriteVariantIds).toEqual(["static-001", "dynamic-001"]);

    preferences = toggleVisualAssetFavorite(preferences, "static-001");
    expect(preferences.favoriteVariantIds).toEqual(["dynamic-001"]);
    expect(toggleVisualAssetFavorite(preferences, "   ")).toEqual(preferences);
    expect(parseVisualAssetPreferences(serializeVisualAssetPreferences(preferences))).toEqual(
      preferences,
    );
  });

  it("records recent variants newest first, deduplicated and capped at twenty", () => {
    let preferences = DEFAULT_VISUAL_ASSET_PREFERENCES;
    for (let index = 0; index < MAX_RECENT_VISUAL_ASSETS + 3; index += 1) {
      preferences = recordRecentVisualAsset(
        preferences,
        `static-${String(index).padStart(3, "0")}`,
      );
    }

    preferences = recordRecentVisualAsset(preferences, "static-010");
    expect(preferences.recentVariantIds).toHaveLength(MAX_RECENT_VISUAL_ASSETS);
    expect(preferences.recentVariantIds[0]).toBe("static-010");
    expect(preferences.recentVariantIds.filter((item) => item === "static-010")).toHaveLength(1);
    expect(preferences.recentVariantIds).not.toContain("static-000");
  });

  it("is SSR safe and tolerates unavailable localStorage", () => {
    expect(readVisualAssetPreferences()).toEqual(DEFAULT_VISUAL_ASSET_PREFERENCES);
    expect(
      writeVisualAssetPreferences({
        favoriteVariantIds: [" static-001 "],
        recentVariantIds: [],
      }),
    ).toEqual({ favoriteVariantIds: ["static-001"], recentVariantIds: [] });

    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => {
          throw new Error("blocked");
        }),
        setItem: vi.fn(() => {
          throw new Error("blocked");
        }),
      },
    });
    expect(readVisualAssetPreferences()).toEqual(DEFAULT_VISUAL_ASSET_PREFERENCES);
    expect(() =>
      writeVisualAssetPreferences({
        favoriteVariantIds: ["static-001"],
        recentVariantIds: [],
      }),
    ).not.toThrow();
  });

  it("persists the versioned payload and notifies same-tab consumers", () => {
    const values = new Map<string, string>();
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      dispatchEvent,
      localStorage: {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      },
    });

    writeVisualAssetPreferences({
      favoriteVariantIds: ["static-001"],
      recentVariantIds: ["dynamic-001"],
    });

    expect(JSON.parse(values.get(VISUAL_ASSET_PREFERENCES_STORAGE_KEY) ?? "null")).toEqual({
      favoriteVariantIds: ["static-001"],
      recentVariantIds: ["dynamic-001"],
      version: 1,
    });
    expect(readVisualAssetPreferences()).toEqual({
      favoriteVariantIds: ["static-001"],
      recentVariantIds: ["dynamic-001"],
    });
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0]?.[0]).toBeInstanceOf(Event);
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe(VISUAL_ASSET_PREFERENCES_CHANGE_EVENT);
  });
});
