import { collectDocumentEntries, type DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { describe, expect, it } from "vitest";

import { buildSnapshotManifests } from "./snapshot-manifest.js";

describe("buildSnapshotManifests", () => {
  it("collects exact component dependencies from every component-backed block type", () => {
    const document = structuredClone(documentV1Fixture) as DocumentV1;
    const blocks = collectDocumentEntries(document.content).blocks;
    const expected = blocks.map(({ node }, index) => {
      const componentId = `component_snapshot_${String(index + 1)}`;
      node.attrs.componentId = componentId;
      node.attrs.componentVersion = "2.4.0";
      node.attrs.componentVariantId = "compact";
      return componentId;
    });

    const manifests = buildSnapshotManifests(document, {
      brandVersionId: null,
      themeId: null,
      themeVersion: null,
    });

    expect(
      manifests.packageManifest
        .filter((entry) => entry.kind === "component")
        .map((entry) => entry.packageId)
        .sort(),
    ).toEqual([...expected].sort());
    expect(
      manifests.packageManifest
        .filter((entry) => entry.kind === "component")
        .every((entry) => entry.version === "2.4.0"),
    ).toBe(true);
    expect(
      manifests.packageManifest.some(
        (entry) => entry.kind === "svg" && entry.packageId === "svg_before_after_slider",
      ),
    ).toBe(true);
    expect(
      manifests.packageManifest.some(
        (entry) => entry.kind === "brand_footer" && entry.packageId === "footer_template_fixture",
      ),
    ).toBe(true);
  });
});
