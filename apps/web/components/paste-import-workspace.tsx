"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  FileText,
  ImagePlus,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";

import { createPasteImport, ImportClientError, type PasteImportInput } from "../lib/imports/client";
import { ResourceClientError, uploadResource } from "../lib/resources/client";
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
  return error instanceof ImportClientError || error instanceof ResourceClientError
    ? error.message
    : "导入失败，请稍后重试";
}

interface PendingPasteImage {
  readonly id: string;
  readonly file: File;
  readonly previewUrl: string | null;
  readonly caption: string;
  readonly placementIndex: number;
}

function imageId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `paste-image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function imagePreviewUrl(file: File): string | null {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
}

function paragraphLabels(value: string): readonly string[] {
  return value
    .replaceAll(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2_000);
}

export function PasteImportWorkspace({ embedded = false }: { readonly embedded?: boolean } = {}) {
  const router = useRouter();
  const { pushToast } = useAppToast();
  const [plainText, setPlainText] = useState("");
  const [clipboardHtml, setClipboardHtml] = useState<string | undefined>();
  const [images, setImages] = useState<readonly PendingPasteImage[]>([]);
  const previewUrls = useRef<string[]>([]);
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

  useEffect(
    () => () => {
      if (typeof URL.revokeObjectURL !== "function") return;
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const paragraphs = useMemo(() => paragraphLabels(plainText), [plainText]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const normalizedText = plainText.trim();
      const uploaded = await Promise.all(
        images.map(async (image) => ({ image, resource: await uploadResource(image.file) })),
      );
      return createPasteImport({
        ...(clipboardHtml === undefined ? {} : { html: clipboardHtml }),
        ...(normalizedText === "" ? {} : { plainText: normalizedText }),
        ...(uploaded.length === 0
          ? {}
          : {
              images: uploaded.map(({ image, resource }) => ({
                resourceId: resource.id,
                placementIndex: Math.min(image.placementIndex, paragraphs.length),
                alt: image.file.name.slice(0, 500),
                ...(image.caption.trim() === ""
                  ? {}
                  : { caption: image.caption.trim().slice(0, 2_000) }),
              })),
            }),
        cleaningMode,
        detectedSourceHint: sourceHint,
        contentType: "general",
        layoutStrength,
      });
    },
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

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    if (selected.length === 0) return;
    const available = Math.max(0, 30 - images.length);
    const accepted = selected.slice(0, available);
    if (accepted.length < selected.length) {
      pushToast({
        title: "最多添加 30 张图片",
        description: "超出数量的图片没有加入本次文章。",
        tone: "warning",
      });
    }
    const oversized = accepted.filter((file) => file.size > 20 * 1024 * 1024);
    const usable = accepted.filter((file) => file.size <= 20 * 1024 * 1024);
    if (oversized.length > 0) {
      pushToast({
        title: "部分图片超过 20 MB",
        description: "请压缩后重新选择。",
        tone: "warning",
      });
    }
    const additions = usable.map((file): PendingPasteImage => {
      const previewUrl = imagePreviewUrl(file);
      if (previewUrl !== null) previewUrls.current.push(previewUrl);
      return {
        id: imageId(),
        file,
        previewUrl,
        caption: "",
        placementIndex: paragraphs.length,
      };
    });
    setImages((current) => [...current, ...additions]);
  };

  const updateImage = (
    id: string,
    patch: Partial<Pick<PendingPasteImage, "caption" | "placementIndex">>,
  ) => {
    setImages((current) =>
      current.map((image) => (image.id === id ? { ...image, ...patch } : image)),
    );
  };

  const removeImage = (id: string) => {
    const removed = images.find((image) => image.id === id);
    if (removed?.previewUrl !== null && removed?.previewUrl !== undefined) {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(removed.previewUrl);
      previewUrls.current = previewUrls.current.filter((url) => url !== removed.previewUrl);
    }
    setImages((current) => current.filter((image) => image.id !== id));
  };

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

    importMutation.mutate();
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

            <section
              className="mt-5 rounded-card border border-line bg-panel p-4"
              aria-label="正文图片"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[12px] font-semibold text-ink">正文图片</h3>
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    可批量添加并指定插入位置；图片会保存到素材库并进入下一步 AI 排版。
                  </p>
                </div>
                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-accent/30 bg-accent-soft px-3 text-[11px] font-semibold text-accent hover:border-accent">
                  <ImagePlus aria-hidden="true" size={14} />
                  {images.length === 0 ? "添加图片" : "继续添加"}
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={importMutation.isPending || images.length >= 30}
                    multiple
                    onChange={addImages}
                    type="file"
                  />
                </label>
              </div>

              {images.length === 0 ? (
                <div className="mt-4 grid min-h-24 place-items-center rounded-control border border-dashed border-line bg-panel-muted px-4 text-center">
                  <p className="text-[10px] leading-5 text-faint">
                    支持 PNG、JPEG、WebP、GIF，单张不超过 20 MB，最多 30 张。
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {images.map((image, index) => (
                    <article
                      className="overflow-hidden rounded-control border border-line"
                      key={image.id}
                    >
                      <div className="relative grid aspect-[16/8] place-items-center overflow-hidden bg-panel-muted">
                        {image.previewUrl === null ? (
                          <ImagePlus aria-hidden="true" className="text-faint" size={22} />
                        ) : (
                          <img
                            alt={image.file.name}
                            className="h-full w-full object-cover"
                            src={image.previewUrl}
                          />
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-medium text-white">
                          图片 {index + 1}
                        </span>
                        <button
                          aria-label={`移除图片 ${index + 1}`}
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/65 text-white hover:bg-danger"
                          onClick={() => removeImage(image.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={12} />
                        </button>
                      </div>
                      <div className="space-y-2.5 p-3">
                        <p className="truncate text-[10px] font-medium text-ink">
                          {image.file.name}
                        </p>
                        <label className="block">
                          <span className="mb-1 block text-[9px] text-faint">插入位置</span>
                          <select
                            aria-label={`图片 ${index + 1} 插入位置`}
                            className="h-8 w-full rounded-md border border-line bg-panel-muted px-2 text-[10px] text-ink"
                            onChange={(event) =>
                              updateImage(image.id, { placementIndex: Number(event.target.value) })
                            }
                            value={Math.min(image.placementIndex, paragraphs.length)}
                          >
                            <option value={0}>正文开头</option>
                            {paragraphs.map((paragraph, paragraphIndex) => (
                              <option
                                key={`${paragraphIndex}-${paragraph}`}
                                value={paragraphIndex + 1}
                              >
                                {paragraphIndex + 1 === paragraphs.length
                                  ? `全文结尾 · ${paragraph.slice(0, 18)}`
                                  : `第 ${paragraphIndex + 1} 段后 · ${paragraph.slice(0, 18)}`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[9px] text-faint">
                            图片说明（可选，帮助 AI 理解图片）
                          </span>
                          <input
                            aria-label={`图片 ${index + 1} 说明`}
                            className="h-8 w-full rounded-md border border-line bg-panel-muted px-2 text-[10px] text-ink outline-none focus:border-accent"
                            maxLength={2_000}
                            onChange={(event) =>
                              updateImage(image.id, { caption: event.target.value })
                            }
                            placeholder="例如：活动现场合影"
                            value={image.caption}
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
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
            {importMutation.isPending
              ? images.length > 0
                ? "正在上传图片并识别…"
                : "正在安全清洗…"
              : "识别文章结构"}
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
