"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  LoaderCircle,
  LockKeyhole,
  MousePointerClick,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  CopyClientError,
  createCopyRecord,
  createWechatRender,
  getCopyPayload,
  type CopyPayload,
  type RenderOutput,
  type WechatOutputMode,
} from "../lib/copy/client";
import {
  selectManualCopyContent,
  writeWechatClipboard,
  type ClipboardWriteFailureReason,
} from "../lib/copy/clipboard";
import type { DocumentSaveSnapshot } from "../lib/documents/autosave";
import { readWorkspacePreferences } from "../lib/preferences";
import { useAppToast } from "./ui/app-toast";

interface WechatCopyPanelProps {
  readonly articleId: string;
  readonly documentVersion: number;
  readonly onRenderOutput?: (output: RenderOutput) => void;
  readonly saveStatus: DocumentSaveSnapshot["status"];
}

const reasonMessages: Readonly<Record<ClipboardWriteFailureReason, string>> = {
  CLIPBOARD_API_UNAVAILABLE: "当前浏览器未开放富文本剪贴板能力",
  CLIPBOARD_WRITE_FAILED: "浏览器拒绝写入剪贴板",
  HTML_MIME_UNSUPPORTED: "当前浏览器不支持复制 HTML 排版",
  INSECURE_CONTEXT: "当前页面不是 HTTPS 安全上下文",
  USER_ACTIVATION_REQUIRED: "浏览器要求再次由用户点击触发复制",
};

