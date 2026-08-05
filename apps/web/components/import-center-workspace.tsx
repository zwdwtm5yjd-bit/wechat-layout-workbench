"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  ClipboardPaste,
  FileUp,
  Globe2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  createDocxImport,
  createWebpageImport,
  ImportClientError,
  type PasteImportInput,
} from "../lib/imports/client";
import { ResourceClientError, uploadResource } from "../lib/resources/client";
import { CreationProgress } from "./creation-progress";
import { PasteImportWorkspace } from "./paste-import-workspace";
import { useAppToast } from "./ui/app-toast";

type ImportMode = "docx" | "paste" | "webpage";
type CleaningMode = PasteImportInput["cleaningMode"];
type LayoutStrength = PasteImportInput["layoutStrength"];

const modes = [
  { id: "paste", label: "粘贴正文", icon: ClipboardPaste, description: "Word、WPS、AI 文稿" },
  { id: "docx", label: "上传 DOCX", icon: FileUp, description: "保留原文件与异步解析" },
  { id: "webpage", label: "导入网页", icon: Globe2, description: "抓取公开网页正文" },
] as const;

function importError(error: unknown): string {
  if (error instanceof ImportClientError || error instanceof ResourceClientError)
    return error.message;
  return "导入失败，请稍后重试";
}

function ImportOptions({
  cleaningMode,
  layoutStrength,
  onCleaningModeChange,
  onLayoutStrengthChange,
}: {
  readonly cleaningMode: CleaningMode;
  readonly layoutStrength: LayoutStrength;
  readonly onCleaningModeChange: (value: CleaningMode) => void;
  readonly onLayoutStrengthChange: (value: LayoutStrength) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium text-muted">清洗方式</span>
        <select
          className="h-10 w-full rounded-control border border-line bg-panel-muted px-3 text-[12px] text-ink"
          onChange={(event) => onCleaningModeChange(event.target.value as CleaningMode)}
          value={cleaningMode}
        >
          <option value="preserve_structure">保留结构</option>
          <option value="preserve_compatible">兼容优先</option>
          <option value="plain_text">纯文本</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium text-muted">排版强度</span>
        <select
          className="h-10 w-full rounded-control border border-line bg-panel-muted px-3 text-[12px] text-ink"
          onChange={(event) => onLayoutStrengthChange(event.target.value as LayoutStrength)}
          value={layoutStrength}
        >
          <option value="light">轻度 · 尽量克制</option>
          <option value="standard">标准 · 层级清晰</option>
          <option value="strong">强烈 · 视觉突出</option>
        </select>
      </label>
    </div>
  );
}

