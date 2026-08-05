"use client";

import type { DocumentV1 } from "@wechat-layout/document-schema";
import type { RenderOutput } from "../lib/copy/client";
import type { DocumentSaveSnapshot } from "../lib/documents/autosave";
import { analyzeDocumentLayout, createLayoutPlans, type LayoutPlan } from "../lib/layout-planner";
import type { OfficialTheme } from "../lib/themes/client";
import {
  CheckCircle2,
  ClipboardCopy,
  Eye,
  FileCheck2,
  Info,
  LayoutTemplate,
  LoaderCircle,
  ImagePlus,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState } from "react";

import { WechatCopyPanel } from "./wechat-copy-panel";

interface EditorDeliveryActionsProps {
  readonly articleId: string;
  readonly applyingPlanId?: string | null;
  readonly document: DocumentV1;
  readonly documentVersion: number;
  readonly onApplyLayout: (plan: LayoutPlan) => Promise<void>;
  readonly saveStatus: DocumentSaveSnapshot["status"];
  readonly themes: readonly OfficialTheme[];
}

function isEditingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "SELECT" ||
      target.tagName === "TEXTAREA")
  );
}

export function EditorDeliveryActions({
  articleId,
  applyingPlanId = null,
  document,
  documentVersion,
  onApplyLayout,
  saveStatus,
  themes,
}: EditorDeliveryActionsProps) {
  const router = useRouter();
  const [compatibilityOpen, setCompatibilityOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [renderOutput, setRenderOutput] = useState<RenderOutput | null>(null);
  const analysis = useMemo(() => analyzeDocumentLayout(document), [document]);
  const layoutPlans = useMemo(() => createLayoutPlans(document, themes), [document, themes]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("guide") === "1") {
      setLayoutOpen(true);
    }
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditingTarget(event.target) || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      const key = event.key.toLocaleLowerCase();
      if (key === "p" && !event.shiftKey) {
        event.preventDefault();
        router.push(`/workspace/articles/${articleId}/preview`);
      } else if (key === "c" && event.shiftKey) {
        event.preventDefault();
        setCompatibilityOpen(true);
      } else if (key === "p" && event.shiftKey) {
        event.preventDefault();
        setCopyOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [articleId, router]);

  useEffect(() => {
    setRenderOutput(null);
  }, [documentVersion]);

  const groupedIssues = useMemo(() => {
    if (renderOutput === null) return null;
    return {
      critical: renderOutput.compatibilityReport.issues.filter(
        (issue) => issue.severity === "critical",
      ),
      warning: renderOutput.compatibilityReport.issues.filter(
        (issue) => issue.severity === "warning",
      ),
      suggestion: renderOutput.compatibilityReport.issues.filter(
        (issue) => issue.severity === "suggestion",
      ),
    };
  }, [renderOutput]);

  return (
    <>
      <section className="flex flex-col gap-3 rounded-card border border-line bg-panel p-3 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
            <FileCheck2 aria-hidden="true" size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-ink">交付工具</p>
            <p className="mt-0.5 truncate text-[10px] text-faint">预览 → 兼容检查 → 复制到公众号</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-control border border-line px-3 text-[11px] font-medium text-ink hover:bg-hover"
            onClick={() => setLayoutOpen(true)}
            type="button"
          >
            <LayoutTemplate aria-hidden="true" size={14} />
            快速排版
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-control border border-line px-3 text-[11px] font-medium text-ink hover:bg-hover"
            onClick={() => router.push(`/workspace/articles/${articleId}/preview`)}
            type="button"
          >
            <Eye aria-hidden="true" size={14} />
            预览
            <kbd className="text-[9px] text-faint">⌘P</kbd>
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-control border border-line px-3 text-[11px] font-medium text-ink hover:bg-hover"
            onClick={() => setCompatibilityOpen(true)}
            type="button"
          >
            <ShieldAlert aria-hidden="true" size={14} />
            兼容检查
            {renderOutput === null ? null : (
              <span
                className={
                  renderOutput.canCopy
                    ? "rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] text-success"
                    : "rounded-full bg-danger-soft px-1.5 py-0.5 text-[9px] text-danger"
                }
              >
                {renderOutput.compatibilityReport.score}
              </span>
            )}
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-control bg-accent px-3 text-[11px] font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"
            disabled={saveStatus !== "saved"}
            onClick={() => setCopyOpen(true)}
            type="button"
          >
            <ClipboardCopy aria-hidden="true" size={14} />
            一键复制
          </button>
        </div>
      </section>

      <Dialog.Root onOpenChange={setLayoutOpen} open={layoutOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/25 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-line bg-panel p-6 shadow-raised">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-ink">
                  选择一套成稿方案
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[11px] text-muted">
                  已分析文章结构。应用方案会先保存安全快照，再统一主题、标题、段距、引用和章节装饰。
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="关闭快速排版"
                className="grid size-8 place-items-center rounded-control text-faint hover:bg-hover"
              >
                <X aria-hidden="true" size={15} />
              </Dialog.Close>
            </div>
            <div className="mt-5 grid gap-3 rounded-control border border-line bg-panel-muted p-4 sm:grid-cols-4">
              {[
                ["正文", `${analysis.characterCount.toLocaleString("zh-CN")} 字`],
                ["章节", `${analysis.headingCount} 个标题`],
                ["现有图片", `${analysis.imageCount} 张`],
                ["建议补图", `${analysis.missingImageCount} 张`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[9px] text-faint">{label}</p>
                  <p className="mt-1 text-[12px] font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {layoutPlans.map((plan) => {
                const applying = applyingPlanId === plan.id;
                return (
                  <article
                    className={`relative overflow-hidden rounded-card border bg-panel p-4 ${
                      plan.recommended ? "border-accent ring-2 ring-accent/10" : "border-line"
                    }`}
                    key={plan.id}
                  >
                    {plan.recommended ? (
                      <span className="absolute top-3 right-3 rounded-full bg-accent-soft px-2 py-1 text-[9px] font-semibold text-accent">
                        内容匹配推荐
                      </span>
                    ) : null}
                    <div className="flex gap-1.5">
                      {plan.accentColors.slice(0, 3).map((color) => (
                        <span
                          className="h-2 w-8 rounded-full"
                          key={color}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="mt-4 text-[14px] font-semibold text-ink">{plan.name}</p>
                    <p className="mt-1 text-[10px] font-medium text-accent">
                      {plan.themeName} · {plan.tone}
                    </p>
                    <p className="mt-3 min-h-16 text-[11px] leading-5 text-muted">
                      {plan.description}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-[10px] text-muted">
                      {plan.highlights.map((highlight) => (
                        <li className="flex items-center gap-1.5" key={highlight}>
                          <Sparkles aria-hidden="true" className="text-accent" size={10} />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-control bg-accent text-[11px] font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={
                        saveStatus !== "saved" || applyingPlanId !== null || plan.theme === null
                      }
                      onClick={() => {
                        void onApplyLayout(plan)
                          .then(() => setLayoutOpen(false))
                          .catch(() => undefined);
                      }}
                      type="button"
                    >
                      {applying ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
                      ) : (
                        <ImagePlus aria-hidden="true" size={13} />
                      )}
                      {applying ? "正在生成成稿…" : "应用整套方案"}
                    </button>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-center text-[10px] text-faint">
              应用后仍可自由拖动区块、换主题、上传自己的图片并逐项修改。
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root onOpenChange={setCompatibilityOpen} open={compatibilityOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/25 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[min(460px,100vw)] overflow-y-auto border-l border-line bg-panel shadow-raised">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-panel/95 p-5 backdrop-blur">
              <div>
                <Dialog.Title className="text-base font-semibold text-ink">兼容检查</Dialog.Title>
                <Dialog.Description className="mt-1 text-[11px] text-muted">
                  与正式微信输出共用同一份服务端规则报告
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="关闭兼容检查"
                className="grid size-8 place-items-center rounded-control text-faint hover:bg-hover"
              >
                <X aria-hidden="true" size={16} />
              </Dialog.Close>
            </div>
            {renderOutput === null || groupedIssues === null ? (
              <div className="grid min-h-[70vh] place-items-center p-6 text-center">
                <div className="max-w-xs">
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning-soft text-warning">
                    <Info aria-hidden="true" size={20} />
                  </span>
                  <h2 className="mt-4 text-sm font-semibold text-ink">尚未生成正式检查报告</h2>
                  <p className="mt-2 text-[11px] leading-5 text-muted">
                    兼容规则依赖已保存的文档版本。请在复制弹窗中生成正式内容，报告会同步显示在这里。
                  </p>
                  <button
                    className="mt-5 h-9 rounded-control bg-accent px-4 text-[11px] font-semibold text-white disabled:opacity-45"
                    disabled={saveStatus !== "saved"}
                    onClick={() => {
                      setCompatibilityOpen(false);
                      setCopyOpen(true);
                    }}
                    type="button"
                  >
                    打开一键复制
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <div
                  className={`rounded-card p-5 ${
                    renderOutput.canCopy ? "bg-success-soft" : "bg-danger-soft"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p
                        className={`text-[12px] font-semibold ${
                          renderOutput.canCopy ? "text-success" : "text-danger"
                        }`}
                      >
                        {renderOutput.canCopy ? "复制门禁已通过" : "发现阻断问题"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted">
                        规则 {renderOutput.compatibilityReport.ruleVersion}
                      </p>
                    </div>
                    <span className="font-mono text-3xl font-semibold text-ink">
                      {renderOutput.compatibilityReport.score}
                    </span>
                  </div>
                </div>
                {(
                  [
                    ["critical", "阻断问题", "text-danger"],
                    ["warning", "风险提醒", "text-warning"],
                    ["suggestion", "优化建议", "text-accent"],
                  ] as const
                ).map(([severity, label, tone]) => {
                  const issues = groupedIssues[severity];
                  if (issues.length === 0) return null;
                  return (
                    <section key={severity}>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className={`text-[11px] font-semibold ${tone}`}>{label}</h3>
                        <span className="text-[10px] text-faint">{issues.length}</span>
                      </div>
                      <ul className="space-y-2">
                        {issues.map((issue) => (
                          <li
                            className="rounded-control border border-line bg-panel-muted p-3"
                            key={issue.issueId}
                          >
                            <p className="text-[11px] font-semibold text-ink">{issue.title}</p>
                            <p className="mt-1 text-[10px] leading-5 text-muted">{issue.message}</p>
                            {issue.blockId === undefined ? null : (
                              <p className="mt-1 font-mono text-[9px] text-faint">
                                block {issue.blockId}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
                {renderOutput.compatibilityReport.issues.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckCircle2 aria-hidden="true" className="mx-auto text-success" size={24} />
                    <p className="mt-3 text-[12px] font-semibold text-ink">未发现兼容问题</p>
                  </div>
                ) : null}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root onOpenChange={setCopyOpen} open={copyOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-panel shadow-raised">
            <Dialog.Title className="sr-only">一键复制到公众号</Dialog.Title>
            <Dialog.Description className="sr-only">
              生成正式微信输出，完成兼容检查并写入系统剪贴板。
            </Dialog.Description>
            <Dialog.Close
              aria-label="关闭复制弹窗"
              className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-control bg-panel text-faint shadow-subtle hover:bg-hover hover:text-ink"
            >
              <X aria-hidden="true" size={16} />
            </Dialog.Close>
            <WechatCopyPanel
              articleId={articleId}
              documentVersion={documentVersion}
              onRenderOutput={setRenderOutput}
              saveStatus={saveStatus}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
