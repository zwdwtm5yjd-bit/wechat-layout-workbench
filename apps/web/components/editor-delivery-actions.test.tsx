// @vitest-environment jsdom

import type {
  AiLayoutCandidate,
  AiLayoutCandidateProfileId,
  AiLayoutDecision,
  AiLayoutDesignLanguageId,
  AiLayoutStatus,
  AiLayoutTemplateCatalogResult,
  AiLayoutTemplateSummary,
  GenerateAiLayoutResult,
} from "@wechat-layout/api-contracts";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateAiLayout, getAiLayoutStatus, getAiLayoutTemplates } from "../lib/ai-layout/client";
import {
  AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY,
  parseAiLayoutTemplatePreferences,
} from "../lib/ai-layout/template-preferences";
import { createResourceAccessUrl, listResources, uploadResource } from "../lib/resources/client";
import { EditorDeliveryActions } from "./editor-delivery-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../lib/ai-layout/client", () => ({
  generateAiLayout: vi.fn(),
  getAiLayoutStatus: vi.fn(),
  getAiLayoutTemplates: vi.fn(),
}));

vi.mock("./ai-template-library", () => ({
  AiTemplateLibrary: ({
    favoriteTemplateIds,
    onSelectTemplate,
    onToggleFavorite,
    recentTemplateIds,
    selectedTemplateId,
  }: {
    readonly favoriteTemplateIds: readonly string[];
    readonly onSelectTemplate: (templateId: string | null) => void;
    readonly onToggleFavorite: (templateId: string) => void;
    readonly recentTemplateIds: readonly string[];
    readonly selectedTemplateId: string | null;
  }) => (
    <div>
      <button onClick={() => onSelectTemplate("editorial-index-classic")} type="button">
        选择政务头版模板
      </button>
      <button onClick={() => onToggleFavorite("editorial-index-classic")} type="button">
        收藏政务头版模板
      </button>
      <span>{selectedTemplateId === null ? "未选模板" : `已选 ${selectedTemplateId}`}</span>
      <span>{`模板收藏 ${favoriteTemplateIds.length}`}</span>
      <span>{`最近模板 ${recentTemplateIds.join(",")}`}</span>
    </div>
  ),
}));

vi.mock("../lib/resources/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/resources/client")>("../lib/resources/client");
  return {
    ...actual,
    createResourceAccessUrl: vi.fn(),
    listResources: vi.fn(),
    uploadResource: vi.fn(),
  };
});

const providerStatus = {
  available: true,
  defaultProviderId: "deepseek",
  model: "deepseek-v4-flash",
  models: [
    {
      available: true,
      description: "日常排版",
      id: "deepseek",
      label: "DeepSeek",
      model: "deepseek-v4-flash",
    },
  ],
  provider: "deepseek",
} as const satisfies AiLayoutStatus;

const candidateProfiles = [
  ["editorial-index", "报刊导读型", "crimson-editorial"],
  ["briefing-cards", "简报卡片型", "civic-blue"],
  ["evidence-led", "数据证据型", "news-editorial"],
  ["minimal-longread", "极简长读型", "annual-report"],
  ["documentary-visual", "纪实图文型", "jade-oriental"],
  ["action-roadmap", "行动路线型", "minimal-blue"],
] as const satisfies readonly (readonly [
  AiLayoutCandidateProfileId,
  string,
  AiLayoutDesignLanguageId,
])[];

const selectedTemplate = {
  catalogCategoryId: "official-report",
  categoryLabel: "政务报告",
  contentClasses: ["government"],
  defaultLanguageId: "crimson-editorial",
  description: "报刊式导读与章节索引",
  imagePolicy: "optional",
  minimumSourceImages: 0,
  name: "政务头版",
  preferredLanguageIds: ["crimson-editorial"],
  previewKey: "editorial-index-classic",
  profileId: "editorial-index",
  rhythm: "balanced",
  sourceImageFallback: "text-first",
  strategyId: "editorial-index",
  structureLabel: "政务头版",
  tags: ["政务", "导读"],
  templateId: "editorial-index-classic",
  version: 1,
  visualIntensity: "balanced",
} as const satisfies AiLayoutTemplateSummary;

const templateCatalog = {
  catalogVersion: "2026.08.1",
  templates: [selectedTemplate],
} as const satisfies AiLayoutTemplateCatalogResult;

