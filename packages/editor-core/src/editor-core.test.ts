// @vitest-environment jsdom

import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { Editor } from "@tiptap/core";
import {
  OFFICIAL_COMPONENT_ASSETS,
  LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION,
  ComponentRegistry,
  createOfficialComponentRegistry,
  validateComponentManifest,
  type ComponentManifest,
} from "@wechat-layout/component-registry";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canRedo,
  canUndo,
  createDocumentExtensions,
  deleteBlock,
  documentToEditorContent,
  duplicateBlock,
  editorContentToDocument,
  insertBlockAfterSelection,
  insertRegisteredComponentAfterSelection,
  listTopLevelBlocks,
  moveBlock,
  redo,
  selectBlock,
  setTextBlockType,
  undo,
} from "./index.js";

const editors: Editor[] = [];

const summaryCardManifest: ComponentManifest = {
  adjustableProperties: ["backgroundColor"],
  category: "CARD",
  compatibilityLevel: "safe",
  componentId: "cmp_card_summary_default_001",
  defaultTokenMap: { backgroundColor: "#FFFFFF" },
  defaultVariantId: "default",
  editorRendererKey: "SummaryCardNodeView",
  fallback: {
    kind: "semantic_card",
    preserveOriginalText: true,
    rendererKey: "safePlaceholder",
  },
  name: "摘要卡片",
  nodeType: "semanticCard",
  schemaVersion: LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION,
  semanticRoles: ["summary"],
  slots: [
    {
      allowImages: false,
      allowRichText: false,
      editorBinding: "title",
      kind: "text",
      label: "标题",
      maxLength: 80,
      required: true,
      slotId: "title",
      textLocked: true,
      wechatExport: "plain_text",
    },
    {
      allowImages: false,
      allowRichText: true,
      editorBinding: "content",
      kind: "rich_text",
      label: "正文",
      required: true,
      slotId: "body",
      textLocked: true,
      wechatExport: "rich_text",
    },
    {
      allowImages: true,
      allowRichText: false,
      editorBinding: "content",
      kind: "image",
      label: "配图",
      required: false,
      slotId: "image",
      textLocked: false,
      wechatExport: "image",
    },
  ],
  variants: [{ name: "默认", variantId: "default" }],
  version: "1.0.0",
  wechatRendererKey: "summaryCardRenderer",
};

