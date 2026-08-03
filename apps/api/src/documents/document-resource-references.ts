import { collectDocumentEntries, type DocumentV1 } from "@wechat-layout/document-schema";

export const DOCUMENT_RESOURCE_USAGE_TYPES = [
  "image",
  "image_original",
  "watermark",
  "svg_asset",
  "svg_fallback",
] as const;

export type DocumentResourceUsageType = (typeof DOCUMENT_RESOURCE_USAGE_TYPES)[number];

const pendingComponentResourceIds = new Set([
  "component_slot_image_pending",
  "component_slot_qrcode_pending",
]);

export interface DocumentResourceReference {
  readonly blockId: string;
  readonly path: string;
  readonly resourceId: string;
  readonly sortOrder: number;
  readonly usageType: DocumentResourceUsageType;
}

export function collectDocumentResourceReferences(
  document: DocumentV1,
): DocumentResourceReference[] {
  const references: DocumentResourceReference[] = [];

  const add = (
    resourceId: string | undefined,
    blockId: string,
    path: string,
    usageType: DocumentResourceUsageType,
  ) => {
    if (resourceId === undefined || pendingComponentResourceIds.has(resourceId)) {
      return;
    }
    references.push({
      blockId,
      path,
      resourceId,
      sortOrder: references.length,
      usageType,
    });
  };

  for (const { node, path } of collectDocumentEntries(document.content).blocks) {
    if (node.type === "imageBlock") {
      add(node.attrs.resourceId, node.attrs.blockId, `${path}/attrs/resourceId`, "image");
      add(
        node.attrs.originalResourceId,
        node.attrs.blockId,
        `${path}/attrs/originalResourceId`,
        "image_original",
      );
      add(node.attrs.watermarkId, node.attrs.blockId, `${path}/attrs/watermarkId`, "watermark");
    } else if (node.type === "svgInteraction") {
      node.attrs.resourceIds.forEach((resourceId, index) => {
        add(
          resourceId,
          node.attrs.blockId,
          `${path}/attrs/resourceIds/${String(index)}`,
          "svg_asset",
        );
      });
      add(
        node.attrs.fallbackResourceId,
        node.attrs.blockId,
        `${path}/attrs/fallbackResourceId`,
        "svg_fallback",
      );
    }
  }

  return references;
}