function AsyncImportPanel({ mode }: { readonly mode: "docx" | "webpage" }) {
  const router = useRouter();
  const { pushToast } = useAppToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [cleaningMode, setCleaningMode] = useState<CleaningMode>("preserve_structure");
  const [layoutStrength, setLayoutStrength] = useState<LayoutStrength>("standard");
  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "docx") {
        if (file === null) throw new ResourceClientError(400, "FILE_REQUIRED", "请选择 DOCX 文件");
        const resource = await uploadResource(file);
        return createDocxImport({
          resourceId: resource.id,
          cleaningMode,
          contentType: "general",
          layoutStrength,
        });
      }
      return createWebpageImport({
        url: url.trim(),
        cleaningMode,
        contentType: "general",
        layoutStrength,
      });
    },
    onSuccess: (job) => {
      pushToast({
        title: mode === "docx" ? "DOCX 已进入解析队列" : "网页已进入抓取队列",
        description: "任务中心会持续更新进度，完成后可确认文章结构。",
        tone: "success",
      });
      router.push(
        `/workspace/jobs?focus=${encodeURIComponent(job.jobId)}&article=${encodeURIComponent(job.articleId)}`,
      );
    },
    onError: (error) => {
      pushToast({ title: "无法创建导入任务", description: importError(error), tone: "warning" });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "webpage" && url.trim() === "") {
      pushToast({
        title: "请输入网页地址",
        description: "需要完整的 http:// 或 https:// 地址。",
        tone: "warning",
      });
      return;
    }
    mutation.mutate();
  };

  return (
    <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" onSubmit={submit}>
      <section className="rounded-card border border-line bg-panel p-5 shadow-subtle sm:p-7">
        <span className="grid size-11 place-items-center rounded-control bg-accent-soft text-accent">
          {mode === "docx" ? (
            <FileUp aria-hidden="true" size={20} />
          ) : (
            <Globe2 aria-hidden="true" size={20} />
          )}
        </span>
        <h2 className="mt-5 text-base font-semibold text-ink">
          {mode === "docx" ? "上传 Word / WPS 文档" : "导入公开网页"}
        </h2>
        <p className="mt-2 max-w-2xl text-[12px] leading-6 text-muted">
          {mode === "docx"
            ? "DOCX 原文件会私有存储，解析在后台执行；标题、段落、列表、表格和图片关系会进入结构确认。"
            : "服务端会校验地址、防止访问内网，并优先抽取正文；需要浏览器渲染时会自动切换安全浏览器任务。"}
        </p>
        {mode === "docx" ? (
          <label className="mt-7 block rounded-card border border-dashed border-line-strong bg-panel-muted p-8 text-center transition hover:border-accent/50">
            <input
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <FileUp aria-hidden="true" className="mx-auto text-accent" size={28} />
            <span className="mt-3 block text-[13px] font-semibold text-ink">
              {file?.name ?? "选择 DOCX 文件"}
            </span>
            <span className="mt-1 block text-[11px] text-faint">
              支持最大 50 MB，重复文件自动复用
            </span>
          </label>
        ) : (
          <label className="mt-7 block">
            <span className="mb-2 block text-[12px] font-medium text-ink">网页地址</span>
            <input
              className="h-12 w-full rounded-control border border-line bg-panel-muted px-4 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-indigo-100"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              type="url"
              value={url}
            />
          </label>
        )}
      </section>
      <aside className="space-y-4">
        <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
          <h2 className="text-sm font-semibold text-ink">导入设置</h2>
          <div className="mt-4">
            <ImportOptions
              cleaningMode={cleaningMode}
              layoutStrength={layoutStrength}
              onCleaningModeChange={setCleaningMode}
              onLayoutStrengthChange={setLayoutStrength}
            />
          </div>
        </section>
        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-[13px] font-semibold text-white shadow-subtle hover:bg-accent-strong disabled:opacity-50"
          disabled={mutation.isPending || (mode === "docx" && file === null)}
          type="submit"
        >
          {mutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          ) : null}
          {mutation.isPending ? "正在提交…" : "开始安全导入"}
          {mutation.isPending ? null : <ArrowRight aria-hidden="true" size={15} />}
        </button>
        <p className="flex items-start gap-2 px-1 text-[10px] leading-5 text-faint">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
          导入完成前不会覆盖任何已有文章；后台任务可取消、失败后可重试。
        </p>
      </aside>
    </form>
  );
}

export function ImportCenterWorkspace() {
  const [mode, setMode] = useState<ImportMode>("paste");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("mode");
    if (requested === "docx" || requested === "webpage" || requested === "paste")
      setMode(requested);
  }, []);

  const selectMode = (next: ImportMode) => {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="space-y-5">
      <CreationProgress current={1} />
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">IMPORT CENTER</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">导入文章</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            粘贴正文、上传 DOCX 或抓取公开网页，统一进入安全清洗和结构确认工作流。
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-success-soft px-3 py-1.5 text-[11px] font-medium text-success">
          <ShieldCheck aria-hidden="true" size={14} />
          三种导入方式已接通
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {modes.map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              aria-pressed={active}
              className={`rounded-card border p-4 text-left shadow-subtle transition ${active ? "border-accent/40 bg-accent-soft" : "border-line bg-panel hover:border-line-strong"}`}
              key={item.id}
              onClick={() => selectMode(item.id)}
              type="button"
            >
              <span className="flex items-center gap-3">
                <span
                  className={`grid size-9 place-items-center rounded-control ${active ? "bg-accent text-white" : "bg-panel-muted text-muted"}`}
                >
                  <Icon aria-hidden="true" size={16} />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] text-muted">{item.description}</span>
                </span>
              </span>
            </button>
          );
        })}
      </section>
      {mode === "paste" ? <PasteImportWorkspace embedded /> : <AsyncImportPanel mode={mode} />}
    </div>
  );
}
