import { createOfficialComponentRegistry } from "@wechat-layout/component-registry";
import { documentPlainText, validateDocument } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import {
  extremeArticleFixture,
  materializeAcceptanceFixture,
  pasteSourceFixtures,
  standardArticleFixtures,
} from "./index.js";

describe("V0.1 standard article fixtures", () => {
  it("keeps all four fixtures valid and uniquely identified", () => {
    expect(standardArticleFixtures).toHaveLength(4);
    expect(new Set(standardArticleFixtures.map((fixture) => fixture.id)).size).toBe(4);

    for (const fixture of standardArticleFixtures) {
      expect(validateDocument(fixture.document)).toEqual({
        data: fixture.document,
        success: true,
      });
      expect(fixture.expectedFeatures.length).toBeGreaterThan(0);
    }
  });

  it("resolves every semantic card through an exact official component reference", () => {
    const registry = createOfficialComponentRegistry();
    const semanticCards = standardArticleFixtures.flatMap((fixture) =>
      fixture.document.content.content.filter((node) => node.type === "semanticCard"),
    );

    expect(semanticCards).toHaveLength(6);
    semanticCards.forEach((node) => {
      expect(node.attrs.componentVersion).toBe("1.0.0");
      expect(node.attrs.componentVariantId).toBe("default");

      const resolution = registry.resolve({
        componentId: node.attrs.componentId,
        version: node.attrs.componentVersion,
      });

      expect(resolution.status).toBe("available");
      if (resolution.status === "available") {
        expect(resolution.descriptor.manifest.nodeType).toBe(node.type);
        expect(resolution.descriptor.version).toBe("1.0.0");
        expect(resolution.descriptor.variantId).toBe(node.attrs.componentVariantId);
      }
    });

    const partyData = semanticCards.find((node) => node.attrs.blockId === "party_data");
    expect(partyData).toMatchObject({
      attrs: {
        componentId: "cmp_data_progress_metric_003",
        eyebrow: "关键数据",
        footer: "本轮巡察已完成阶段性问题整改。",
        title: "整改完成率",
        variant: "progress",
      },
      content: [
        {
          content: [{ text: "92%", type: "text" }],
          type: "paragraph",
        },
      ],
    });

    const parameterCard = semanticCards.find((node) => node.attrs.blockId === "ai_specs");
    expect(parameterCard?.attrs).toMatchObject({
      componentId: "cmp_notice_info_blue_001",
      title: "8B 参数 · 32K 上下文",
      variant: "info",
    });
  });

  it("materializes isolated acceptance documents without changing text or source fixtures", () => {
    const expectedImageCounts = {
      ai_technology: 1,
      extreme: 50,
      legal: 0,
      party_inspection: 1,
    } as const;
    const sourceSnapshots = standardArticleFixtures.map((fixture) =>
      structuredClone(fixture.document),
    );

    standardArticleFixtures.forEach((fixture) => {
      const sourceImages = fixture.document.content.content.filter(
        (node) => node.type === "imageBlock",
      );
      const resourceIds = Object.fromEntries(
        sourceImages.map((node, imageIndex) => [
          node.attrs.resourceId,
          `acceptance_${fixture.id}_${String(imageIndex + 1).padStart(2, "0")}`,
        ]),
      );
      const materialized = materializeAcceptanceFixture({
        articleId: `acceptance_article_${fixture.id}`,
        createdAt: "2026-08-03T09:00:00+08:00",
        documentId: `acceptance_document_${fixture.id}`,
        fixture,
        resourceIds,
        updatedAt: "2026-08-03T09:30:00+08:00",
      });
      const materializedImages = materialized.content.content.filter(
        (node) => node.type === "imageBlock",
      );

      expect(materialized).not.toBe(fixture.document);
      expect(materialized.content).not.toBe(fixture.document.content);
      expect(materialized.articleId).toBe(`acceptance_article_${fixture.id}`);
      expect(materialized.documentId).toBe(`acceptance_document_${fixture.id}`);
      expect(materialized.meta.createdAt).toBe("2026-08-03T09:00:00+08:00");
      expect(materialized.meta.updatedAt).toBe("2026-08-03T09:30:00+08:00");
      expect(documentPlainText(materialized.content)).toBe(
        documentPlainText(fixture.document.content),
      );
      expect(materialized.content.content.map((node) => node.attrs.blockId)).toEqual(
        fixture.document.content.content.map((node) => node.attrs.blockId),
      );
      expect(materializedImages).toHaveLength(expectedImageCounts[fixture.id]);
      materializedImages.forEach((node, imageIndex) => {
        expect(node.attrs.resourceId).toBe(
          resourceIds[sourceImages[imageIndex]?.attrs.resourceId ?? ""],
        );
        expect(node.attrs.resourceId).not.toMatch(/^fixture_resource_/);
      });
      expect(validateDocument(materialized)).toEqual({
        data: materialized,
        success: true,
      });
    });

    standardArticleFixtures.forEach((fixture, index) => {
      expect(fixture.document).toEqual(sourceSnapshots[index]);
    });
  });

  it("identifies the fixture, block and source resource when a mapping is missing", () => {
    expect(() =>
      materializeAcceptanceFixture({
        articleId: "acceptance_article_party_missing_resource",
        createdAt: "2026-08-03T09:00:00+08:00",
        documentId: "acceptance_document_party_missing_resource",
        fixture: standardArticleFixtures[0],
        resourceIds: {},
        updatedAt: "2026-08-03T09:30:00+08:00",
      }),
    ).toThrow(
      "Acceptance fixture party_inspection is missing resourceIds mapping for block party_image: fixture_resource_01",
    );
  });

  it("covers the extreme-length and image-count release boundaries", () => {
    const renderedText = documentPlainText(extremeArticleFixture.document.content);
    const images = extremeArticleFixture.document.content.content.filter(
      (node) => node.type === "imageBlock",
    );
    const heading = extremeArticleFixture.document.content.content[0];

    expect(renderedText.length).toBeGreaterThanOrEqual(10_000);
    expect(images).toHaveLength(50);
    expect(heading?.type).toBe("heading");
    if (heading?.type === "heading") {
      expect(
        heading.content?.[0]?.type === "text" ? heading.content[0].text.length : 0,
      ).toBeGreaterThan(40);
    }
  });

  it("keeps hostile paste input outside the authoritative document fixtures", () => {
    expect(pasteSourceFixtures.maliciousHtml.html).toContain("<script>");
    expect(pasteSourceFixtures.maliciousHtml.html).toContain("javascript:");
    expect(
      standardArticleFixtures.some((fixture) =>
        JSON.stringify(fixture.document).includes("<script>"),
      ),
    ).toBe(false);
  });
});
