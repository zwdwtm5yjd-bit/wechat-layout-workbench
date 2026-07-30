import {
  ArrowRight,
  CheckCircle2,
  FileText,
  PackageOpen,
  Palette,
  Radio,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";

import { QuickStartGrid } from "../../../components/quick-start-grid";

export const metadata: Metadata = {
  title: "工作台",
};

export default function WorkspacePage() {
  const today = new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    weekday: "long",
  }).format(new Date());

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-12">
        <div className="relative overflow-hidden rounded-card border border-line bg-panel p-6 shadow-subtle sm:p-7 xl:col-span-8">
          <div className="pointer-events-none absolute top-[-90px] right-[-70px] size-64 rounded-full bg-indigo-100/80 blur-3xl" />
          <div className="relative">
            <p className="text-[12px] font-medium text-muted">{today}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-ink">
              早上好，欢迎来到一键视觉
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              你的工作台已经准备好。可以从空白排版开始，也可以导入已经定稿的文章。
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-[12px] font-medium text-success">
                <CheckCircle2 aria-hidden="true" size={14} />
                基础服务正常
              </span>
              <span className="text-[12px] text-faint">目前还没有最近编辑的文章</span>
            </div>
          </div>
        </div>
        <div className="rounded-card bg-[#26225f] p-6 text-white shadow-subtle sm:p-7 xl:col-span-4">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-[10px] bg-white/10 text-indigo-100">
              <Sparkles aria-hidden="true" size={19} />
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-indigo-100">
              S0-WEB-001
            </span>
          </div>
          <p className="mt-5 text-[12px] font-medium text-indigo-200">本阶段进度</p>
          <p className="mt-1 text-lg font-semibold">工作台基础框架</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full rounded-full bg-indigo-300" />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-indigo-100/70">
            页面、全局状态、反馈组件与 API 类型生成流程已经接入。
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">快速开始</h2>
            <p className="mt-1 text-[12px] text-muted">选择一种方式创建你的第一篇排版</p>
          </div>
        </div>
        <QuickStartGrid />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="rounded-card border border-line bg-panel shadow-subtle xl:col-span-8">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">最近文章</h2>
              <p className="mt-1 text-[11px] text-muted">最近编辑的内容会出现在这里</p>
            </div>
            <span className="rounded-full bg-panel-muted px-2.5 py-1 text-[11px] text-faint">
              0 篇
            </span>
          </div>
          <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                <FileText aria-hidden="true" size={21} />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-ink">还没有文章</h3>
              <p className="mt-2 text-[12px] leading-5 text-muted">
                新建或导入一篇定稿文章后，这里会显示它的状态、主题与兼容评分。
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:col-span-4">
          <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-control bg-accent-soft text-accent">
                <Radio aria-hidden="true" size={17} />
              </span>
              <span className="text-[11px] text-faint">公众号品牌</span>
            </div>
            <h2 className="mt-4 text-[14px] font-semibold text-ink">尚未连接公众号</h2>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              后续可保存品牌色、默认主题和微信授权状态。
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
              连接能力待开发
              <ArrowRight aria-hidden="true" size={13} />
            </span>
          </section>
          <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-control bg-warning-soft text-warning">
                <PackageOpen aria-hidden="true" size={17} />
              </span>
              <span className="text-[11px] text-faint">素材更新</span>
            </div>
            <h2 className="mt-4 text-[14px] font-semibold text-ink">素材仓库尚未启用</h2>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              主题、组件与 SVG 素材包将在素材协议冻结后接入。
            </p>
            <div className="mt-4 flex items-center gap-3 text-[11px] text-faint">
              <span className="inline-flex items-center gap-1">
                <Palette aria-hidden="true" size={12} />0 主题
              </span>
              <span className="inline-flex items-center gap-1">
                <Sparkles aria-hidden="true" size={12} />0 更新
              </span>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
