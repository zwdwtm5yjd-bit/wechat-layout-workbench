"use client";

import { Check, Eye, Palette, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog } from "radix-ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { listThemes, type OfficialTheme } from "../lib/themes/client";
import {
  displayThemeCategory,
  summarizeThemeCategories,
  THEME_FILTER_ROWS,
  type ThemeFilterAxis,
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
  const [filters, setFilters] = useState<Partial<Record<ThemeFilterAxis, string>>>({});
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
      const matchesFilters = Object.entries(filters).every(([axis, value]) =>
        theme.manifest.categories.includes(`${axis}:${value}`),
      );
      return matchesQuery && matchesFilters;
    });
  }, [filters, query, themes.data]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">VISUAL SYSTEM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">主题</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
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
            className="h-10 w-full rounded-control border border-line bg-panel pr-3 pl-9 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索风格或场景"
            value={query}
          />
        </label>
      </section>

      <section className="space-y-2 rounded-card border border-line bg-panel p-4 shadow-subtle">
        {THEME_FILTER_ROWS.map((row) => (
          <div className="flex items-start gap-3" key={row.axis}>
            <span className="w-10 shrink-0 pt-1.5 text-[11px] text-faint">{row.axis}</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                className={`rounded-md px-2.5 py-1.5 text-[11px] ${filters[row.axis] === undefined ? "bg-accent text-white" : "text-muted hover:bg-hover"}`}
                onClick={() => setFilters((current) => ({ ...current, [row.axis]: undefined }))}
                type="button"
              >
                全部
              </button>
              {row.options.map((option) => (
                <button
                  className={`rounded-md px-2.5 py-1.5 text-[11px] transition ${filters[row.axis] === option ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-hover hover:text-ink"}`}
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

      <section className="rounded-card border border-accent/15 bg-accent-soft/60 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-panel text-accent shadow-subtle">
            <Sparkles aria-hidden="true" size={16} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">官方资产已安装</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              正式应用前会自动创建文章快照，只更新主题引用，不改变原文。
            </p>
          </div>
        </div>
      </section>

      {themes.isPending ? (
        <section className="grid min-h-72 place-items-center rounded-card border border-line bg-panel text-[12px] text-muted">
          正在读取已安装主题…
        </section>
      ) : themes.isError ? (
        <section className="grid min-h-72 place-items-center rounded-card border border-danger/20 bg-danger-soft text-[12px] text-danger">
          主题服务暂时不可用，请稍后重试。
        </section>
      ) : visibleThemes.length === 0 ? (
        <section className="grid min-h-72 place-items-center rounded-card border border-line bg-panel text-center">
          <div>
            <Palette aria-hidden="true" className="mx-auto text-faint" size={24} />
            <p className="mt-3 text-sm font-semibold text-ink">没有匹配的主题</p>
            <p className="mt-1 text-[12px] text-muted">试试“政务”或“长文”。</p>
          </div>
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleThemes.map((theme) => (
            <article
              className="group rounded-card border border-line bg-panel p-4 shadow-subtle transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
              key={theme.manifest.themeId}
            >
              <ThemeArtwork theme={theme} />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{theme.manifest.name}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {summarizeThemeCategories(theme.manifest.categories)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-medium text-success">
                  <ShieldCheck aria-hidden="true" size={11} />
                  已安装
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-muted">{theme.manifest.description}</p>
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-[11px] font-medium text-ink hover:bg-hover"
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
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[90vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-card border border-line bg-panel p-5 shadow-raised md:grid-cols-[minmax(0,1fr)_300px]">
            {selected === null ? null : (
              <>
                <ThemeArtwork large theme={selected} />
                <div className="flex flex-col">
                  <Dialog.Title className="text-xl font-semibold tracking-tight text-ink">
                    {selected.manifest.name}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-[12px] leading-6 text-muted">
                    {selected.manifest.description}
                  </Dialog.Description>
                  <dl className="mt-6 space-y-3 text-[12px]">
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">分类</dt>
                      <dd className="text-ink">
                        {selected.manifest.categories
                          .filter((category) => category.includes(":"))
                          .map(displayThemeCategory)
                          .join("、")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">适用场景</dt>
                      <dd className="text-right text-ink">
                        {selected.manifest.recommendedContentTypes.join("、")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">兼容状态</dt>
                      <dd className="inline-flex items-center gap-1 text-success">
                        <Check aria-hidden="true" size={12} />
                        {selected.manifest.compatibilityLevel} · 三模式通过
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">安装状态</dt>
                      <dd className="text-success">已安装 v{selected.manifest.version}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto space-y-2 pt-8">
                    <button
                      className="h-10 w-full rounded-control bg-accent text-[12px] font-semibold text-white"
                      onClick={() => setSelected(null)}
                      type="button"
                    >
                      已安装，可在编辑器应用
                    </button>
                    <button
                      className="h-10 w-full rounded-control border border-line text-[12px] font-medium text-ink hover:bg-hover"
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
