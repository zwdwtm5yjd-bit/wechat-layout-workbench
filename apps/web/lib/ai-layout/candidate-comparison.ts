import type {
  AiLayoutCandidate,
  AiLayoutCandidateProfileId,
  AiLayoutRhythm,
  AiLayoutVisualIntensity,
} from "@wechat-layout/api-contracts";

export interface AiLayoutCandidateComparison {
  readonly emphasisCount: number;
  readonly imageCount: number;
  readonly imageStrategy: string;
  readonly rhythmLabel: string;
  readonly sectionCount: number;
  readonly visualIntensityLabel: string;
}

const RHYTHM_LABELS: Readonly<Record<AiLayoutRhythm, string>> = {
  airy: "舒展长读",
  balanced: "均衡阅读",
  compact: "高效扫读",
};

const VISUAL_INTENSITY_LABELS: Readonly<Record<AiLayoutVisualIntensity, string>> = {
  bold: "鲜明",
  balanced: "适中",
  restrained: "克制",
};

const IMAGE_STRATEGIES: Readonly<Record<AiLayoutCandidateProfileId, string>> = {
  "action-roadmap": "步骤节点",
  "briefing-cards": "卡片穿插",
  "documentary-visual": "大图叙事",
  "editorial-index": "纪实边框",
  "evidence-led": "编号证据",
  "minimal-longread": "留白原图",
};

export function compareAiLayoutCandidate(
  candidate: AiLayoutCandidate,
): AiLayoutCandidateComparison {
  const blocks = candidate.decision.blocks;
  return {
    emphasisCount: blocks.filter(
      (block) =>
        block.treatment === "quote" || block.treatment === "data" || block.treatment === "callout",
    ).length,
    imageCount: blocks.filter((block) => block.treatment === "image").length,
    imageStrategy: IMAGE_STRATEGIES[candidate.profileId],
    rhythmLabel: RHYTHM_LABELS[candidate.decision.rhythm],
    sectionCount: blocks.filter((block) => block.treatment === "section").length,
    visualIntensityLabel: VISUAL_INTENSITY_LABELS[candidate.decision.visualIntensity],
  };
}
