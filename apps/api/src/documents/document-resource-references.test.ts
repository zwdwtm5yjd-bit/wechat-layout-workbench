import type { DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { describe, expect, it } from "vitest";

import { collectDocumentResourceReferences } from "./document-resource-references.js";

describe("document resource references", () => {
  it("collects image, watermark and SVG resources in stable document order", () => {
    const document = structuredClone(documentV1Fixture) as DocumentV1;
    const image = document.content.content.find((node) => node.type === "imageBlock");
    if (image?.type !== "imageBlock") {
      throw new Error("Document fixture image is missing");
    }
    image.attrs.watermarkId = "resource_watermark";

    const references = collectDocumentResourceReferences(document);

    expect(
      references.map(({ blockId, resourceId, sortOrder, usageType }) => ({
        blockId,
        resourceId,
        sortOrder,
        usageType,
      })),
    ).toEqual([
      {
        blockId: "block_image",
        resourceId: "resource_image",
        sortOrder: 0,
        usageType: "image",
      },
      {
        blockId: "block_image",
        resourceId: "resource_image_original",
        sortOrder: 1,
        usageType: "image_original",
      },
      {
        blockId: "block_image",
        resourceId: "resource_watermark",
        sortOrder: 2,
        usageType: "watermark",
      },
      {
        blockId: "block_svg_placeholder",
        resourceId: "resource_before",
        sortOrder: 3,
        usageType: "svg_asset",
      },
      {
        blockId: "block_svg_placeholder",
        resourceId: "resource_after",
        sortOrder: 4,
        usageType: "svg_asset",
      },
      {
        blockId: "block_svg_placeholder",
        resourceId: "resource_static_fallback",
        sortOrder: 5,
        usageType: "svg_fallback",
      },
    ]);
    expect(references.map(({ path }) => path)).toEqual([
      expect.stringMatching(/\/attrs\/resourceId$/),
      expect.stringMatching(/\/attrs\/originalResourceId$/),
      expect.stringMatching(/\/attrs\/watermarkId$/),
      expect.stringMatching(/\/attrs\/resourceIds\/0$/),
      expect.stringMatching(/\/attrs\/resourceIds\/1$/),
      expect.stringMatching(/\/attrs\/fallbackResourceId$/),
    ]);
  });

  it("returns no references for an empty document", () => {
    const document = structuredClone(documentV1Fixture) as DocumentV1;
    document.content.content = [];

    expect(collectDocumentResourceReferences(document)).toEqual([]);
  });

  it("does not register component image slots that are still pending user input", () => {
    const document = structuredClone(documentV1Fixture) as DocumentV1;
    const fixtureImage = document.content.content.find((node) => node.type === "imageBlock");
    if (fixtureImage?.type !== "imageBlock") {
      throw new Error("Document fixture image is missing");
    }
    const pendingImage = structuredClone(fixtureImage);
    pendingImage.attrs.blockId = "pending_component_image";
    pendingImage.attrs.resourceId = "component_slot_image_pending";
    delete pendingImage.attrs.originalResourceId;
    const pendingQrcode = structuredClone(fixtureImage);
    pendingQrcode.attrs.blockId = "pending_component_qrcode";
    pendingQrcode.attrs.resourceId = "component_slot_qrcode_pending";
    delete pendingQrcode.attrs.originalResourceId;
    document.content.content = [pendingImage, pendingQrcode];

    expect(collectDocumentResourceReferences(document)).toEqual([]);
  });

  it("preserves repeated block references without mutating the document", () => {
    const document = structuredClone(documentV1Fixture) as DocumentV1;
    const fixtureImage = document.content.content.find((node) => node.type === "imageBlock");
    if (fixtureImage?.type !== "imageBlock") {
      throw new Error("Document fixture image is missing");
    }
    const first = structuredClone(fixtureImage);
    first.attrs.blockId = "repeated-image-a";
    first.attrs.resourceId = "resource_shared";
    delete first.attrs.originalResourceId;
    const second = structuredClone(first);
    second.attrs.blockId = "repeated-image-b";
    document.content.content = [first, second];
    const before = structuredClone(document);

    expect(
      collectDocumentResourceReferences(document).map(({ blockId, resourceId }) => ({
        blockId,
        resourceId,
      })),
    ).toEqual([
      { blockId: "repeated-image-a", resourceId: "resource_shared" },
      { blockId: "repeated-image-b", resourceId: "resource_shared" },
    ]);
    expect(document).toEqual(before);
  });

  it("keeps the generic editor fallback visible so persistence rejects it", () => {
    const document = structuredClone(documentV1Fixture) as DocumentV1;
    const fixtureImage = document.content.content.find((node) => node.type === "imageBlock");
    if (fixtureImage?.type !== "imageBlock") {
      throw new Error("Document fixture image is missing");
    }
    fixtureImage.attrs.resourceId = "resource_pending";
    delete fixtureImage.attrs.originalResourceId;
    document.content.content = [fixtureImage];

    expect(collectDocumentResourceReferences(document)).toEqual([
      expect.objectContaining({ resourceId: "resource_pending", usageType: "image" }),
    ]);
  });
});
