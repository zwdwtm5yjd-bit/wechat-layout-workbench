import type { AiLayoutTemplateSummary } from "@wechat-layout/api-contracts";

export type { AiLayoutTemplateSummary } from "@wechat-layout/api-contracts";

export type AiLayoutTemplateFilter = "all" | "favorite" | "recent";

export interface AiLayoutTemplateCatalogFilters {
  readonly categoryId: string | "all";
  readonly favoriteTemplateIds?: readonly string[];
  readonly filter?: AiLayoutTemplateFilter;
  readonly query: string;
  readonly recentTemplateIds?: readonly string[];
}

export interface AiLayoutTemplateRecommendationContext {
  readonly articleTypeLabel: string;
  readonly emotionLabel: string;
  readonly keywords: readonly string[];
  readonly sourceImageCount: number;
}

export const AI_LAYOUT_TEMPLATE_PAGE_SIZE = 12;
export const AI_LAYOUT_TEMPLATE_RECOMMENDATION_COUNT = 6;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function searchableText(template: AiLayoutTemplateSummary): string {
  return normalized(
    [
      template.name,
      template.description,
      template.categoryLabel,
      template.structureLabel,
      template.defaultLanguageId,
      template.rhythm,
      template.visualIntensity,
      ...template.tags,
    ].join(" "),
  );
}

export function filterAiLayoutTemplates(
  templates: readonly AiLayoutTemplateSummary[],
  filters: AiLayoutTemplateCatalogFilters,
): readonly AiLayoutTemplateSummary[] {
  const query = normalized(filters.query);
  const favorites = new Set(filters.favoriteTemplateIds ?? []);
  const recents = new Map(
    (filters.recentTemplateIds ?? []).map((templateId, index) => [templateId, index]),
  );
  const filtered = templates.filter((template) => {
    if (filters.categoryId !== "all" && template.catalogCategoryId !== filters.categoryId) {
      return false;
    }
    if (filters.filter === "favorite" && !favorites.has(template.templateId)) return false;
    if (filters.filter === "recent" && !recents.has(template.templateId)) return false;
    return query === "" || searchableText(template).includes(query);
  });
  if (filters.filter !== "recent") return filtered;
  return filtered.toSorted(
    (left, right) =>
      (recents.get(left.templateId) ?? Number.MAX_SAFE_INTEGER) -
      (recents.get(right.templateId) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function recommendAiLayoutTemplates(
  templates: readonly AiLayoutTemplateSummary[],
  context: AiLayoutTemplateRecommendationContext,
  count = AI_LAYOUT_TEMPLATE_RECOMMENDATION_COUNT,
): readonly AiLayoutTemplateSummary[] {
  const signals = [context.articleTypeLabel, context.emotionLabel, ...context.keywords]
    .map(normalized)
    .filter((signal) => signal !== "");
  const ranked = templates
    .filter((template) => template.minimumSourceImages <= context.sourceImageCount)
    .map((template, index) => {
      const text = searchableText(template);
      const score = signals.reduce(
        (total, signal) => total + (text.includes(signal) ? (signal.length > 1 ? 3 : 1) : 0),
        0,
      );
      return { index, score, template };
    })
    .toSorted((left, right) => right.score - left.score || left.index - right.index);
  const selected: AiLayoutTemplateSummary[] = [];
  const usedStrategies = new Set<string>();
  for (const { template } of ranked) {
    if (selected.length >= count) break;
    if (usedStrategies.has(template.strategyId)) continue;
    selected.push(template);
    usedStrategies.add(template.strategyId);
  }
  for (const { template } of ranked) {
    if (selected.length >= count) break;
    if (selected.some((selectedTemplate) => selectedTemplate.templateId === template.templateId)) {
      continue;
    }
    selected.push(template);
  }
  return selected;
}

export function paginateAiLayoutTemplates(
  templates: readonly AiLayoutTemplateSummary[],
  page: number,
  pageSize = AI_LAYOUT_TEMPLATE_PAGE_SIZE,
): readonly AiLayoutTemplateSummary[] {
  const safePage = Math.max(1, page);
  return templates.slice((safePage - 1) * pageSize, safePage * pageSize);
}

export function summarizeAiLayoutTemplateCategories(
  templates: readonly AiLayoutTemplateSummary[],
): readonly Readonly<{ id: string; label: string; count: number }>[] {
  const categories = new Map<string, { label: string; count: number }>();
  templates.forEach((template) => {
    const current = categories.get(template.catalogCategoryId);
    categories.set(template.catalogCategoryId, {
      label: template.categoryLabel,
      count: (current?.count ?? 0) + 1,
    });
  });
  return [...categories.entries()].map(([id, value]) => ({ id, ...value }));
}
