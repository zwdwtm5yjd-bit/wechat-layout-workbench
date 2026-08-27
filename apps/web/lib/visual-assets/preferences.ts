export const VISUAL_ASSET_PREFERENCES_STORAGE_KEY = "wechat-layout-visual-asset-preferences:v1";
export const VISUAL_ASSET_PREFERENCES_CHANGE_EVENT = "visual-asset-preferences-change";

export const MAX_RECENT_VISUAL_ASSETS = 20;

export interface VisualAssetPreferences {
  readonly favoriteVariantIds: readonly string[];
  readonly recentVariantIds: readonly string[];
}

export const DEFAULT_VISUAL_ASSET_PREFERENCES: VisualAssetPreferences = {
  favoriteVariantIds: [],
  recentVariantIds: [],
};

function normalizeVariantId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function validVariantIds(
  value: unknown,
  allowedVariantIds?: ReadonlySet<string>,
): readonly string[] {
  if (!Array.isArray(value)) return [];

  const variantIds: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const variantId = normalizeVariantId(item);
    if (
      variantId === null ||
      seen.has(variantId) ||
      (allowedVariantIds !== undefined && !allowedVariantIds.has(variantId))
    ) {
      continue;
    }
    seen.add(variantId);
    variantIds.push(variantId);
  }
  return variantIds;
}

function normalizePreferences(
  preferences: VisualAssetPreferences,
  allowedVariantIds?: ReadonlySet<string>,
): VisualAssetPreferences {
  return {
    favoriteVariantIds: validVariantIds(preferences.favoriteVariantIds, allowedVariantIds),
    recentVariantIds: validVariantIds(preferences.recentVariantIds, allowedVariantIds).slice(
      0,
      MAX_RECENT_VISUAL_ASSETS,
    ),
  };
}

export function parseVisualAssetPreferences(
  raw: string | null,
  allowedVariantIds?: ReadonlySet<string>,
): VisualAssetPreferences {
  if (raw === null) return DEFAULT_VISUAL_ASSET_PREFERENCES;

  try {
    const value = JSON.parse(raw) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1
    ) {
      return DEFAULT_VISUAL_ASSET_PREFERENCES;
    }

    const record = value as Readonly<Record<string, unknown>>;
    return {
      favoriteVariantIds: validVariantIds(record.favoriteVariantIds, allowedVariantIds),
      recentVariantIds: validVariantIds(record.recentVariantIds, allowedVariantIds).slice(
        0,
        MAX_RECENT_VISUAL_ASSETS,
      ),
    };
  } catch {
    return DEFAULT_VISUAL_ASSET_PREFERENCES;
  }
}

export function serializeVisualAssetPreferences(preferences: VisualAssetPreferences): string {
  const normalized = normalizePreferences(preferences);
  return JSON.stringify({
    favoriteVariantIds: normalized.favoriteVariantIds,
    recentVariantIds: normalized.recentVariantIds,
    version: 1,
  });
}

export function toggleVisualAssetFavorite(
  preferences: VisualAssetPreferences,
  variantId: string,
): VisualAssetPreferences {
  const normalized = normalizePreferences(preferences);
  const targetVariantId = normalizeVariantId(variantId);
  if (targetVariantId === null) return normalized;

  return {
    ...normalized,
    favoriteVariantIds: normalized.favoriteVariantIds.includes(targetVariantId)
      ? normalized.favoriteVariantIds.filter((candidate) => candidate !== targetVariantId)
      : [...normalized.favoriteVariantIds, targetVariantId],
  };
}

export function recordRecentVisualAsset(
  preferences: VisualAssetPreferences,
  variantId: string,
): VisualAssetPreferences {
  const normalized = normalizePreferences(preferences);
  const targetVariantId = normalizeVariantId(variantId);
  if (targetVariantId === null) return normalized;

  return {
    ...normalized,
    recentVariantIds: [
      targetVariantId,
      ...normalized.recentVariantIds.filter((candidate) => candidate !== targetVariantId),
    ].slice(0, MAX_RECENT_VISUAL_ASSETS),
  };
}

export function readVisualAssetPreferences(
  allowedVariantIds?: ReadonlySet<string>,
): VisualAssetPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_VISUAL_ASSET_PREFERENCES;
  }

  try {
    return parseVisualAssetPreferences(
      window.localStorage.getItem(VISUAL_ASSET_PREFERENCES_STORAGE_KEY),
      allowedVariantIds,
    );
  } catch {
    return DEFAULT_VISUAL_ASSET_PREFERENCES;
  }
}

export function writeVisualAssetPreferences(
  preferences: VisualAssetPreferences,
): VisualAssetPreferences {
  const normalized = normalizePreferences(preferences);
  if (typeof window === "undefined") return normalized;

  try {
    window.localStorage.setItem(
      VISUAL_ASSET_PREFERENCES_STORAGE_KEY,
      serializeVisualAssetPreferences(normalized),
    );
    window.dispatchEvent(new Event(VISUAL_ASSET_PREFERENCES_CHANGE_EVENT));
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }

  return normalized;
}
