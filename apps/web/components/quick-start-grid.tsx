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
    <div className="space-y-3">
      <button
        className="group grid w-full gap-5 overflow-hidden rounded-card border border-accent/20 bg-[#26225f] p-5 text-left text-white shadow-subtle transition hover:-translate-y-0.5 hover:shadow-raised md:grid-cols-[auto_1fr_auto] md:items-center"
        onClick={() => router.push("/workspace/imports/paste")}
        type="button"
      >
        <span className="grid size-12 place-items-center rounded-[12px] bg-white/12 text-indigo-100">
          <ClipboardPaste aria-hidden="true" size={21} />
        </span>
        <span>
          <span className="block text-[15px] font-semibold">开始制作公众号文章</span>
          <span className="mt-1 block text-[11px] leading-5 text-indigo-100/75">
            粘贴原稿后，依次检查结构、选择 3 套成稿方案、补充图片，最后预览并复制到公众号。
          </span>
          <span className="mt-3 flex flex-wrap gap-2 text-[9px] text-indigo-100/65">
            {["1 导入原稿", "2 检查结构", "3 选择成稿", "4 完善并发布"].map((step) => (
              <span className="rounded-full border border-white/10 px-2 py-1" key={step}>
                {step}
              </span>
            ))}
          </span>
        </span>
        <span className="inline-flex h-9 items-center justify-center gap-2 rounded-control bg-white px-4 text-[11px] font-semibold text-[#26225f] transition group-hover:bg-indigo-50">
          开始
          <ArrowRight aria-hidden="true" size={13} />
        </span>
      </button>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {secondaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              className="group flex min-h-16 items-center gap-3 rounded-control border border-line bg-panel p-3 text-left transition hover:border-indigo-200 hover:bg-hover"
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
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-control bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span>
                  <span className="block text-[11px] font-semibold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-[9px] text-faint">{item.description}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
