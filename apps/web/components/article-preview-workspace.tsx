"use client";

import { normalizeDocument } from "@wechat-layout/editor-core";
import type {
  BlockNode,
  DocumentMark,
  DocumentV1,
  InlineNode,
  StyleOverrides,
} from "@wechat-layout/document-schema";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ImageIcon,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { ArticleClientError, getArticle } from "../lib/articles/client";
import { DocumentClientError, getArticleDocument } from "../lib/documents/client";

type Device = "desktop" | "phone" | "tablet";

const deviceWidths: Readonly<Record<Device, string>> = {
  desktop: "677px",
  phone: "375px",
  tablet: "560px",
};

function errorMessage(error: unknown): string {
  if (error instanceof ArticleClientError || error instanceof DocumentClientError) {
    return error.message;
  }
  return "预览数据暂时无法读取";
}

function blockStyle(overrides?: StyleOverrides): CSSProperties | undefined {
  if (overrides === undefined) return undefined;
  return {
    backgroundColor: overrides.backgroundColor,
    borderColor: overrides.borderColor,
    borderRadius: overrides.borderRadius,
    borderStyle: overrides.borderStyle,
    borderWidth: overrides.borderWidth,
    color: overrides.textColor,
    fontSize: overrides.fontSize,
    fontWeight: overrides.fontWeight,
    letterSpacing: overrides.letterSpacing,
    lineHeight: overrides.lineHeight,
    marginBottom: overrides.marginBottom,
    marginTop: overrides.marginTop,
    paddingBottom: overrides.paddingBottom,
    paddingLeft: overrides.paddingLeft,
    paddingRight: overrides.paddingRight,
    paddingTop: overrides.paddingTop,
    textAlign: overrides.textAlign,
  };
}

function safePreviewHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function applyMarks(content: ReactNode, marks: readonly DocumentMark[] | undefined): ReactNode {
  return (marks ?? []).reduce<ReactNode>((value, mark, index) => {
    if (mark.type === "bold") return <strong key={index}>{value}</strong>;
    if (mark.type === "italic") return <em key={index}>{value}</em>;
    if (mark.type === "underline") return <u key={index}>{value}</u>;
    if (mark.type === "strike") return <s key={index}>{value}</s>;
    if (mark.type === "textColor") {
      return (
        <span key={index} style={{ color: mark.attrs.color }}>
          {value}
        </span>
      );
    }
    if (mark.type === "backgroundColor") {
      return (
        <span key={index} style={{ backgroundColor: mark.attrs.color }}>
          {value}
        </span>
      );
    }
    if (mark.type === "fontSize") {
      return (
        <span key={index} style={{ fontSize: mark.attrs.size }}>
          {value}
        </span>
      );
    }
    if (mark.type === "link") {
      const href = safePreviewHref(mark.attrs.href);
      if (href === undefined) {
        return value;
      }
      return (
        <a href={href} key={index} rel="noreferrer" target="_blank">
          {value}
        </a>
      );
    }
    return value;
  }, content);
}

function InlineContent({ nodes }: { readonly nodes: readonly InlineNode[] | undefined }) {
  return (nodes ?? []).map((node, index) =>
    node.type === "hardBreak" ? (
      <br key={`break-${index}`} />
    ) : (
      <span key={`text-${index}`}>{applyMarks(node.text, node.marks)}</span>
    ),
  );
}

