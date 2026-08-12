"use client";

import { normalizeDocument } from "@wechat-layout/editor-core";
import type { AiLayoutDecision, AiLayoutProviderId } from "@wechat-layout/api-contracts";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Database,
  FileJson2,
  LoaderCircle,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  insertPreparedImages,
  type PreparedImageSelection,
  type PreparedImagesSaveResult,
} from "../lib/ai-layout/image-preparation";
import { createEditableLayoutDraft } from "../lib/layout-draft";
import {
  applyAiLayoutDecisionToDocument,
  applyLayoutPlanToDocument,
  layoutPlanFromAiDecision,
  type LayoutPlan,
} from "../lib/layout-planner";
import {
  layoutDraftModeFromOrigin,
  layoutDraftTransactionOrigin,
  layoutTransactionOrigin,
} from "../lib/layout-transaction";
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

type LayoutDraftMode = "ai" | "rule";

interface LayoutDraftState {
  readonly designName: string;
  readonly mode: LayoutDraftMode;
  readonly outcome: string;
}

interface MutableLayoutDraft {
  document: DocumentV1;
  readonly mode: LayoutDraftMode;
  revision: number;
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
  const layoutDraftRef = useRef<MutableLayoutDraft | null>(null);
  const savingLayoutDraftRef = useRef(false);
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
  const [layoutDraft, setLayoutDraft] = useState<LayoutDraftState | null>(null);
  const [savingLayoutDraft, setSavingLayoutDraft] = useState(false);
  const [layoutSaveNotice, setLayoutSaveNotice] = useState<string | null>(null);
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
          const restoredDocument = normalizeDocument(draft.document);
          setActiveDocument(restoredDocument);
          const draftMode =
            draft.saveMode === "manual" ? layoutDraftModeFromOrigin(draft.transactionOrigin) : null;
          if (draftMode !== null) {
            layoutDraftRef.current = { document: restoredDocument, mode: draftMode, revision: 0 };
            setLayoutDraft({
              designName: "恢复的智能排版",
              mode: draftMode,
              outcome: layoutOutcome(restoredDocument),
            });
          }
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
    layoutDraftRef.current = null;
    setLayoutDraft(null);
    setLayoutSaveNotice(null);
    setRecoveredDraft(null);
    setActiveDocument(normalizeDocument(initial.document));
  };

  const handleDocumentChange = (document: DocumentV1, transactionOrigin: string) => {
    if (controller === null) {
      return;
    }

    setEditorError(null);
    const currentLayoutDraft = layoutDraftRef.current;
    if (currentLayoutDraft !== null) {
      currentLayoutDraft.document = document;
      currentLayoutDraft.revision += 1;
      void controller
        .queue(
          document as unknown as DocumentJson,
          initial.schemaVersion,
          layoutDraftTransactionOrigin(currentLayoutDraft.mode),
          { saveMode: "manual" },
        )
        .catch((error: unknown) => {
          setLocalStorageError(error instanceof Error ? error.message : "浏览器本地草稿保存失败");
        });
      return;
    }
    void controller
      .queue(document as unknown as DocumentJson, initial.schemaVersion, transactionOrigin)
      .catch((error: unknown) => {
        setLocalStorageError(error instanceof Error ? error.message : "浏览器本地草稿保存失败");
      });
  };

  const discardLayoutDraft = async (): Promise<void> => {
    if (controller === null || savingLayoutDraftRef.current) return;
    savingLayoutDraftRef.current = true;
    setEditorError(null);
    setSavingLayoutDraft(true);
    try {
      const persisted = await getArticleDocument(initial.articleId);
      await controller.discardLocalDraft(persisted.documentVersion, persisted.lastSavedAt);
      layoutDraftRef.current = null;
      setLayoutDraft(null);
      setLayoutSaveNotice(null);
      setRecoveredDraft(null);
      setActiveDocument(normalizeDocument(persisted.document));
      setLastTransactionId(persisted.lastTransactionId);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "无法放弃本次手动调整");
    } finally {
      savingLayoutDraftRef.current = false;
      setSavingLayoutDraft(false);
    }
  };

  const saveLayoutDraft = async (): Promise<void> => {
    const savingDraft = layoutDraftRef.current;
    if (controller === null || savingDraft === null || savingLayoutDraftRef.current) return;
    const savingRevision = savingDraft.revision;
    const hasNewerLayoutDraft = (): boolean =>
      layoutDraftRef.current !== savingDraft || savingDraft.revision !== savingRevision;

    savingLayoutDraftRef.current = true;
    setEditorError(null);
    setLayoutSaveNotice(null);
    setSavingLayoutDraft(true);
    try {
      await controller.flushNow();
      const current = controller.getSnapshot();
      if (current.status !== "saved") {
        if (hasNewerLayoutDraft()) {
          setLayoutSaveNotice(
            "保存期间检测到新的调整；新草稿仍保留在本机，请等待保存状态稳定后再次保存。",
          );
          return;
        }
        throw new Error(current.errorMessage ?? "当前排版草稿尚未保存，请稍后重试");
      }
      const persisted = await getArticleDocument(initial.articleId);
      setLastTransactionId(persisted.lastTransactionId);
      if (hasNewerLayoutDraft()) {
        setLayoutSaveNotice(
          "点击保存后又产生了新的调整：刚才的版本已保存，新调整仍保留在本机，请再次点击保存。",
        );
        return;
      }
      layoutDraftRef.current = null;
      setLayoutDraft(null);
      setLayoutSaveNotice(null);
      setRecoveredDraft(null);
      setActiveDocument(normalizeDocument(persisted.document));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "排版草稿保存失败");
    } finally {
      savingLayoutDraftRef.current = false;
      setSavingLayoutDraft(false);
    }
  };

  const handleLockChange = async (
    document: DocumentV1,
    transactionOrigin: string,
  ): Promise<boolean> => {
    if (controller === null) {
      return false;
    }

    setEditorError(null);
    const currentLayoutDraft = layoutDraftRef.current;
    if (currentLayoutDraft !== null) {
      try {
        currentLayoutDraft.document = document;
        currentLayoutDraft.revision += 1;
        await controller.queue(
          document as unknown as DocumentJson,
          initial.schemaVersion,
          layoutDraftTransactionOrigin(currentLayoutDraft.mode),
          { saveMode: "manual" },
        );
        return true;
      } catch (error) {
        setEditorError(error instanceof Error ? error.message : "草稿锁定状态保存失败");
        return false;
      }
    }
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
    layoutDraftRef.current = null;
    setLayoutDraft(null);
    setLayoutSaveNotice(null);
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
    if (layoutDraftRef.current !== null) {
      const message = "请先手动保存或放弃当前 AI 排版草稿，再切换主题";
      setEditorError(message);
      throw new Error(message);
    }
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
    suppliedDecision?: AiLayoutDecision,
  ): Promise<void> => {
    if (layoutDraftRef.current !== null) {
      const message = "请先手动保存或放弃当前 AI 排版草稿，再生成新方案";
      setEditorError(message);
      throw new Error(message);
    }
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
      let aiDecision: AiLayoutDecision | null = suppliedDecision ?? null;
      if (plan.mode !== "preset") {
        if (aiDecision === null) {
          const generated = await generateAiLayout(initial.articleId, {
            baseDocumentVersion: currentDocument.documentVersion,
            mode: plan.mode,
            preferredLanguageId: plan.languageId,
            providerId,
            ...(plan.brief === null ? {} : { styleBrief: plan.brief }),
          });
          aiDecision = generated.decision;
        }
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
      const editableDraft = createEditableLayoutDraft(plannedDocument);
      assertValidPlannedLayout(sourceDocument, editableDraft);
      await createManualSnapshot(
        initial.articleId,
        `应用成稿“${resolvedPlan.designName}”前自动创建`,
      );
      const transactionId = globalThis.crypto.randomUUID();
      const saved = await saveArticleDocument({
        articleId: initial.articleId,
        baseVersion: currentDocument.documentVersion,
        schemaVersion: currentDocument.schemaVersion,
        document: editableDraft as unknown as DocumentJson,
        lastTransactionId: transactionId,
        transactionOrigin: layoutTransactionOrigin(aiDecision === null ? "rule" : "ai"),
        appearance: {
          paletteId: resolvedPlan.theme.manifest.defaultPaletteId,
          themeId: resolvedPlan.theme.manifest.themeId,
          themeVersion: resolvedPlan.theme.manifest.version,
        },
      });
      const persisted = await getArticleDocument(initial.articleId);
      const persistedDocument = normalizeDocument(persisted.document);
      await controller.discardLocalDraft(persisted.documentVersion, persisted.lastSavedAt);
      const draftMode = aiDecision === null ? "rule" : "ai";
      layoutDraftRef.current = { document: persistedDocument, mode: draftMode, revision: 0 };
      setLayoutDraft({
        designName: resolvedPlan.designName,
        mode: draftMode,
        outcome: layoutOutcome(persistedDocument),
      });
      setActiveDocument(persistedDocument);
      setLastTransactionId(persisted.lastTransactionId ?? saved.lastTransactionId);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "成稿方案应用失败，请稍后重试");
      throw error;
    } finally {
      setApplyingPlanId(null);
      setApplyingThemeId(null);
    }
  };

  const handlePrepareImages = async (
    selections: readonly PreparedImageSelection[],
  ): Promise<PreparedImagesSaveResult> => {
    if (layoutDraftRef.current !== null) {
      const message = "请先手动保存或放弃当前 AI 排版草稿，再添加配图";
      setEditorError(message);
      throw new Error(message);
    }
    if (controller === null) {
      throw new Error("文档保存会话尚未就绪");
    }

    setEditorError(null);
    try {
      await controller.flushNow();
      const current = controller.getSnapshot();
      if (current.status !== "saved") {
        throw new Error(current.errorMessage ?? "请先等待当前文档保存完成");
      }
      const persisted = await getArticleDocument(initial.articleId);
      if (persisted.documentVersion !== current.documentVersion) {
        throw new Error("文章版本已更新，请刷新后重新选择配图");
      }
      const sourceDocument = normalizeDocument(persisted.document);
      const prepared = insertPreparedImages(sourceDocument, selections);
      const insertedCount = prepared.content.content.length - sourceDocument.content.content.length;
      if (insertedCount !== selections.length) {
        throw new Error("部分所选图片已在文章中或插入位置已失效，请重新选择");
      }

      await controller.queue(
        prepared as unknown as DocumentJson,
        initial.schemaVersion,
        "image.preparation.apply",
      );
      await controller.flushNow();
      const savedState = controller.getSnapshot();
      if (savedState.status !== "saved") {
        throw new Error(savedState.errorMessage ?? "配图尚未保存，请稍后重试");
      }
      const saved = await getArticleDocument(initial.articleId);
      const savedDocument = normalizeDocument(saved.document);
      setActiveDocument(savedDocument);
      setLastTransactionId(saved.lastTransactionId);
      return { document: savedDocument, documentVersion: saved.documentVersion };
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "配图保存失败，请稍后重试");
      throw error;
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
              {layoutDraft === null
                ? `原文${initial.textLocked ? "已锁定" : "未锁定"}`
                : "AI 草稿可编辑"}
            </span>
          </div>
        </div>
        <DocumentSaveStatus snapshot={snapshot} />
      </section>

      {recoveredDraft === null || layoutDraft !== null ? null : (
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

      {layoutDraft === null ? null : (
        <section className="flex flex-col gap-3 rounded-control border border-accent/20 bg-accent-soft p-4 text-[12px] text-ink sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">“{layoutDraft.designName}”已进入可编辑草稿</p>
            <p className="mt-1 leading-5 text-muted">
              {layoutDraft.outcome}
              。所有区块均已解锁，可修改文字、拖动区块和调整样式；后续调整只保存在本机，确认后再手动保存。
            </p>
            {layoutSaveNotice === null ? null : (
              <p className="mt-1.5 font-medium leading-5 text-warning" role="status">
                {layoutSaveNotice}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-control border border-line bg-panel px-3 text-[11px] font-medium text-ink hover:bg-hover disabled:opacity-45"
              disabled={savingLayoutDraft}
              onClick={() => void discardLayoutDraft()}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={13} />
              放弃未保存调整
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-control bg-accent px-3 text-[11px] font-semibold text-white hover:bg-accent-strong disabled:opacity-45"
              disabled={savingLayoutDraft || snapshot.status === "conflict"}
              onClick={() => void saveLayoutDraft()}
              type="button"
            >
              {savingLayoutDraft ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
              ) : (
                <Save aria-hidden="true" size={13} />
              )}
              {savingLayoutDraft ? "正在保存当前版本…" : "手动保存成稿"}
            </button>
          </div>
        </section>
      )}

      <EditorDeliveryActions
        articleId={initial.articleId}
        applyingPlanId={applyingPlanId}
        document={activeDocument}
        documentVersion={snapshot.documentVersion}
        onApplyLayout={handleApplyLayout}
        onPrepareImages={handlePrepareImages}
        saveStatus={snapshot.status}
        themes={themesQuery.data?.items ?? []}
      />

      <ArticleEditor
        applyingThemeId={applyingThemeId}
        currentThemeId={activeDocument.themeId ?? null}
        document={activeDocument}
        editable={controller !== null && snapshot.status !== "conflict" && !savingLayoutDraft}
        lockActionsEnabled={
          controller !== null &&
          snapshot.status !== "conflict" &&
          snapshot.status !== "saving" &&
          !savingLayoutDraft
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
