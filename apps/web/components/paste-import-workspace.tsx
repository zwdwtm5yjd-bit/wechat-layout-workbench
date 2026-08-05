"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ClipboardEvent, type FormEvent } from "react";

import { createPasteImport, ImportClientError, type PasteImportInput } from "../lib/imports/client";
import { CreationProgress } from "./creation-progress";
import { useAppToast } from "./ui/app-toast";

type CleaningMode = PasteImportInput["cleaningMode"];
type SourceHint = PasteImportInput["detectedSourceHint"];

const cleaningModes: readonly {
  readonly description: string;
  readonly label: string;
  readonly value: CleaningMode;
}[] = [
  {
    value: "preserve_structure",
    label: "保留结构",
    description: "识别标题、段落、列表和引用，适合大多数文章。",
  },
  {
    value: "preserve_compatible",
    label: "兼容优先",
    description: "保留可安全迁移的强调与链接，清理 Word / WPS 冗余样式。",
  },
  {
    value: "plain_text",
    label: "纯文本",
    description: "忽略原有样式，仅按文本层级重新识别。",
  },
];

const sourceHints: readonly { readonly label: string; readonly value: SourceHint }[] = [
  { value: "auto", label: "自动识别来源" },
  { value: "word", label: "Microsoft Word" },
  { value: "wps", label: "WPS" },
  { value: "web", label: "网页" },
  { value: "wechat", label: "微信公众号" },
  { value: "markdown", label: "Markdown" },
  { value: "plain_text", label: "纯文本" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude", label: "Claude" },
];

function errorMessage(error: unknown): string {
  return error instanceof ImportClientError ? error.message : "导入失败，请稍后重试";
}

export function PasteImportWorkspace({ embedded = false }: { readonly embedded?: boolean } = {}) {
  const router = useRouter();
  const { pushToast } = useAppToast();
  const [plainText, setPlainText] = useState("");
  const [clipboardHtml, setClipboardHtml] = useState<string | undefined>();
  const [cleaningMode, setCleaningMode] = useState<CleaningMode>("preserve_structure");
  const [sourceHint, setSourceHint] = useState<SourceHint>("auto");
  const [layoutStrength, setLayoutStrength] =
    useState<PasteImportInput["layoutStrength"]>("standard");

  useEffect(() => {
    const requestedSource = new URLSearchParams(window.location.search).get("source");
    if (sourceHints.some((item) => item.value === requestedSource)) {
      setSourceHint(requestedSource as SourceHint);
    }
  }, []);

  const importMutation = useMutation({
    mutationFn: createPasteImport,
    onSuccess: (structure) => {
      pushToast({
        title: "内容已安全导入",
        description: `已识别 ${structure.statistics.blockCount} 个内容块，请确认文章结构。`,
        tone: "success",
      });
      router.push(`/workspace/imports/${structure.articleId}/structure`);
    },
    onError: (error) => {
      pushToast({
        title: "无法导入内容",
        description: errorMessage(error),
        tone: "warning",
      });
    },
  });

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedHtml = event.clipboardData.getData("text/html");
    const pastedText = event.clipboardData.getData("text/plain");
    if (pastedHtml === "" && pastedText === "") {
      return;
    }

    event.preventDefault();
    setClipboardHtml(pastedHtml === "" ? undefined : pastedHtml);
    setPlainText(pastedText || event.currentTarget.value);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedText = plainText.trim();
    if (normalizedText === "" && clipboardHtml === undefined) {
      pushToast({
        title: "还没有可导入的内容",
        description: "请把 Word、WPS、网页或纯文本内容粘贴到输入框。",
        tone: "warning",
      });
      return;
    }

    importMutation.mutate({
      ...(clipboardHtml === undefined ? {} : { html: clipboardHtml }),
      ...(normalizedText === "" ? {} : { plainText: normalizedText }),
      cleaningMode,
      detectedSourceHint: sourceHint,
      contentType: "general",
      layoutStrength,
    });
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      {embedded ? null : <CreationProgress current={1} />}
      {embedded ? null : (
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-medium text-accent">PASTE IMPORT</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">粘贴导入</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
              粘贴来自 Word、WPS、网页或 AI 工具的正文。原始 HTML
              不会保存，脚本、隐藏节点和危险链接会在服务端清理。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-success-soft px-3 py-1.5 text-[11px] font-medium text-success">
            <ShieldCheck aria-hidden="true" size={14} />
            服务端安全清洗
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-card border border-line bg-panel shadow-subtle">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">文章内容</h2>
              <p className="mt-1 text-[11px] text-muted">
                直接在下面粘贴，系统会同时读取剪贴板结构。
              </p>
            </div>
            <span className="rounded-full bg-panel-muted px-2.5 py-1 text-[10px] text-faint">
              {plainText.length.toLocaleString("zh-CN")} 字符
            </span>
          </div>
          <div className="p-5">
            <label className="block">
              <span className="sr-only">粘贴文章内容</span>
              <textarea
                autoFocus
                className="min-h-[460px] w-full resize-y rounded-control border border-line bg-panel-muted px-5 py-4 text-[14px] leading-7 text-ink outline-none transition placeholder:text-faint focus:border-accent focus:bg-panel focus:ring-3 focus:ring-indigo-100"
                maxLength={500_000}
                onChange={(event) => {
                  setPlainText(event.target.value);
                  setClipboardHtml(undefined);
                }}
                onPaste={handlePaste}
                placeholder={
                  "在这里粘贴文章正文…\n\n支持标题、段落、引用、有序/无序列表、表格文本和外链图片引用。"
                }
                value={plainText}
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" size={12} />
                不保存原始 HTML
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" size={12} />
                原文可追踪
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" size={12} />
                导入后生成版本快照
              </span>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="text-accent" size={16} />
              <h2 className="text-sm font-semibold text-ink">清洗方式</h2>
            </div>
            <div className="mt-4 space-y-2">
              {cleaningModes.map((mode) => (
                <label
                  className={`block cursor-pointer rounded-control border p-3 transition ${
                    cleaningMode === mode.value
                      ? "border-accent/40 bg-accent-soft"
                      : "border-line hover:bg-hover"
                  }`}
                  key={mode.value}
                >
                  <span className="flex items-start gap-3">
                    <input
                      checked={cleaningMode === mode.value}
                      className="mt-0.5 accent-indigo-600"
                      name="cleaning-mode"
                      onChange={() => {
                        setCleaningMode(mode.value);
                      }}
                      type="radio"
                      value={mode.value}
                    />
                    <span>
                      <span className="block text-[12px] font-semibold text-ink">{mode.label}</span>
                      <span className="mt-1 block text-[10px] leading-4 text-muted">
                        {mode.description}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
            <h2 className="text-sm font-semibold text-ink">识别偏好</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted">内容来源</span>
                <select
                  aria-label="内容来源"
                  className="h-10 w-full rounded-control border border-line bg-panel-muted px-3 text-[12px] text-ink outline-none focus:border-accent focus:ring-3 focus:ring-indigo-100"
                  onChange={(event) => {
                    setSourceHint(event.target.value as SourceHint);
                  }}
                  value={sourceHint}
                >
                  {sourceHints.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted">排版强度</span>
                <select
                  aria-label="排版强度"
                  className="h-10 w-full rounded-control border border-line bg-panel-muted px-3 text-[12px] text-ink outline-none focus:border-accent focus:ring-3 focus:ring-indigo-100"
                  onChange={(event) => {
                    setLayoutStrength(event.target.value as PasteImportInput["layoutStrength"]);
                  }}
                  value={layoutStrength}
                >
                  <option value="light">轻度 · 尽量克制</option>
                  <option value="standard">标准 · 层级清晰</option>
                  <option value="strong">强烈 · 视觉突出</option>
                </select>
              </label>
            </div>
          </section>

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-[13px] font-semibold text-white shadow-subtle transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            disabled={importMutation.isPending}
            type="submit"
          >
            {importMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
            ) : (
              <ClipboardPaste aria-hidden="true" size={16} />
            )}
            {importMutation.isPending ? "正在安全清洗…" : "识别文章结构"}
            {importMutation.isPending ? null : <ArrowRight aria-hidden="true" size={15} />}
          </button>

          <p className="flex items-start gap-2 px-1 text-[10px] leading-5 text-faint">
            <FileText aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
            下一步可逐块检查标题、正文、列表与图片引用；确认前不会进入排版状态。
          </p>
        </aside>
      </section>
    </form>
  );
}