function browserInfo(): Readonly<Record<string, string>> {
  return {
    language: navigator.language,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof CopyClientError ? error.message : "生成复制内容失败，请稍后重试";
}

export function WechatCopyPanel({
  articleId,
  documentVersion,
  onRenderOutput,
  saveStatus,
}: WechatCopyPanelProps) {
  const { pushToast } = useAppToast();
  const [mode, setMode] = useState<WechatOutputMode>("standard");
  const [renderOutput, setRenderOutput] = useState<RenderOutput | null>(null);
  const [payload, setPayload] = useState<CopyPayload | null>(null);
  const [pending, setPending] = useState<"generate" | "write" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualReason, setManualReason] = useState<string | null>(null);
  const [secureContext, setSecureContext] = useState<boolean | null>(null);
  const manualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSecureContext(globalThis.isSecureContext);
    setMode(readWorkspacePreferences().copyMode);
  }, []);

  useEffect(() => {
    setRenderOutput(null);
    setPayload(null);
    setMessage(null);
    setManualReason(null);
  }, [documentVersion, mode]);

  const generate = async () => {
    if (saveStatus !== "saved") {
      setMessage("请先等待当前文档保存完成，再生成正式复制内容。");
      return;
    }
    setPending("generate");
    setMessage(null);
    setManualReason(null);
    try {
      const output = await createWechatRender({
        articleId,
        documentVersion,
        outputMode: mode,
      });
      setRenderOutput(output);
      onRenderOutput?.(output);
      if (!output.canCopy) {
        setPayload(null);
        setMessage("兼容检查发现严重问题，正式复制已阻止。请按报告定位并修复。");
        return;
      }
      const nextPayload = await getCopyPayload(articleId, output.id);
      setPayload(nextPayload);
      setMessage("正式内容已生成。请再次点击“写入剪贴板”完成复制。");
    } catch (error) {
      setRenderOutput(null);
      setPayload(null);
      setMessage(errorMessage(error));
    } finally {
      setPending(null);
    }
  };

  const recordFailure = async (reason: string) => {
    if (payload === null) {
      return;
    }
    try {
      await createCopyRecord({
        articleId,
        browserInfo: browserInfo(),
        failureReason: reason,
        renderOutputId: payload.renderOutputId,
        status: "failed",
      });
    } catch {
      // Clipboard fallback remains available even if telemetry cannot be recorded.
    }
  };

  const write = async () => {
    if (payload === null) {
      return;
    }
    if (Date.parse(payload.expiresAt) <= Date.now()) {
      setPayload(null);
      setMessage("复制内容已过期，请重新生成。");
      return;
    }

    setPending("write");
    setMessage(null);
    const result = await writeWechatClipboard(payload);
    if (!result.ok) {
      const fallbackMessage = reasonMessages[result.reason];
      setManualReason(fallbackMessage);
      setMessage(`${fallbackMessage}，请使用下方手动复制。`);
      await recordFailure(
        result.detail === undefined ? result.reason : `${result.reason}:${result.detail}`,
      );
      setPending(null);
      return;
    }

    try {
      await createCopyRecord({
        articleId,
        browserInfo: browserInfo(),
        renderOutputId: payload.renderOutputId,
        status: "success",
      });
    } catch {
      setMessage("内容已写入剪贴板，但复制记录暂未回写。请继续到微信公众号后台粘贴检查。");
      setPending(null);
      return;
    }
    const success = "内容已写入剪贴板。请粘贴到微信公众号后台，并完成标题、封面和最终预览。";
    setMessage(success);
    pushToast({
      title: "已写入系统剪贴板",
      description: "下一步请到微信公众号后台粘贴并预览；此操作不代表文章已发布。",
      tone: "success",
    });
    setPending(null);
  };

  const criticalIssues =
    renderOutput?.compatibilityReport.issues.filter((issue) => issue.severity === "critical") ?? [];
  const showManual = payload !== null && manualReason !== null;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-panel shadow-subtle">
      <div className="flex flex-col gap-4 border-b border-line p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCopy aria-hidden="true" className="text-accent" size={17} />
            <h2 className="text-sm font-semibold text-ink">一键复制到公众号</h2>
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-muted">
            服务端从已保存文档生成正式 HTML；生成完成后需再次点击，浏览器才会写入剪贴板。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] text-muted" htmlFor="wechat-copy-mode">
            输出模式
          </label>
          <select
            className="h-8 rounded-control border border-line bg-panel px-2 text-[11px] text-ink"
            disabled={pending !== null}
            id="wechat-copy-mode"
            onChange={(event) => setMode(event.target.value as WechatOutputMode)}
            value={mode}
          >
            <option value="standard">标准</option>
            <option value="wechat_safe">安全</option>
            <option value="static">静态</option>
          </select>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-[11px] font-medium text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45"
            disabled={pending !== null || saveStatus !== "saved"}
            onClick={() => {
              void generate();
            }}
            type="button"
          >
            {pending === "generate" ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
            ) : (
              <LockKeyhole aria-hidden="true" size={13} />
            )}
            生成正式内容
          </button>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-[11px] font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={payload === null || pending !== null}
            onClick={() => {
              void write();
            }}
            type="button"
          >
            {pending === "write" ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
            ) : (
              <MousePointerClick aria-hidden="true" size={13} />
            )}
            写入剪贴板
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          {message === null ? (
            <p className="text-[11px] leading-5 text-muted">
              {saveStatus === "saved"
                ? "当前文档已保存，可以生成复制内容。"
                : "文档仍在保存或存在冲突，暂不能生成正式输出。"}
            </p>
          ) : (
            <p
              className={`text-[11px] leading-5 ${
                renderOutput?.canCopy === false || manualReason !== null
                  ? "text-warning"
                  : "text-success"
              }`}
              role="status"
            >
              {message}
            </p>
          )}
          {criticalIssues.length === 0 ? null : (
            <ul className="mt-3 space-y-2">
              {criticalIssues.slice(0, 5).map((issue) => (
                <li
                  className="rounded-control border border-danger/15 bg-danger-soft px-3 py-2 text-[10px] leading-4 text-danger"
                  key={issue.issueId}
                >
                  <span className="font-semibold">{issue.title}</span>
                  {issue.blockId === undefined ? "" : ` · Block ${issue.blockId}`}
                  <span className="mt-0.5 block text-muted">{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
          {showManual ? (
            <div className="mt-4 rounded-control border border-warning/20 bg-warning-soft p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-warning">手动复制区</p>
                  <p className="mt-1 text-[10px] text-muted">
                    点击全选后，按 {navigator.platform.includes("Mac") ? "Command+C" : "Ctrl+C"}。
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-control border border-line bg-panel px-3 py-1.5 text-[10px] font-medium text-ink hover:bg-hover"
                  onClick={() => {
                    if (manualRef.current !== null) {
                      selectManualCopyContent(manualRef.current);
                    }
                  }}
                  type="button"
                >
                  全选内容
                </button>
              </div>
              <div
                aria-label="手动复制内容"
                className="mt-3 max-h-56 overflow-auto rounded-control border border-line bg-white p-4 text-black outline-none focus:ring-2 focus:ring-accent/30"
                contentEditable
                dangerouslySetInnerHTML={{ __html: payload.html }}
                ref={manualRef}
                role="textbox"
                suppressContentEditableWarning
                tabIndex={0}
              />
            </div>
          ) : null}
        </div>
        <dl className="space-y-2 rounded-control bg-panel-muted p-3 text-[10px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-faint">安全上下文</dt>
            <dd className={secureContext === false ? "text-warning" : "text-success"}>
              {secureContext === null ? "检测中" : secureContext ? "可用" : "需 HTTPS"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-faint">服务端版本</dt>
            <dd className="font-mono text-muted">v{documentVersion}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-faint">兼容评分</dt>
            <dd className="font-mono text-muted">
              {renderOutput === null ? "未检查" : `${renderOutput.compatibilityReport.score}/100`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-faint">复制门禁</dt>
            <dd className="inline-flex items-center gap-1 text-muted">
              {renderOutput?.canCopy === true ? (
                <CheckCircle2 aria-hidden="true" className="text-success" size={11} />
              ) : renderOutput?.canCopy === false ? (
                <AlertTriangle aria-hidden="true" className="text-danger" size={11} />
              ) : (
                <ClipboardCheck aria-hidden="true" size={11} />
              )}
              {renderOutput === null ? "待生成" : renderOutput.canCopy ? "通过" : "已阻止"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
