"use client";

import { normalizeDocument } from "@wechat-layout/editor-core";
import type { AiLayoutProviderId } from "@wechat-layout/api-contracts";
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
import { generateAiLayout } from "../lib/ai-layout/client";
import {
  applyAiLayoutDecisionToDocument,
  applyLayoutPlanToDocument,
  layoutPlanFromAiDecision,
  type LayoutPlan,
} from "../lib/layout-planner";
import { assertValidPlannedLayout } from "../lib/layout-validation";
import { createManualSnapshot, type RestoreSnapshotResult } from "../lib/snapshots/client";
import { applyTheme, listThemes, ThemeClientError, type OfficialTheme } from "../lib/themes/client";
import { ArticleEditor } from "./article-editor";
import { CreationProgress } from "./creation-progress";
import { DocumentSaveStatus } from "./document-save-status";
import { EditorDeliveryActions } from "./editor-delivery-actions";
import { SnapshotPanel } from "./snapshot-panel";

function errorMessage(error: unknown): string {
  return error instanceof DocumentClientError ? error.message : "文档读取失败，请稍后重试";
}

function layoutOutcome(document: DocumentV1): string {
  const blocks = document.content.content;
  const countRole = (role: string) =>
    blocks.filter((node) => node.attrs.semanticRole === role).length;
  const sectionCount = blocks.filter(
    (node) => node.type === "heading" && node.attrs.level === 2,
  ).length;
  return [
    `首屏 ${String(countRole("layout_plan_generated_intro"))}`,
    `章节 ${String(sectionCount)}`,
    `导航 ${String(countRole("layout_plan_generated_overview"))}`,
    `金句 ${String(countRole("layout_plan_emphasis"))}`,
    `数据/提示 ${String(countRole("layout_plan_generated_data"))}`,
    `分隔 ${String(countRole("layout_plan_generated_divider"))}`,
    `尾卡 ${String(countRole("layout_plan_generated_footer"))}`,
  ].join(" · ");
}

