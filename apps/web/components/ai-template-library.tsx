"use client";

import {
  AI_LAYOUT_TEMPLATE_CATALOG_CATEGORY_IDS,
  type AiLayoutTemplateCatalogCategoryId,
  type AiLayoutTemplateId,
  type AiLayoutTemplateSummary,
} from "@wechat-layout/api-contracts";
import { ChevronLeft, ChevronRight, Search, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 12;
const RECOMMENDATION_COUNT = 6;

const CATEGORY_FALLBACK_LABELS: Readonly<Record<AiLayoutTemplateCatalogCategoryId, string>> = {
  "official-report": "政务报告",
  "data-business": "数据商业",
  "knowledge-guide": "知识指南",
  "story-people": "人物故事",
  "brand-event": "品牌活动",
};

type CatalogFilter = "all" | "favorite" | "recent";
type CatalogView = "recommended" | "catalog";

type TemplateWithOptionalSignals = AiLayoutTemplateSummary &
  Readonly<{
    minimumSourceImages?: number;
    negativeSignals?: readonly string[];
    positiveSignals?: readonly string[];
  }>;

export interface AiTemplateLibraryProps {
  readonly errorMessage?: string | null;
  readonly favoriteTemplateIds?: readonly AiLayoutTemplateId[];
  readonly loading?: boolean;
  readonly onSelectTemplate: (templateId: AiLayoutTemplateId | null) => void;
  readonly onToggleFavorite?: (templateId: AiLayoutTemplateId) => void;
  readonly recentTemplateIds?: readonly AiLayoutTemplateId[];
  readonly recommendedTemplateIds?: readonly AiLayoutTemplateId[];
  readonly selectedTemplateId: AiLayoutTemplateId | null;
  readonly sourceImageCount?: number;
  readonly templates: readonly AiLayoutTemplateSummary[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function stringHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

function TemplateThumbnail({ template }: { readonly template: AiLayoutTemplateSummary }) {
  const variant = stringHash(template.previewKey) % 10;
  const dark = template.visualIntensity === "bold" && variant % 3 === 0;
  const primary = dark ? "#E2E8F0" : "#25324A";
  const accent = ["#C72C35", "#2563EB", "#8B5CF6", "#C48A30", "#23856D"][variant % 5]!;
  const surface = dark ? "#182238" : "#FCFCFD";
  const muted = dark ? "#718096" : "#CBD5E1";
  const centered = variant === 1 || variant === 4 || variant === 8;
  const cardCount = variant % 4 === 0 ? 3 : variant % 3 === 0 ? 2 : 1;

  return (
    <div
      aria-label={`${template.name}模板缩略预演`}
      className="h-36 overflow-hidden rounded-t-[11px] border-b border-line p-3"
      data-preview-variant={variant}
      role="img"
      style={{ backgroundColor: surface }}
    >
      <div className={`flex items-center gap-1.5 ${centered ? "justify-center" : "justify-start"}`}>
        {variant % 2 === 0 ? (
          <span className="h-5 w-5 rounded-sm" style={{ backgroundColor: accent }} />
        ) : null}
        <div className={`space-y-1 ${centered ? "w-2/3" : "w-3/4"}`}>
          <span className="block h-2 rounded-full" style={{ backgroundColor: primary }} />
          <span
            className={`block h-1 rounded-full ${centered ? "mx-auto" : ""}`}
            style={{ backgroundColor: muted, width: variant % 2 === 0 ? "54%" : "72%" }}
          />
        </div>
      </div>
      {variant === 2 || variant === 5 || variant === 9 ? (
        <div className="mt-3 grid h-10 grid-cols-[1.4fr_1fr] gap-2">
          <span className="rounded" style={{ backgroundColor: `${accent}32` }} />
          <span className="rounded" style={{ backgroundColor: `${muted}50` }} />
        </div>
      ) : (
        <div className={`mt-3 grid gap-1.5 ${cardCount === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {Array.from({ length: cardCount }, (_, index) => (
            <span
              className="h-9 rounded border p-1.5"
              key={index}
              style={{
                borderColor: `${accent}45`,
                backgroundColor: `${accent}${index === 0 ? "16" : "08"}`,
              }}
            >
              <span className="block h-1 w-2/3 rounded-full" style={{ backgroundColor: accent }} />
              <span className="mt-1.5 block h-1 rounded-full" style={{ backgroundColor: muted }} />
            </span>
          ))}
        </div>
      )}
      <div
        className={`mt-3 space-y-1 border-l-2 pl-2 ${variant === 7 ? "ml-5" : ""}`}
        style={{ borderColor: accent }}
      >
        {[92, 76, 84].map((width) => (
          <span
            className="block h-1 rounded-full"
            key={width}
            style={{ backgroundColor: muted, width: `${String(width)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function searchableText(template: TemplateWithOptionalSignals): string {
  return normalize(
    [
      template.name,
      template.description,
      template.categoryLabel,
      template.structureLabel,
      ...template.tags,
      ...(template.positiveSignals ?? []),
      ...(template.negativeSignals ?? []),
    ].join(" "),
  );
}

export function AiTemplateLibrary({
  errorMessage = null,
  favoriteTemplateIds = [],
  loading = false,
  onSelectTemplate,
  onToggleFavorite = () => undefined,
  recentTemplateIds = [],
  recommendedTemplateIds,
  selectedTemplateId,
  sourceImageCount = 0,
  templates,
}: AiTemplateLibraryProps) {
  const [view, setView] = useState<CatalogView>("recommended");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<AiLayoutTemplateCatalogCategoryId | "all">("all");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [page, setPage] = useState(1);
  const browseButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const favorites = useMemo(() => new Set(favoriteTemplateIds), [favoriteTemplateIds]);
  const recents = useMemo(
    () => new Map(recentTemplateIds.map((templateId, index) => [templateId, index])),
    [recentTemplateIds],
  );
  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.templateId, template])),
    [templates],
  );
  const recommended = useMemo(() => {
    const preferred = (recommendedTemplateIds ?? [])
      .map((templateId) => templateById.get(templateId))
      .filter((template): template is AiLayoutTemplateSummary => template !== undefined);
    const used = new Set(preferred.map((template) => template.templateId));
    return [...preferred, ...templates.filter((template) => !used.has(template.templateId))].slice(
      0,
      RECOMMENDATION_COUNT,
    );
  }, [recommendedTemplateIds, templateById, templates]);
  const categories = useMemo(
    () =>
      AI_LAYOUT_TEMPLATE_CATALOG_CATEGORY_IDS.map((id) => ({
        count: templates.filter((template) => template.catalogCategoryId === id).length,
        id,
        label:
          templates.find((template) => template.catalogCategoryId === id)?.categoryLabel ??
          CATEGORY_FALLBACK_LABELS[id],
      })),
    [templates],
  );
  const filteredTemplates = useMemo(() => {
    const normalizedQuery = normalize(query);
    const matches = templates.filter((template) => {
      if (categoryId !== "all" && template.catalogCategoryId !== categoryId) return false;
      if (filter === "favorite" && !favorites.has(template.templateId)) return false;
      if (filter === "recent" && !recents.has(template.templateId)) return false;
      return normalizedQuery === "" || searchableText(template).includes(normalizedQuery);
    });
    return filter === "recent"
      ? matches.toSorted(
          (left, right) =>
            (recents.get(left.templateId) ?? Number.MAX_SAFE_INTEGER) -
            (recents.get(right.templateId) ?? Number.MAX_SAFE_INTEGER),
        )
      : matches;
  }, [categoryId, favorites, filter, query, recents, templates]);
  const pageCount = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleTemplates =
    view === "recommended"
      ? recommended
      : filteredTemplates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const openCatalog = (): void => {
    setView("catalog");
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };
  const showRecommended = (): void => {
    setView("recommended");
    window.requestAnimationFrame(() => browseButtonRef.current?.focus());
  };
  const resetPage = (): void => setPage(1);

  return (
    <section aria-label="AI 模板库" className="mt-4 rounded-card border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-[12px] font-semibold text-ink">
            {view === "recommended" ? "内容匹配的 6 套模板" : "浏览全部 AI 模板"}
          </h3>
          <p className="mt-1 text-[9px] leading-4 text-muted">
            {view === "recommended"
              ? "选中一套作为 AI 设计起点，生成时仍只返回 6 个候选。"
              : `共 ${String(templates.length)} 套，每页最多 ${String(PAGE_SIZE)} 套。`}
          </p>
        </div>
        {view === "recommended" ? (
          <button
            className="inline-flex min-h-11 items-center rounded-control border border-line px-3 text-[10px] font-semibold text-ink hover:bg-hover"
            onClick={openCatalog}
            ref={browseButtonRef}
            type="button"
          >
            浏览全部 {templates.length} 套
          </button>
        ) : (
          <button
            className="inline-flex min-h-11 items-center gap-1 rounded-control border border-line px-3 text-[10px] font-semibold text-ink hover:bg-hover"
            onClick={showRecommended}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={14} />
            返回推荐
          </button>
        )}
      </header>

      {view === "catalog" ? (
        <div className="sticky top-0 z-10 space-y-2 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur">
          <label className="relative block">
            <span className="sr-only">搜索 AI 模板</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
              size={14}
            />
            <input
              className="h-11 w-full rounded-control border border-line bg-panel pr-3 pl-9 text-[11px] text-ink outline-none placeholder:text-faint focus:border-accent"
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                resetPage();
              }}
              placeholder="搜索名称、场景或风格"
              ref={searchInputRef}
              value={query}
            />
          </label>
          <div aria-label="模板范围" className="flex gap-1.5 overflow-x-auto pb-1">
            {(
              [
                ["all", "全部"],
                ["favorite", `收藏 ${String(favoriteTemplateIds.length)}`],
                ["recent", `最近 ${String(recentTemplateIds.length)}`],
              ] as const
            ).map(([id, label]) => (
              <button
                aria-pressed={filter === id}
                className={`min-h-11 shrink-0 rounded-control px-3 text-[10px] font-medium ${
                  filter === id ? "bg-accent text-white" : "bg-panel-muted text-muted"
                }`}
                key={id}
                onClick={() => {
                  setFilter(id);
                  resetPage();
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div aria-label="模板分类" className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              aria-pressed={categoryId === "all"}
              className={`min-h-11 shrink-0 rounded-control px-3 text-[10px] font-medium ${
                categoryId === "all" ? "bg-accent-soft text-accent" : "bg-panel-muted text-muted"
              }`}
              onClick={() => {
                setCategoryId("all");
                resetPage();
              }}
              type="button"
            >
              全部分类 · {templates.length}
            </button>
            {categories.map((category) => (
              <button
                aria-pressed={categoryId === category.id}
                className={`min-h-11 shrink-0 rounded-control px-3 text-[10px] font-medium ${
                  categoryId === category.id
                    ? "bg-accent-soft text-accent"
                    : "bg-panel-muted text-muted"
                }`}
                key={category.id}
                onClick={() => {
                  setCategoryId(category.id);
                  resetPage();
                }}
                type="button"
              >
                {category.label} · {category.count}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {loading
          ? "正在读取 AI 模板…"
          : errorMessage !== null
            ? errorMessage
            : view === "recommended"
              ? `已展示 ${String(visibleTemplates.length)} 套内容匹配模板`
              : `找到 ${String(filteredTemplates.length)} 套模板，第 ${String(safePage)} 页`}
      </p>

      {!loading && errorMessage === null ? (
        <div className="px-4 pt-4">
          <button
            aria-pressed={selectedTemplateId === null}
            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-control border px-3 py-2 text-left transition ${
              selectedTemplateId === null
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-panel-muted text-muted hover:border-line-strong"
            }`}
            onClick={() => onSelectTemplate(null)}
            type="button"
          >
            <span className="text-[10px] font-semibold">由 AI 自动匹配</span>
            <span className="text-right text-[8px] leading-4">不指定模板，根据正文自主选择</span>
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-52 place-items-center px-4 text-[11px] text-muted">
          正在读取 AI 模板…
        </div>
      ) : errorMessage !== null ? (
        <div
          className="grid min-h-52 place-items-center bg-danger-soft px-4 text-center text-[11px] text-danger"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className="grid min-h-52 place-items-center px-4 text-center">
          <div>
            <p className="text-[12px] font-semibold text-ink">没有匹配的模板</p>
            <button
              className="mt-3 min-h-11 rounded-control border border-line px-4 text-[10px] font-medium text-muted"
              onClick={() => {
                setQuery("");
                setCategoryId("all");
                setFilter("all");
                resetPage();
              }}
              type="button"
            >
              清除筛选
            </button>
          </div>
        </div>
      ) : (
        <div
          aria-label="可选 AI 模板"
          className="grid grid-cols-1 gap-3 p-4 min-[420px]:grid-cols-2 lg:grid-cols-3"
          role="radiogroup"
        >
          {visibleTemplates.map((template) => {
            const favorite = favorites.has(template.templateId);
            const recent = recents.has(template.templateId);
            const selected = selectedTemplateId === template.templateId;
            const minimumSourceImages = (template as TemplateWithOptionalSignals)
              .minimumSourceImages;
            const imageShortfall = Math.max(0, (minimumSourceImages ?? 0) - sourceImageCount);
            return (
              <article
                className={`relative overflow-hidden rounded-card border bg-panel shadow-subtle transition ${
                  selected
                    ? "border-accent ring-2 ring-accent/15"
                    : "border-line hover:border-line-strong"
                }`}
                data-testid="ai-template-card"
                key={template.templateId}
              >
                <TemplateThumbnail template={template} />
                <button
                  aria-label={favorite ? `取消收藏${template.name}` : `收藏${template.name}`}
                  aria-pressed={favorite}
                  className={`absolute top-2 right-2 grid size-11 place-items-center rounded-full border border-white/70 shadow-subtle ${
                    favorite ? "bg-warning-soft text-warning" : "bg-panel/90 text-muted"
                  }`}
                  onClick={() => onToggleFavorite(template.templateId)}
                  type="button"
                >
                  <Star aria-hidden="true" fill={favorite ? "currentColor" : "none"} size={15} />
                </button>
                <button
                  aria-checked={selected}
                  aria-label={`选择模板 ${template.name}`}
                  className="min-h-[132px] w-full p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
                  onClick={() => onSelectTemplate(template.templateId)}
                  role="radio"
                  type="button"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold leading-5 text-ink">
                      {template.name}
                    </span>
                    {selected ? (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-[8px] font-semibold text-accent">
                        已选择
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[9px] text-accent">
                    {template.categoryLabel} · {template.structureLabel}
                  </span>
                  <span className="mt-2 line-clamp-2 block text-[9px] leading-4 text-muted">
                    {template.description}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    {template.tags.slice(0, 2).map((tag) => (
                      <span
                        className="rounded-full bg-panel-muted px-2 py-0.5 text-[8px] text-faint"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                    {recent ? (
                      <span className="rounded-full bg-panel-muted px-2 py-0.5 text-[8px] text-muted">
                        最近使用
                      </span>
                    ) : null}
                    {imageShortfall > 0 ? (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[8px] text-warning">
                        建议先补 {imageShortfall} 张图
                      </span>
                    ) : null}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {view === "catalog" && filteredTemplates.length > PAGE_SIZE ? (
        <nav
          aria-label="AI 模板库分页"
          className="flex items-center justify-center gap-3 border-t border-line px-4 py-3"
        >
          <button
            aria-label="上一页模板"
            className="grid size-11 place-items-center rounded-control border border-line text-muted disabled:opacity-35"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={15} />
          </button>
          <span className="min-w-20 text-center text-[10px] text-muted">
            {safePage} / {pageCount}
          </span>
          <button
            aria-label="下一页模板"
            className="grid size-11 place-items-center rounded-control border border-line text-muted disabled:opacity-35"
            disabled={safePage >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={15} />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
