"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Database,
  FileJson2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DocumentAutosaveController, type DocumentSaveSnapshot } from "../lib/documents/autosave";
import {
  DocumentClientError,
  getArticleDocument,
  saveArticleDocument,
  type ArticleDocument,
} from "../lib/documents/client";
import { IndexedDbDocumentDraftStore, type LocalDocumentDraft } from "../lib/documents/draft-store";
import { DocumentSaveStatus } from "./document-save-status";

function errorMessage(error: unknown): string {
  return error instanceof DocumentClientError ? error.message : "文档读取失败，请稍后重试";
}

export function DocumentWorkspace({ articleId }: { readonly articleId: string }) {
  const documentQuery = useQuery({
    queryKey: ["article-document", articleId],
    queryFn: () => getArticleDocument(articleId),
  });

  if (documentQuery.isPending) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-muted">
        <span className="inline-flex items-center gap-2 text-[13px]">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          正在建立文档会话…
        </span>
      </div>
    );
  }

  if (documentQuery.isError) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle aria-hidden="true" size={18} />
          </span>
          <h1 className="mt-4 text-base font-semibold text-ink">无法打开文档</h1>
          <p className="mt-2 text-[12px] text-muted">{errorMessage(documentQuery.error)}</p>
          <Link
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-control border border-line px-3 text-[12px] font-medium text-ink hover:bg-hover"
            href="/workspace/articles"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            返回文章列表
          </Link>
        </div>
      </div>
    );
  }

  return <DocumentSession initial={documentQuery.data} />;
}

function DocumentSession({ initial }: { readonly initial: ArticleDocument }) {
  const [controller, setController] = useState<DocumentAutosaveController | null>(null);
  const [recoveredDraft, setRecoveredDraft] = useState<LocalDocumentDraft | null>(null);
  const [localStorageError, setLocalStorageError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DocumentSaveSnapshot>({
    status: "saved",
    documentVersion: initial.documentVersion,
    lastSavedAt: initial.lastSavedAt,
    errorMessage: null,
    conflict: null,
  });

  useEffect(() => {
    const session = new DocumentAutosaveController({
      articleId: initial.articleId,
      initialVersion: initial.documentVersion,
      initialLastTransactionId: initial.lastTransactionId,
      initialLastSavedAt: initial.lastSavedAt,
      draftStore: new IndexedDbDocumentDraftStore(),
      save: (draft) =>
        saveArticleDocument({
          articleId: draft.articleId,
          baseVersion: draft.baseVersion,
          schemaVersion: draft.schemaVersion,
          document: draft.document,
          lastTransactionId: draft.lastTransactionId,
          transactionOrigin: draft.transactionOrigin,
        }),
    });
    const unsubscribe = session.subscribe(() => {
      setSnapshot(session.getSnapshot());
    });
    setController(session);
    setSnapshot(session.getSnapshot());
    void session
      .initialize()
      .then((draft) => {
        setRecoveredDraft(draft);
      })
      .catch((error: unknown) => {
        setLocalStorageError(error instanceof Error ? error.message : "浏览器本地草稿不可用");
      });

    return () => {
      unsubscribe();
      session.destroy();
    };
  }, [initial]);

  const discardDraft = async () => {
    if (controller === null) {
      return;
    }
    await controller.discardLocalDraft(initial.documentVersion, initial.lastSavedAt);
    setRecoveredDraft(null);
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink"
            href="/workspace/articles"
          >
            <ArrowLeft aria-hidden="true" size={13} />
            返回文章
          </Link>
          <p className="mt-4 text-[12px] font-medium text-accent">DOCUMENT SESSION</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">文章文档</h1>
          <p className="mt-2 text-[13px] text-muted">权威 JSON、乐观锁和本地草稿恢复已连接。</p>
        </div>
        <DocumentSaveStatus snapshot={snapshot} />
      </section>

      {recoveredDraft === null ? null : (
        <section className="flex flex-col gap-3 rounded-control border border-warning/25 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold text-warning">检测到浏览器本地草稿</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              草稿保存于 {new Date(recoveredDraft.savedAt).toLocaleString("zh-CN")}。版本一致时会
              自动重试；发生冲突时仍会留在本机。
            </p>
          </div>
          {snapshot.status === "conflict" ? (
            <button
              className="shrink-0 rounded-control border border-line bg-panel px-3 py-2 text-[11px] font-medium text-ink hover:bg-hover"
              onClick={() => {
                void discardDraft();
              }}
              type="button"
            >
              放弃本地草稿
            </button>
          ) : null}
        </section>
      )}

      {localStorageError === null ? null : (
        <section className="rounded-control border border-danger/20 bg-danger-soft p-4 text-[12px] text-danger">
          本地草稿存储不可用：{localStorageError}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <DocumentFact icon={FileJson2} label="Schema" value={initial.schemaVersion} />
        <DocumentFact icon={Database} label="服务端版本" value={`v${snapshot.documentVersion}`} />
        <DocumentFact
          icon={ShieldCheck}
          label="原文保护"
          value={initial.textLocked ? "已锁定" : "未锁定"}
        />
      </section>

      <section className="rounded-card border border-line bg-panel p-6 shadow-subtle">
        <div className="mx-auto max-w-2xl py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            <FileJson2 aria-hidden="true" size={20} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-ink">文档保存链路已准备好</h2>
          <p className="mt-2 text-[12px] leading-6 text-muted">
            当前文档可安全读取、自动保存并在断网后恢复。可视化编辑画布将在后续编辑器任务中
            接入这套保存会话。
          </p>
          <p className="mt-4 font-mono text-[10px] text-faint">
            document {initial.documentId} · transaction{" "}
            {initial.lastTransactionId ?? "尚无保存事务"}
          </p>
        </div>
      </section>
    </div>
  );
}

function DocumentFact({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Database;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-card border border-line bg-panel p-4 shadow-subtle">
      <span className="grid size-8 place-items-center rounded-control bg-panel-muted text-muted">
        <Icon aria-hidden="true" size={15} />
      </span>
      <p className="mt-3 text-[10px] font-medium tracking-[0.08em] text-faint uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
