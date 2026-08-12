import type { AiLayoutTemplateSummary } from "@wechat-layout/api-contracts";
import { describe, expect, it } from "vitest";

import { recommendAiLayoutTemplates } from "./template-catalog";

const testStrategies = [
  "editorial-index",
  "briefing-cards",
  "evidence-led",
  "minimal-longread",
  "documentary-visual",
  "action-roadmap",
  "timeline-milestones",
  "quote-led",
  "chapter-magazine",
  "checklist-guide",
] as const satisfies readonly AiLayoutTemplateSummary["strategyId"][];

function template(
  index: number,
  overrides: Partial<AiLayoutTemplateSummary> = {},
): AiLayoutTemplateSummary {
  return {
    catalogCategoryId: index % 2 === 0 ? "official-report" : "knowledge-guide",
    categoryLabel: index % 2 === 0 ? "政务报告" : "知识指南",
    contentClasses: index % 2 === 0 ? ["government"] : ["narrative"],
    defaultLanguageId: index % 2 === 0 ? "crimson-editorial" : "minimal-blue",
    description: index === 7 ? "权威数据报告" : "清晰长文",
    imagePolicy: "optional",
    minimumSourceImages: 0,
    name: `模板 ${String(index)}`,
    preferredLanguageIds: [index % 2 === 0 ? "crimson-editorial" : "minimal-blue"],
    previewKey: `preview-${String(index % 10)}`,
    profileId: "editorial-index",
    rhythm: "balanced",
    sourceImageFallback: "text-first",
    strategyId: testStrategies[index % testStrategies.length]!,
    structureLabel: "导读结构",
    tags: index === 7 ? ["数据", "报告"] : ["长文"],
    templateId: `template-${String(index)}`,
    version: 1,
    visualIntensity: "restrained",
    ...overrides,
  };
}

describe("AI layout template recommendations", () => {
  it("returns exactly six content matches and preserves stable order for ties", () => {
    const templates = Array.from({ length: 50 }, (_, index) => template(index));
    const recommended = recommendAiLayoutTemplates(templates, {
      articleTypeLabel: "数据报告",
      emotionLabel: "权威",
      keywords: ["数据"],
      sourceImageCount: 0,
    });
    expect(recommended).toHaveLength(6);
    expect(recommended[0]?.templateId).toBe("template-7");
    expect(new Set(recommended.map((item) => item.strategyId)).size).toBe(6);
  });

  it("excludes image-dependent templates until the article has enough source images", () => {
    const templates = [
      template(0, { minimumSourceImages: 2, strategyId: "documentary-visual" }),
      ...Array.from({ length: 10 }, (_, index) =>
        template(index + 1, {
          strategyId: testStrategies[index]!,
        }),
      ),
    ];

    const withoutImages = recommendAiLayoutTemplates(templates, {
      articleTypeLabel: "摄影报道",
      emotionLabel: "纪实",
      keywords: ["图片"],
      sourceImageCount: 0,
    });
    const withImages = recommendAiLayoutTemplates(templates, {
      articleTypeLabel: "摄影报道",
      emotionLabel: "纪实",
      keywords: ["图片"],
      sourceImageCount: 2,
    });

    expect(withoutImages.map((item) => item.templateId)).not.toContain("template-0");
    expect(withImages.map((item) => item.templateId)).toContain("template-0");
  });
});
