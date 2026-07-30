"use client";

import { AlertTriangle, Check, CloudOff, LoaderCircle } from "lucide-react";

import type { DocumentSaveSnapshot } from "../lib/documents/autosave";

const labels = {
  saved: "已保存",
  saving: "正在保存…",
  local_saved: "本地已保存",
  error: "保存失败",
  conflict: "存在版本冲突",
} as const;

const tones = {
  saved: "text-muted",
  saving: "text-accent",
  local_saved: "text-warning",
  error: "text-danger",
  conflict: "text-danger",
} as const;

function StatusIcon({ status }: { readonly status: DocumentSaveSnapshot["status"] }) {
  if (status === "saving") {
    return <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />;
  }
  if (status === "saved") {
    return <Check aria-hidden="true" size={13} />;
  }
  if (status === "local_saved") {
    return <CloudOff aria-hidden="true" size={13} />;
  }
  return <AlertTriangle aria-hidden="true" size={13} />;
}

export function DocumentSaveStatus({ snapshot }: { readonly snapshot: DocumentSaveSnapshot }) {
  return (
    <details className="group relative">
      <summary
        aria-live="polite"
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-control px-2 py-1 text-[11px] font-medium transition hover:bg-hover ${tones[snapshot.status]}`}
      >
        <StatusIcon status={snapshot.status} />
        {labels[snapshot.status]}
      </summary>
      <div className="absolute top-full right-0 z-30 mt-2 w-72 rounded-control border border-line bg-panel p-3 text-left shadow-raised">
        <p className="text-[12px] font-semibold text-ink">{labels[snapshot.status]}</p>
        <p className="mt-1 text-[11px] leading-5 text-muted">
          当前服务端文档版本：{snapshot.documentVersion}
        </p>
        {snapshot.lastSavedAt === null ? null : (
          <p className="text-[11px] leading-5 text-muted">
            最近保存：{new Date(snapshot.lastSavedAt).toLocaleString("zh-CN")}
          </p>
        )}
        {snapshot.conflict === null ? null : (
          <p className="mt-2 text-[11px] leading-5 text-danger">
            本地基于版本 {snapshot.conflict.submittedVersion}，远端版本{" "}
            {snapshot.conflict.currentVersion ?? "未知"}。本地草稿仍保留，未覆盖远端内容。
          </p>
        )}
        {snapshot.errorMessage === null ? null : (
          <p className="mt-2 text-[11px] leading-5 text-danger">{snapshot.errorMessage}</p>
        )}
      </div>
    </details>
  );
}
