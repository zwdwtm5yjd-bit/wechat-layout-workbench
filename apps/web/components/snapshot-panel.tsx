"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Clock3, Eye, FileClock, LoaderCircle, PackageOpen, RotateCcw } from "lucide-react";
import { useState } from "react";

import type { DocumentSaveStatus } from "../lib/documents/autosave";
import {
  createManualSnapshot,
  listSnapshots,
  previewSnapshot,
  restoreSnapshot,
  SnapshotClientError,
  type RestoreSnapshotResult,
  type SnapshotDetail,
  type SnapshotSummary,
} from "../lib/snapshots/client";
import { useAppToast } from "./ui/app-toast";

const reasonLabels: Readonly<Record<SnapshotSummary["reason"], string>> = {
  manual: "手动快照",
  after_import: "导入后",
  before_theme_apply: "应用主题前",
  before_copy: "复制前",
  before_restore: "恢复前保护",
  restored: "历史恢复",
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof SnapshotClientError ? error.message : "版本操作失败，请稍后重试";
}

export function SnapshotPanel({
  articleId,
  documentVersion,
  saveStatus,
  onRestored,
}: {
  readonly articleId: string;
  readonly documentVersion: number;
  readonly saveStatus: DocumentSaveStatus;
  readonly onRestored: (result: RestoreSnapshotResult) => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useAppToast();
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<SnapshotDetail | null>(null);
  const snapshotsQuery = useQuery({
    queryKey: ["article-snapshots", articleId],
    queryFn: () => listSnapshots(articleId),
  });

  const refreshSnapshots = async () => {
    await queryClient.invalidateQueries({ queryKey: ["article-snapshots", articleId] });
  };

  const createMutation = useMutation({
    mutationFn: () => createManualSnapshot(articleId, note.trim() || null),
    onSuccess: async (created) => {
      setNote("");
      setPreview(created);
      await refreshSnapshots();
      pushToast({
        title: `版本 #${created.snapshotNumber} 已保存`,
        description: "当前文档、主题、品牌和资源清单已冻结。",
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({
        title: "无法创建快照",
        description: errorMessage(error),
        tone: "warning",
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (snapshotId: string) => previewSnapshot(articleId, snapshotId),
    onSuccess: (snapshot) => {
      setPreview(snapshot);
    },
    onError: (error) => {
      pushToast({
        title: "无法预览版本",
        description: errorMessage(error),
        tone: "warning",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (snapshot: SnapshotDetail) =>
      restoreSnapshot({
        articleId,
        snapshotId: snapshot.id,
        baseVersion: documentVersion,
        lastTransactionId: crypto.randomUUID(),
      }),
    onSuccess: async (result) => {
      await onRestored(result);
      setPreview(null);
      await refreshSnapshots();
      pushToast({
        title: "历史版本已恢复",
        description: `恢复前状态和恢复后状态已分别保存为版本 #${result.safetySnapshot.snapshotNumber}、#${result.restoredSnapshot.snapshotNumber}。`,
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({
        title: "恢复未执行",
        description: errorMessage(error),
        tone: "warning",
      });
    },
  });

  const restorePreview = () => {
    if (
      preview === null ||
      preview.isCurrent ||
      saveStatus !== "saved" ||
      !window.confirm(
        `恢复版本 #${preview.snapshotNumber}？系统会先为当前状态创建安全快照，整个操作失败时不会修改文章。`,
      )
    ) {
      return;
    }
    restoreMutation.mutate(preview);
  };

  return (
    <section className="rounded-card border border-line bg-panel shadow-subtle">
      <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <FileClock aria-hidden="true" className="text-accent" size={16} />
            历史版本
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            快照不可修改。恢复时会先保护当前状态，再生成新的恢复版本。
          </p>
        </div>
        <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
          <input
            aria-label="快照备注"
            className="h-9 min-w-0 flex-1 rounded-control border border-line bg-panel-muted px-3 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-indigo-100"
            disabled={createMutation.isPending || saveStatus !== "saved"}
            maxLength={500}
            onChange={(event) => {
              setNote(event.target.value);
            }}
            placeholder="可选备注，例如：完成第一轮排版"
            value={note}
          />
          <button
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-3 text-[12px] font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            disabled={createMutation.isPending || saveStatus !== "saved"}
            onClick={() => {
              createMutation.mutate();
            }}
            type="button"
          >
            {createMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
            ) : (
              <Camera aria-hidden="true" size={14} />
            )}
            创建快照
          </button>
        </div>
      </div>

      <div className="grid min-h-80 lg:grid-cols-[320px_1fr]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          {snapshotsQuery.isPending ? (
            <div className="grid min-h-56 place-items-center text-[12px] text-muted">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
                正在读取历史版本…
              </span>
            </div>
          ) : snapshotsQuery.isError ? (
            <div className="p-5 text-[12px] text-danger">
              {errorMessage(snapshotsQuery.error)}
              <button
                className="mt-3 block text-accent hover:underline"
                onClick={() => {
                  void snapshotsQuery.refetch();
                }}
                type="button"
              >
                重新加载
              </button>
            </div>
          ) : snapshotsQuery.data.items.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-6 text-center">
              <div>
                <Clock3 aria-hidden="true" className="mx-auto text-faint" size={20} />
                <p className="mt-3 text-[12px] font-medium text-ink">尚无历史版本</p>
                <p className="mt-1 text-[11px] text-muted">保存第一个手动快照作为恢复点。</p>
              </div>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto p-2">
              {snapshotsQuery.data.items.map((item) => (
                <button
                  className={`mb-1 w-full rounded-control border px-3 py-3 text-left transition last:mb-0 ${
                    preview?.id === item.id
                      ? "border-accent/30 bg-accent-soft"
                      : "border-transparent hover:border-line hover:bg-hover"
                  }`}
                  key={item.id}
                  onClick={() => {
                    previewMutation.mutate(item.id);
                  }}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-ink">
                      #{item.snapshotNumber} · {reasonLabels[item.reason]}
                    </span>
                    {item.isCurrent ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[9px] font-medium text-success">
                        当前
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[10px] text-faint">
                    {formatTime(item.createdAt)}
                  </span>
                  {item.note === null ? null : (
                    <span className="mt-1 block truncate text-[10px] text-muted">{item.note}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 p-5">
          {previewMutation.isPending ? (
            <div className="grid min-h-64 place-items-center text-[12px] text-muted">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
                正在生成只读预览…
              </span>
            </div>
          ) : preview === null ? (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <Eye aria-hidden="true" className="mx-auto text-faint" size={21} />
                <p className="mt-3 text-[12px] font-medium text-ink">选择一个版本查看内容</p>
                <p className="mt-1 text-[11px] text-muted">预览不会修改当前文档。</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    版本 #{preview.snapshotNumber} · {reasonLabels[preview.reason]}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Schema {preview.documentSchemaVersion} · {preview.resourceCount} 项资源 ·{" "}
                    {preview.packageCount} 个版本包
                  </p>
                </div>
                <button
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-control border border-line px-3 text-[11px] font-medium text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    preview.isCurrent || saveStatus !== "saved" || restoreMutation.isPending
                  }
                  onClick={restorePreview}
                  type="button"
                >
                  {restoreMutation.isPending ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
                  ) : (
                    <RotateCcw aria-hidden="true" size={13} />
                  )}
                  {preview.isCurrent ? "当前版本" : "恢复此版本"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PreviewFact label="主题" value={preview.themeVersion ?? "未绑定"} />
                <PreviewFact
                  label="品牌版本"
                  value={preview.brandVersionId === null ? "未绑定" : "已冻结"}
                />
                <PreviewFact
                  label="兼容得分"
                  value={preview.compatibilityScore?.toString() ?? "未检测"}
                />
              </div>

              <details className="mt-4 rounded-control border border-line bg-panel-muted">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] font-medium text-ink">
                  <PackageOpen aria-hidden="true" size={13} />
                  查看完整只读 JSON
                </summary>
                <pre className="max-h-72 overflow-auto border-t border-line p-3 text-[10px] leading-5 text-muted">
                  {JSON.stringify(preview.document, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PreviewFact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-control border border-line bg-panel-muted px-3 py-2">
      <p className="text-[9px] font-medium tracking-[0.08em] text-faint uppercase">{label}</p>
      <p className="mt-1 truncate text-[11px] font-medium text-ink">{value}</p>
    </div>
  );
}
