"use client";

import { Check, Eye, Palette, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";

import { V0_THEME_PREVIEWS, type ThemePreview } from "../lib/v0-catalog";
import { useAppToast } from "./ui/app-toast";

function ThemeArtwork({
  theme,
  large = false,
}: {
  readonly large?: boolean;
  readonly theme: ThemePreview;
}) {
  const civic = theme.id === "modern-civic";

  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-subtle ${
        large ? "min-h-[430px] p-8" : "aspect-[4/5] p-4"
      }`}
    >
      <div
        className={`mx-auto h-1 rounded-full ${large ? "w-20" : "w-12"}`}
        style={{ backgroundColor: theme.colors[2] }}
      />
      <p
        className={`${large ? "mt-10 text-3xl" : "mt-5 text-[15px]"} text-center font-bold tracking-tight`}
        style={{ color: theme.colors[0] }}
      >
        {civic ? "把工作做深，把责任压实" : "让真正重要的内容被看见"}
      </p>
      <p
        className={`${large ? "mt-5 text-[15px] leading-8" : "mt-3 text-[9px] leading-4"} text-zinc-500`}
      >
        好的排版不是装饰内容，而是建立阅读秩序。标题、正文、引用与留白各自承担清楚的职责。
      </p>
      <div
        className={`${large ? "my-8 p-5 text-sm leading-7" : "my-4 p-3 text-[9px] leading-4"} border-l-[3px]`}
        style={{ borderColor: theme.colors[2], backgroundColor: theme.colors[1] }}
      >
        每一处视觉强调都必须服务于信息，而不是争夺注意力。
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
  const { pushToast } = useAppToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ThemePreview | null>(null);
  const visibleThemes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return normalized === ""
      ? V0_THEME_PREVIEWS
      : V0_THEME_PREVIEWS.filter((theme) =>
          `${theme.name} ${theme.category} ${theme.description} ${theme.scenes.join(" ")}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalized),
        );
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">VISUAL SYSTEM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">主题</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            V0.1 先提供两套视觉方向预览。主题 Token
            协议已经冻结，正式安装与应用由基础主题资产任务接入。
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

      <section className="rounded-card border border-accent/15 bg-accent-soft/60 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-panel text-accent shadow-subtle">
            <Sparkles aria-hidden="true" size={16} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">预览目录，不伪造安装状态</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              你可以查看完整视觉方向；编辑器内支持临时“试穿”。正式应用按钮会保持禁用，直到主题资产和持久化接口完成。
            </p>
          </div>
        </div>
      </section>

      {visibleThemes.length === 0 ? (
        <section className="grid min-h-72 place-items-center rounded-card border border-line bg-panel text-center">
          <div>
            <Palette aria-hidden="true" className="mx-auto text-faint" size={24} />
            <p className="mt-3 text-sm font-semibold text-ink">没有匹配的主题</p>
            <p className="mt-1 text-[12px] text-muted">试试“政务”或“长文”。</p>
          </div>
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {visibleThemes.map((theme) => (
            <article
              className="group rounded-card border border-line bg-panel p-4 shadow-subtle transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
              key={theme.id}
            >
              <ThemeArtwork theme={theme} />
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{theme.name}</p>
                  <p className="mt-1 text-[11px] text-muted">{theme.category}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-medium text-success">
                  <ShieldCheck aria-hidden="true" size={11} />
                  安全预览
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-muted">{theme.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-1">
                  {theme.colors.map((color) => (
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
                    {selected.name}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-[12px] leading-6 text-muted">
                    {selected.description}
                  </Dialog.Description>
                  <dl className="mt-6 space-y-3 text-[12px]">
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">分类</dt>
                      <dd className="text-ink">{selected.category}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">适用场景</dt>
                      <dd className="text-right text-ink">{selected.scenes.join("、")}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">兼容状态</dt>
                      <dd className="inline-flex items-center gap-1 text-success">
                        <Check aria-hidden="true" size={12} />
                        静态预览通过
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">安装状态</dt>
                      <dd className="text-warning">等待主题资产</dd>
                    </div>
                  </dl>
                  <div className="mt-auto space-y-2 pt-8">
                    <button
                      className="h-10 w-full rounded-control bg-accent text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                      disabled
                      type="button"
                    >
                      正式应用尚未接入
                    </button>
                    <button
                      className="h-10 w-full rounded-control border border-line text-[12px] font-medium text-ink hover:bg-hover"
                      onClick={() => {
                        pushToast({
                          title: "可在编辑器内试穿",
                          description: "打开任意文章，在左侧“主题”标签中选择该视觉方向。",
                        });
                        setSelected(null);
                      }}
                      type="button"
                    >
                      查看使用说明
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
