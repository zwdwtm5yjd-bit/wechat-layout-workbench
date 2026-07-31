import { documentPlainText, validateDocument } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import { extremeArticleFixture, pasteSourceFixtures, standardArticleFixtures } from "./index.js";

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
