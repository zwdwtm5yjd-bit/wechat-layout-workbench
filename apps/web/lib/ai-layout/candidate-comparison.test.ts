import type { AiLayoutCandidate } from "@wechat-layout/api-contracts";
import { describe, expect, it } from "vitest";

import { compareAiLayoutCandidate } from "./candidate-comparison";

function candidate(): AiLayoutCandidate {
  return {
    candidateId: "candidate-documentary",
    differenceHighlights: [],
    profileId: "documentary-visual",
    recommended: false,
    structureLabel: "纪实图文",
    decision: {
      blocks: [
        { blockId: "a", componentId: null, reason: "", treatment: "title" },
        { blockId: "b", componentId: null, reason: "", treatment: "section" },
        { blockId: "c", componentId: null, reason: "", treatment: "quote" },
        { blockId: "d", componentId: null, reason: "", treatment: "image" },
        { blockId: "e", componentId: null, reason: "", treatment: "image" },
      ],
      concept: "",
      designName: "",
      designTokens: {
        accentColor: "#000000",
        bodyFontSize: 15,
        bodyLineHeight: 1.8,
        cardRadius: 8,
        mutedColor: "#666666",
        primaryColor: "#111111",
        sectionSpacing: 32,
        surfaceAltColor: "#f5f5f5",
        surfaceColor: "#ffffff",
        textColor: "#111111",
        titleAlign: "left",
      },
      dividerAfterBlockIds: [],
      dividerComponentId: "cmp_divider_solid_clean_001",
      footer: { componentId: "cmp_notice_info_blue_001", text: "", title: "" },
      hero: {
        componentId: "cmp_intro_leaf_story_003",
        eyebrow: "",
        footer: "",
        title: "",
      },
      languageId: "warm-paper",
      rhythm: "airy",
      imagePlacements: [
        {
          afterBlockId: "b",
          imageBlockId: "d",
          mode: "after-text",
          reason: "图文语义匹配",
          resourceId: "01900000-0000-7000-8000-000000000001",
        },
      ],
      variantSeed: 1,
      visualAssets: [],
      visualIntensity: "restrained",
    },
  };
}

describe("AI layout candidate comparison", () => {
  it("summarizes structure, images, rhythm and visual intensity", () => {
    expect(compareAiLayoutCandidate(candidate())).toEqual({
      emphasisCount: 1,
      imageCount: 1,
      imageStrategy: "大图叙事",
      rhythmLabel: "舒展长读",
      sectionCount: 1,
      visualIntensityLabel: "克制",
    });
  });
});
