"use client";

import {
  ClipboardPaste,
  Copy,
  FilePlus2,
  FileText,
  Globe2,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useAppToast } from "./ui/app-toast";

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
    href: "/workspace/imports/paste?source=word",
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
    icon: Globe2,
    label: "网页导入",
  },
  {
    description: "复用过往文章结构",
    icon: Copy,
    label: "从历史复制",
  },
  {
    description: "从视觉套系开始",
    icon: Palette,
    label: "从主题新建",
  },
];

export function QuickStartGrid() {
  const router = useRouter();
  const { pushToast } = useAppToast();

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {quickStartItems.map((item) => {
        const Icon = item.icon;

        return (
          <button
            className="group min-h-28 rounded-card border border-line bg-panel p-4 text-left shadow-subtle transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-raised"
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
              pushToast({
                description: "入口与交互状态已经就绪，导入和文章能力将在后续任务接入。",
                title: `${item.label}暂未开放`,
              });
            }}
            type="button"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-9 place-items-center rounded-control bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white">
                <Icon aria-hidden="true" size={17} />
              </span>
              {item.shortcut === undefined ? null : (
                <kbd className="rounded-md border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-faint">
                  {item.shortcut}
                </kbd>
              )}
            </div>
            <p className="mt-4 text-[14px] font-semibold text-ink">{item.label}</p>
            <p className="mt-1 text-[12px] text-muted">{item.description}</p>
          </button>
        );
      })}
    </div>
  );
}
