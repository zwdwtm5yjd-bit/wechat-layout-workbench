"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FilePlus2,
  FileText,
  ImageIcon,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DropdownMenu } from "radix-ui";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  archiveArticle,
  ArticleClientError,
  type Article,
  type ArticleStatus,
  createArticle,
  duplicateArticle,
  listArticles,
  restoreArticle,
  trashArticle,
  unarchiveArticle,
} from "../lib/articles/client";
import { useAppToast } from "./ui/app-toast";

type ArticleFilter = ArticleStatus | "all" | "trash";

const filters: readonly { readonly label: string; readonly value: ArticleFilter }[] = [
  { label: "全部", value: "all" },
  { label: "待排版", value: "pending_layout" },
  { label: "编辑中", value: "layout_editing" },
  { label: "待检查", value: "pending_check" },
  { label: "已复制", value: "copied" },
  { label: "已同步", value: "synced" },
  { label: "已发布", value: "published" },
  { label: "已归档", value: "archived" },
  { label: "回收站", value: "trash" },
];

const statusLabels: Readonly<Record<ArticleStatus, string>> = {
  pending_import: "待导入",
  pending_recognition: "待识别",
  pending_layout: "待排版",
  layout_editing: "编辑中",
  pending_check: "待检查",
  copied: "已复制",
  synced: "已同步",
  published: "已发布",
  archived: "已归档",
  import_failed: "导入失败",
  recognition_failed: "识别失败",
  save_failed: "保存失败",
  compatibility_failed: "兼容失败",
  copy_failed: "复制失败",
  sync_failed: "同步失败",
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: ArticleStatus): string {
  if (status === "published" || status === "synced" || status === "copied") {
    return "bg-success-soft text-success";
  }
  if (status.endsWith("_failed")) {
    return "bg-danger-soft text-danger";
  }
  if (status === "archived") {
    return "bg-panel-muted text-muted";
  }
  return "bg-accent-soft text-accent-strong";
}

function errorMessage(error: unknown): string {
  return error instanceof ArticleClientError ? error.message : "操作失败，请稍后重试";
}

