import { collectDocumentEntries, type DocumentV1 } from "@wechat-layout/document-schema";

import type {
  SnapshotPackageManifestEntry,
  SnapshotResourceManifestEntry,
} from "./snapshot.types.js";

interface ArticlePackageState {
  readonly themeId: string | null;
  readonly themeVersion: string | null;
  readonly brandVersionId: string | null;
}

interface ResourceReference {
  readonly blockId: string;
  readonly usageType: string;
}

function addResource(
  resources: Map<string, ResourceReference[]>,
  resourceId: string | undefined,
  reference: ResourceReference,
): void {
  if (resourceId === undefined) {
    return;
  }
  const references = resources.get(resourceId) ?? [];
  references.push(reference);
  resources.set(resourceId, references);
}

export function buildSnapshotManifests(
  document: DocumentV1,
  article: ArticlePackageState,
): {
  readonly resourceManifest: SnapshotResourceManifestEntry[];
  readonly packageManifest: SnapshotPackageManifestEntry[];
} {
  const resources = new Map<string, ResourceReference[]>();
  const packages = new Map<string, SnapshotPackageManifestEntry>();

  const addPackage = (entry: SnapshotPackageManifestEntry) => {
    packages.set(`${entry.kind}:${entry.packageId}:${entry.version ?? ""}`, entry);
  };

  if (article.themeId !== null) {
    addPackage({
      kind: "theme",
      packageId: article.themeId,
      version: article.themeVersion,
    });
  }
  if (article.brandVersionId !== null) {
    addPackage({
      kind: "brand",
      packageId: article.brandVersionId,
      version: document.brandVersion ?? null,
    });
  }

  for (const { node } of collectDocumentEntries(document.content).blocks) {
    if (node.type === "imageBlock") {
      const reference = { blockId: node.attrs.blockId, usageType: "image" };
      addResource(resources, node.attrs.resourceId, reference);
      addResource(resources, node.attrs.originalResourceId, {
        ...reference,
        usageType: "image_original",
      });
      addResource(resources, node.attrs.watermarkId, {
        ...reference,
        usageType: "watermark",
      });
    } else if (node.type === "svgInteraction") {
      node.attrs.resourceIds.forEach((resourceId) => {
        addResource(resources, resourceId, {
          blockId: node.attrs.blockId,
          usageType: "svg_asset",
        });
      });
      addResource(resources, node.attrs.fallbackResourceId, {
        blockId: node.attrs.blockId,
        usageType: "svg_fallback",
      });
      addPackage({
        kind: "svg",
        packageId: node.attrs.templateId,
        version: node.attrs.templateVersion,
      });
    } else if (node.type === "semanticCard") {
      addPackage({
        kind: "component",
        packageId: node.attrs.componentId,
        version: node.attrs.componentVersion,
      });
    } else if (node.type === "brandFooter") {
      addPackage({
        kind: "brand_footer",
        packageId: node.attrs.templateId,
        version: node.attrs.frozenVersion ?? null,
      });
    }
  }

  return {
    resourceManifest: [...resources.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resourceId, references]) => ({
        resourceId,
        references,
      })),
    packageManifest: [...packages.values()].sort((left, right) =>
      `${left.kind}:${left.packageId}`.localeCompare(`${right.kind}:${right.packageId}`),
    ),
  };
}