function decision(
  languageId: AiLayoutDesignLanguageId,
  label: string,
  variantSeed: number,
): AiLayoutDecision {
  return {
    blocks: [
      {
        blockId: "block_heading",
        componentId: "cmp_head_level1_numbered_002",
        reason: "建立首屏层级",
        treatment: "title",
      },
      {
        blockId: "block_paragraph",
        componentId: "cmp_notice_info_blue_001",
        reason: "强调正文重点",
        treatment: "callout",
      },
      {
        blockId: "block_quote",
        componentId: "cmp_quote_conclusion_card_003",
        reason: "突出金句",
        treatment: "quote",
      },
      {
        blockId: "block_bullet_list",
        componentId: null,
        reason: "保留行动清单",
        treatment: "list",
      },
    ],
    concept: `${label}测试概念`,
    designName: `${label}视觉方案`,
    designTokens: {
      accentColor: "#D29A54",
      bodyFontSize: 16,
      bodyLineHeight: 1.8,
      cardRadius: 8,
      mutedColor: "#667085",
      primaryColor: "#C1292E",
      sectionSpacing: 36,
      surfaceAltColor: "#FEF9F7",
      surfaceColor: "#FFFFFF",
      textColor: "#1A1210",
      titleAlign: "left",
    },
    dividerAfterBlockIds: ["block_paragraph"],
    dividerComponentId: "cmp_divider_solid_clean_001",
    footer: {
      componentId: "cmp_notice_info_blue_001",
      text: "原文保护已开启",
      title: "阅读提示",
    },
    hero: {
      componentId: "cmp_intro_bamboo_note_002",
      eyebrow: "AI 原创排版",
      footer: "六套结构对比",
      title: label,
    },
    languageId,
    rhythm: variantSeed % 2 === 0 ? "balanced" : "airy",
    variantSeed,
    visualAssets: [],
    visualIntensity: variantSeed % 2 === 0 ? "balanced" : "restrained",
  };
}

const candidates = candidateProfiles.map(
  ([profileId, structureLabel, languageId], index): AiLayoutCandidate => ({
    candidateId: `candidate-${profileId}`,
    decision: decision(languageId, structureLabel, index + 1),
    differenceHighlights: [`${structureLabel}首屏`, `${structureLabel}阅读节奏`],
    profileId,
    recommended: index === 0,
    structureLabel,
    ...(index === 0
      ? { templateId: selectedTemplate.templateId, templateVersion: selectedTemplate.version }
      : {}),
  }),
);

const generationResult = {
  ...providerStatus,
  candidates,
  decision: candidates[0]!.decision,
} satisfies GenerateAiLayoutResult;

function documentNeedingImages(): DocumentV1 {
  const document = structuredClone(documentV1Fixture) as DocumentV1;
  document.content.content = document.content.content.filter((node) => node.type !== "imageBlock");
  const paragraph = document.content.content.find((node) => node.type === "paragraph");
  if (paragraph === undefined || paragraph.type !== "paragraph") {
    throw new Error("fixture paragraph is required");
  }
  paragraph.content = [
    {
      type: "text",
      text: "团队深入项目现场，记录真实工作过程，围绕协作、质量与服务形成可复盘的实践路径。".repeat(
        45,
      ),
    },
  ];
  return document;
}

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(getAiLayoutStatus).mockResolvedValue(providerStatus);
  vi.mocked(getAiLayoutTemplates).mockResolvedValue(templateCatalog);
  vi.mocked(generateAiLayout).mockResolvedValue(generationResult);
  vi.mocked(listResources).mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
  vi.mocked(createResourceAccessUrl).mockResolvedValue({
    expiresAt: "2026-08-12T10:05:00.000Z",
    headers: {},
    url: "https://cdn.example.com/prepared-image.jpg",
  });
});