export function ArticleManager() {
  const queryClient = useQueryClient();
  const { pushToast } = useAppToast();
  const [filter, setFilter] = useState<ArticleFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setCreateOpen(true);
    }
  }, []);

  const articlesQuery = useQuery({
    queryKey: ["articles", filter, search],
    queryFn: () =>
      listArticles({
        ...(filter === "all" ? {} : { status: filter }),
        ...(search === "" ? {} : { search }),
      }),
  });

  const refreshArticles = async () => {
    await queryClient.invalidateQueries({ queryKey: ["articles"] });
  };

  const createMutation = useMutation({
    mutationFn: createArticle,
    onSuccess: async (article) => {
      setCreateOpen(false);
      await refreshArticles();
      pushToast({
        description: `“${article.title}”已建立独立文档，可进入下一步排版。`,
        title: "文章已创建",
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({ description: errorMessage(error), title: "无法创建文章", tone: "warning" });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      article,
    }: {
      readonly action: "archive" | "duplicate" | "restore" | "trash" | "unarchive";
      readonly article: Article;
    }) => {
      if (action === "duplicate") {
        return { article: await duplicateArticle(article.id), message: "副本已创建" };
      }
      if (action === "archive") {
        return { article: await archiveArticle(article.id), message: "文章已归档" };
      }
      if (action === "unarchive") {
        return { article: await unarchiveArticle(article.id), message: "文章已恢复归档" };
      }
      if (action === "trash") {
        return { article: await trashArticle(article.id), message: "文章已移入回收站" };
      }
      return { article: await restoreArticle(article.id), message: "文章已恢复" };
    },
    onSuccess: async ({ article, message }) => {
      await refreshArticles();
      pushToast({
        description: article.title,
        title: message,
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({ description: errorMessage(error), title: "操作未完成", tone: "warning" });
    },
  });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
  };

  const runAction = (
    action: "archive" | "duplicate" | "restore" | "trash" | "unarchive",
    article: Article,
  ) => {
    if (
      action === "trash" &&
      !window.confirm(`将“${article.title}”移入回收站？文章将在 30 天后允许清理。`)
    ) {
      return;
    }
    actionMutation.mutate({ action, article });
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">CONTENT WORKSPACE</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">文章</h1>
          <p className="mt-2 text-[13px] text-muted">集中管理文章状态、版本入口与回收站。</p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[13px] font-semibold text-white shadow-subtle transition hover:bg-accent-strong"
          onClick={() => {
            setCreateOpen(true);
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          新建空白文章
        </button>
      </section>

      <section className="rounded-card border border-line bg-panel shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0" role="tablist">
            {filters.map((item) => (
              <button
                aria-selected={filter === item.value}
                className={`shrink-0 rounded-control px-3 py-2 text-[12px] font-medium transition ${
                  filter === item.value
                    ? "bg-accent-soft text-accent-strong"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
                key={item.value}
                onClick={() => {
                  setFilter(item.value);
                }}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={submitSearch}>
            <label className="relative min-w-0 flex-1 lg:w-72">
              <span className="sr-only">搜索文章</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
                size={15}
              />
              <input
                className="h-9 w-full rounded-control border border-line bg-panel-muted pr-9 pl-9 text-[12px] text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-indigo-100"
                maxLength={200}
                onChange={(event) => {
                  setSearchDraft(event.target.value);
                }}
                placeholder="搜索标题或副标题"
                value={searchDraft}
              />
              {searchDraft === "" ? null : (
                <button
                  aria-label="清除搜索"
                  className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
                  onClick={() => {
                    setSearchDraft("");
                    setSearch("");
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={13} />
                </button>
              )}
            </label>
            <button
              className="h-9 rounded-control border border-line bg-panel px-3 text-[12px] font-medium text-ink transition hover:bg-hover"
              type="submit"
            >
              搜索
            </button>
          </form>
        </div>

        {articlesQuery.isPending ? (
          <div className="grid min-h-72 place-items-center text-muted">
            <span className="inline-flex items-center gap-2 text-[13px]">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
              正在读取文章…
            </span>
          </div>
        ) : articlesQuery.isError ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-danger">文章列表加载失败</p>
              <p className="mt-2 text-[12px] text-muted">{errorMessage(articlesQuery.error)}</p>
              <button
                className="mt-4 rounded-control border border-line px-3 py-2 text-[12px] font-medium text-ink hover:bg-hover"
                onClick={() => {
                  void articlesQuery.refetch();
                }}
                type="button"
              >
                重新加载
              </button>
            </div>
          </div>
        ) : articlesQuery.data.items.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 py-10 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                {filter === "trash" ? (
                  <Trash2 aria-hidden="true" size={20} />
                ) : (
                  <FileText aria-hidden="true" size={20} />
                )}
              </span>
              <h2 className="mt-4 text-sm font-semibold text-ink">
                {filter === "trash"
                  ? "回收站是空的"
                  : search === ""
                    ? "还没有符合条件的文章"
                    : "没有找到文章"}
              </h2>
              <p className="mt-2 text-[12px] leading-5 text-muted">
                {filter === "trash"
                  ? "删除的文章会在这里保留 30 天。"
                  : "新建一篇空白文章，开始建立你的内容工作流。"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-panel-muted text-[11px] font-medium text-faint">
                    <th className="px-5 py-3">文章</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">内容</th>
                    <th className="px-4 py-3">兼容</th>
                    <th className="px-4 py-3">更新时间</th>
                    <th className="w-16 px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {articlesQuery.data.items.map((article) => (
                    <ArticleTableRow
                      article={article}
                      busy={actionMutation.isPending}
                      key={article.id}
                      onAction={runAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-3 md:hidden">
              {articlesQuery.data.items.map((article) => (
                <ArticleCard
                  article={article}
                  busy={actionMutation.isPending}
                  key={article.id}
                  onAction={runAction}
                />
              ))}
            </div>
            <div className="border-t border-line px-5 py-3 text-[11px] text-faint">
              共 {articlesQuery.data.pagination.total} 篇文章
            </div>
          </>
        )}
      </section>

      <CreateArticleDialog
        busy={createMutation.isPending}
        onOpenChange={setCreateOpen}
        onSubmit={(input) => {
          createMutation.mutate(input);
        }}
        open={createOpen}
      />
    </div>
  );
}

type ArticleAction = "archive" | "duplicate" | "restore" | "trash" | "unarchive";

interface ArticleItemProps {
  readonly article: Article;
  readonly busy: boolean;
  onAction(action: ArticleAction, article: Article): void;
}

function ArticleTableRow({ article, busy, onAction }: ArticleItemProps) {
  return (
    <tr className="border-b border-line/80 last:border-0 hover:bg-panel-muted">
      <td className="max-w-sm px-5 py-4">
        {article.deletedAt === null ? (
          <Link
            className="block truncate text-[13px] font-semibold text-ink hover:text-accent"
            href={`/workspace/articles/${article.id}`}
          >
            {article.title}
          </Link>
        ) : (
          <p className="truncate text-[13px] font-semibold text-ink">{article.title}</p>
        )}
        <p className="mt-1 truncate text-[11px] text-faint">
          {article.subtitle ?? `${article.contentType} · ${article.sourceType}`}
        </p>
      </td>
      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${statusTone(article.status)}`}
        >
          {article.deletedAt === null ? statusLabels[article.status] : "回收站"}
        </span>
      </td>
      <td className="px-4 py-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <FileText aria-hidden="true" size={12} />
            {article.wordCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <ImageIcon aria-hidden="true" size={12} />
            {article.imageCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles aria-hidden="true" size={12} />
            {article.svgCount}
          </span>
        </span>
      </td>
      <td className="px-4 py-4 text-[11px] text-muted">
        {article.compatibilityScore === null ? "尚未检查" : `${article.compatibilityScore} 分`}
      </td>
      <td className="px-4 py-4 text-[11px] text-muted">{formatTime(article.updatedAt)}</td>
      <td className="px-4 py-4 text-right">
        <ArticleActions article={article} busy={busy} onAction={onAction} />
      </td>
    </tr>
  );
}

function ArticleCard({ article, busy, onAction }: ArticleItemProps) {
  return (
    <article className="rounded-card border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {article.deletedAt === null ? (
            <Link
              className="block truncate text-[13px] font-semibold text-ink hover:text-accent"
              href={`/workspace/articles/${article.id}`}
            >
              {article.title}
            </Link>
          ) : (
            <p className="truncate text-[13px] font-semibold text-ink">{article.title}</p>
          )}
          <p className="mt-1 text-[11px] text-faint">{formatTime(article.updatedAt)}</p>
        </div>
        <ArticleActions article={article} busy={busy} onAction={onAction} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${statusTone(article.status)}`}
        >
          {article.deletedAt === null ? statusLabels[article.status] : "回收站"}
        </span>
        <span className="text-[11px] text-muted">
          {article.wordCount} 字 · {article.imageCount} 图 · {article.svgCount} SVG
        </span>
      </div>
    </article>
  );
}

function ArticleActions({ article, busy, onAction }: ArticleItemProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`打开“${article.title}”操作菜单`}
          className="grid size-8 place-items-center rounded-control text-muted transition hover:bg-hover hover:text-ink disabled:opacity-50"
          disabled={busy}
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-40 rounded-control border border-line bg-panel p-1.5 shadow-raised"
          sideOffset={5}
        >
          {article.deletedAt === null ? (
            <>
              <ActionItem
                icon={Copy}
                label="创建副本"
                onSelect={() => {
                  onAction("duplicate", article);
                }}
              />
              <ActionItem
                icon={article.status === "archived" ? ArchiveRestore : Archive}
                label={article.status === "archived" ? "恢复归档" : "归档"}
                onSelect={() => {
                  onAction(article.status === "archived" ? "unarchive" : "archive", article);
                }}
              />
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <ActionItem
                danger
                icon={Trash2}
                label="移入回收站"
                onSelect={() => {
                  onAction("trash", article);
                }}
              />
            </>
          ) : (
            <ActionItem
              icon={RotateCcw}
              label="恢复文章"
              onSelect={() => {
                onAction("restore", article);
              }}
            />
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ActionItem({
  danger = false,
  icon: Icon,
  label,
  onSelect,
}: {
  readonly danger?: boolean;
  readonly icon: typeof Copy;
  readonly label: string;
  onSelect(): void;
}) {
  return (
    <DropdownMenu.Item
      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] outline-none data-[highlighted]:bg-hover ${
        danger ? "text-danger" : "text-muted data-[highlighted]:text-ink"
      }`}
      onSelect={onSelect}
    >
      <Icon aria-hidden="true" size={14} />
      {label}
    </DropdownMenu.Item>
  );
}

function CreateArticleDialog({
  busy,
  onOpenChange,
  onSubmit,
  open,
}: {
  readonly busy: boolean;
  readonly open: boolean;
  onOpenChange(open: boolean): void;
  onSubmit(input: {
    readonly title: string;
    readonly contentType: string;
    readonly layoutStrength: "light" | "standard" | "strong";
  }): void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      title: String(data.get("title") ?? ""),
      contentType: String(data.get("contentType") ?? "general"),
      layoutStrength: String(data.get("layoutStrength") ?? "standard") as
        "light" | "standard" | "strong",
    });
  };

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-zinc-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className="dialog-content fixed top-1/2 left-1/2 z-50 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-panel p-5 shadow-raised sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink">新建空白文章</Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] leading-5 text-muted">
                创建后会同步建立一份独立的 Document Schema 文档。
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="关闭"
              className="grid size-8 place-items-center rounded-control text-faint hover:bg-hover hover:text-ink"
              disabled={busy}
            >
              <X aria-hidden="true" size={16} />
            </Dialog.Close>
          </div>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="mb-2 block text-[12px] font-medium text-ink">文章标题</span>
              <input
                autoFocus
                className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-indigo-100"
                disabled={busy}
                maxLength={500}
                name="title"
                placeholder="例如：巡察工作动员会讲话稿"
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-ink">内容类型</span>
                <select
                  className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[13px] text-ink outline-none focus:border-accent focus:ring-3 focus:ring-indigo-100"
                  defaultValue="general"
                  disabled={busy}
                  name="contentType"
                >
                  <option value="general">通用文章</option>
                  <option value="inspection">巡察材料</option>
                  <option value="government">政务内容</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-ink">排版强度</span>
                <select
                  className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[13px] text-ink outline-none focus:border-accent focus:ring-3 focus:ring-indigo-100"
                  defaultValue="standard"
                  disabled={busy}
                  name="layoutStrength"
                >
                  <option value="light">轻量</option>
                  <option value="standard">标准</option>
                  <option value="strong">强视觉</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close
                className="h-9 rounded-control border border-line px-4 text-[12px] font-medium text-muted hover:bg-hover"
                disabled={busy}
              >
                取消
              </Dialog.Close>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-control bg-accent px-4 text-[12px] font-semibold text-white hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
                disabled={busy}
                type="submit"
              >
                {busy ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
                ) : (
                  <FilePlus2 aria-hidden="true" size={14} />
                )}
                {busy ? "正在创建…" : "创建文章"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
