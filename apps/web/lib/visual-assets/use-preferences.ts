"use client";

import { OFFICIAL_VISUAL_ASSETS } from "@wechat-layout/component-registry";
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_VISUAL_ASSET_PREFERENCES,
  VISUAL_ASSET_PREFERENCES_CHANGE_EVENT,
  VISUAL_ASSET_PREFERENCES_STORAGE_KEY,
  readVisualAssetPreferences,
  recordRecentVisualAsset,
  toggleVisualAssetFavorite,
  writeVisualAssetPreferences,
  type VisualAssetPreferences,
} from "./preferences";

const ALLOWED_VISUAL_ASSET_IDS = new Set(OFFICIAL_VISUAL_ASSETS.map((asset) => asset.id));

export interface VisualAssetPreferenceActions {
  readonly preferences: VisualAssetPreferences;
  readonly recordRecent: (variantId: string) => void;
  readonly toggleFavorite: (variantId: string) => void;
}

export function useVisualAssetPreferences(): VisualAssetPreferenceActions {
  const [preferences, setPreferences] = useState<VisualAssetPreferences>(
    DEFAULT_VISUAL_ASSET_PREFERENCES,
  );

  useEffect(() => {
    const synchronize = (): void => {
      setPreferences(readVisualAssetPreferences(ALLOWED_VISUAL_ASSET_IDS));
    };
    const synchronizeStorage = (event: StorageEvent): void => {
      if (event.key === VISUAL_ASSET_PREFERENCES_STORAGE_KEY || event.key === null) synchronize();
    };

    synchronize();
    window.addEventListener(VISUAL_ASSET_PREFERENCES_CHANGE_EVENT, synchronize);
    window.addEventListener("storage", synchronizeStorage);
    return () => {
      window.removeEventListener(VISUAL_ASSET_PREFERENCES_CHANGE_EVENT, synchronize);
      window.removeEventListener("storage", synchronizeStorage);
    };
  }, []);

  const update = useCallback(
    (updater: (current: VisualAssetPreferences) => VisualAssetPreferences): void => {
      const current = readVisualAssetPreferences(ALLOWED_VISUAL_ASSET_IDS);
      setPreferences(writeVisualAssetPreferences(updater(current)));
    },
    [],
  );

  const toggleFavorite = useCallback(
    (variantId: string): void => update((current) => toggleVisualAssetFavorite(current, variantId)),
    [update],
  );
  const recordRecent = useCallback(
    (variantId: string): void => update((current) => recordRecentVisualAsset(current, variantId)),
    [update],
  );

  return { preferences, recordRecent, toggleFavorite };
}
