import { describe, expect, it } from "vitest";

import {
  parseAiLayoutTemplatePreferences,
  recordRecentAiLayoutTemplate,
  serializeAiLayoutTemplatePreferences,
  toggleAiLayoutTemplateFavorite,
} from "./template-preferences";

describe("AI layout template preferences", () => {
  it("recovers from bad storage and removes templates absent from the catalog", () => {
    expect(parseAiLayoutTemplatePreferences("bad-json")).toMatchObject({
      favoriteTemplateIds: [],
      recentTemplateIds: [],
    });
    expect(
      parseAiLayoutTemplatePreferences(
        JSON.stringify({
          version: 1,
          favoriteTemplateIds: ["a", "gone", "a"],
          recentTemplateIds: ["gone", "b"],
        }),
        new Set(["a", "b"]),
      ),
    ).toMatchObject({ favoriteTemplateIds: ["a"], recentTemplateIds: ["b"] });
  });

  it("keeps template favorites separate and records at most twelve recent templates", () => {
    let preferences = parseAiLayoutTemplatePreferences(null);
    preferences = toggleAiLayoutTemplateFavorite(preferences, "template-1");
    for (let index = 0; index < 14; index += 1) {
      preferences = recordRecentAiLayoutTemplate(preferences, `template-${String(index)}`, "v2");
    }
    const roundTrip = parseAiLayoutTemplatePreferences(
      serializeAiLayoutTemplatePreferences(preferences),
    );
    expect(roundTrip.favoriteTemplateIds).toEqual(["template-1"]);
    expect(roundTrip.recentTemplateIds).toHaveLength(12);
    expect(roundTrip.recentTemplateIds[0]).toBe("template-13");
    expect(roundTrip.catalogVersion).toBe("v2");
  });
});