function createEditor(content = documentToEditorContent(documentV1Fixture)): Editor {
  const editor = new Editor({
    content,
    extensions: createDocumentExtensions(),
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe("editor core", () => {
  it("round-trips the complete authoritative JSON without losing schema data", () => {
    const editor = createEditor();
    const restored = editorContentToDocument(
      documentV1Fixture,
      editor.getJSON(),
      new Date(documentV1Fixture.meta.updatedAt),
    );

    expect(restored.content).toEqual(documentV1Fixture.content);
    expect(restored.meta).toEqual({
      ...documentV1Fixture.meta,
      updatedAt: "2026-07-30T02:00:00.000Z",
    });
  });

  it("inserts all 41 official components as their native nodes with exact versions", () => {
    const editor = createEditor();
    OFFICIAL_COMPONENT_ASSETS.forEach((asset) => {
      const validation = validateComponentManifest(asset.manifest);
      expect(
        validation.success,
        `${asset.manifest.componentId}: ${JSON.stringify(validation)}`,
      ).toBe(true);
    });
    const registry = createOfficialComponentRegistry();
    const originalBlocks = structuredClone(documentV1Fixture.content.content);

    OFFICIAL_COMPONENT_ASSETS.forEach((asset) => {
      const result = insertRegisteredComponentAfterSelection(editor, registry, {
        componentId: asset.manifest.componentId,
        slots: asset.defaultSlots,
        version: asset.manifest.version,
      });
      expect(result).toMatchObject({ success: true });
    });

    const restored = editorContentToDocument(
      documentV1Fixture,
      editor.getJSON(),
      new Date(documentV1Fixture.meta.updatedAt),
    );
    expect(OFFICIAL_COMPONENT_ASSETS).toHaveLength(41);
    OFFICIAL_COMPONENT_ASSETS.forEach((asset) => {
      const block = restored.content.content.find(
        (candidate) => candidate.attrs.componentId === asset.manifest.componentId,
      );
      expect(block).toMatchObject({
        type: asset.manifest.nodeType,
        attrs: {
          componentId: asset.manifest.componentId,
          componentVariantId: asset.manifest.defaultVariantId,
          componentVersion: asset.manifest.version,
        },
      });
    });
    originalBlocks.forEach((original) => {
      expect(
        restored.content.content.find((block) => block.attrs.blockId === original.attrs.blockId),
      ).toEqual(original);
    });
  });

  it("duplicates, moves and deletes top-level blocks through undoable transactions", () => {
    const editor = createEditor();
    const firstBlock = listTopLevelBlocks(editor)[0]!;

    expect(selectBlock(editor, firstBlock.blockId)).toBe(true);
    expect(duplicateBlock(editor, firstBlock.blockId)).toBe(true);

    const duplicatedBlocks = listTopLevelBlocks(editor);
    expect(duplicatedBlocks).toHaveLength(documentV1Fixture.content.content.length + 1);
    expect(new Set(duplicatedBlocks.map((block) => block.blockId)).size).toBe(
      duplicatedBlocks.length,
    );
    expect(canUndo(editor)).toBe(true);

    const duplicatedId = duplicatedBlocks[1]!.blockId;
    expect(moveBlock(editor, duplicatedId, 1)).toBe(true);
    expect(listTopLevelBlocks(editor)[2]?.blockId).toBe(duplicatedId);
    expect(deleteBlock(editor, duplicatedId)).toBe(true);
    expect(listTopLevelBlocks(editor).some((block) => block.blockId === duplicatedId)).toBe(false);

    expect(undo(editor)).toBe(true);
    expect(listTopLevelBlocks(editor).some((block) => block.blockId === duplicatedId)).toBe(true);
    expect(canRedo(editor)).toBe(true);
    expect(redo(editor)).toBe(true);
    expect(listTopLevelBlocks(editor).some((block) => block.blockId === duplicatedId)).toBe(false);
  });

  it("assigns unique identities when a text block is split", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "block_split_source", locked: false },
          content: [{ type: "text", text: "前半后半" }],
        },
      ],
    });

    editor.commands.setTextSelection(3);
    expect(editor.commands.splitBlock()).toBe(true);

    const blocks = listTopLevelBlocks(editor);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.blockId).not.toBe(blocks[1]?.blockId);
    expect(blocks.every((block) => block.blockId.startsWith("block_"))).toBe(true);
  });

  it("preserves authoritative block attributes when changing a heading to a paragraph", () => {
    const editor = createEditor();
    const heading = listTopLevelBlocks(editor)[0]!;

    expect(setTextBlockType(editor, heading.blockId, "paragraph")).toBe(true);
    const changed = editor.getJSON().content?.[0];
    expect(changed).toMatchObject({
      type: "paragraph",
      attrs: {
        blockId: "block_heading",
        locked: true,
        semanticRole: "section_heading",
        sourceBlockId: "source_heading",
        styleRef: "heading.level1.default",
      },
    });
    expect(() => editorContentToDocument(documentV1Fixture, editor.getJSON())).not.toThrow();

    expect(undo(editor)).toBe(true);
    expect(editor.getJSON().content?.[0]?.type).toBe("heading");
  });

  it("opens and edits a 5,000-character article", () => {
    const content = "视觉排版".repeat(1_250);
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "block_long_article", locked: false },
          content: [{ type: "text", text: content }],
        },
      ],
    });

    expect(editor.state.doc.textContent).toHaveLength(5_000);
    const startedAt = performance.now();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(editor.commands.insertContent("继续")).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(500);
    expect(editor.state.doc.textContent.endsWith("继续")).toBe(true);
  });

  it("keeps an editable paragraph after deleting the only block and supports insertion", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "block_only", locked: false },
        },
      ],
    });

    expect(deleteBlock(editor, "block_only")).toBe(true);
    expect(listTopLevelBlocks(editor)).toHaveLength(1);
    expect(listTopLevelBlocks(editor)[0]?.type).toBe("paragraph");
    expect(insertBlockAfterSelection(editor, "heading2")).toBe(true);
    expect(listTopLevelBlocks(editor)[1]?.type).toBe("heading");
  });

  it("opens an empty authoritative document with an editable starter block", () => {
    const emptyDocument = structuredClone(documentV1Fixture);
    emptyDocument.content.content = [];

    const editor = createEditor(documentToEditorContent(emptyDocument));
    const blocks = listTopLevelBlocks(editor);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("paragraph");
    expect(blocks[0]?.blockId).toMatch(/^block_/);
  });

  it("intercepts typing and deletion in locked source blocks but allows style changes", async () => {
    const onBlocked = vi.fn();
    const editor = new Editor({
      content: documentToEditorContent(documentV1Fixture),
      extensions: createDocumentExtensions({
        textLocked: true,
        onTextMutationBlocked: onBlocked,
      }),
    });
    editors.push(editor);
    const heading = listTopLevelBlocks(editor)[0]!;

    editor.commands.setTextSelection(2);
    editor.commands.insertContent("新增文字");
    await Promise.resolve();
    expect(editor.state.doc.textContent.startsWith("Document Schema V1")).toBe(true);
    expect(onBlocked).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          blockId: "block_heading",
          code: "LOCKED_TEXT_CHANGED",
        }),
      ]),
    );

    expect(editor.commands.setTextSelection({ from: 1, to: 5 })).toBe(true);
    expect(editor.commands.deleteSelection()).toBe(true);
    await Promise.resolve();
    expect(editor.state.doc.textContent.startsWith("Document Schema V1")).toBe(true);

    expect(setTextBlockType(editor, heading.blockId, "heading", 2)).toBe(true);
    expect(editor.getJSON().content?.[0]?.attrs?.level).toBe(2);
    expect(editor.commands.setTextSelection({ from: 1, to: 9 })).toBe(true);
    expect(editor.commands.toggleItalic()).toBe(true);
    expect(editor.isActive("italic")).toBe(true);
    expect(selectBlock(editor, heading.blockId)).toBe(true);
    expect(insertBlockAfterSelection(editor, "divider")).toBe(true);
    expect(listTopLevelBlocks(editor).some((block) => block.type === "divider")).toBe(true);
  });

  it("allows editing an unlocked block while document-level protection stays enabled", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "block_manual", locked: false },
          content: [{ type: "text", text: "手工区块" }],
        },
      ],
    };
    const editor = new Editor({
      content,
      extensions: createDocumentExtensions({ textLocked: true }),
    });
    editors.push(editor);

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(editor.commands.insertContent("可编辑")).toBe(true);
    expect(editor.state.doc.textContent).toBe("手工区块可编辑");
  });

  it("inserts a validated component with an exact version and slot bindings", () => {
    const registry = new ComponentRegistry();
    registry.register(summaryCardManifest);
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "block_before_component", locked: false },
        },
      ],
    });

    expect(selectBlock(editor, "block_before_component")).toBe(true);
    const result = insertRegisteredComponentAfterSelection(editor, registry, {
      componentId: "cmp_card_summary_default_001",
      slots: {
        body: "组件正文",
        image: { alt: "摘要配图", resourceId: "resource_summary_image" },
        title: "组件标题",
      },
    });

    expect(result).toMatchObject({
      success: true,
      descriptor: { version: "1.0.0" },
    });
    expect(editor.getJSON().content?.[1]).toMatchObject({
      type: "semanticCard",
      attrs: {
        compatibilityLevel: "safe",
        componentId: "cmp_card_summary_default_001",
        componentVersion: "1.0.0",
        title: "组件标题",
        variant: "default",
      },
      content: [
        {
          type: "paragraph",
          attrs: {
            locked: true,
            semanticRole: "body",
          },
          content: [{ text: "组件正文", type: "text" }],
        },
        {
          type: "imageBlock",
          attrs: {
            alt: "摘要配图",
            locked: false,
            resourceId: "resource_summary_image",
            semanticRole: "image",
          },
        },
      ],
    });
    expect(() => editorContentToDocument(documentV1Fixture, editor.getJSON())).not.toThrow();
  });

  it("renders registered and missing component Node Views through the registry boundary", () => {
    const registry = new ComponentRegistry();
    registry.register(summaryCardManifest);
    const element = document.createElement("div");
    document.body.append(element);
    const editor = new Editor({
      element,
      content: {
        type: "doc",
        content: [
          {
            type: "semanticCard",
            attrs: {
              blockId: "block_component_available",
              componentId: "cmp_card_summary_default_001",
              componentVersion: "1.0.0",
              locked: false,
            },
          },
          {
            type: "semanticCard",
            attrs: {
              blockId: "block_component_missing",
              componentId: "cmp_card_missing_default_001",
              componentVersion: "9.9.9",
              locked: false,
            },
          },
        ],
      },
      extensions: createDocumentExtensions({
        componentNodeViewResolver: (reference) => registry.describeNodeView(reference),
      }),
    });
    editors.push(editor);

    const nodeViews = element.querySelectorAll<HTMLElement>(".editor-semantic-card");
    expect(nodeViews).toHaveLength(2);
    expect(nodeViews[0]?.dataset).toMatchObject({
      componentRenderer: "SummaryCardNodeView",
      componentState: "available",
      componentVersion: "1.0.0",
    });
    expect(nodeViews[0]?.textContent).toContain("摘要卡片");
    expect(nodeViews[1]?.dataset).toMatchObject({
      componentRenderer: "safePlaceholder",
      componentState: "missing",
      componentVersion: "9.9.9",
    });
    expect(nodeViews[1]?.textContent).toContain("安全占位");
  });
});
