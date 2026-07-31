"use client";

import {
  Blocks,
  ChevronRight,
  Heading1,
  Heading2,
  Info,
  Minus,
  Pilcrow,
  Quote,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";

import {
  V0_COMPONENT_PREVIEWS,
  type ComponentPreview,
  type NativeComponentBlock,
} from "../lib/v0-catalog";

const componentIcons: Readonly<Record<NativeComponentBlock, LucideIcon>> = {
  blockquote: Quote,
  divider: Minus,
  heading1: Heading1,
  heading2: Heading2,
  paragraph: Pilcrow,
};

const categories = ["全部", "标题", "引用", "提示", "分割线"] as const;

function ComponentSample({ component }: { readonly component: ComponentPreview }) {
  if (component.blockType === "divider") {
    return (
      <div className="flex h-28 items-center px-7">
        <span className="h-px w-full bg-zinc-300" />
      </div>
    );
  }

  if (component.blockType === "blockquote") {
    return (
      <div className="flex h-28 items-center p-5">
        <blockquote
          className={`w-full border-l-[3px] px-4 py-3 text-[12px] leading-5 ${
            component.tone === "warning"
              ? "border-amber-500 bg-amber-50 text-amber-950"
              : "border-indigo-500 bg-indigo-50 text-zinc-700"
          }`}
        >
          {component.tone === "warning"
            ? "注意：发布前请完成最终预览。"
            : "重点信息应该清晰，而不是喧闹。"}
        </blockquote>
      </div>
    );
  }

  if (component.blockType === "heading1" || component.blockType === "heading2") {
    return (
      <div className="flex h-28 items-center px-5">
        <div>
          <span className="mb-2 block h-1 w-8 rounded-full bg-indigo-500" />
          <p
            className={
              component.blockType === "heading1"
                ? "text-lg font-bold text-zinc-900"
                : "text-[15px] font-semibold text-zinc-800"
            }
          >
            {component.blockType === "heading1" ? "真正重要的章节" : "把信息分成清楚的小节"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-28 items-center p-5">
      <div className="rounded-md bg-zinc-50 px-4 py-3 text-[12px] leading-5 text-zinc-600">
        补充说明用于解释上下文，不抢夺正文的阅读焦点。
      </div>
    </div>
  );
}

export function ComponentCatalog() {
  const [category, setCategory] = useState<(typeof categories)[number]>("全部");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ComponentPreview | null>(null);
  const visibleComponents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return V0_COMPONENT_PREVIEWS.filter(
      (component) =>
        (category === "全部" || component.category === category) &&
        (normalized === "" ||
          `${component.name} ${component.category} ${component.description}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalized)),
    );
  }, [category, query]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">NATIVE BLOCKS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">组件</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            浏览编辑器当前支持的基础结构组件。打开文章后，可从左侧组件面板直接插入。
          </p>
        </div>
        <label className="relative w-full md:w-72">
          <span className="sr-only">搜索组件</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
            size={15}
          />
          <input
            className="h-10 w-full rounded-control border border-line bg-panel pr-3 pl-9 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称或用途"
            value={query}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-panel p-4 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-success-soft text-success">
            <ShieldCheck aria-hidden="true" size={16} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">微信安全基础区块</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              当前目录只展示可由文档 Schema 表达、可在安全模式降级的原生区块。
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-panel-muted px-3 py-1.5 text-[10px] text-muted">
          {V0_COMPONENT_PREVIEWS.length} 个可用预览
        </span>
      </section>

      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {categories.map((item) => (
          <button
            aria-selected={category === item}
            className={`shrink-0 rounded-control px-3 py-2 text-[12px] font-medium transition ${
              category === item
                ? "bg-accent-soft text-accent-strong"
                : "text-muted hover:bg-hover hover:text-ink"
            }`}
            key={item}
            onClick={() => setCategory(item)}
            role="tab"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      {visibleComponents.length === 0 ? (
        <section className="grid min-h-72 place-items-center rounded-card border border-line bg-panel text-center">
          <div>
            <Blocks aria-hidden="true" className="mx-auto text-faint" size={24} />
            <p className="mt-3 text-sm font-semibold text-ink">没有匹配的组件</p>
            <p className="mt-1 text-[12px] text-muted">清除关键词或切换分类后再试。</p>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleComponents.map((component) => {
            const Icon = componentIcons[component.blockType];
            return (
              <button
                className="group overflow-hidden rounded-card border border-line bg-panel text-left shadow-subtle transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
                key={component.id}
                onClick={() => setSelected(component)}
                type="button"
              >
                <div className="border-b border-line bg-white">
                  <ComponentSample component={component} />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent">
                      <Icon aria-hidden="true" size={13} />
                    </span>
                    <p className="text-[13px] font-semibold text-ink">{component.name}</p>
                    <ChevronRight
                      aria-hidden="true"
                      className="ml-auto text-faint transition group-hover:translate-x-0.5"
                      size={14}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-muted">
                    {component.description}
                  </p>
                </div>
              </button>
            );
          })}
        </section>
      )}

      <Dialog.Root
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        open={selected !== null}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/25 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[min(420px,100vw)] overflow-y-auto border-l border-line bg-panel p-6 shadow-raised">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold text-ink">
                  {selected?.name}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12px] text-muted">
                  {selected?.category} · 基础结构组件
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="关闭组件详情"
                className="grid size-8 place-items-center rounded-control text-faint hover:bg-hover hover:text-ink"
              >
                <X aria-hidden="true" size={16} />
              </Dialog.Close>
            </div>
            {selected === null ? null : (
              <>
                <div className="mt-6 overflow-hidden rounded-card border border-line bg-white">
                  <ComponentSample component={selected} />
                </div>
                <p className="mt-5 text-[12px] leading-6 text-muted">{selected.description}</p>
                <dl className="mt-6 space-y-3 rounded-control bg-panel-muted p-4 text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-faint">Schema 区块</dt>
                    <dd className="font-mono text-ink">{selected.blockType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-faint">输出策略</dt>
                    <dd className="text-success">微信安全降级</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-faint">目录状态</dt>
                    <dd className="text-ink">可在编辑器插入</dd>
                  </div>
                </dl>
                <div className="mt-5 flex gap-2 rounded-control border border-accent/15 bg-accent-soft p-3">
                  <Info aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={14} />
                  <p className="text-[11px] leading-5 text-muted">
                    组件中心不持有当前文章上下文。请进入文章编辑器，从左侧“组件”标签插入。
                  </p>
                </div>
                <button
                  className="mt-6 h-10 w-full rounded-control bg-accent text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled
                  type="button"
                >
                  需要先打开一篇文章
                </button>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
