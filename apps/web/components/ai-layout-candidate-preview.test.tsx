// @vitest-environment jsdom

import type { AiLayoutCandidate, AiLayoutCandidateProfileId } from "@wechat-layout/api-contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

const plan = {
  designTokens: {
    accentColor: "#D29A54",
    mutedColor: "#667085",
    primaryColor: "#C1292E",
    surfaceColor: "#FFFFFF",
  },
} as LayoutPlan;

describe("AI layout candidate preview", () => {
  it.each(profileIds)("renders a visual comparison for %s", (profileId) => {
    const candidate = {
      profileId,
      structureLabel: profileId,
    } as AiLayoutCandidate;

    render(<AiLayoutCandidatePreview candidate={candidate} plan={plan} />);

    expect(screen.getByRole("img", { name: `${profileId}结构缩略图` })).toBeTruthy();
  });
});
