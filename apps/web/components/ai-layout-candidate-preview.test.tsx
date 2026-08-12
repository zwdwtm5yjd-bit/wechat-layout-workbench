// @vitest-environment jsdom

import type { AiLayoutCandidate, AiLayoutCandidateProfileId } from "@wechat-layout/api-contracts";
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

function candidate(profileId: AiLayoutCandidateProfileId): AiLayoutCandidate {
  return {
    candidateId: `candidate-${profileId}`,
    differenceHighlights: [],
    profileId,
    recommended: false,
    structureLabel: profileId,
    decision: {
      blocks: [
        { blockId: "title", componentId: null, reason: "", treatment: "title" },
        { blockId: "section", componentId: null, reason: "", treatment: "section" },
        { blockId: "quote", componentId: null, reason: "", treatment: "quote" },
        { blockId: "image", componentId: null, reason: "", treatment: "image" },
      ],
      rhythm: "balanced",
      visualIntensity: "restrained",
    } as unknown as AiLayoutCandidate["decision"],
  };
}

describe("AI layout candidate preview", () => {
  it.each(profileIds)("renders a visual comparison for %s", (profileId) => {
    render(<AiLayoutCandidatePreview candidate={candidate(profileId)} plan={plan} />);

    expect(screen.getByRole("img", { name: `${profileId}结构预演` })).toBeTruthy();
    expect(screen.getByText("结构预演 · 当前文章")).toBeTruthy();
  });

  it("uses only article-derived counts in the evidence preview", () => {
    render(<AiLayoutCandidatePreview candidate={candidate("evidence-led")} plan={plan} />);

    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("95%")).toBeNull();
    expect(screen.queryByText("510")).toBeNull();
    expect(screen.queryByText("3.2x")).toBeNull();
  });

  it("does not invent an image when the article has no image blocks", () => {
    const noImageCandidate = candidate("documentary-visual");
    render(
      <AiLayoutCandidatePreview
        candidate={{
          ...noImageCandidate,
          decision: {
            ...noImageCandidate.decision,
            blocks: noImageCandidate.decision.blocks.filter((block) => block.treatment !== "image"),
          },
        }}
        plan={plan}
      />,
    );

    expect(screen.getByText("原文无图 · 保持留白")).toBeTruthy();
  });
});
