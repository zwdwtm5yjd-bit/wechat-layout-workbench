import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { parseDocument } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import {
  analyzeDocumentLayout,
  applyLayoutPlanToDocument,
  createLayoutPlans,
} from "./layout-planner";

describe("layout planner", () => {
  it("analyzes the document and creates three user-facing plans", () => {
    const analysis = analyzeDocumentLayout(documentV1Fixture);
    const plans = createLayoutPlans(documentV1Fixture, []);

    expect(analysis.characterCount).toBeGreaterThan(0);
    expect(plans).toHaveLength(3);
    expect(plans.filter((plan) => plan.recommended)).toHaveLength(1);
  });

  it("preserves source text while adding idempotent visual layout blocks", () => {
    const [plan] = createLayoutPlans(documentV1Fixture, []);
    if (plan === undefined) throw new Error("layout plan missing");
    const before = JSON.stringify(documentV1Fixture).match(/"text":"[^"]*"/gu);
    const first = applyLayoutPlanToDocument(documentV1Fixture, plan);
    const second = applyLayoutPlanToDocument(first, plan);
    expect(() => parseDocument(second)).not.toThrow();
    const after = JSON.stringify(second).match(/"text":"[^"]*"/gu);

    expect(after).toEqual(before);
    expect(
      second.content.content.filter((node) => node.attrs.semanticRole === "layout_plan_generated")
        .length,
    ).toBeGreaterThan(0);
    expect(
      second.content.content.filter((node) => node.attrs.semanticRole === "layout_plan_generated"),
    ).toHaveLength(
      first.content.content.filter((node) => node.attrs.semanticRole === "layout_plan_generated")
        .length,
    );
  });
});
