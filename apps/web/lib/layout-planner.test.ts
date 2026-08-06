import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { parseDocument, type DocumentV1 } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import {
  analyzeDocumentLayout,
  applyAiLayoutDecisionToDocument,
  applyLayoutPlanToDocument,
  createLayoutPlans,
  createLayoutPlanForLanguage,
  layoutPlanFromAiDecision,
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

  it("applies model-selected structure and removes unresolved visual placeholders", () => {
    const document: DocumentV1 = structuredClone(documentV1Fixture);
    document.content.content.push({
      type: "semanticCard",
      attrs: {
        blockId: "block_empty_gallery",
        componentId: "cmp_gallery_magazine_duo_002",
        componentVersion: "1.0.0",
        locked: false,
      },
      content: [
        {
          type: "imageBlock",
          attrs: {
            blockId: "block_pending_image",
            locked: false,
            resourceId: "component_slot_image_pending",
          },
        },
      ],
    });
    const sourcePlan = createLayoutPlans(document, [], { mode: "original" })[0]!;
    const decision = {
      languageId: "crimson-editorial",
      designName: "纪律坐标",
      concept: "以报告式章节和克制的数据提示组织阅读。",
      rhythm: "compact",
      variantSeed: 812,
      visualIntensity: "bold",
      dividerComponentId: "cmp_divider_dashed_subtle_002",
      hero: {
        componentId: "cmp_gov_red_gold_banner_001",
        eyebrow: "INSPECTION REPORT",
        title: "稳中提质",
        footer: "体系化 · 标准化",
      },
      footer: {
        componentId: "cmp_notice_risk_red_004",
        title: "回看重点",
        text: "让监督成果落到行动",
      },
      dividerAfterBlockIds: ["block_paragraph"],
      blocks: document.content.content.map((node) => ({
        blockId: node.attrs.blockId,
        componentId:
          node.type === "imageBlock" ? ("cmp_image_centered_numbered_004" as const) : null,
        reason: "测试决策",
        treatment:
          node.attrs.blockId === "block_paragraph"
            ? ("lead" as const)
            : node.type === "imageBlock"
              ? ("image" as const)
              : ("body" as const),
      })),
    } as const;
    const plan = layoutPlanFromAiDecision(document, [], sourcePlan, decision);
    const result = applyAiLayoutDecisionToDocument(document, plan, decision);

    expect(() => parseDocument(result)).not.toThrow();
    expect(
      result.content.content.some((node) => node.attrs.blockId === "block_empty_gallery"),
    ).toBe(false);
    const intro = result.content.content.find(
      (node) => node.attrs.semanticRole === "layout_plan_generated_intro",
    );
    expect(intro?.type === "semanticCard" ? intro.attrs.title : undefined).toBe("稳中提质");
    expect(result.content.content.some((node) => node.type === "divider")).toBe(true);
    expect(plan.languageId).toBe("crimson-editorial");
    expect(plan.designName).toBe("纪律坐标");
    expect(plan.rhythm).toBe("compact");
    expect(plan.visualIntensity).toBe("bold");
    expect(intro?.attrs.componentId).toBe("cmp_gov_red_gold_banner_001");
    expect(result.content.content.find((node) => node.type === "divider")?.attrs.componentId).toBe(
      "cmp_divider_dashed_subtle_002",
    );
  });

  it("builds the red-white editorial baseline from article structure", () => {
    const timestamp = "2026-08-06T00:00:00.000Z";
    const document: DocumentV1 = {
      articleId: "article_crimson_baseline",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { blockId: "title", level: 1, locked: false },
            content: [{ type: "text", text: "实干担当，提质增效" }],
          },
          {
            type: "paragraph",
            attrs: { blockId: "lead", locked: false },
            content: [{ type: "text", text: "把“精准落地”和“实质提升”作为全文主线。" }],
          },
          {
            type: "heading",
            attrs: { blockId: "section_1", level: 2, locked: false },
            content: [{ type: "text", text: "以稳为基，筑牢工作底座" }],
          },
          {
            type: "paragraph",
            attrs: { blockId: "body_1", locked: false },
            content: [{ type: "text", text: "通过“体系闭环”推动工作稳中提质。" }],
          },
          {
            type: "heading",
            attrs: { blockId: "section_2", level: 2, locked: false },
            content: [{ type: "text", text: "以新为要，激发工作动能" }],
          },
          {
            type: "paragraph",
            attrs: { blockId: "body_2", locked: false },
            content: [{ type: "text", text: "累计形成510项成果，覆盖644人，完成率95%。" }],
          },
        ],
      },
      documentId: "document_crimson_baseline",
      meta: {
        createdAt: timestamp,
        sourceType: "manual",
        textLocked: true,
        updatedAt: timestamp,
      },
      schemaVersion: "1.0.0",
    };
    const plan = createLayoutPlanForLanguage(document, [], "crimson-editorial", {
      mode: "original",
    });
    const result = applyLayoutPlanToDocument(document, plan);

    expect(() => parseDocument(result)).not.toThrow();
    expect(
      result.content.content.some(
        (node) => node.attrs.semanticRole === "layout_plan_generated_overview",
      ),
    ).toBe(true);
    const chapters = result.content.content.filter(
      (node) => node.attrs.semanticRole === "layout_plan_crimson_chapter",
    );
    expect(chapters).toHaveLength(2);
    expect(chapters.map((node) => (node.type === "heading" ? node.attrs.numbering : null))).toEqual(
      ["01", "02"],
    );
    const highlighted = JSON.stringify(result).match(/"type":"underline"/gu) ?? [];
    expect(highlighted.length).toBeGreaterThanOrEqual(2);
  });
});
