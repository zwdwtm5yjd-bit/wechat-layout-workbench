"use client";

import { normalizeDocument } from "@wechat-layout/editor-core";
import type { DocumentV1 } from "@wechat-layout/document-schema";
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
  type DocumentJson,
} from "../lib/documents/client";
import { IndexedDbDocumentDraftStore, type LocalDocumentDraft } from "../lib/documents/draft-store";
import type { RestoreSnapshotResult } from "../lib/snapshots/client";
import { ArticleEditor } from "./article-editor";
import { DocumentSaveStatus } from "./document-save-status";
import { SnapshotPanel } from "./snapshot-panel";
import { WechatCopyPanel } from "./wechat-copy-panel";

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
  const [activeDocument, setActiveDocument] = useState<DocumentV1>(() =>
    normalizeDocument(initial.document),
  );
  const [recoveredDraft, setRecoveredDraft] = useState<LocalDocumentDraft | null>(null);
  const [localStorageError, setLocalStorageError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [lastTransactionId, setLastTransactionId] = useState(initial.lastTransactionId);
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
        if (draft !== null && draft.baseVersion === initial.documentVersion) {
          setActiveDocument(normalizeDocument(draft.document));
        }
      })
      .catch((error: unknown) => {
        setLocalStorageError(error instanceof Error ? error.message : "浏览器本地草稿不可用");
      });

    return () => {
      unsubscribe();
      session.destroy();
    };
  }, [initial]);

  useEffect(() => {
    if (recoveredDraft !== null && snapshot.status === "saved") {
      setRecoveredDraft(null);
    }
  }, [recoveredDraft, snapshot.status]);

  const discardDraft = async () => {
    if (controller === null) {
      return;
    }
    await controller.discardLocalDraft(initial.documentVersion, initial.lastSavedAt);
    setRecoveredDraft(null);
    setActiveDocument(normalizeDocument(initial.document));
  };

  const handleDocumentChange = (document: DocumentV1, transactionOrigin: string) => {
    if (controller === null) {
      return;
    }

    setEditorError(null);
    void controller
      .queue(document as unknown as DocumentJson, initial.schemaVersion, transactionOrigin)
      .catch((error: unknown) => {
        setLocalStorageError(error instanceof Error ? error.message : "浏览器本地草稿保存失败");
      });
  };

  const handleLockChange = async (
    document: DocumentV1,
    transactionOrigin: string,
  ): Promise<boolean> => {
    if (controller === null) {
      return false;
    }

    setEditorError(null);
    try {
      await controller.queue(
        document as unknown as DocumentJson,
        initial.schemaVersion,
        transactionOrigin,
      );
      await controller.flushNow();
      const result = controller.getSnapshot();
      if (result.status !== "saved") {
        setEditorError(result.errorMessage ?? "锁定状态尚未保存，请稍后重试");
        return false;
      }
      setActiveDocument(document);
      return true;
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "锁定状态保存失败");
      return false;
    }
  };

  const handleSnapshotRestored = async (result: RestoreSnapshotResult) => {
    if (controller === null) {
      setSnapshot({
        status: "saved",
        documentVersion: result.documentVersion,
        lastSavedAt: result.lastSavedAt,
        errorMessage: null,
        conflict: null,
      });
    } else {
      await controller.discardLocalDraft(result.documentVersion, result.lastSavedAt);
    }
    setRecoveredDraft(null);
    setLastTransactionId(result.lastTransactionId);

    try {
      const restored = await getArticleDocument(initial.articleId);
      setActiveDocument(normalizeDocument(restored.document));
    } catch (error) {
      setEditorError(errorMessage(error));
    }
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink"
            href="/workspace/articles"
          >
            <ArrowLeft aria-hidden="true" size={13} />
            返回文章
          </Link>
          <p className="mt-4 text-[12px] font-medium text-accent">VISUAL EDITOR</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">文章视觉编辑</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
              <FileJson2 aria-hidden="true" size={11} />
              Schema {initial.schemaVersion}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
              <Database aria-hidden="true" size={11} />
              服务端 v{snapshot.documentVersion}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
              <ShieldCheck aria-hidden="true" size={11} />
              原文{initial.textLocked ? "已锁定" : "未锁定"}
            </span>
          </div>
        </div>
        <DocumentSaveStatus snapshot={snapshot} />
      </section>

      {recoveredDraft === null ? null : (
        <section className="flex flex-col gap-3 rounded-control border border-warning/25 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold text-warning">已恢复浏览器本地草稿</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              草稿保存于 {new Date(recoveredDraft.savedAt).toLocaleString("zh-CN")}
              。版本一致时已载入画布并自动重试保存；冲突草稿不会覆盖远端内容。
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

      {editorError === null ? null : (
        <section className="rounded-control border border-danger/20 bg-danger-soft p-4 text-[12px] text-danger">
          编辑器暂未保存本次变更：{editorError}
        </section>
      )}

      <ArticleEditor
        document={activeDocument}
        editable={controller !== null && snapshot.status !== "conflict"}
        lockActionsEnabled={
          controller !== null && snapshot.status !== "conflict" && snapshot.status !== "saving"
        }
        onChange={handleDocumentChange}
        onError={setEditorError}
        onLockChange={handleLockChange}
        sourceBlocks={initial.sourceBlocks}
        textLocked={initial.textLocked}
      />

      <p className="text-center font-mono text-[9px] text-faint">
        document {initial.documentId} · transaction {lastTransactionId ?? "尚无保存事务"}
      </p>

      <WechatCopyPanel
        articleId={initial.articleId}
        documentVersion={snapshot.documentVersion}
        saveStatus={snapshot.status}
      />

      <SnapshotPanel
        articleId={initial.articleId}
        documentVersion={snapshot.documentVersion}
        onRestored={handleSnapshotRestored}
        saveStatus={snapshot.status}
      />
    </div>
  );
}
