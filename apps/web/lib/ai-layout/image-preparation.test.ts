import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import {
  countRealContentImages,
  createImagePreparationTasks,
  insertPreparedImages,
  type PreparedImageSelection,
} from "./image-preparation";

function articleWithoutImages(): DocumentV1 {
  const document = structuredClone(documentV1Fixture) as DocumentV1;
  const paragraph = (blockId: string, text: string) => ({
    type: "paragraph" as const,
    attrs: { blockId, locked: true, sourceBlockId: `source_${blockId}` },
    content: [{ type: "text" as const, text }],
  });
  document.content.content = [
    {
      type: "heading",
      attrs: {
        blockId: "block_main_title",
        level: 1,
        locked: true,
        semanticRole: "main_title",
      },
      content: [{ type: "text", text: "年度工作纪实" }],
    },
    paragraph(
      "block_intro",
      "本次工作围绕质量、协作与服务展开，形成了可复盘的实践路径。".repeat(8),
    ),
    {
      type: "heading",
      attrs: { blockId: "block_section_one", level: 2, locked: true },
      content: [{ type: "text", text: "一、走进项目现场" }],
    },
    paragraph(
      "block_evidence",
      "团队完成 12 项重点任务，服务 320 人次，阶段目标全部按计划推进。".repeat(8),
    ),
    paragraph(
      "block_story",
      "成员在现场记录流程、讨论问题并复盘经验，让改进措施逐步落地。".repeat(8),
    ),
    {
      type: "heading",
      attrs: { blockId: "block_section_two", level: 2, locked: true },
      content: [{ type: "text", text: "二、沉淀长期方法" }],
    },
    paragraph(
      "block_conclusion",
      "后续将继续完善流程，保留真实记录，并以稳定节奏推进下一阶段工作。".repeat(8),
    ),
    {
      type: "paragraph",
      attrs: {
        blockId: "block_generated",
        locked: false,
        semanticRole: "layout_plan_emphasis",
      },
      content: [{ type: "text", text: "自动生成的结尾" }],
    },
  ];
  return document;
}

describe("image preparation", () => {
  it("derives at most five deterministic tasks from real non-H1 text anchors", () => {
    const document = articleWithoutImages();
    const first = createImagePreparationTasks(document);
    const second = createImagePreparationTasks(structuredClone(document));

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(5);
    expect(new Set(first.map((task) => task.taskId)).size).toBe(first.length);
    expect(first.every((task) => task.searchQuery.length > 0)).toBe(true);
    expect(first.some((task) => task.afterBlockId === "block_main_title")).toBe(false);
    expect(first.some((task) => task.afterBlockId === "block_generated")).toBe(false);
    expect(
      first.every((task) =>
        document.content.content.some(
          (node) => node.attrs.blockId === task.afterBlockId && node.type !== "imageBlock",
        ),
      ),
    ).toBe(true);
  });

  it("inserts only unique resolved private images after valid anchors", () => {
    const document = articleWithoutImages();
    const original = structuredClone(document);
    const selections: readonly PreparedImageSelection[] = [
      {
        taskId: "task-one",
        afterBlockId: "block_intro",
        resourceId: "019c0fb5-7d53-7f66-bfb7-f70c0e462603",
        alt: "  项目现场  ",
        caption: "  真实活动记录  ",
      },
      {
        taskId: "task-duplicate-resource",
        afterBlockId: "block_story",
        resourceId: "019c0fb5-7d53-7f66-bfb7-f70c0e462603",
        alt: "不应重复插入",
      },
      {
        taskId: "task-invalid-anchor",
        afterBlockId: "block_main_title",
        resourceId: "019c0fb5-7d53-7f66-bfb7-f70c0e462604",
        alt: "不应挂在主标题后",
      },
      {
        taskId: "task-not-a-resource",
        afterBlockId: "block_story",
        resourceId: "builtin_visual_static_001",
        alt: "不是用户真实图片",
      },
    ];

    const result = insertPreparedImages(document, selections, () => "block_prepared_image_1");
    const anchorIndex = result.content.content.findIndex(
      (node) => node.attrs.blockId === "block_intro",
    );
    const inserted = result.content.content[anchorIndex + 1];

    expect(document).toEqual(original);
    expect(result.content.content).toHaveLength(document.content.content.length + 1);
    expect(inserted).toMatchObject({
      type: "imageBlock",
      attrs: {
        alt: "项目现场",
        blockId: "block_prepared_image_1",
        caption: "真实活动记录",
        compatibilityLevel: "safe",
        elementKind: "image",
        locked: false,
        resourceId: "019c0fb5-7d53-7f66-bfb7-f70c0e462603",
      },
    });
    if (inserted?.type !== "imageBlock") throw new Error("未插入图片");
    expect(inserted.attrs.originalResourceId).toBeUndefined();
    expect(result.content.content.filter((node) => node.type === "imageBlock")).toHaveLength(1);
  });

  it("does not create placeholders when every task is skipped or unresolved", () => {
    const document = articleWithoutImages();
    expect(insertPreparedImages(document, [])).toEqual(document);
  });

  it("does not let many built-in decorations inflate the recommended content image count", () => {
    const document = articleWithoutImages();
    for (let index = 0; index < 10; index += 1) {
      document.content.content.push({
        type: "imageBlock",
        attrs: {
          blockId: `block_builtin_decoration_${String(index)}`,
          locked: false,
          compatibilityLevel: "safe",
          resourceId: "builtin_visual_static_022",
          elementKind: "decoration",
        },
      });
    }

    expect(countRealContentImages(document)).toBe(0);
    const tasks = createImagePreparationTasks(document);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.length).toBeLessThan(5);
  });

  it("counts nested real images and rejects reusing their resource or block identifier", () => {
    const document = articleWithoutImages();
    document.content.content.push({
      type: "semanticCard",
      attrs: {
        blockId: "block_nested_card",
        locked: false,
        componentId: "cmp_nested_test",
        componentVersion: "1.0.0",
      },
      content: [
        {
          type: "imageBlock",
          attrs: {
            blockId: "block_nested_real_image",
            locked: false,
            resourceId: "019c0fb5-7d53-7f66-bfb7-f70c0e462699",
            elementKind: "image",
          },
        },
      ],
    });

    expect(countRealContentImages(document)).toBe(1);
    const result = insertPreparedImages(
      document,
      [
        {
          taskId: "task-reuse-nested-resource",
          afterBlockId: "block_story",
          resourceId: "019c0fb5-7d53-7f66-bfb7-f70c0e462699",
          alt: "不能重复",
        },
        {
          taskId: "task-reuse-nested-block",
          afterBlockId: "block_story",
          resourceId: "019c0fb5-7d53-7f66-bfb7-f70c0e462698",
          alt: "不能复用区块 ID",
        },
      ],
      () => "block_nested_real_image",
    );
    expect(result).toEqual(document);
  });
});
