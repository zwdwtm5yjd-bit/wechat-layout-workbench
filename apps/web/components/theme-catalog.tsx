"use client";

import { Check, Eye, Palette, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog } from "radix-ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { listThemes, type OfficialTheme } from "../lib/themes/client";
import {
  clearThemeFilter,
  displayThemeCategory,
  summarizeThemeCategories,
  themeMatchesFilters,
  THEME_FILTER_ROWS,
  type ThemeFilters,
} from "../lib/themes/taxonomy";

function ThemeArtwork({
  theme,
  large = false,
}: {
  readonly large?: boolean;
  readonly theme: OfficialTheme;
}) {
  const colors = theme.preview.accentColors;

  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-subtle ${
        large ? "min-h-[430px] p-8" : "aspect-[4/5] p-4"
      }`}
    >
      <div
        className={`mx-auto h-1 rounded-full ${large ? "w-20" : "w-12"}`}
        style={{ backgroundColor: colors[2] }}
      />
      <p
        className={`${large ? "mt-10 text-3xl" : "mt-5 text-[15px]"} text-center font-bold tracking-tight`}
        style={{ color: colors[0] }}
      >
        {theme.preview.heading1}
      </p>
      <p
        className={`${large ? "mt-5 text-[15px] leading-8" : "mt-3 text-[9px] leading-4"} text-zinc-500`}
      >
        {theme.preview.body}
      </p>
      <div
        className={`${large ? "my-8 p-5 text-sm leading-7" : "my-4 p-3 text-[9px] leading-4"} border-l-[3px]`}
        style={{ borderColor: colors[2], backgroundColor: colors[1] }}
      >
        {theme.preview.quote}
      </div>
      {[74, 92, 84, 66].map((width) => (
        <div
          className={`${large ? "mt-4 h-2" : "mt-2 h-1"} rounded-full bg-zinc-200`}
          key={width}
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}

export function ThemeCatalog() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OfficialTheme | null>(null);
  const [filters, setFilters] = useState<ThemeFilters>({});
  const themes = useQuery({
    queryKey: ["themes"],
    queryFn: () => listThemes(),
    staleTime: 60_000,
  });
  const visibleThemes = useMemo(() => {
    const items = themes.data?.items ?? [];
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return items.filter((theme) => {
      const matchesQuery =
        normalized === "" ||
        `${theme.manifest.name} ${theme.manifest.categories.join(" ")} ${theme.manifest.description} ${theme.manifest.recommendedContentTypes.join(" ")}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalized);
      const matchesFilters = themeMatchesFilters(theme.manifest.categories, filters);
      return matchesQuery && matchesFilters;
    });
  }, [filters, query, themes.data]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium text-accent">VISUAL SYSTEM</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold tracking-[-0.035em] text-ink">
            主题
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-[13px] leading-6 text-muted">
            10 套官方场景主题已安装，并按用途、行业、节假、风格与色调重新分类。
            可直接搜索“放假通知”“党建宣传”“中秋节”等内容场景。
          </p>
        </div>
        <label className="relative w-full md:w-72">
          <span className="sr-only">搜索主题</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
            size={15}
          />
          <input
            className="h-11 w-full rounded-control border border-line bg-panel pr-3 pl-9 text-base text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-accent focus:ring-3 focus:ring-accent/20"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索风格或场景"
            value={query}
          />
        </label>
      </section>

      <section aria-label="主题筛选" className="space-y-3 rounded-card bg-panel p-5 shadow-subtle">
        {THEME_FILTER_ROWS.map((row) => (
          <div className="flex items-start gap-3" key={row.axis}>
            <span className="w-10 shrink-0 pt-3 text-[11px] font-medium text-muted">
              {row.axis}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                aria-pressed={filters[row.axis] === undefined}
                className={`min-h-10 rounded-control px-3 py-2 text-[11px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${filters[row.axis] === undefined ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-hover hover:text-ink"}`}
                onClick={() => setFilters((current) => clearThemeFilter(current, row.axis))}
                type="button"
              >
                全部
              </button>
              {row.options.map((option) => (
                <button
                  aria-pressed={filters[row.axis] === option}
                  className={`min-h-10 rounded-control px-3 py-2 text-[11px] transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${filters[row.axis] === option ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-hover hover:text-ink"}`}
                  key={option}
                  onClick={() => setFilters((current) => ({ ...current, [row.axis]: option }))}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-card bg-accent-soft/60 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-panel text-accent shadow-subtle">
            <Sparkles aria-hidden="true" size={16} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">官方资产已安装</p>
            <p className="mt-1 text-pretty text-[11px] leading-5 text-muted">
              正式应用前会自动创建文章快照，只更新主题引用，不改变原文。
            </p>
          </div>
        </div>
      </section>

      {themes.isPending ? (
        <section className="grid min-h-72 place-items-center rounded-card bg-panel text-xs text-muted shadow-subtle">
          正在读取已安装主题…
        </section>
      ) : themes.isError ? (
        <section className="grid min-h-72 place-items-center rounded-card bg-danger-soft px-6 text-center text-xs text-danger shadow-subtle">
          主题服务暂时不可用，请稍后重试。
        </section>
      ) : visibleThemes.length === 0 ? (
        <section className="grid min-h-72 place-items-center rounded-card bg-panel px-6 text-center shadow-subtle">
          <div>
            <Palette aria-hidden="true" className="mx-auto text-muted" size={24} />
            <p className="mt-3 text-balance text-sm font-semibold text-ink">没有匹配的主题</p>
            <p className="mt-1 text-pretty text-xs text-muted">
              请清除筛选，或改用“政务”“长文”等更宽泛的关键词。
            </p>
            <button
              className="mt-4 min-h-10 rounded-control border border-line px-4 py-2 text-xs font-medium text-ink transition-[background-color,border-color,transform] duration-150 hover:bg-hover active:scale-[0.96]"
              onClick={() => {
                setFilters({});
                setQuery("");
              }}
              type="button"
            >
              清除筛选与搜索
            </button>
          </div>
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleThemes.map((theme) => (
            <article
              className="group rounded-card bg-panel p-4 shadow-subtle transition-shadow duration-150 hover:shadow-raised"
              key={theme.manifest.themeId}
            >
              <ThemeArtwork theme={theme} />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-balance text-sm font-semibold text-ink">
                    {theme.manifest.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {summarizeThemeCategories(theme.manifest.categories)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[11px] font-medium text-success">
                  <ShieldCheck aria-hidden="true" size={11} />
                  已安装
                </span>
              </div>
              <p className="mt-3 text-pretty text-xs leading-5 text-muted">
                {theme.manifest.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-1">
                  {theme.preview.accentColors.map((color) => (
                    <span
                      aria-label={`色值 ${color}`}
                      className="size-5 rounded-full border-2 border-panel"
                      key={color}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  className="inline-flex h-10 items-center gap-1.5 rounded-control border border-line px-3 text-[11px] font-medium text-ink transition-[background-color,border-color,transform] duration-150 hover:bg-hover active:scale-[0.96]"
                  onClick={() => setSelected(theme)}
                  type="button"
                >
                  <Eye aria-hidden="true" size={13} />
                  查看预览
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <Dialog.Root
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        open={selected !== null}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[90vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-card bg-panel p-5 shadow-raised md:grid-cols-[minmax(0,1fr)_300px]">
            {selected === null ? null : (
              <>
                <ThemeArtwork large theme={selected} />
                <div className="flex flex-col">
                  <Dialog.Title className="text-balance text-xl font-semibold tracking-tight text-ink">
                    {selected.manifest.name}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-pretty text-xs leading-6 text-muted">
                    {selected.manifest.description}
                  </Dialog.Description>
                  <dl className="mt-6 space-y-3 text-xs">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">分类</dt>
                      <dd className="text-ink">
                        {selected.manifest.categories
                          .filter((category) => category.includes(":"))
                          .map(displayThemeCategory)
                          .join("、")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">适用场景</dt>
                      <dd className="text-right text-ink">
                        {selected.manifest.recommendedContentTypes.join("、")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">兼容状态</dt>
                      <dd className="inline-flex items-center gap-1 text-success">
                        <Check aria-hidden="true" size={12} />
                        {selected.manifest.compatibilityLevel} · 三模式通过
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">安装状态</dt>
                      <dd className="text-success">已安装 v{selected.manifest.version}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto space-y-2 pt-8">
                    <div className="flex min-h-10 items-center justify-center gap-2 rounded-control bg-success-soft px-3 text-xs font-medium text-success">
                      <Check aria-hidden="true" size={14} />
                      已安装，可在编辑器应用
                    </div>
                    <button
                      className="h-10 w-full rounded-control bg-accent text-xs font-semibold text-white shadow-subtle transition-[background-color,transform,box-shadow] duration-150 hover:bg-accent-strong hover:shadow-raised active:scale-[0.96]"
                      onClick={() => setSelected(null)}
                      type="button"
                    >
                      关闭预览
                    </button>
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
