import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { parseDocument } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import {
  analyzeDocumentLayout,
  applyLayoutPlanToDocument,
  createLayoutPlans,
} from "./layout-planner";

describe("layout planner", () => {
  it("analyzes the article gene and creates six design-language plans", () => {
    const analysis = analyzeDocumentLayout(documentV1Fixture);
    const plans = createLayoutPlans(documentV1Fixture, []);

    expect(analysis.characterCount).toBeGreaterThan(0);
    expect(analysis.gene.articleTypeLabel).not.toHaveLength(0);
    expect(analysis.gene.emotionLabel).not.toHaveLength(0);
    expect(plans).toHaveLength(6);
    expect(plans.filter((plan) => plan.recommended)).toHaveLength(1);
  });

  it("creates one described plan and one stable original plan", () => {
    const described = createLayoutPlans(documentV1Fixture, [], {
      brief: "温暖的杂志感，米白纸张和克制的陶土色",
      mode: "described",
    });
    const original = createLayoutPlans(documentV1Fixture, [], { mode: "original" });

    expect(described).toHaveLength(1);
    expect(described[0]?.languageId).toBe("warm-paper");
    expect(original).toHaveLength(1);
    expect(original[0]?.id).toBe(
      createLayoutPlans(documentV1Fixture, [], { mode: "original" })[0]?.id,
    );
  });

  it("preserves source text while adding idempotent visual layout blocks", () => {
    const [plan] = createLayoutPlans(documentV1Fixture, []);
    if (plan === undefined) throw new Error("layout plan missing");
    const before = JSON.stringify(documentV1Fixture).match(/"text":"[^"]*"/gu);
    const first = applyLayoutPlanToDocument(documentV1Fixture, plan);
    const second = applyLayoutPlanToDocument(first, plan);
    expect(() => parseDocument(second)).not.toThrow();
    const after = JSON.stringify(second).match(/"text":"[^"]*"/gu);
    const firstGenerated = first.content.content.filter((node) =>
      node.attrs.semanticRole?.startsWith("layout_plan_generated"),
    );
    const secondGenerated = second.content.content.filter((node) =>
      node.attrs.semanticRole?.startsWith("layout_plan_generated"),
    );
    const intro = secondGenerated.find(
      (node) => node.attrs.semanticRole === "layout_plan_generated_intro",
    );
    const footer = secondGenerated.find(
      (node) => node.attrs.semanticRole === "layout_plan_generated_footer",
    );
    const componentHeading = second.content.content.find((node) => node.type === "heading");

    expect(after).toEqual(before);
    expect(secondGenerated.length).toBeGreaterThan(1);
    expect(secondGenerated).toHaveLength(firstGenerated.length);
    expect(intro?.type).toBe("semanticCard");
    expect(intro?.attrs.componentId).toMatch(/^cmp_(?:hero|intro|gov|tech)_/u);
    expect(footer?.type).toBe("semanticCard");
    expect(footer?.type === "semanticCard" ? footer.attrs.title : undefined).toContain("点赞");
    expect(componentHeading?.attrs.componentId).toMatch(/^cmp_head_/u);
  });
});
