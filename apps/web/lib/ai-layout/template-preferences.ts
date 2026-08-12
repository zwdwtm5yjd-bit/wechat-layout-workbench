export const AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY = "wechat-layout-template-preferences:v1";

const MAX_RECENT_TEMPLATES = 12;

export interface AiLayoutTemplatePreferences {
  readonly catalogVersion: string | null;
  readonly favoriteTemplateIds: readonly string[];
  readonly recentTemplateIds: readonly string[];
}

const EMPTY_PREFERENCES: AiLayoutTemplatePreferences = {
  catalogVersion: null,
  favoriteTemplateIds: [],
  recentTemplateIds: [],
};

function validIds(value: unknown, allowedIds?: ReadonlySet<string>): readonly string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)].filter(
    (item): item is string =>
      typeof item === "string" && item.trim() !== "" && (allowedIds?.has(item) ?? true),
  );
}

export function parseAiLayoutTemplatePreferences(
  raw: string | null,
  allowedTemplateIds?: ReadonlySet<string>,
): AiLayoutTemplatePreferences {
  if (raw === null) return EMPTY_PREFERENCES;
  try {
    const value = JSON.parse(raw) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1
    ) {
      return EMPTY_PREFERENCES;
    }
    const record = value as Readonly<Record<string, unknown>>;
    return {
      catalogVersion: typeof record.catalogVersion === "string" ? record.catalogVersion : null,
      favoriteTemplateIds: validIds(record.favoriteTemplateIds, allowedTemplateIds),
      recentTemplateIds: validIds(record.recentTemplateIds, allowedTemplateIds).slice(
        0,
        MAX_RECENT_TEMPLATES,
      ),
    };
  } catch {
    return EMPTY_PREFERENCES;
  }
}

export function serializeAiLayoutTemplatePreferences(
  preferences: AiLayoutTemplatePreferences,
): string {
  return JSON.stringify({
    catalogVersion: preferences.catalogVersion,
    favoriteTemplateIds: validIds(preferences.favoriteTemplateIds),
    recentTemplateIds: validIds(preferences.recentTemplateIds).slice(0, MAX_RECENT_TEMPLATES),
    version: 1,
  });
}

export function toggleAiLayoutTemplateFavorite(
  preferences: AiLayoutTemplatePreferences,
  templateId: string,
): AiLayoutTemplatePreferences {
  const favoriteTemplateIds = preferences.favoriteTemplateIds.includes(templateId)
    ? preferences.favoriteTemplateIds.filter((candidate) => candidate !== templateId)
    : [...preferences.favoriteTemplateIds, templateId];
  return { ...preferences, favoriteTemplateIds };
}

export function recordRecentAiLayoutTemplate(
  preferences: AiLayoutTemplatePreferences,
  templateId: string,
  catalogVersion = preferences.catalogVersion,
): AiLayoutTemplatePreferences {
  return {
    ...preferences,
    catalogVersion,
    recentTemplateIds: [
      templateId,
      ...preferences.recentTemplateIds.filter((candidate) => candidate !== templateId),
    ].slice(0, MAX_RECENT_TEMPLATES),
  };
}
