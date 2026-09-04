"use client";

import {
  ArrowRight,
  ClipboardPaste,
  Copy,
  FilePlus2,
  FileText,
  Globe2,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface QuickStartItem {
  readonly description: string;
  readonly href?: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut?: string;
}

const quickStartItems: readonly QuickStartItem[] = [
  {
    description: "从干净画布开始",
    icon: FilePlus2,
    label: "空白排版",
    shortcut: "⌘ N",
  },
  {
    description: "保留标题与段落结构",
    href: "/workspace/imports/paste?mode=docx",
    icon: FileText,
    label: "Word / WPS",
    shortcut: "⌘ O",
  },
  {
    description: "直接粘贴定稿正文",
    href: "/workspace/imports/paste",
    icon: ClipboardPaste,
    label: "粘贴文章",
  },
  {
    description: "读取网页正文内容",
    href: "/workspace/imports/paste?mode=webpage",
    icon: Globe2,
    label: "网页导入",
  },
  {
    description: "复用过往文章结构",
    href: "/workspace/articles",
    icon: Copy,
    label: "从历史复制",
  },
  {
    description: "从视觉套系开始",
    href: "/workspace/themes",
    icon: Palette,
    label: "从主题新建",
  },
];

export function QuickStartGrid() {
  const router = useRouter();
  const secondaryItems = quickStartItems.filter((item) => item.label !== "粘贴文章");

  return (
    <div className="space-y-8">
      <button
        className="group grid w-full gap-5 overflow-hidden rounded-card bg-accent p-5 text-left text-white shadow-subtle transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-raised active:scale-[0.96] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-6"
        onClick={() => router.push("/workspace/imports/paste")}
        type="button"
      >
        <span className="grid size-12 place-items-center rounded-control bg-white/15 text-white shadow-subtle">
          <ClipboardPaste aria-hidden="true" size={21} />
        </span>
        <span className="min-w-0">
          <span className="block text-balance text-lg font-semibold tracking-[-0.02em]">
            开始制作公众号文章
          </span>
          <span className="mt-1 block max-w-3xl text-pretty text-[13px] leading-6 text-white/90">
            粘贴原稿后，依次检查结构、对比 6 种成稿方向、补充图片，最后预览并复制到公众号。
          </span>
          <span className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium text-white/80">
            {["1 导入原稿", "2 检查结构", "3 选择成稿", "4 完善并发布"].map((step) => (
              <span className="rounded-full bg-white/10 px-2.5 py-1" key={step}>
                {step}
              </span>
            ))}
          </span>
        </span>
        <span className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-white px-4 text-xs font-semibold text-accent-strong transition-colors duration-150 group-hover:bg-panel-muted">
          开始完整流程
          <ArrowRight aria-hidden="true" size={13} />
        </span>
      </button>
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">其他开始方式</h3>
          <p className="mt-1 text-pretty text-xs text-muted">
            已有文件、网页或历史稿件时，可直接从对应入口开始。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {secondaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className="group flex min-h-[76px] items-center justify-between gap-3 rounded-control bg-panel p-3 text-left shadow-subtle transition-[background-color,color,transform,box-shadow] duration-150 hover:bg-hover hover:shadow-raised active:scale-[0.96]"
                key={item.label}
                onClick={() => {
                  if (item.href !== undefined) {
                    router.push(item.href);
                    return;
                  }
                  if (item.label === "空白排版") {
                    router.push("/workspace/articles?new=1");
                    return;
                  }
                  router.push("/workspace/articles?new=1");
                }}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-control bg-panel-muted text-muted transition-[background-color,color] duration-150 group-hover:bg-accent-soft group-hover:text-accent">
                    <Icon aria-hidden="true" size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{item.label}</span>
                    <span className="mt-0.5 block text-pretty text-[11px] leading-4 text-muted">
                      {item.description}
                    </span>
                  </span>
                </span>
                {item.shortcut ? (
                  <span className="hidden shrink-0 text-[11px] font-medium text-muted 2xl:block">
                    {item.shortcut}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
