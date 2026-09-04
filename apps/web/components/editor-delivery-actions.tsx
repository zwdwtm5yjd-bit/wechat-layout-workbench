"use client";

import {
  AI_LAYOUT_PROVIDER_IDS,
  type AiLayoutCandidate,
  type AiLayoutCandidateProfileId,
  type AiLayoutDecision,
  type AiLayoutProviderId,
  type AiLayoutTemplateId,
} from "@wechat-layout/api-contracts";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RenderOutput } from "../lib/copy/client";
import type { DocumentSaveSnapshot } from "../lib/documents/autosave";
import {
  analyzeDocumentLayout,
  createLayoutPlans,
  DESIGN_LANGUAGE_FAMILY_BY_ID,
  DESIGN_LANGUAGE_FAMILY_LABELS,
  layoutPlanFromAiDecision,
  type DesignLanguageFamily,
  type LayoutDesignMode,
  type LayoutPlan,
} from "../lib/layout-planner";
import { generateAiLayout, getAiLayoutStatus, getAiLayoutTemplates } from "../lib/ai-layout/client";
import { compareAiLayoutCandidate } from "../lib/ai-layout/candidate-comparison";
import { recommendAiLayoutTemplates } from "../lib/ai-layout/template-catalog";
import {
  AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY,
  parseAiLayoutTemplatePreferences,
  recordRecentAiLayoutTemplate,
  serializeAiLayoutTemplatePreferences,
  toggleAiLayoutTemplateFavorite,
  type AiLayoutTemplatePreferences,
} from "../lib/ai-layout/template-preferences";
import {
  countRealContentImages,
  createImagePreparationTasks,
  type PreparedImageSelection,
  type PreparedImagesSaveResult,
} from "../lib/ai-layout/image-preparation";
import {
  AI_LAYOUT_FAVORITES_STORAGE_KEY,
  orderAiLayoutCandidates,
  parseAiLayoutFavorites,
  serializeAiLayoutFavorites,
  toggleAiLayoutFavorite,
} from "../lib/ai-layout/favorites";
import type { OfficialTheme } from "../lib/themes/client";
import {
  createResourceAccessUrl,
  listResources,
  uploadResource,
  type Resource,
} from "../lib/resources/client";
import {
  Ban,
  CheckCircle2,
  ClipboardCopy,
  Copy,
  Eye,
  FileCheck2,
  Info,
  Images,
  LayoutTemplate,
  LoaderCircle,
  ImagePlus,
  ShieldAlert,
  Sparkles,
  Star,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { AiLayoutCandidatePreview } from "./ai-layout-candidate-preview";
import { AiTemplateLibrary } from "./ai-template-library";
import { WechatCopyPanel } from "./wechat-copy-panel";

interface EditorDeliveryActionsProps {
  readonly articleId: string;
  readonly applyingPlanId?: string | null;
  readonly document: DocumentV1;
  readonly documentVersion: number;
  readonly onApplyLayout: (
    plan: LayoutPlan,
    providerId: AiLayoutProviderId,
    decision?: AiLayoutDecision,
  ) => Promise<void>;
  readonly onPrepareImages: (
    selections: readonly PreparedImageSelection[],
  ) => Promise<PreparedImagesSaveResult>;
  readonly saveStatus: DocumentSaveSnapshot["status"];
  readonly themes: readonly OfficialTheme[];
}

type ImageTaskResolution =
  Readonly<{ status: "skipped" }> | Readonly<{ resource: Resource; status: "selected" }>;

function resourceLabel(resource: Resource): string {
  return resource.displayName ?? resource.originalFilename ?? "未命名图片";
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
  onPrepareImages,
  saveStatus,
  themes,
}: EditorDeliveryActionsProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [compatibilityOpen, setCompatibilityOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutDesignMode>("preset");
  const [languageFamily, setLanguageFamily] = useState<DesignLanguageFamily | "all">("all");
  const [providerId, setProviderId] = useState<AiLayoutProviderId>("auto");
  const [styleBrief, setStyleBrief] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<AiLayoutTemplateId | null>(null);
  const [templatePreferences, setTemplatePreferences] = useState<AiLayoutTemplatePreferences>(() =>
    parseAiLayoutTemplatePreferences(null),
  );
  const [aiCandidates, setAiCandidates] = useState<readonly AiLayoutCandidate[]>([]);
  const [favoriteProfileIds, setFavoriteProfileIds] = useState<
    readonly AiLayoutCandidateProfileId[]
  >([]);
  const [favoriteAnnouncement, setFavoriteAnnouncement] = useState("");
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [generatingCandidates, setGeneratingCandidates] = useState(false);
  const [imageTaskResolutions, setImageTaskResolutions] = useState<
    Readonly<Record<string, ImageTaskResolution>>
  >({});
  const [imageTaskError, setImageTaskError] = useState<string | null>(null);
  const [imageTaskSaving, setImageTaskSaving] = useState(false);
  const [uploadingImageTaskId, setUploadingImageTaskId] = useState<string | null>(null);
  const [resourcePickerTaskId, setResourcePickerTaskId] = useState<string | null>(null);
  const [copiedSearchTaskId, setCopiedSearchTaskId] = useState<string | null>(null);
  const candidateSectionRef = useRef<HTMLElement | null>(null);
  const candidateRequestGenerationRef = useRef(0);
  const imageTaskSavingRef = useRef(false);
  const generatingCandidatesRef = useRef(false);
  const [renderOutput, setRenderOutput] = useState<RenderOutput | null>(null);
  const aiStatusQuery = useQuery({
    queryKey: ["ai-layout-status"],
    queryFn: getAiLayoutStatus,
    staleTime: 60_000,
  });
  const aiTemplatesQuery = useQuery({
    queryKey: ["ai-layout-templates"],
    queryFn: getAiLayoutTemplates,
    enabled: layoutOpen && layoutMode !== "preset",
    staleTime: 5 * 60_000,
  });
  const aiTemplates = aiTemplatesQuery.data?.templates ?? [];
  const aiTemplateById = useMemo(
    () => new Map(aiTemplates.map((template) => [template.templateId, template] as const)),
    [aiTemplates],
  );
  const analysis = useMemo(() => analyzeDocumentLayout(document), [document]);
  const realContentImageCount = useMemo(() => countRealContentImages(document), [document]);
  const recommendedTemplateIds = useMemo(
    () =>
      recommendAiLayoutTemplates(aiTemplates, {
        articleTypeLabel: analysis.gene.articleTypeLabel,
        emotionLabel: analysis.gene.emotionLabel,
        keywords: analysis.gene.keywords,
        sourceImageCount: realContentImageCount,
      }).map((template) => template.templateId),
    [
      aiTemplates,
      analysis.gene.articleTypeLabel,
      analysis.gene.emotionLabel,
      analysis.gene.keywords,
      realContentImageCount,
    ],
  );
  const aiAvailable = aiStatusQuery.data?.available === true;
  const selectedModel = aiStatusQuery.data?.models.find((model) => model.id === providerId);
  const selectedProviderAvailable =
    providerId === "auto" ? aiAvailable : selectedModel?.available === true;
  const imagePreparationTasks = useMemo(() => createImagePreparationTasks(document), [document]);
  const resolvedImageTaskCount = imagePreparationTasks.filter(
    (task) => imageTaskResolutions[task.taskId] !== undefined,
  ).length;
  const selectedImageTaskCount = imagePreparationTasks.filter(
    (task) => imageTaskResolutions[task.taskId]?.status === "selected",
  ).length;
  const privateImagesQuery = useQuery({
    queryKey: ["image-preparation-private-resources"],
    queryFn: () => listResources({ resourceType: "image", status: "active", pageSize: 100 }),
    enabled: resourcePickerTaskId !== null,
    staleTime: 30_000,
  });
  const privateImages = privateImagesQuery.data?.items ?? [];
  const visiblePrivateImages = privateImages.slice(0, 30);
  const previewResources = [
    ...new Map(
      [
        ...visiblePrivateImages,
        ...Object.values(imageTaskResolutions).flatMap((resolution) =>
          resolution.status === "selected" ? [resolution.resource] : [],
        ),
      ].map((resource) => [resource.id, resource] as const),
    ).values(),
  ];
  const privateImageIdsKey = previewResources.map((resource) => resource.id).join(",");
  const privateImageUrlsQuery = useQuery({
    queryKey: ["image-preparation-private-resource-urls", privateImageIdsKey],
    enabled:
      (resourcePickerTaskId !== null || selectedImageTaskCount > 0) && previewResources.length > 0,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        previewResources.map(async (resource) => {
          try {
            const access = await createResourceAccessUrl(
              resource.id,
              resource.thumbnail === null ? "original" : "thumbnail",
            );
            return [resource.id, access.url] as const;
          } catch {
            return [resource.id, null] as const;
          }
        }),
      );
      return Object.fromEntries(
        entries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
      );
    },
  });
  const layoutPlans = useMemo(
    () => createLayoutPlans(document, themes, { brief: styleBrief, mode: layoutMode }),
    [document, layoutMode, styleBrief, themes],
  );
  const aiCandidatePlans = useMemo(() => {
    if (layoutMode === "preset" || aiCandidates.length === 0) return [];
    const sourcePlan = layoutPlans[0];
    if (sourcePlan === undefined) return [];
    return orderAiLayoutCandidates(aiCandidates, favoriteProfileIds).map((candidate) => ({
      candidate,
      plan: layoutPlanFromAiDecision(document, themes, sourcePlan, candidate.decision),
    }));
  }, [aiCandidates, document, favoriteProfileIds, layoutMode, layoutPlans, themes]);
  const visibleLayoutPlans = useMemo(
    () =>
      layoutMode !== "preset"
        ? aiCandidatePlans.map(({ plan }) => plan)
        : languageFamily === "all"
          ? layoutPlans
          : layoutPlans.filter(
              (plan) => DESIGN_LANGUAGE_FAMILY_BY_ID[plan.languageId] === languageFamily,
            ),
    [aiCandidatePlans, languageFamily, layoutMode, layoutPlans],
  );
  const aiCandidateByPlanId = useMemo(
    () => new Map(aiCandidatePlans.map(({ candidate, plan }) => [plan.id, candidate])),
    [aiCandidatePlans],
  );
  const comparisonBoardVisible = layoutMode !== "preset" && aiCandidatePlans.length > 0;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("guide") === "1") {
      setLayoutOpen(true);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("wechat-layout-ai-provider");
    if (AI_LAYOUT_PROVIDER_IDS.some((candidate) => candidate === stored)) {
      setProviderId(stored as AiLayoutProviderId);
    }
  }, []);

  useEffect(() => {
    try {
      setFavoriteProfileIds(
        parseAiLayoutFavorites(window.localStorage.getItem(AI_LAYOUT_FAVORITES_STORAGE_KEY)),
      );
    } catch {
      setFavoriteProfileIds([]);
    }
  }, []);

  useEffect(() => {
    setTemplatePreferences(
      parseAiLayoutTemplatePreferences(
        window.localStorage.getItem(AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY),
      ),
    );
  }, []);

  useEffect(() => {
    const catalog = aiTemplatesQuery.data;
    if (catalog === undefined) return;
    const allowedTemplateIds = new Set(catalog.templates.map((template) => template.templateId));
    setTemplatePreferences((current) => {
      const next = {
        ...parseAiLayoutTemplatePreferences(
          serializeAiLayoutTemplatePreferences(current),
          allowedTemplateIds,
        ),
        catalogVersion: catalog.catalogVersion,
      };
      try {
        window.localStorage.setItem(
          AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY,
          serializeAiLayoutTemplatePreferences(next),
        );
      } catch {
        // Storage can be disabled. Keep preferences for this browser session.
      }
      return next;
    });
  }, [aiTemplatesQuery.data]);

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

  useEffect(() => {
    candidateRequestGenerationRef.current += 1;
    setAiCandidates([]);
    setCandidateError(null);
  }, [documentVersion, layoutMode, providerId, selectedTemplateId, styleBrief]);

  useEffect(() => {
    if (
      selectedTemplateId !== null &&
      aiTemplatesQuery.data !== undefined &&
      !aiTemplateById.has(selectedTemplateId)
    ) {
      setSelectedTemplateId(null);
    }
  }, [aiTemplateById, aiTemplatesQuery.data, selectedTemplateId]);

  useEffect(() => {
    const validTaskIds = new Set(imagePreparationTasks.map((task) => task.taskId));
    setImageTaskResolutions((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([taskId, resolution]) => resolution.status === "skipped" && validTaskIds.has(taskId),
        ),
      ),
    );
    setImageTaskError(null);
    setResourcePickerTaskId(null);
  }, [document.documentId, documentVersion, imagePreparationTasks]);

  const selectedImageTaskInputs = (): readonly PreparedImageSelection[] =>
    imagePreparationTasks.flatMap((task) => {
      const resolution = imageTaskResolutions[task.taskId];
      if (resolution?.status !== "selected") return [];
      return [
        {
          taskId: task.taskId,
          afterBlockId: task.afterBlockId,
          resourceId: resolution.resource.id,
          alt: resourceLabel(resolution.resource).slice(0, 500),
        },
      ];
    });

  const savePreparedImages = async (): Promise<
    | Readonly<{ result: PreparedImagesSaveResult | null; success: true }>
    | Readonly<{ success: false }>
  > => {
    const selections = selectedImageTaskInputs();
    if (selections.length === 0) return { result: null, success: true };
    if (imageTaskSavingRef.current) return { success: false };
    imageTaskSavingRef.current = true;
    setImageTaskSaving(true);
    setImageTaskError(null);
    try {
      const result = await onPrepareImages(selections);
      setImageTaskResolutions({});
      return { result, success: true };
    } catch (error) {
      setImageTaskError(error instanceof Error ? error.message : "配图没有保存，请重试");
      return { success: false };
    } finally {
      imageTaskSavingRef.current = false;
      setImageTaskSaving(false);
    }
  };

  const resolveImageTask = (taskId: string, resolution: ImageTaskResolution): void => {
    setImageTaskResolutions((current) => ({ ...current, [taskId]: resolution }));
    setImageTaskError(null);
    setResourcePickerTaskId(null);
  };

  const uploadImageForTask = async (taskId: string, file: File): Promise<void> => {
    setUploadingImageTaskId(taskId);
    setImageTaskError(null);
    try {
      const resource = await uploadResource(file);
      resolveImageTask(taskId, { resource, status: "selected" });
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      await queryClient.invalidateQueries({ queryKey: ["editor-private-resources"] });
      await queryClient.invalidateQueries({ queryKey: ["image-preparation-private-resources"] });
    } catch (error) {
      setImageTaskError(error instanceof Error ? error.message : "图片上传失败，请重试");
    } finally {
      setUploadingImageTaskId(null);
    }
  };

  const continueToCandidates = async (): Promise<void> => {
    if (!(await savePreparedImages()).success) return;
    candidateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const generateCandidates = async (): Promise<void> => {
    if (
      layoutMode === "preset" ||
      saveStatus !== "saved" ||
      !selectedProviderAvailable ||
      generatingCandidates ||
      generatingCandidatesRef.current ||
      imageTaskSaving ||
      (layoutMode === "described" && styleBrief.trim().length < 3)
    ) {
      return;
    }
    generatingCandidatesRef.current = true;
    const requestGeneration = candidateRequestGenerationRef.current + 1;
    candidateRequestGenerationRef.current = requestGeneration;
    setGeneratingCandidates(true);
    setCandidateError(null);
    try {
      const preparation = await savePreparedImages();
      if (!preparation.success) return;
      const effectiveDocument = preparation.result?.document ?? document;
      const effectiveVersion = preparation.result?.documentVersion ?? documentVersion;
      const sourcePlan = createLayoutPlans(effectiveDocument, themes, {
        brief: styleBrief,
        mode: layoutMode,
      })[0];
      if (selectedTemplateId !== null) {
        setTemplatePreferences((current) => {
          const next = recordRecentAiLayoutTemplate(
            current,
            selectedTemplateId,
            aiTemplatesQuery.data?.catalogVersion,
          );
          try {
            window.localStorage.setItem(
              AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY,
              serializeAiLayoutTemplatePreferences(next),
            );
          } catch {
            // Storage can be disabled. Keep preferences for this browser session.
          }
          return next;
        });
      }
      const generated = await generateAiLayout(articleId, {
        baseDocumentVersion: effectiveVersion,
        mode: layoutMode,
        ...(sourcePlan === undefined ? {} : { preferredLanguageId: sourcePlan.languageId }),
        ...(selectedTemplateId === null ? {} : { preferredTemplateId: selectedTemplateId }),
        providerId,
        ...(layoutMode === "described" ? { styleBrief: styleBrief.trim() } : {}),
      });
      if (generated.candidates.length === 0) {
        throw new Error("AI 未返回可用的候选方案，请重新生成");
      }
      if (candidateRequestGenerationRef.current !== requestGeneration) return;
      setAiCandidates(generated.candidates.slice(0, 6));
    } catch (error) {
      if (candidateRequestGenerationRef.current === requestGeneration) {
        setCandidateError(error instanceof Error ? error.message : "AI 候选方案生成失败");
      }
    } finally {
      generatingCandidatesRef.current = false;
      setGeneratingCandidates(false);
    }
  };

  const toggleTemplateFavorite = (templateId: AiLayoutTemplateId): void => {
    setTemplatePreferences((current) => {
      const next = toggleAiLayoutTemplateFavorite(current, templateId);
      try {
        window.localStorage.setItem(
          AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY,
          serializeAiLayoutTemplatePreferences(next),
        );
      } catch {
        // Storage can be disabled. Keep preferences for this browser session.
      }
      return next;
    });
  };

  const toggleFavoriteProfile = (
    profileId: AiLayoutCandidateProfileId,
    structureLabel: string,
  ): void => {
    const wasFavorite = favoriteProfileIds.includes(profileId);
    const next = toggleAiLayoutFavorite(favoriteProfileIds, profileId);
    setFavoriteProfileIds(next);
    setFavoriteAnnouncement(
      wasFavorite
        ? `已取消收藏“${structureLabel}”，候选已按收藏和 AI 推荐重新排序。`
        : `已收藏“${structureLabel}”并置顶候选列表。`,
    );
    try {
      window.localStorage.setItem(
        AI_LAYOUT_FAVORITES_STORAGE_KEY,
        serializeAiLayoutFavorites(next),
      );
    } catch {
      // Storage can be disabled by the browser. Keep the favorite for this session.
    }
  };

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
            <p className="mt-0.5 truncate text-[11px] text-faint">预览 → 兼容检查 → 复制到公众号</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-3 text-[11px] font-medium text-ink transition-[background-color,border-color,color,transform] duration-150 hover:bg-hover active:scale-[0.96]"
            onClick={() => setLayoutOpen(true)}
            type="button"
          >
            <LayoutTemplate aria-hidden="true" size={14} />
            智能排版
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-3 text-[11px] font-medium text-ink transition-[background-color,border-color,color,transform] duration-150 hover:bg-hover active:scale-[0.96]"
            onClick={() => router.push(`/workspace/articles/${articleId}/preview`)}
            type="button"
          >
            <Eye aria-hidden="true" size={14} />
            预览
            <kbd className="text-[11px] text-faint">⌘P</kbd>
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-3 text-[11px] font-medium text-ink transition-[background-color,border-color,color,transform] duration-150 hover:bg-hover active:scale-[0.96]"
            onClick={() => setCompatibilityOpen(true)}
            type="button"
          >
            <ShieldAlert aria-hidden="true" size={14} />
            兼容检查
            {renderOutput === null ? null : (
              <span
                className={
                  renderOutput.canCopy
                    ? "rounded-full bg-success-soft px-1.5 py-0.5 text-[11px] text-success"
                    : "rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] text-danger"
                }
              >
                {renderOutput.compatibilityReport.score}
              </span>
            )}
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-control bg-accent px-3 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
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
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[min(1180px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card border border-line bg-panel shadow-raised sm:max-h-[92vh]">
            <div className="relative z-30 flex shrink-0 items-start justify-between gap-4 border-b border-line bg-panel px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <Dialog.Title className="text-base font-semibold text-ink">
                  让内容决定排版
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[11px] text-muted">
                  规则模式快速套用安全样式；AI 模式由服务端模型阅读全文后逐段设计，原文保持不变。
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="关闭快速排版"
                className="grid size-10 shrink-0 place-items-center rounded-control border border-transparent text-faint transition-[background-color,border-color,color,transform] duration-150 hover:border-line hover:bg-hover hover:text-ink active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                type="button"
              >
                <X aria-hidden="true" size={15} />
              </Dialog.Close>
            </div>
            <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
              {favoriteAnnouncement}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6 sm:pb-6">
              <div className="mt-5 rounded-control border border-accent/15 bg-accent-soft/35 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
                    {analysis.gene.articleTypeLabel}
                  </span>
                  <span className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-muted">
                    {analysis.gene.emotionLabel}
                  </span>
                  <span className="text-[11px] leading-5 text-muted">{analysis.gene.summary}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  {[
                    ["正文", `${analysis.characterCount.toLocaleString("zh-CN")} 字`],
                    ["章节", `${analysis.headingCount} 个标题`],
                    ["内容图片", `${realContentImageCount} 张`],
                    ["建议补图", `${imagePreparationTasks.length} 张`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[11px] text-faint">{label}</p>
                      <p className="mt-1 text-[12px] font-semibold text-ink">{value}</p>
                    </div>
                  ))}
                </div>
                {analysis.gene.structureSignals.length === 0 ? null : (
                  <p className="mt-3 text-[11px] leading-5 text-faint">
                    结构线索：{analysis.gene.structureSignals.join(" · ")}
                  </p>
                )}
              </div>
              <section className="mt-4 overflow-hidden rounded-card border border-line bg-panel">
                <div className="border-b border-line bg-panel-muted px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
                        <Images aria-hidden="true" size={16} />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold text-ink">2 · 配图准备</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted">
                          把缺图位置变成任务；上传的真实图片会参与下一步 AI 排版。
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-medium text-muted">
                      {imagePreparationTasks.length === 0
                        ? "已经图文平衡"
                        : `已处理 ${resolvedImageTaskCount}/${imagePreparationTasks.length}`}
                    </span>
                  </div>
                </div>

                {imagePreparationTasks.length === 0 ? (
                  <div className="flex items-start gap-3 p-4">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-success"
                      size={16}
                    />
                    <div>
                      <p className="text-[11px] font-semibold text-ink">当前图片密度已足够</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        无需为了凑数再加图，可直接选择排版方向。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 p-4 lg:grid-cols-2">
                    {imagePreparationTasks.map((task, index) => {
                      const resolution = imageTaskResolutions[task.taskId];
                      const selectedResource =
                        resolution?.status === "selected" ? resolution.resource : null;
                      const selectedUrl =
                        selectedResource === null
                          ? undefined
                          : privateImageUrlsQuery.data?.[selectedResource.id];
                      const pickerOpen = resourcePickerTaskId === task.taskId;
                      return (
                        <article
                          className={`rounded-control border p-3 ${
                            resolution === undefined
                              ? "border-line bg-panel"
                              : "border-accent/25 bg-accent-soft/40"
                          }`}
                          key={task.taskId}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-ink">
                                {String(index + 1).padStart(2, "0")} · {task.sectionLabel}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                                  {task.purposeLabel}
                                </span>
                                <span className="rounded-full bg-panel-muted px-2 py-0.5 text-[11px] text-muted">
                                  {task.aspectRatio === "portrait"
                                    ? "竖图"
                                    : task.aspectRatio === "square"
                                      ? "方图"
                                      : "横图"}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                                resolution?.status === "selected"
                                  ? "bg-success-soft text-success"
                                  : resolution?.status === "skipped"
                                    ? "bg-panel-muted text-faint"
                                    : "bg-warning-soft text-warning"
                              }`}
                            >
                              {resolution?.status === "selected"
                                ? "已选图"
                                : resolution?.status === "skipped"
                                  ? "已略过"
                                  : "待补图"}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-muted">{task.reason}</p>

                          <div className="mt-2 flex items-center gap-2 rounded-md bg-panel-muted px-2.5 py-2">
                            <p className="min-w-0 flex-1 truncate text-[11px] text-muted">
                              搜图词：
                              <span className="font-medium text-ink">{task.searchQuery}</span>
                            </p>
                            <button
                              aria-label={`复制搜图词 ${task.searchQuery}`}
                              className="grid size-10 shrink-0 place-items-center rounded-md bg-panel text-faint transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-accent active:scale-[0.96]"
                              onClick={() => {
                                void navigator.clipboard
                                  .writeText(task.searchQuery)
                                  .then(() => setCopiedSearchTaskId(task.taskId))
                                  .catch(() => setImageTaskError("无法复制搜图词，请手动选中复制"));
                              }}
                              type="button"
                            >
                              {copiedSearchTaskId === task.taskId ? (
                                <CheckCircle2
                                  aria-hidden="true"
                                  className="text-success"
                                  size={12}
                                />
                              ) : (
                                <Copy aria-hidden="true" size={12} />
                              )}
                            </button>
                          </div>

                          {selectedResource === null ? null : (
                            <div className="mt-3 flex items-center gap-3 rounded-md border border-line bg-panel p-2">
                              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-panel-muted">
                                {selectedUrl === undefined ? (
                                  <Images aria-hidden="true" className="text-faint" size={16} />
                                ) : (
                                  <img
                                    alt={resourceLabel(selectedResource)}
                                    className="h-full w-full object-cover"
                                    src={selectedUrl}
                                  />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-semibold text-ink">
                                  {resourceLabel(selectedResource)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-success">将插入该内容之后</p>
                              </div>
                              <button
                                aria-label={`移除${task.sectionLabel}已选图片`}
                                className="min-h-10 shrink-0 rounded-md px-2 text-[11px] text-muted transition-[background-color,color,transform] duration-150 hover:bg-danger-soft hover:text-danger active:scale-[0.96]"
                                onClick={() =>
                                  setImageTaskResolutions((current) => {
                                    const next = { ...current };
                                    delete next[task.taskId];
                                    return next;
                                  })
                                }
                                type="button"
                              >
                                移除
                              </button>
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-3 gap-1.5">
                            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-md bg-accent px-1 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent active:scale-[0.96]">
                              {uploadingImageTaskId === task.taskId ? (
                                <LoaderCircle
                                  aria-hidden="true"
                                  className="animate-spin"
                                  size={11}
                                />
                              ) : (
                                <UploadCloud aria-hidden="true" size={11} />
                              )}
                              {selectedResource === null ? "上传图片" : "换一张"}
                              <input
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                aria-label={`为${task.sectionLabel}上传图片`}
                                className="sr-only"
                                disabled={uploadingImageTaskId !== null || imageTaskSaving}
                                onChange={(event) => {
                                  const file = event.currentTarget.files?.[0];
                                  if (file !== undefined)
                                    void uploadImageForTask(task.taskId, file);
                                  event.currentTarget.value = "";
                                }}
                                type="file"
                              />
                            </label>
                            <button
                              aria-expanded={pickerOpen}
                              aria-label={`为${task.sectionLabel}从我的素材选择图片`}
                              className="min-h-10 rounded-md border border-line bg-panel px-1 text-[11px] font-medium text-ink transition-[background-color,border-color,color,transform] duration-150 hover:bg-hover active:scale-[0.96]"
                              onClick={() =>
                                setResourcePickerTaskId((current) =>
                                  current === task.taskId ? null : task.taskId,
                                )
                              }
                              type="button"
                            >
                              我的素材
                            </button>
                            <button
                              aria-label={`${task.sectionLabel}这处不配图`}
                              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-line bg-panel px-1 text-[11px] font-medium text-muted transition-[background-color,border-color,color,transform] duration-150 hover:bg-hover active:scale-[0.96]"
                              onClick={() => resolveImageTask(task.taskId, { status: "skipped" })}
                              type="button"
                            >
                              <Ban aria-hidden="true" size={10} />
                              这处不配
                            </button>
                          </div>

                          {pickerOpen ? (
                            <div className="mt-3 rounded-md border border-line bg-panel p-2">
                              {privateImagesQuery.isPending ? (
                                <p className="py-4 text-center text-[11px] text-muted">
                                  正在读取我的素材…
                                </p>
                              ) : privateImagesQuery.isError ? (
                                <div className="py-4 text-center">
                                  <p className="text-[11px] text-danger">我的素材暂时无法读取</p>
                                  <button
                                    className="mt-2 min-h-10 rounded-md px-3 text-[11px] font-medium text-accent transition-[background-color,color,transform] duration-150 hover:bg-accent-soft hover:underline active:scale-[0.96]"
                                    onClick={() => void privateImagesQuery.refetch()}
                                    type="button"
                                  >
                                    重新加载
                                  </button>
                                </div>
                              ) : privateImages.length === 0 ? (
                                <p className="py-4 text-center text-[11px] text-faint">
                                  我的素材还没有图片，可直接上传。
                                </p>
                              ) : (
                                <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto">
                                  {visiblePrivateImages.map((resource) => {
                                    const url = privateImageUrlsQuery.data?.[resource.id];
                                    return (
                                      <button
                                        className="min-h-10 overflow-hidden rounded-md border border-line bg-panel-muted text-left transition-[background-color,border-color,transform] duration-150 hover:border-accent active:scale-[0.96]"
                                        key={resource.id}
                                        onClick={() =>
                                          resolveImageTask(task.taskId, {
                                            resource,
                                            status: "selected",
                                          })
                                        }
                                        type="button"
                                      >
                                        <span className="grid aspect-square place-items-center overflow-hidden">
                                          {url === undefined ? (
                                            <Images
                                              aria-hidden="true"
                                              className="text-faint"
                                              size={14}
                                            />
                                          ) : (
                                            <img
                                              alt={resourceLabel(resource)}
                                              className="h-full w-full border border-line object-cover"
                                              loading="lazy"
                                              src={url}
                                            />
                                          )}
                                        </span>
                                        <span className="block truncate border-t border-line px-1.5 py-1.5 text-[11px] text-ink">
                                          {resourceLabel(resource)}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}

                {imagePreparationTasks.length === 0 ? null : (
                  <div className="flex flex-col gap-3 border-t border-line bg-panel-muted p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] leading-5 text-muted">
                      {selectedImageTaskCount > 0
                        ? `已选 ${selectedImageTaskCount} 张真实图片，保存后 AI 会重新阅读全文与图片。`
                        : "图片不是必填项；可明确略过，不会生成空白占位图。"}
                    </p>
                    <button
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={
                        saveStatus !== "saved" || imageTaskSaving || uploadingImageTaskId !== null
                      }
                      onClick={() => void continueToCandidates()}
                      type="button"
                    >
                      {imageTaskSaving ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" size={12} />
                      ) : (
                        <Sparkles aria-hidden="true" size={12} />
                      )}
                      {imageTaskSaving
                        ? "正在保存配图…"
                        : selectedImageTaskCount > 0
                          ? `保存 ${selectedImageTaskCount} 张配图并继续`
                          : "先用现有图片继续"}
                    </button>
                  </div>
                )}
                {imageTaskError === null ? null : (
                  <p
                    className="border-t border-danger/15 bg-danger-soft px-4 py-2.5 text-[11px] text-danger"
                    role="alert"
                  >
                    {imageTaskError}
                  </p>
                )}
              </section>
              <div
                ref={(node) => {
                  candidateSectionRef.current = node;
                }}
                className="mt-5 grid gap-2 sm:grid-cols-3"
                role="tablist"
                aria-label="排版生成方式"
              >
                {(
                  [
                    ["preset", "快速规则", "不用模型，从 18 种安全设计语言中选择"],
                    ["described", "AI 定制", "说出感觉，由模型逐段设计"],
                    ["original", "AI 原创", "模型阅读全文后自主设计"],
                  ] as const
                ).map(([mode, label, description]) => (
                  <button
                    aria-selected={layoutMode === mode}
                    className={`min-h-10 rounded-control border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.96] ${
                      layoutMode === mode
                        ? "border-accent bg-accent-soft ring-2 ring-accent/10"
                        : "border-line bg-panel hover:border-line-strong"
                    }`}
                    key={mode}
                    onClick={() => {
                      candidateRequestGenerationRef.current += 1;
                      setLayoutMode(mode);
                    }}
                    role="tab"
                    type="button"
                  >
                    <span className="block text-[11px] font-semibold text-ink">{label}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-muted">
                      {description}
                    </span>
                  </button>
                ))}
              </div>
              {layoutMode === "preset" ? null : (
                <section className="mt-4 rounded-control border border-line bg-panel-muted p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-ink">选择排版大模型</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        自动选择会优先使用 DeepSeek，失败时依次切换通义千问和 Kimi。
                      </p>
                    </div>
                    <span className="rounded-full bg-success-soft px-2 py-1 text-[11px] font-medium text-success">
                      {aiStatusQuery.data?.models.filter((model) => model.available).length ?? 0}{" "}
                      个节点可用
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      aria-pressed={providerId === "auto"}
                      className={`min-h-10 rounded-control border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.96] ${
                        providerId === "auto"
                          ? "border-accent bg-panel ring-2 ring-accent/10"
                          : "border-line bg-panel hover:border-line-strong"
                      }`}
                      disabled={!aiAvailable}
                      onClick={() => {
                        candidateRequestGenerationRef.current += 1;
                        setProviderId("auto");
                        window.localStorage.setItem("wechat-layout-ai-provider", "auto");
                      }}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-ink">
                        自动选择
                        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                          推荐
                        </span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-muted">
                        自动容灾，优先低成本节点
                      </span>
                    </button>
                    {(aiStatusQuery.data?.models ?? []).map((model) => (
                      <button
                        aria-pressed={providerId === model.id}
                        className={`min-h-10 rounded-control border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45 ${
                          providerId === model.id
                            ? "border-accent bg-panel ring-2 ring-accent/10"
                            : "border-line bg-panel hover:border-line-strong"
                        }`}
                        disabled={!model.available}
                        key={model.id}
                        onClick={() => {
                          candidateRequestGenerationRef.current += 1;
                          setProviderId(model.id);
                          window.localStorage.setItem("wechat-layout-ai-provider", model.id);
                        }}
                        type="button"
                      >
                        <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-ink">
                          {model.label}
                          <span
                            className={`size-1.5 rounded-full ${model.available ? "bg-success" : "bg-faint"}`}
                          />
                        </span>
                        <span className="mt-1 block text-[11px] leading-5 text-muted">
                          {model.description}
                        </span>
                        <span className="mt-1 block truncate font-mono text-[11px] text-faint">
                          {model.model}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {layoutMode === "described" ? (
                <label className="mt-4 block rounded-control border border-line bg-panel-muted p-4">
                  <span className="text-[11px] font-semibold text-ink">你想要什么感觉？</span>
                  <textarea
                    className="mt-2 min-h-20 w-full resize-y rounded-control border border-line bg-panel px-3 py-2 text-base leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-2 focus:ring-accent/15 sm:text-[11px] sm:leading-5"
                    maxLength={300}
                    onChange={(event) => {
                      candidateRequestGenerationRef.current += 1;
                      setStyleBrief(event.currentTarget.value);
                    }}
                    placeholder="例如：温暖的杂志感，米白底色，标题有手工纸气质，金句突出但不要太花。"
                    value={styleBrief}
                  />
                  <span className="mt-1 block text-right text-[11px] text-faint">
                    {styleBrief.length}/300
                  </span>
                </label>
              ) : null}
              {layoutMode === "original" ? (
                <div className="mt-4 rounded-control border border-accent/20 bg-accent-soft p-4 text-[11px] leading-5 text-muted">
                  模型会逐段决定哪些是标题、章节、导语、金句、数据卡和转场，再选择视觉语言。
                  不再使用内容指纹假装 AI，也不会插入占位图集。
                </div>
              ) : null}
              {layoutMode === "preset" ? null : (
                <AiTemplateLibrary
                  errorMessage={
                    aiTemplatesQuery.isError && aiTemplatesQuery.data === undefined
                      ? "AI 模板库暂时无法读取，仍可不选模板直接生成。"
                      : null
                  }
                  favoriteTemplateIds={templatePreferences.favoriteTemplateIds}
                  loading={aiTemplatesQuery.isPending}
                  onSelectTemplate={(templateId) => {
                    candidateRequestGenerationRef.current += 1;
                    setSelectedTemplateId(templateId);
                  }}
                  onToggleFavorite={toggleTemplateFavorite}
                  recentTemplateIds={templatePreferences.recentTemplateIds}
                  recommendedTemplateIds={recommendedTemplateIds}
                  selectedTemplateId={selectedTemplateId}
                  sourceImageCount={realContentImageCount}
                  templates={aiTemplates}
                />
              )}
              {layoutMode === "preset" || selectedProviderAvailable ? null : (
                <div className="mt-4 rounded-control border border-warning/25 bg-warning-soft p-4 text-[11px] leading-5 text-warning">
                  {providerId === "auto"
                    ? "尚未连接可用的 AI 模型。"
                    : `${selectedModel?.label ?? "所选模型"} 尚未配置。`}
                  请切换到已连接的模型后再生成。
                </div>
              )}
              {layoutMode === "preset" ? null : (
                <section className="mt-4 rounded-card border border-line bg-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-ink">
                        {aiCandidates.length > 0
                          ? `已生成 ${aiCandidates.length} 套可对比方案`
                          : "一次生成 6 种结构方向"}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        模型只阅读全文一次，再派生六种结构表达，不会为每张卡重复消耗额度。
                      </p>
                    </div>
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={
                        saveStatus !== "saved" ||
                        !selectedProviderAvailable ||
                        generatingCandidates ||
                        imageTaskSaving ||
                        (layoutMode === "described" && styleBrief.trim().length < 3)
                      }
                      onClick={() => void generateCandidates()}
                      type="button"
                    >
                      {generatingCandidates ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
                      ) : (
                        <Sparkles aria-hidden="true" size={13} />
                      )}
                      {generatingCandidates
                        ? "正在设计6种方向…"
                        : aiCandidates.length > 0
                          ? "重新生成6套"
                          : "生成6套AI方案"}
                    </button>
                  </div>
                  {aiCandidates.length === 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {["报刊导读", "简报卡片", "数据证据", "极简长读", "纪实图文", "行动路线"].map(
                        (label) => (
                          <span
                            className="rounded-full border border-line bg-panel-muted px-2.5 py-1 text-[11px] font-medium text-muted"
                            key={label}
                          >
                            {label}
                          </span>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] leading-5 text-muted">
                      下方统一对比首屏结构、章节、重点卡、图片策略和阅读节奏；星标会在当前浏览器置顶喜欢的方向。
                    </p>
                  )}
                  {candidateError === null ? null : (
                    <p className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-[11px] leading-5 text-danger">
                      {candidateError}
                    </p>
                  )}
                </section>
              )}
              {layoutMode === "preset" ? (
                <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-control border border-line bg-panel-muted p-2">
                  <button
                    aria-pressed={languageFamily === "all"}
                    className={`min-h-10 rounded-md px-3 py-1.5 text-[11px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
                      languageFamily === "all"
                        ? "bg-accent text-white"
                        : "bg-panel text-muted hover:text-ink"
                    }`}
                    onClick={() => setLanguageFamily("all")}
                    type="button"
                  >
                    全部 · {layoutPlans.length}
                  </button>
                  {Object.entries(DESIGN_LANGUAGE_FAMILY_LABELS).map(([family, label]) => {
                    const familyId = family as DesignLanguageFamily;
                    const count = layoutPlans.filter(
                      (plan) => DESIGN_LANGUAGE_FAMILY_BY_ID[plan.languageId] === familyId,
                    ).length;
                    return (
                      <button
                        aria-pressed={languageFamily === familyId}
                        className={`min-h-10 rounded-md px-3 py-1.5 text-[11px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
                          languageFamily === familyId
                            ? "bg-accent text-white"
                            : "bg-panel text-muted hover:text-ink"
                        }`}
                        key={familyId}
                        onClick={() => setLanguageFamily(familyId)}
                        type="button"
                      >
                        {label} · {count}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {comparisonBoardVisible ? (
                <div className="sticky top-0 z-20 -mx-1 mt-4 flex items-center justify-between gap-3 rounded-control border border-line bg-panel/95 px-3 py-2.5 shadow-subtle backdrop-blur">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-ink">六套结构预演</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted">
                      <span className="lg:hidden">左右滑动逐套比较；</span>
                      预演用于看结构方向，应用后才生成可继续编辑的成稿。
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-panel-muted px-2.5 py-1 text-[11px] font-medium text-muted">
                    已收藏 {favoriteProfileIds.length}
                  </span>
                </div>
              ) : null}
              <div
                className={
                  comparisonBoardVisible
                    ? "-mx-1 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0"
                    : `mt-5 grid gap-3 ${visibleLayoutPlans.length === 1 ? "mx-auto max-w-xl" : "lg:grid-cols-3"}`
                }
                data-testid={comparisonBoardVisible ? "ai-candidate-comparison-track" : undefined}
              >
                {visibleLayoutPlans.map((plan) => {
                  const applying = applyingPlanId === plan.id;
                  const candidate = aiCandidateByPlanId.get(plan.id);
                  const candidateTemplate =
                    candidate?.templateId === undefined
                      ? undefined
                      : aiTemplateById.get(candidate.templateId);
                  const recommended =
                    layoutMode === "preset" ? plan.recommended : candidate?.recommended === true;
                  const comparison =
                    candidate === undefined ? null : compareAiLayoutCandidate(candidate);
                  const favorite =
                    candidate === undefined
                      ? false
                      : favoriteProfileIds.includes(candidate.profileId);
                  return (
                    <article
                      aria-label={
                        candidate === undefined ? undefined : `${candidate.structureLabel}候选方案`
                      }
                      className={`flex min-h-full flex-col overflow-hidden rounded-card border bg-panel p-4 ${
                        comparisonBoardVisible
                          ? "w-[82vw] max-w-[360px] shrink-0 snap-center lg:w-auto lg:max-w-none lg:shrink lg:snap-none"
                          : ""
                      } ${recommended ? "border-accent ring-2 ring-accent/10" : "border-line"}`}
                      key={plan.id}
                    >
                      <div className="flex min-h-7 items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          {plan.accentColors.slice(0, 3).map((color) => (
                            <span
                              className="h-2 w-8 rounded-full"
                              key={color}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {candidate === undefined ? null : (
                            <button
                              aria-label={
                                favorite
                                  ? `取消收藏${candidate.structureLabel}结构`
                                  : `收藏${candidate.structureLabel}结构并置顶`
                              }
                              aria-pressed={favorite}
                              className={`grid size-10 place-items-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
                                favorite
                                  ? "bg-warning-soft text-warning"
                                  : "bg-panel-muted text-faint hover:text-warning"
                              } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                              onClick={() =>
                                toggleFavoriteProfile(candidate.profileId, candidate.structureLabel)
                              }
                              title={favorite ? "已在当前浏览器收藏" : "收藏并置顶"}
                              type="button"
                            >
                              <Star
                                aria-hidden="true"
                                fill={favorite ? "currentColor" : "none"}
                                size={13}
                              />
                            </button>
                          )}
                          {recommended ? (
                            <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
                              {layoutMode === "preset" ? "内容匹配" : "AI 首选"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {candidate === undefined ? null : (
                        <div className="mt-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
                              结构预演
                            </span>
                            <span className="text-[11px] text-faint">非最终成稿</span>
                          </div>
                          <AiLayoutCandidatePreview candidate={candidate} plan={plan} />
                        </div>
                      )}
                      <p className="mt-4 text-[14px] font-semibold text-ink">{plan.designName}</p>
                      <p className="mt-1 text-[11px] font-medium text-accent">
                        {candidate === undefined
                          ? `${plan.languageName} · ${plan.tone}`
                          : `${candidate.structureLabel} · ${plan.languageName}`}
                      </p>
                      {candidate?.templateId === undefined ? null : (
                        <p
                          className="mt-1 truncate font-mono text-[11px] text-faint"
                          title={`${candidateTemplate?.name ?? candidate.structureLabel} · ${candidate.templateId}`}
                        >
                          模板 · {candidateTemplate?.name ?? candidate.structureLabel} ·{" "}
                          {candidate.templateId}
                        </p>
                      )}
                      <p className="mt-3 text-[11px] leading-5 text-muted">{plan.description}</p>
                      {comparison === null ? (
                        <p className="mt-2 rounded-md bg-panel-muted px-2.5 py-2 text-[11px] leading-5 text-faint">
                          {plan.reasoning}
                        </p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-control bg-line">
                          {[
                            ["章节组织", `${comparison.sectionCount} 个章节`],
                            ["重点强调", `${comparison.emphasisCount} 个卡片`],
                            [
                              "图片策略",
                              `${comparison.imageStrategy} · ${comparison.imageCount} 张`,
                            ],
                            [
                              "阅读感受",
                              `${comparison.rhythmLabel} · ${comparison.visualIntensityLabel}`,
                            ],
                          ].map(([label, value]) => (
                            <div className="bg-panel-muted px-2.5 py-2" key={label}>
                              <p className="text-[11px] leading-4 text-faint">{label}</p>
                              <p
                                className="mt-1 break-words text-[11px] leading-4 font-semibold text-ink"
                                title={value}
                              >
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      <ul className="mt-3 flex-1 space-y-1.5 text-[11px] text-muted">
                        {(candidate?.differenceHighlights ?? plan.highlights)
                          .slice(0, candidate === undefined ? undefined : 2)
                          .map((highlight) => (
                            <li className="flex items-center gap-1.5" key={highlight}>
                              <Sparkles aria-hidden="true" className="text-accent" size={10} />
                              {highlight}
                            </li>
                          ))}
                      </ul>
                      <button
                        className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-control bg-accent text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={
                          saveStatus !== "saved" ||
                          applyingPlanId !== null ||
                          plan.theme === null ||
                          (layoutMode !== "preset" && !selectedProviderAvailable) ||
                          (layoutMode === "described" && styleBrief.trim().length < 3)
                        }
                        onClick={() => {
                          void onApplyLayout(plan, providerId, candidate?.decision)
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
                        {applying
                          ? "正在生成成稿…"
                          : layoutMode !== "preset" && !selectedProviderAvailable
                            ? "模型未连接"
                            : layoutMode === "preset"
                              ? "应用这套设计语言"
                              : "应用这套 AI 候选"}
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-[11px] text-faint">
                应用前自动保存安全快照；应用后仍可拖动区块、局部改样式、上传并保存自己的素材。
              </p>
            </div>
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
                className="grid size-10 place-items-center rounded-control border border-transparent text-faint transition-[background-color,border-color,color,transform] duration-150 hover:border-line hover:bg-hover hover:text-ink active:scale-[0.96]"
                type="button"
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
                    className="mt-5 min-h-10 rounded-control bg-accent px-4 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.96] disabled:opacity-45"
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
                      <p className="mt-1 text-[11px] text-muted">
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
                        <span className="text-[11px] text-faint">{issues.length}</span>
                      </div>
                      <ul className="space-y-2">
                        {issues.map((issue) => (
                          <li
                            className="rounded-control border border-line bg-panel-muted p-3"
                            key={issue.issueId}
                          >
                            <p className="text-[11px] font-semibold text-ink">{issue.title}</p>
                            <p className="mt-1 text-[11px] leading-5 text-muted">{issue.message}</p>
                            {issue.blockId === undefined ? null : (
                              <p className="mt-1 font-mono text-[11px] text-faint">
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
              className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-control border border-line bg-panel text-faint shadow-subtle transition-[background-color,border-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.96]"
              type="button"
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
