import {
  OFFICIAL_DYNAMIC_VISUAL_ASSETS,
  OFFICIAL_STATIC_VISUAL_ASSETS,
} from "@wechat-layout/component-registry";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import { inspectDocumentCompatibility, renderWechatHtml } from "./index.js";

const staticAsset = OFFICIAL_STATIC_VISUAL_ASSETS[0]!;
const dynamicAsset = OFFICIAL_DYNAMIC_VISUAL_ASSETS[0]!;

const document: DocumentV1 = {
  articleId: "article_visual_asset_test",
  content: {
    content: [
      {
        attrs: {
          alt: staticAsset.name,
          blockId: "block_static_asset",
          locked: false,
          resourceId: staticAsset.resourceId,
        },
        type: "imageBlock",
      },
      {
        attrs: {
          blockId: "block_dynamic_asset",
          configuration: { effect: dynamicAsset.effect ?? "float" },
          fallbackResourceId: dynamicAsset.fallbackResourceId!,
          interactionId: "interaction_visual_asset_test",
          interactionType: dynamicAsset.effect!,
          locked: false,
          resourceIds: [dynamicAsset.resourceId],
          templateId: dynamicAsset.id,
          templateVersion: "1.0.0",
        },
        type: "svgInteraction",
      },
    ],
    type: "doc",
  },
  documentId: "document_visual_asset_test",
  meta: {
    createdAt: "2026-08-05T08:00:00+08:00",
    sourceType: "manual",
    textLocked: false,
    updatedAt: "2026-08-05T08:00:00+08:00",
  },
  schemaVersion: "1.0.0",
};

describe("built-in visual asset rendering", () => {
  it("resolves static assets and dynamic fallbacks without caller supplied resource maps", () => {
    const result = renderWechatHtml({ document, resources: {} });
    expect(result.html).toContain(`https://visual.ericmm.com${staticAsset.previewPath}`);
    expect(result.html).toContain(
      `https://visual.ericmm.com/visual-assets/library/static/static-001.svg`,
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "SVG_STATIC_FALLBACK" })]),
    );
    expect(result.warnings.some((warning) => warning.code === "RESOURCE_MISSING")).toBe(false);
    expect(inspectDocumentCompatibility(document, {}, "wechat_safe")).toEqual([]);
  });
});
