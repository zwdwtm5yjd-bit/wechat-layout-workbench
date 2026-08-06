// @vitest-environment jsdom

import {
  OFFICIAL_DYNAMIC_VISUAL_ASSETS,
  OFFICIAL_STATIC_VISUAL_ASSETS,
} from "@wechat-layout/component-registry";
import { validateDocument } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDocumentExtensions,
  documentToEditorContent,
  editorContentToDocument,
  insertVisualAssetAfterSelection,
} from "./index.js";

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe("visual asset insertion", () => {
  it("inserts images, editable decoration containers, draggable stickers and dynamic SVG fallbacks", () => {
    const editor = new Editor({
      content: documentToEditorContent(documentV1Fixture),
      extensions: createDocumentExtensions(),
    });
    editors.push(editor);
    const staticAsset = OFFICIAL_STATIC_VISUAL_ASSETS[0]!;
    const frameAsset = OFFICIAL_STATIC_VISUAL_ASSETS.find((asset) => asset.function === "frame")!;
    const stickerAsset = OFFICIAL_STATIC_VISUAL_ASSETS.find(
      (asset) => asset.function === "sticker" && asset.resourceId === "builtin_visual_static_101",
    )!;
    const dynamicAsset = OFFICIAL_DYNAMIC_VISUAL_ASSETS[0]!;

    expect(insertVisualAssetAfterSelection(editor, staticAsset)).toBe(true);
    expect(insertVisualAssetAfterSelection(editor, frameAsset)).toBe(true);
    expect(insertVisualAssetAfterSelection(editor, stickerAsset)).toBe(true);
    expect(insertVisualAssetAfterSelection(editor, dynamicAsset)).toBe(true);

    const document = editorContentToDocument(
      documentV1Fixture,
      editor.getJSON(),
      new Date(documentV1Fixture.meta.updatedAt),
    );
    expect(validateDocument(document)).toMatchObject({ success: true });
    expect(document.content.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attrs: expect.objectContaining({ resourceId: staticAsset.resourceId }),
          type: "imageBlock",
        }),
        expect.objectContaining({
          attrs: expect.objectContaining({
            decorationType: "frame",
            resourceId: frameAsset.resourceId,
          }),
          content: [expect.objectContaining({ text: "点击输入文字", type: "text" })],
          type: "decorativeContainer",
        }),
        expect.objectContaining({
          attrs: expect.objectContaining({
            elementKind: "sticker",
            freePosition: true,
            resourceId: stickerAsset.resourceId,
            widthPercent: 24,
          }),
          type: "imageBlock",
        }),
        expect.objectContaining({
          attrs: expect.objectContaining({
            fallbackResourceId: dynamicAsset.fallbackResourceId,
            resourceIds: [dynamicAsset.resourceId],
          }),
          type: "svgInteraction",
        }),
      ]),
    );
  });
});