function PreviewBlock({ node }: { readonly node: BlockNode }) {
  const style = blockStyle(node.attrs.styleOverrides);
  if (node.type === "paragraph") {
    return (
      <p className="my-4 min-h-6 text-[15px] leading-8 text-zinc-700" style={style}>
        <InlineContent nodes={node.content} />
      </p>
    );
  }
  if (node.type === "heading") {
    const content = <InlineContent nodes={node.content} />;
    if (node.attrs.level === 1) {
      return (
        <h1 className="mt-10 mb-5 text-2xl font-bold text-zinc-950" style={style}>
          {content}
        </h1>
      );
    }
    if (node.attrs.level === 2) {
      return (
        <h2
          className="mt-8 mb-4 border-l-4 border-indigo-500 pl-3 text-xl font-bold text-zinc-900"
          style={style}
        >
          {content}
        </h2>
      );
    }
    return (
      <h3 className="mt-6 mb-3 text-lg font-semibold text-zinc-900" style={style}>
        {content}
      </h3>
    );
  }
  if (node.type === "blockquote") {
    return (
      <blockquote
        className="my-6 border-l-[3px] border-indigo-500 bg-indigo-50 px-5 py-3 text-zinc-700"
        style={style}
      >
        {node.content.map((child) => (
          <PreviewBlock key={child.attrs.blockId} node={child} />
        ))}
      </blockquote>
    );
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const List = node.type === "bulletList" ? "ul" : "ol";
    return (
      <List
        className={`my-4 space-y-2 pl-6 text-[15px] leading-7 text-zinc-700 ${
          node.type === "bulletList" ? "list-disc" : "list-decimal"
        }`}
        style={style}
      >
        {node.content.map((item) => (
          <li key={item.attrs.blockId}>
            {item.content.map((child) => (
              <PreviewBlock key={child.attrs.blockId} node={child} />
            ))}
          </li>
        ))}
      </List>
    );
  }
  if (node.type === "listItem") {
    return null;
  }
  if (node.type === "divider") {
    return <hr className="my-8 border-0 border-t border-zinc-200" style={style} />;
  }
  if (node.type === "imageBlock") {
    return (
      <figure className="my-7" style={style}>
        <div className="grid aspect-video place-items-center rounded-md bg-zinc-100 text-zinc-400">
          <span className="text-center text-xs">
            <ImageIcon aria-hidden="true" className="mx-auto mb-2" size={22} />
            图片资源 · {node.attrs.resourceId}
          </span>
        </div>
        {node.attrs.caption === undefined ? null : (
          <figcaption className="mt-2 text-center text-xs text-zinc-500">
            {node.attrs.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (node.type === "semanticCard") {
    return (
      <section className="my-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5" style={style}>
        {node.attrs.eyebrow === undefined ? null : (
          <p className="text-[11px] font-semibold tracking-wider text-indigo-600 uppercase">
            {node.attrs.eyebrow}
          </p>
        )}
        {node.attrs.title === undefined ? null : (
          <h3 className="mt-2 text-lg font-bold text-zinc-900">{node.attrs.title}</h3>
        )}
        {(node.content ?? []).map((child) => (
          <PreviewBlock key={child.attrs.blockId} node={child} />
        ))}
      </section>
    );
  }
  if (node.type === "brandFooter") {
    return (
      <footer className="mt-10 border-t border-zinc-200 pt-5 text-center" style={style}>
        {(node.content ?? []).map((child) => (
          <PreviewBlock key={child.attrs.blockId} node={child} />
        ))}
      </footer>
    );
  }
  return (
    <div
      className="my-6 rounded-lg bg-zinc-100 p-5 text-center text-xs text-zinc-500"
      style={style}
    >
      SVG 互动在当前预览中使用静态占位
    </div>
  );
}

function DocumentPreview({
  document,
  title,
}: {
  readonly document: DocumentV1;
  readonly title: string;
}) {
  return (
    <article className="min-h-[720px] bg-white px-8 py-10 sm:px-12">
      <header className="mb-8 border-b border-zinc-100 pb-6">
        <p className="text-[11px] font-medium tracking-[0.15em] text-indigo-600 uppercase">
          WeChat Article Preview
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">{title}</h1>
      </header>
      {document.content.content.map((node) => (
        <PreviewBlock key={node.attrs.blockId} node={node} />
      ))}
    </article>
  );
}

export function ArticlePreviewWorkspace({ articleId }: { readonly articleId: string }) {
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState(100);
  const articleQuery = useQuery({
    queryKey: ["article", articleId],
    queryFn: () => getArticle(articleId),
  });
  const documentQuery = useQuery({
    queryKey: ["article-document", articleId],
    queryFn: () => getArticleDocument(articleId),
    refetchOnMount: "always",
    staleTime: 0,
  });
  const document = useMemo(
    () =>
      documentQuery.data === undefined ? null : normalizeDocument(documentQuery.data.document),
    [documentQuery.data],
  );
  const pending = articleQuery.isPending || documentQuery.isPending;
  const error = articleQuery.error ?? documentQuery.error;

  if (pending) {
    return (
      <div className="grid min-h-[65vh] place-items-center text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          正在生成设备预览…
        </span>
      </div>
    );
  }

  if (error !== null || articleQuery.data === undefined || document === null) {
    return (
      <div className="grid min-h-[65vh] place-items-center text-center">
        <div>
          <AlertTriangle aria-hidden="true" className="mx-auto text-danger" size={24} />
          <h1 className="mt-3 text-base font-semibold text-ink">无法打开预览</h1>
          <p className="mt-2 text-[12px] text-muted">{errorMessage(error)}</p>
          <button
            className="mt-5 rounded-control border border-line px-3 py-2 text-[11px] text-ink hover:bg-hover"
            onClick={() => {
              void articleQuery.refetch();
              void documentQuery.refetch();
            }}
            type="button"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-card border border-line bg-panel p-3 shadow-subtle lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="返回编辑器"
            className="grid size-9 shrink-0 place-items-center rounded-control border border-line text-muted hover:bg-hover hover:text-ink"
            href={`/workspace/articles/${articleId}`}
          >
            <ArrowLeft aria-hidden="true" size={15} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{articleQuery.data.title}</p>
            <p className="mt-0.5 text-[10px] text-faint">
              文档 v{documentQuery.data?.documentVersion} · 预览不会修改正文
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-control border border-line bg-panel-muted p-1">
            {(
              [
                ["phone", Smartphone, "手机"],
                ["tablet", Tablet, "平板"],
                ["desktop", Monitor, "桌面"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                aria-label={`${label}预览`}
                aria-pressed={device === value}
                className={`grid size-8 place-items-center rounded-md ${
                  device === value ? "bg-panel text-accent shadow-subtle" : "text-faint"
                }`}
                key={value}
                onClick={() => setDevice(value)}
                type="button"
              >
                <Icon aria-hidden="true" size={14} />
              </button>
            ))}
          </div>
          <label className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-3 text-[10px] text-muted">
            缩放
            <select
              className="bg-transparent font-mono text-ink outline-none"
              onChange={(event) => setZoom(Number(event.target.value))}
              value={zoom}
            >
              <option value={75}>75%</option>
              <option value={90}>90%</option>
              <option value={100}>100%</option>
            </select>
          </label>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-3 text-[11px] text-ink hover:bg-hover"
            onClick={() => void documentQuery.refetch()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={13} />
            刷新
          </button>
        </div>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-control border border-line bg-panel px-4 py-3">
        <p className="text-[11px] text-muted">
          这是基于当前文档 Schema 的视觉预览；正式微信输出仍以复制前生成结果为准。
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 text-[10px] ${
            articleQuery.data.compatibilityScore === null ? "text-warning" : "text-success"
          }`}
        >
          {articleQuery.data.compatibilityScore === null ? (
            <AlertTriangle aria-hidden="true" size={12} />
          ) : (
            <CheckCircle2 aria-hidden="true" size={12} />
          )}
          {articleQuery.data.compatibilityScore === null
            ? "尚未生成兼容报告"
            : `最近评分 ${articleQuery.data.compatibilityScore}/100`}
        </span>
      </section>

      <div className="overflow-auto rounded-card border border-line bg-[#e7e7e4] px-4 py-8 shadow-inner sm:px-8">
        <div
          className="mx-auto origin-top overflow-hidden shadow-[0_8px_40px_rgb(24_24_27/12%)] transition-[width]"
          style={{
            width: deviceWidths[device],
            maxWidth: "100%",
            transform: `scale(${zoom / 100})`,
            marginBottom: `${(zoom / 100 - 1) * 720}px`,
          }}
        >
          <DocumentPreview document={document} title={articleQuery.data.title} />
        </div>
      </div>
    </div>
  );
}