export function DocumentWorkspace({ articleId }: { readonly articleId: string }) {
  const documentQuery = useQuery({
    queryKey: ["article-document", articleId],
    queryFn: () => getArticleDocument(articleId),
    refetchOnMount: "always",
    staleTime: 0,
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
  const [applyingThemeId, setApplyingThemeId] = useState<string | null>(null);
  const [applyingPlanId, setApplyingPlanId] = useState<string | null>(null);
  const [appliedLayoutOutcome, setAppliedLayoutOutcome] = useState<string | null>(null);
  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: () => listThemes(),
    staleTime: 60_000,
  });
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

  const handleApplyTheme = async (theme: OfficialTheme): Promise<void> => {
    if (controller === null || applyingThemeId !== null) {
      return;
    }
    setEditorError(null);
    setApplyingThemeId(theme.manifest.themeId);
    try {
      await controller.flushNow();
      const current = controller.getSnapshot();
      if (current.status !== "saved") {
        throw new Error(current.errorMessage ?? "请先等待当前文档保存完成");
      }
      const result = await applyTheme({
        articleId: initial.articleId,
        baseDocumentVersion: current.documentVersion,
        theme,
      });
      await controller.discardLocalDraft(result.documentVersion, result.appliedAt);
      const themedDocument = await getArticleDocument(initial.articleId);
      setActiveDocument(normalizeDocument(themedDocument.document));
      setLastTransactionId(result.lastTransactionId);
    } catch (error) {
      setEditorError(
        error instanceof ThemeClientError || error instanceof Error
          ? error.message
          : "主题应用失败，请稍后重试",
      );
      throw error;
    } finally {
      setApplyingThemeId(null);
    }
  };

  const handleApplyLayout = async (
    plan: LayoutPlan,
    providerId: AiLayoutProviderId,
  ): Promise<void> => {
    if (controller === null || applyingPlanId !== null) {
      return;
    }
    setEditorError(null);
    setApplyingPlanId(plan.id);
    try {
      await controller.flushNow();
      const current = controller.getSnapshot();
      if (current.status !== "saved") {
        throw new Error(current.errorMessage ?? "请先等待当前文档保存完成");
      }
      const currentDocument = await getArticleDocument(initial.articleId);
      if (currentDocument.documentVersion !== current.documentVersion) {
        throw new Error("文章版本已更新，请刷新后重试");
      }
      const sourceDocument = normalizeDocument(currentDocument.document);
      let resolvedPlan = plan;
      let aiDecision = null;
      if (plan.mode !== "preset") {
        const generated = await generateAiLayout(initial.articleId, {
          baseDocumentVersion: currentDocument.documentVersion,
          mode: plan.mode,
          preferredLanguageId: plan.languageId,
          providerId,
          ...(plan.brief === null ? {} : { styleBrief: plan.brief }),
        });
        aiDecision = generated.decision;
        resolvedPlan = layoutPlanFromAiDecision(
          sourceDocument,
          themesQuery.data?.items ?? [],
          plan,
          aiDecision,
        );
      }
      if (resolvedPlan.theme === null) {
        throw new Error("尚未加载可用主题，请稍后重试");
      }
      setApplyingThemeId(resolvedPlan.theme.manifest.themeId);
      const themedSource: DocumentV1 = {
        ...structuredClone(sourceDocument),
        themeId: resolvedPlan.theme.manifest.themeId,
        themeVersion: resolvedPlan.theme.manifest.version,
      };
      const plannedDocument =
        aiDecision === null
          ? applyLayoutPlanToDocument(themedSource, resolvedPlan)
          : applyAiLayoutDecisionToDocument(themedSource, resolvedPlan, aiDecision);
      assertValidPlannedLayout(sourceDocument, plannedDocument);
      await createManualSnapshot(
        initial.articleId,
        `应用成稿“${resolvedPlan.designName}”前自动创建`,
      );
      const transactionId = globalThis.crypto.randomUUID();
      const saved = await saveArticleDocument({
        articleId: initial.articleId,
        baseVersion: currentDocument.documentVersion,
        schemaVersion: currentDocument.schemaVersion,
        document: plannedDocument as unknown as DocumentJson,
        lastTransactionId: transactionId,
        transactionOrigin: `${aiDecision === null ? "layout.rule" : "layout.ai"}.${resolvedPlan.id}`,
        appearance: {
          paletteId: resolvedPlan.theme.manifest.defaultPaletteId,
          themeId: resolvedPlan.theme.manifest.themeId,
          themeVersion: resolvedPlan.theme.manifest.version,
        },
      });
      await controller.discardLocalDraft(saved.documentVersion, saved.lastSavedAt);
      setActiveDocument(plannedDocument);
      setLastTransactionId(saved.lastTransactionId);
      setAppliedLayoutOutcome(layoutOutcome(plannedDocument));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "成稿方案应用失败，请稍后重试");
      throw error;
    } finally {
      setApplyingPlanId(null);
      setApplyingThemeId(null);
    }
  };

  return (
    <div className="space-y-5">
      <CreationProgress
        current={
          activeDocument.content.content.some(
            (node) => node.attrs.semanticRole?.startsWith("layout_plan_generated") === true,
          )
            ? 4
            : 3
        }
      />
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

      {appliedLayoutOutcome === null ? null : (
        <section className="rounded-control border border-success/20 bg-success-soft p-4 text-[12px] text-success">
          <p className="font-semibold">AI 成稿已整体保存</p>
          <p className="mt-1 leading-5">
            {appliedLayoutOutcome}。主题与排版已作为同一个版本落地，不会再只剩下基础色块。
          </p>
        </section>
      )}

      <EditorDeliveryActions
        articleId={initial.articleId}
        applyingPlanId={applyingPlanId}
        document={activeDocument}
        documentVersion={snapshot.documentVersion}
        onApplyLayout={handleApplyLayout}
        saveStatus={snapshot.status}
        themes={themesQuery.data?.items ?? []}
      />

      <ArticleEditor
        applyingThemeId={applyingThemeId}
        currentThemeId={activeDocument.themeId ?? null}
        document={activeDocument}
        editable={controller !== null && snapshot.status !== "conflict"}
        lockActionsEnabled={
          controller !== null && snapshot.status !== "conflict" && snapshot.status !== "saving"
        }
        onChange={handleDocumentChange}
        onApplyTheme={handleApplyTheme}
        onError={setEditorError}
        onLockChange={handleLockChange}
        sourceBlocks={initial.sourceBlocks}
        textLocked={initial.textLocked}
        themes={themesQuery.data?.items ?? []}
      />

      <p className="text-center font-mono text-[9px] text-faint">
        document {initial.documentId} · transaction {lastTransactionId ?? "尚无保存事务"}
      </p>

      <SnapshotPanel
        articleId={initial.articleId}
        documentVersion={snapshot.documentVersion}
        onRestored={handleSnapshotRestored}
        saveStatus={snapshot.status}
      />
    </div>
  );
}