describe("EditorDeliveryActions AI candidate comparison", () => {
  it("keeps comparison guidance visible and exposes six mobile-snap structure previews", async () => {
    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={documentV1Fixture.articleId}
        document={structuredClone(documentV1Fixture)}
        documentVersion={1}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
        onPrepareImages={vi.fn().mockResolvedValue({
          document: structuredClone(documentV1Fixture),
          documentVersion: 1,
        })}
        saveStatus="saved"
        themes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "智能排版" }));
    fireEvent.click(screen.getByRole("tab", { name: /AI 原创/u }));

    const generateButton = await screen.findByRole("button", { name: "生成6套AI方案" });
    await waitFor(() => expect(generateButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(generateButton);

    expect(await screen.findByText("已生成 6 套可对比方案")).toBeTruthy();

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("overflow-hidden");
    expect(screen.getByRole("button", { name: "关闭快速排版" })).toBeTruthy();

    const comparisonTitle = screen.getByText("六套结构预演");
    expect(comparisonTitle.closest(".sticky")).toBeTruthy();
    expect(screen.getByText(/左右滑动逐套比较/u)).toBeTruthy();

    const track = screen.getByTestId("ai-candidate-comparison-track");
    expect(track.className).toContain("snap-x");
    expect(track.className).toContain("snap-mandatory");
    expect(track.className).toContain("lg:grid-cols-3");

    const cards = screen.getAllByRole("article", { name: /候选方案$/u });
    expect(cards).toHaveLength(6);
    expect(cards[0]!.className).toContain("snap-center");
    expect(cards[0]!.className).toContain("lg:w-auto");
    expect(screen.getAllByText("结构预演")).toHaveLength(6);
    expect(screen.getAllByText("非最终成稿")).toHaveLength(6);

    const firstCard = cards[0]!;
    expect(within(firstCard).getByText("章节组织").className).toContain("text-[11px]");
    expect(within(firstCard).getByText(/\d+ 个章节/u).className).toContain("text-[11px]");
  });

  it("sends the selected catalog template while still returning six AI candidates", async () => {
    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={documentV1Fixture.articleId}
        document={structuredClone(documentV1Fixture)}
        documentVersion={1}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
        onPrepareImages={vi.fn().mockResolvedValue({
          document: structuredClone(documentV1Fixture),
          documentVersion: 1,
        })}
        saveStatus="saved"
        themes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "智能排版" }));
    fireEvent.click(screen.getByRole("tab", { name: /AI 原创/u }));
    expect(await screen.findByText("未选模板")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "选择政务头版模板" }));
    expect(screen.getByText("已选 editorial-index-classic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "收藏政务头版模板" }));
    expect(screen.getByText("模板收藏 1")).toBeTruthy();

    const generateButton = screen.getByRole("button", { name: "生成6套AI方案" });
    await waitFor(() => expect(generateButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(generateButton);

    await waitFor(() =>
      expect(generateAiLayout).toHaveBeenCalledWith(
        documentV1Fixture.articleId,
        expect.objectContaining({
          mode: "original",
          preferredTemplateId: "editorial-index-classic",
        }),
      ),
    );
    expect(await screen.findByText("已生成 6 套可对比方案")).toBeTruthy();
    expect(screen.getAllByRole("article", { name: /候选方案$/u })).toHaveLength(6);
    expect(screen.getByText("模板 · 政务头版 · editorial-index-classic")).toBeTruthy();
    expect(screen.getByText("最近模板 editorial-index-classic")).toBeTruthy();
    expect(
      parseAiLayoutTemplatePreferences(
        window.localStorage.getItem(AI_LAYOUT_TEMPLATE_PREFERENCES_STORAGE_KEY),
      ),
    ).toMatchObject({
      favoriteTemplateIds: ["editorial-index-classic"],
      recentTemplateIds: ["editorial-index-classic"],
    });
  });

  it("prevents a rapid double click from consuming two AI requests", async () => {
    let resolveGeneration: (result: GenerateAiLayoutResult) => void = () => undefined;
    vi.mocked(generateAiLayout).mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      }),
    );
    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={documentV1Fixture.articleId}
        document={structuredClone(documentV1Fixture)}
        documentVersion={1}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
        onPrepareImages={vi.fn().mockResolvedValue({
          document: structuredClone(documentV1Fixture),
          documentVersion: 1,
        })}
        saveStatus="saved"
        themes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "智能排版" }));
    fireEvent.click(screen.getByRole("tab", { name: /AI 原创/u }));
    const generateButton = await screen.findByRole("button", { name: "生成6套AI方案" });
    await waitFor(() => expect(generateButton.hasAttribute("disabled")).toBe(false));
    act(() => {
      generateButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      generateButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(generateAiLayout).toHaveBeenCalledTimes(1));
    resolveGeneration(generationResult);
    expect(await screen.findByText("已生成 6 套可对比方案")).toBeTruthy();
  });

  it("discards an AI response when the generation settings change in flight", async () => {
    let resolveGeneration: (result: GenerateAiLayoutResult) => void = () => undefined;
    vi.mocked(generateAiLayout).mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      }),
    );
    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={documentV1Fixture.articleId}
        document={structuredClone(documentV1Fixture)}
        documentVersion={1}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
        onPrepareImages={vi.fn().mockResolvedValue({
          document: structuredClone(documentV1Fixture),
          documentVersion: 1,
        })}
        saveStatus="saved"
        themes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "智能排版" }));
    fireEvent.click(screen.getByRole("tab", { name: /AI 原创/u }));
    const generateButton = await screen.findByRole("button", { name: "生成6套AI方案" });
    await waitFor(() => expect(generateButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(generateButton);
    await waitFor(() => expect(generateAiLayout).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: /AI 定制/u }));
    await act(async () => {
      resolveGeneration(generationResult);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByText("已生成 6 套可对比方案")).toBeNull());
    expect(screen.queryAllByRole("article", { name: /候选方案$/u })).toHaveLength(0);
  });

  it("announces favorite pinning and removal to assistive technology", async () => {
    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={documentV1Fixture.articleId}
        document={structuredClone(documentV1Fixture)}
        documentVersion={1}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
        onPrepareImages={vi.fn().mockResolvedValue({
          document: structuredClone(documentV1Fixture),
          documentVersion: 1,
        })}
        saveStatus="saved"
        themes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "智能排版" }));
    fireEvent.click(screen.getByRole("tab", { name: /AI 原创/u }));
    const generateButton = await screen.findByRole("button", { name: "生成6套AI方案" });
    await waitFor(() => expect(generateButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(generateButton);
    await screen.findByText("已生成 6 套可对比方案");

    const status = screen.getByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "收藏纪实图文型结构并置顶" }));
    await waitFor(() => expect(status.textContent).toContain("已收藏“纪实图文型”并置顶候选列表。"));
    expect(screen.getByText("已收藏 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "取消收藏纪实图文型结构" }));
    await waitFor(() => expect(status.textContent).toContain("已取消收藏“纪实图文型”"));
    expect(screen.getByText("已收藏 0")).toBeTruthy();
  });

  it("saves a real uploaded image before AI generation and uses the new document version", async () => {
    const document = documentNeedingImages();
    const preparedDocument = structuredClone(document);
    const uploadedResourceId = "019c0fb5-7d53-7f66-bfb7-f70c0e462603";
    const uploadedResource = {
      id: uploadedResourceId,
      displayName: "项目现场.jpg",
      originalFilename: "项目现场.jpg",
      thumbnail: null,
    };
    vi.mocked(uploadResource).mockResolvedValue(uploadedResource as never);
    const onPrepareImages = vi.fn().mockResolvedValue({
      document: preparedDocument,
      documentVersion: 7,
    });

    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={document.articleId}
        document={document}
        documentVersion={4}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
        onPrepareImages={onPrepareImages}
        saveStatus="saved"
        themes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "智能排版" }));
    fireEvent.click(screen.getByRole("tab", { name: /AI 原创/u }));
    const uploadInput = await screen.findAllByLabelText(/上传图片$/u);
    const file = new File(["real image"], "项目现场.jpg", { type: "image/jpeg" });
    fireEvent.change(uploadInput[0]!, { target: { files: [file] } });

    expect(await screen.findByText("项目现场.jpg")).toBeTruthy();
    expect(uploadResource).toHaveBeenCalledWith(file);

    const generateButton = await screen.findByRole("button", { name: "生成6套AI方案" });
    await waitFor(() => expect(generateButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(generateButton);

    await waitFor(() => expect(onPrepareImages).toHaveBeenCalledTimes(1));
    expect(onPrepareImages).toHaveBeenCalledWith([
      expect.objectContaining({
        resourceId: uploadedResourceId,
        alt: "项目现场.jpg",
      }),
    ]);
    await waitFor(() =>
      expect(generateAiLayout).toHaveBeenCalledWith(
        document.articleId,
        expect.objectContaining({ baseDocumentVersion: 7, mode: "original" }),
      ),
    );
    expect(await screen.findByText("已生成 6 套可对比方案")).toBeTruthy();
  });
});
