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
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import {
  COMPONENT_CATALOG_GROUPS,
  V0_COMPONENT_PREVIEWS,
  type ComponentPreview,
} from "../lib/v0-catalog";

const layoutIcons: Readonly<Record<ComponentPreview["layoutKey"], LucideIcon>> = {
  data: Blocks,
  divider: Minus,
  footer: Pilcrow,
  heading: Heading1,
  image: Blocks,
  notice: Info,
  quote: Quote,
};

const categories = ["全部", ...COMPONENT_CATALOG_GROUPS] as const;

const compatibilityLabels = {
  compatible: "微信兼容",
  conditional: "条件兼容",
  risky: "高风险",
  safe: "微信安全",
} as const;

function categoryCount(category: (typeof categories)[number]): number {
  return category === "全部"
    ? V0_COMPONENT_PREVIEWS.length
    : V0_COMPONENT_PREVIEWS.filter((component) => component.category === category).length;
}

function sampleText(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function previewVariant(component: ComponentPreview): string {
  const tokenVariant = component.asset.manifest.defaultTokenMap.variant;
  if (typeof tokenVariant === "string") return tokenVariant;
  const attributes = component.asset.manifest.insertionPreset.attributes;
  return "variant" in attributes && typeof attributes.variant === "string"
    ? attributes.variant
    : component.asset.manifest.defaultVariantId;
}

function defaultSlotText(component: ComponentPreview, slotId: string, fallback = ""): string {
  const value = component.asset.defaultSlots[slotId];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function ComponentSample({ component }: { readonly component: ComponentPreview }) {
  const { layoutKey, sample } = component.asset.preview;
  const variant = previewVariant(component);

  if (layoutKey === "divider") {
    const preset = component.asset.manifest.insertionPreset;
    const attributes = preset.nodeType === "divider" ? preset.attributes : {};
    const ornament = attributes.variant === "ornament";
    return (
      <div
        className="flex h-32 items-center justify-center gap-3 px-7"
        data-layout-key={layoutKey}
        data-variant={variant}
      >
        <span
          className="h-0 flex-1 border-t border-zinc-300"
          style={{ borderTopStyle: attributes.variant === "dashed" ? "dashed" : "solid" }}
        />
        {ornament ? (
          <span className="text-[11px] text-indigo-500">{attributes.icon ?? "◆"}</span>
        ) : null}
        {ornament ? <span className="h-0 flex-1 border-t border-zinc-300" /> : null}
      </div>
    );
  }

  if (layoutKey === "quote") {
    const body = sampleText(sample.body ?? sample.title, "重点信息应该清晰，而不是喧闹。");
    const source = sample.source;
    if (variant === "quotation") {
      return (
        <div
          className="flex h-32 items-center px-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <blockquote className="relative w-full px-6 py-2 text-center text-[12px] leading-5 text-zinc-700">
            <span className="absolute top-0 left-0 text-3xl leading-none text-indigo-300">“</span>
            {body}
            <footer className="mt-1 text-[10px] text-zinc-500">— {source}</footer>
          </blockquote>
        </div>
      );
    }
    if (variant === "conclusion") {
      return (
        <div
          className="flex h-32 items-center p-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <blockquote className="w-full border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-[12px] font-semibold leading-5 text-zinc-800">
            {body}
            <footer className="mt-1 text-[9px] font-normal text-zinc-500">{source}</footer>
          </blockquote>
        </div>
      );
    }
    if (variant === "document") {
      return (
        <div
          className="flex h-32 items-center p-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <blockquote className="w-full border border-zinc-300 bg-stone-50 px-4 py-3 text-[11px] leading-5 text-zinc-700">
            <p className="mb-1 text-[9px] font-semibold tracking-[0.14em] text-zinc-500">
              原文摘录
            </p>
            {body}
            <footer className="mt-1 text-right text-[9px] text-zinc-500">{source}</footer>
          </blockquote>
        </div>
      );
    }
    if (variant === "postcard" || variant === "highlight") {
      return (
        <div
          className="flex h-32 items-center p-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <blockquote
            className={
              variant === "postcard"
                ? "w-full rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[11px] leading-5 text-stone-700"
                : "w-full border-y-2 border-indigo-300 px-4 py-3 text-center text-[14px] font-bold leading-6 text-zinc-800"
            }
          >
            {body}
            <footer className="mt-1 text-[9px] font-normal text-zinc-500">— {source}</footer>
          </blockquote>
        </div>
      );
    }
    return (
      <div
        className="flex h-32 items-center p-5"
        data-layout-key={layoutKey}
        data-variant={variant}
      >
        <blockquote className="w-full border-l-[3px] border-indigo-500 bg-indigo-50 px-4 py-3 text-[12px] leading-5 text-zinc-700">
          {body}
          {source === undefined ? null : (
            <footer className="mt-1 text-right text-[10px] text-zinc-500">— {source}</footer>
          )}
        </blockquote>
      </div>
    );
  }

  if (layoutKey === "heading") {
    const levelOne = component.category === "一级标题";
    const title = sampleText(sample.title, levelOne ? "真正重要的章节" : "把信息分成清楚的小节");
    const titleClass = levelOne
      ? "text-lg font-bold leading-7 text-zinc-900"
      : "text-[15px] font-semibold leading-6 text-zinc-800";
    const numbered = title.match(/^(.{1,8}?[、.])\s*(.+)$/u);
    let heading: ReactNode;
    if (variant === "ribbon") {
      heading = (
        <p className={`rounded bg-indigo-600 px-4 py-3 text-center text-white ${titleClass}`}>
          {title}
        </p>
      );
    } else if (variant === "framed") {
      heading = (
        <p
          className={`rounded border border-amber-400 px-4 py-3 text-center tracking-wider ${titleClass}`}
        >
          {title}
        </p>
      );
    } else if (variant === "pill") {
      heading = (
        <p
          className={`inline-block rounded-full bg-indigo-50 px-4 py-1.5 text-indigo-700 ${titleClass}`}
        >
          {title}
        </p>
      );
    } else if (variant === "marker") {
      heading = <p className={`border-b-2 border-indigo-400 pb-2 ${titleClass}`}>{title}</p>;
    } else if (variant === "leftbar") {
      heading = <p className={`border-l-[3px] border-indigo-500 pl-3 ${titleClass}`}>{title}</p>;
    } else if (variant === "underlined") {
      heading = (
        <div>
          <p className={titleClass}>{title}</p>
          <span className="mt-2 block h-px w-12 bg-indigo-400" />
        </div>
      );
    } else if (variant === "centered") {
      heading = <p className={`${titleClass} text-center tracking-wide`}>{title}</p>;
    } else if (variant === "dot") {
      heading = (
        <p className={`flex items-start gap-2 ${titleClass}`}>
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-500" />
          <span>{title}</span>
        </p>
      );
    } else if (variant === "numbered" && numbered !== null) {
      heading = (
        <div className="flex items-start gap-3">
          <span className="border-b-2 border-indigo-500 pt-0.5 text-[11px] font-bold text-indigo-600">
            {numbered[1]}
          </span>
          <p className={titleClass}>{numbered[2]}</p>
        </div>
      );
    } else {
      heading = <p className={titleClass}>{title}</p>;
    }
    return (
      <div
        className="flex h-32 items-center px-5"
        data-layout-key={layoutKey}
        data-variant={variant}
      >
        <div className="w-full">{heading}</div>
      </div>
    );
  }

  if (layoutKey === "data") {
    const title = sampleText(sample.eyebrow ?? sample.title, "关键指标");
    const value = sampleText(sample.value, "96");
    const unit = sample.unit?.trim() ?? "";
    if (variant === "double_compare") {
      const labels = title.split("/").map((label) => label.trim());
      return (
        <div
          className="flex h-32 items-center p-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <div className="grid w-full grid-cols-2 divide-x divide-zinc-200 border border-zinc-200 bg-zinc-50 py-3 text-center">
            {["primaryValue", "secondaryValue"].map((slotId, index) => (
              <div key={slotId}>
                <p className="text-[9px] text-zinc-500">
                  {labels[index] ?? `指标 ${String(index + 1)}`}
                </p>
                <p className="mt-1 text-xl font-bold text-zinc-900">
                  {defaultSlotText(component, slotId, "--")}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (variant === "progress") {
      const progress = Math.max(0, Math.min(100, Number(value) || 0));
      return (
        <div
          className="flex h-32 items-center p-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <div className="w-full border-l-[3px] border-indigo-500 bg-zinc-50 px-4 py-3">
            <div className="flex items-end justify-between gap-3">
              <p className="text-[10px] text-zinc-500">{title}</p>
              <p className="text-xl font-bold text-zinc-900">
                {value}
                {unit}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <span
                className="block h-full bg-indigo-500"
                style={{ width: `${String(progress)}%` }}
              />
            </div>
          </div>
        </div>
      );
    }
    if (variant === "time_metric") {
      return (
        <div
          className="flex h-32 items-center p-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <div className="flex w-full items-center justify-between border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div>
              <p className="text-[9px] tracking-wide text-zinc-500">TIME</p>
              <p className="mt-1 text-[10px] text-zinc-600">{title}</p>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {value}
              <span className="ml-1 text-[10px] font-medium text-zinc-500">{unit}</span>
            </p>
          </div>
        </div>
      );
    }
    if (variant === "badge_metric") {
      return (
        <div
          className="flex h-32 items-center justify-center p-5"
          data-layout-key={layoutKey}
          data-variant={variant}
        >
          <div className="rounded-full border border-indigo-200 bg-indigo-50 px-7 py-3 text-center">
            <p className="text-[9px] text-indigo-500">{title}</p>
            <p className="mt-0.5 text-2xl font-bold text-indigo-700">
              {value}
              <span className="ml-1 text-[9px] font-medium text-indigo-400">{unit}</span>
            </p>
          </div>
        </div>
      );
    }
    return (
      <div
        className="flex h-32 items-center p-5"
        data-layout-key={layoutKey}
        data-variant={variant}
      >
        <div className="w-full border-t-2 border-indigo-500 bg-zinc-50 px-4 py-3">
          <p className="text-[10px] text-zinc-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
            {value}
            {unit === "" ? null : (
              <span className="ml-1 text-xs font-medium text-zinc-500">{unit}</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (layoutKey === "image") {
    const preset = component.asset.manifest.insertionPreset;
    const attributes = preset.nodeType === "imageBlock" ? preset.attributes : {};
    const width =
      attributes.widthMode === "percent" ? `${String(attributes.widthPercent ?? 100)}%` : "100%";
    const frameClass =
      variant === "rounded_caption"
        ? "rounded-lg border border-zinc-200"
        : variant === "polaroid"
          ? "border-[6px] border-white shadow-md"
          : variant === "documentary"
            ? "border-2 border-zinc-400"
            : "border border-zinc-200";
    return (
      <div
        className="flex h-32 flex-col items-center justify-center p-4"
        data-layout-key={layoutKey}
        data-variant={variant}
      >
        {variant === "documentary" ? (
          <p className="mb-1 w-full text-[8px] tracking-[0.12em] text-zinc-500">DOCUMENTARY</p>
        ) : null}
        <div
          className={`grid h-16 place-items-center bg-zinc-100 text-[10px] text-zinc-500 ${frameClass}`}
          style={{ width }}
        >
          {sampleText(sample.imageAlt, "图片预览")} · 待选择
        </div>
        <p
          className={`mt-1 w-full truncate text-[9px] text-zinc-500 ${variant === "centered_numbered" ? "text-center font-medium" : "text-left"}`}
        >
          {sampleText(sample.caption, "图片说明")}
        </p>
      </div>
    );
  }

  if (layoutKey === "footer") {
    const qrcode = variant === "qrcode_follow";
    const signature = variant === "signature";
    return (
      <div
        className="flex h-32 items-center justify-center px-6 text-center"
        data-layout-key={layoutKey}
        data-variant={variant}
      >
        <div
          className={`w-full pt-3 ${qrcode ? "rounded-md bg-zinc-50 px-4" : signature ? "border-t border-amber-300 font-serif" : "border-t border-zinc-200"}`}
        >
          {qrcode ? (
            <div className="mx-auto grid size-9 place-items-center border border-dashed border-zinc-400 bg-white text-[7px] text-zinc-500">
              待选二维码
            </div>
          ) : null}
          <p className="mt-1 text-[9px] text-zinc-500">
            {sampleText(sample.footer ?? sample.body, "感谢阅读")}
          </p>
        </div>
      </div>
    );
  }

  const noticeClass =
    variant === "risk"
      ? "border-2 border-red-300 bg-red-50"
      : variant === "checklist"
        ? "rounded-md border border-dashed border-emerald-300 bg-emerald-50"
        : variant === "story"
          ? "rounded-md border border-amber-200 bg-amber-50"
          : variant === "warning"
            ? "border-t-[3px] border-amber-400 bg-amber-50"
            : variant === "success"
              ? "border border-emerald-200 bg-emerald-50"
              : "border-l-[3px] border-indigo-400 bg-indigo-50";
  return (
    <div className="flex h-32 items-center p-5" data-layout-key={layoutKey} data-variant={variant}>
      <div className={`w-full px-4 py-3 text-[12px] leading-5 text-zinc-700 ${noticeClass}`}>
        {sample.eyebrow === undefined ? null : (
          <p className="mb-1 text-[9px] font-semibold tracking-wide text-indigo-600">
            {sample.eyebrow}
          </p>
        )}
        <p className="font-semibold text-zinc-800">{sampleText(sample.title, "重点提示")}</p>
        <p className="mt-1 line-clamp-2 text-[10px] text-zinc-600">
          {sampleText(sample.body, "用清晰的结构承载关键说明。")}
        </p>
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
    return V0_COMPONENT_PREVIEWS.filter((component) => {
      const manifest = component.asset.manifest;
      const searchText = [
        component.name,
        component.category,
        component.description,
        component.id,
        component.version,
        manifest.nodeType,
        ...manifest.semanticRoles,
        ...(manifest.scenarios ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("zh-CN");

      return (
        (category === "全部" || component.category === category) &&
        (normalized === "" || searchText.includes(normalized))
      );
    });
  }, [category, query]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">OFFICIAL COMPONENTS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">组件</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            浏览 41 个正式组件，覆盖标题、引用、提示、数据、图片、分隔与文末。
            目录、编辑器和微信输出共用同一份组件 Manifest。
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
            placeholder="搜索名称、ID 或用途"
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
            <p className="text-[13px] font-semibold text-ink">官方组件已安装</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              每个条目都有固定 ID、版本、插入预设和微信兼容等级，可安全追踪与降级。
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-panel-muted px-3 py-1.5 text-[10px] text-muted">
          {V0_COMPONENT_PREVIEWS.length} 个正式组件
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
            <span className="ml-1.5 text-[10px] opacity-60">{categoryCount(item)}</span>
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
            const Icon =
              component.layoutKey === "heading" && component.category === "二级标题"
                ? Heading2
                : layoutIcons[component.layoutKey];
            return (
              <button
                className="group overflow-hidden rounded-card border border-line bg-panel text-left shadow-subtle transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
                data-component-card={component.id}
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
                  <p className="mt-2 font-mono text-[9px] text-faint">
                    {component.id} · v{component.version}
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
                  {selected?.category} · 官方正式组件
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
                    <dt className="text-faint">组件 ID</dt>
                    <dd className="font-mono text-ink">{selected.asset.manifest.componentId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-faint">版本</dt>
                    <dd className="font-mono text-ink">{selected.asset.manifest.version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-faint">Schema 区块</dt>
                    <dd className="font-mono text-ink">{selected.asset.manifest.nodeType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-faint">兼容等级</dt>
                    <dd className="text-success">
                      {compatibilityLabels[selected.asset.manifest.compatibilityLevel]}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-faint">目录状态</dt>
                    <dd className="text-ink">已安装</dd>
                  </div>
                </dl>
                <section aria-label="组件槽位" className="mt-5">
                  <h2 className="text-[11px] font-semibold text-ink">内容槽位</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.asset.manifest.slots.length === 0 ? (
                      <span className="rounded-full bg-panel-muted px-2 py-1 text-[10px] text-faint">
                        无内容槽位
                      </span>
                    ) : (
                      selected.asset.manifest.slots.map((slot) => (
                        <span
                          className="rounded-full bg-panel-muted px-2 py-1 text-[10px] text-muted"
                          key={slot.slotId}
                        >
                          {slot.label} · {slot.kind}
                        </span>
                      ))
                    )}
                  </div>
                </section>
                <section aria-label="组件变体" className="mt-5">
                  <h2 className="text-[11px] font-semibold text-ink">可用变体</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.asset.manifest.variants.map((variant) => (
                      <span
                        className="rounded-full border border-line px-2 py-1 text-[10px] text-muted"
                        key={variant.variantId}
                      >
                        {variant.name}
                      </span>
                    ))}
                  </div>
                </section>
                <div className="mt-5 flex gap-2 rounded-control border border-accent/15 bg-accent-soft p-3">
                  <Info aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={14} />
                  <p className="text-[11px] leading-5 text-muted">
                    组件中心不持有当前文章上下文。请进入文章编辑器，从左侧“组件”标签插入。
                  </p>
                </div>
                <Link
                  className="mt-6 flex h-10 w-full items-center justify-center rounded-control bg-accent text-[12px] font-semibold text-white"
                  href="/workspace/articles?new=1"
                >
                  新建文章后使用
                </Link>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
