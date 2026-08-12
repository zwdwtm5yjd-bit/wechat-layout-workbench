// @vitest-environment jsdom

import type {
  AiLayoutCandidate,
  AiLayoutCandidateProfileId,
  AiLayoutDecision,
  AiLayoutDesignLanguageId,
  AiLayoutStatus,
  GenerateAiLayoutResult,
} from "@wechat-layout/api-contracts";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateAiLayout, getAiLayoutStatus } from "../lib/ai-layout/client";
import { EditorDeliveryActions } from "./editor-delivery-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../lib/ai-layout/client", () => ({
  generateAiLayout: vi.fn(),
  getAiLayoutStatus: vi.fn(),
}));

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
  }),
);

const generationResult = {
  ...providerStatus,
  candidates,
  decision: candidates[0]!.decision,
} satisfies GenerateAiLayoutResult;

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
  vi.mocked(generateAiLayout).mockResolvedValue(generationResult);
});

describe("EditorDeliveryActions AI candidate comparison", () => {
  it("keeps comparison guidance visible and exposes six mobile-snap structure previews", async () => {
    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={documentV1Fixture.articleId}
        document={structuredClone(documentV1Fixture)}
        documentVersion={1}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
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
    expect(within(firstCard).getByText("章节组织").className).toContain("text-[10px]");
    expect(within(firstCard).getByText(/\d+ 个章节/u).className).toContain("text-[11px]");
  });

  it("announces favorite pinning and removal to assistive technology", async () => {
    renderWithQueryClient(
      <EditorDeliveryActions
        articleId={documentV1Fixture.articleId}
        document={structuredClone(documentV1Fixture)}
        documentVersion={1}
        onApplyLayout={vi.fn().mockResolvedValue(undefined)}
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
});
