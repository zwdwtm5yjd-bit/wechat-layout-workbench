// @vitest-environment jsdom

import type {
  AiLayoutCandidate,
  AiLayoutCandidateProfileId,
  AiLayoutDecision,
} from "@wechat-layout/api-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LayoutPlan } from "../lib/layout-planner";
import { AiLayoutCandidatePreview } from "./ai-layout-candidate-preview";

const profileIds: readonly AiLayoutCandidateProfileId[] = [
  "editorial-index",
  "briefing-cards",
  "evidence-led",
  "minimal-longread",
  "documentary-visual",
  "action-roadmap",
];

afterEach(cleanup);

const plan = {
  designTokens: {
    accentColor: "#D29A54",
    mutedColor: "#667085",
    primaryColor: "#C1292E",
    surfaceColor: "#FFFFFF",
  },
} as LayoutPlan;

function decision(overrides: Partial<AiLayoutDecision> = {}): AiLayoutDecision {
  return {
    blocks: [
      { blockId: "title", componentId: null, reason: "", treatment: "title" },
      { blockId: "section", componentId: null, reason: "", treatment: "section" },
      { blockId: "quote", componentId: null, reason: "", treatment: "quote" },
      { blockId: "image", componentId: null, reason: "", treatment: "image" },
    ],
    concept: "结构化预演",
    designName: "编辑预演",
    designTokens: {
      accentColor: "#D29A54",
      bodyFontSize: 16,
      bodyLineHeight: 1.8,
      cardRadius: 8,
      mutedColor: "#667085",
      primaryColor: "#C1292E",
      sectionSpacing: 28,
      surfaceAltColor: "#F8F5F0",
      surfaceColor: "#FFFFFF",
      textColor: "#1D2939",
      titleAlign: "left",
    },
    dividerAfterBlockIds: ["section"],
    dividerComponentId: "cmp_divider_solid_clean_001",
    footer: {
      componentId: "cmp_notice_info_blue_001",
      text: "收束语",
      title: "结语",
    },
    hero: {
      componentId: "cmp_hero_ink_mountain_001",
      eyebrow: "导读",
      footer: "文章摘要",
      title: "当前文章标题",
    },
    imagePlacements: [
      {
        afterBlockId: null,
        imageBlockId: "image",
        mode: "keep-original",
        reason: "保留原图",
        resourceId: "resource-image",
      },
    ],
    languageId: "crimson-editorial",
    rhythm: "balanced",
    variantSeed: 17,
    visualAssets: [],
    visualIntensity: "restrained",
    ...overrides,
  };
}

function candidate(
  profileId: AiLayoutCandidateProfileId,
  overrides: Partial<AiLayoutCandidate> = {},
): AiLayoutCandidate {
  return {
    candidateId: `candidate-${profileId}`,
    decision: decision(),
    differenceHighlights: [],
    profileId,
    recommended: false,
    structureLabel: profileId,
    ...overrides,
  };
}

describe("AI layout candidate preview", () => {
  it.each(profileIds)("renders a visual comparison for %s", (profileId) => {
    render(<AiLayoutCandidatePreview candidate={candidate(profileId)} plan={plan} />);

    expect(screen.getByRole("img", { name: `${profileId}结构预演` })).toBeTruthy();
    expect(screen.getByText("结构预演 · 当前文章")).toBeTruthy();
  });

  it("renders hero, dividers, block sequence, rhythm and intensity from the decision", () => {
    render(<AiLayoutCandidatePreview candidate={candidate("evidence-led")} plan={plan} />);

    const preview = screen.getByRole("img", { name: "evidence-led结构预演" });
    expect(preview.getAttribute("data-block-pattern")).toBe("title,section,quote,image");
    expect(preview.getAttribute("data-divider-count")).toBe("1");
    expect(preview.getAttribute("data-rhythm")).toBe("balanced");
    expect(preview.getAttribute("data-visual-intensity")).toBe("restrained");
    expect(preview.querySelector('[data-hero-component="cmp_hero_ink_mountain_001"]')).toBeTruthy();
    expect(
      preview.querySelector('[data-divider-component="cmp_divider_solid_clean_001"]'),
    ).toBeTruthy();
    expect(preview.querySelector('[data-block-treatment="quote"]')).toBeTruthy();
    expect(screen.getByText("1 章节 · 1 图 · 1 转场")).toBeTruthy();
    expect(screen.queryByText("95%")).toBeNull();
    expect(screen.queryByText("510")).toBeNull();
    expect(screen.queryByText("3.2x")).toBeNull();
  });

  it("renders different structure markers for two templates sharing one profile", () => {
    const first = candidate("editorial-index", {
      candidateId: "candidate-classic",
      structureFingerprint: "structure-a",
      structureLabel: "报刊导读",
      templateId: "editorial-index-classic",
    });
    const second = candidate("editorial-index", {
      candidateId: "candidate-poster",
      decision: decision({
        blocks: [
          { blockId: "title", componentId: null, reason: "", treatment: "title" },
          { blockId: "lead", componentId: null, reason: "", treatment: "lead" },
          { blockId: "data", componentId: null, reason: "", treatment: "data" },
          { blockId: "section", componentId: null, reason: "", treatment: "section" },
          { blockId: "body", componentId: null, reason: "", treatment: "body" },
        ],
        dividerAfterBlockIds: ["data", "section"],
        dividerComponentId: "cmp_divider_ornament_dots_004",
        hero: {
          componentId: "cmp_gov_red_gold_banner_001",
          eyebrow: "专题",
          footer: "重点速览",
          title: "当前文章标题",
        },
        rhythm: "compact",
        visualIntensity: "bold",
      }),
      structureFingerprint: "structure-b",
      structureLabel: "报刊导读",
      templateId: "editorial-index-poster",
    });
    const { rerender } = render(<AiLayoutCandidatePreview candidate={first} plan={plan} />);
    const firstPreview = screen.getByRole("img", { name: "报刊导读结构预演" });
    const firstMarkup = firstPreview.innerHTML;
    const firstVariant = firstPreview.getAttribute("data-preview-variant");

    rerender(<AiLayoutCandidatePreview candidate={second} plan={plan} />);

    const secondPreview = screen.getByRole("img", { name: "报刊导读结构预演" });
    expect(secondPreview.getAttribute("data-template-id")).toBe("editorial-index-poster");
    expect(secondPreview.getAttribute("data-structure-key")).toBe("structure-b");
    expect(secondPreview.getAttribute("data-rhythm")).toBe("compact");
    expect(secondPreview.getAttribute("data-visual-intensity")).toBe("bold");
    expect(secondPreview.getAttribute("data-preview-variant")).not.toBe(firstVariant);
    expect(secondPreview.innerHTML).not.toBe(firstMarkup);
  });

  it("does not invent an image when the article has no image blocks", () => {
    const noImageCandidate = candidate("documentary-visual");
    render(
      <AiLayoutCandidatePreview
        candidate={{
          ...noImageCandidate,
          decision: decision({
            blocks: noImageCandidate.decision.blocks.filter((block) => block.treatment !== "image"),
            imagePlacements: [],
          }),
        }}
        plan={plan}
      />,
    );

    expect(screen.queryByText("原稿图片")).toBeNull();
    expect(screen.getByText("1 章节 · 0 图 · 1 转场")).toBeTruthy();
  });
});
