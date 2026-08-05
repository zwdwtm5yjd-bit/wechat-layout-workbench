"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LoaderCircle,
  PackageOpen,
  Palette,
  Radio,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { ArticleClientError, listArticles, type Article } from "../lib/articles/client";
import { QuickStartGrid } from "./quick-start-grid";

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function articleStatus(article: Article): string {
  if (article.status === "copied") return "已复制";
  if (article.status === "synced") return "已同步";
  if (article.status === "published") return "已发布";
  if (article.status.endsWith("_failed")) return "需要处理";
  return article.status === "pending_layout" ? "待排版" : "编辑中";
}

export function WorkspaceDashboard({ today }: { readonly today: string }) {
  const articlesQuery = useQuery({
    queryKey: ["articles", "dashboard"],
    queryFn: () => listArticles({ pageSize: 6 }),
  });
  const articles = articlesQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-12">
        <div className="relative overflow-hidden rounded-card border border-line bg-panel p-6 shadow-subtle sm:p-7 xl:col-span-8">
          <div className="pointer-events-none absolute top-[-90px] right-[-70px] size-64 rounded-full bg-indigo-100/80 blur-3xl" />
          <div className="relative">
            <p className="text-[12px] font-medium text-muted">{today}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-ink">
              欢迎回来，继续完成今天的排版
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              从空白画布开始，或导入已经定稿的文章。编辑、预览、兼容检查和复制现在位于同一条工作流。
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-[12px] font-medium text-success">
                <CheckCircle2 aria-hidden="true" size={14} />
                基础服务正常
              </span>
              {articlesQuery.isPending ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={12} />
                  正在读取最近文章
                </span>
              ) : (
                <span className="text-[12px] text-faint">
                  {articlesQuery.data?.pagination.total ?? 0} 篇文章在工作台中
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-card bg-[#26225f] p-6 text-white shadow-subtle sm:p-7 xl:col-span-4">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-[10px] bg-white/10 text-indigo-100">
              <Sparkles aria-hidden="true" size={19} />
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-indigo-100">
              已上线
            </span>
          </div>
          <p className="mt-5 text-[12px] font-medium text-indigo-200">V0.1 工作流</p>
          <p className="mt-1 text-lg font-semibold">从导入到公众号复制</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full rounded-full bg-indigo-300" />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-indigo-100/70">
            文章、主题预览、基础组件、设备预览、兼容报告与正式复制入口已经贯通。
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">快速开始</h2>
            <p className="mt-1 text-[12px] text-muted">选择一种方式开始排版</p>
          </div>
        </div>
        <QuickStartGrid />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="rounded-card border border-line bg-panel shadow-subtle xl:col-span-8">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">最近文章</h2>
              <p className="mt-1 text-[11px] text-muted">按最近更新时间排序</p>
            </div>
            <Link
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-strong"
              href="/workspace/articles"
            >
              查看全部
              <ArrowRight aria-hidden="true" size={12} />
            </Link>
          </div>
          {articlesQuery.isPending ? (
            <div className="grid min-h-64 place-items-center text-[12px] text-muted">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
                正在加载文章…
              </span>
            </div>
          ) : articlesQuery.isError ? (
            <div className="grid min-h-64 place-items-center px-6 text-center">
              <div>
                <p className="text-[13px] font-semibold text-ink">暂时无法读取文章</p>
                <p className="mt-2 text-[11px] text-muted">
                  {articlesQuery.error instanceof ArticleClientError
                    ? articlesQuery.error.message
                    : "文章服务暂时不可用"}
                </p>
                <button
                  className="mt-4 rounded-control border border-line px-3 py-2 text-[11px] text-ink hover:bg-hover"
                  onClick={() => void articlesQuery.refetch()}
                  type="button"
                >
                  重新加载
                </button>
              </div>
            </div>
          ) : articles.length === 0 ? (
            <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                  <FileText aria-hidden="true" size={21} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink">还没有文章</h3>
                <p className="mt-2 text-[12px] leading-5 text-muted">
                  新建或导入一篇定稿文章后，这里会显示它的状态与兼容评分。
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {articles.map((article) => (
                <Link
                  className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-hover"
                  href={`/workspace/articles/${article.id}`}
                  key={article.id}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
                    <FileText aria-hidden="true" size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">
                      {article.title}
                    </span>
                    <span className="mt-1 block text-[10px] text-faint">
                      {formatUpdatedAt(article.updatedAt)}
                    </span>
                  </span>
                  <span className="hidden rounded-full bg-panel-muted px-2.5 py-1 text-[10px] text-muted sm:inline">
                    {articleStatus(article)}
                  </span>
                  <span className="w-12 text-right font-mono text-[10px] text-faint">
                    {article.compatibilityScore === null
                      ? "未检查"
                      : `${article.compatibilityScore}分`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 xl:col-span-4">
          <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-control bg-accent-soft text-accent">
                <Radio aria-hidden="true" size={17} />
              </span>
              <span className="text-[11px] text-faint">公众号品牌</span>
            </div>
            <h2 className="mt-4 text-[14px] font-semibold text-ink">公众号品牌空间已开放</h2>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              可创建多个公众号品牌空间、设置默认账号，并管理启用与归档状态。
            </p>
            <Link
              className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent"
              href="/workspace/accounts"
            >
              管理公众号
              <ArrowRight aria-hidden="true" size={13} />
            </Link>
          </section>
          <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-control bg-warning-soft text-warning">
                <PackageOpen aria-hidden="true" size={17} />
              </span>
              <span className="text-[11px] text-faint">视觉资产</span>
            </div>
            <h2 className="mt-4 text-[14px] font-semibold text-ink">预览目录已开放</h2>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              可查看 10 套正式主题和 41 个已安装基础组件，均使用精确版本资产。
            </p>
            <div className="mt-4 flex items-center gap-3 text-[11px] text-faint">
              <Link
                className="inline-flex items-center gap-1 hover:text-accent"
                href="/workspace/themes"
              >
                <Palette aria-hidden="true" size={12} />2 主题
              </Link>
              <Link
                className="inline-flex items-center gap-1 hover:text-accent"
                href="/workspace/components"
              >
                <Sparkles aria-hidden="true" size={12} />
                41 组件
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
