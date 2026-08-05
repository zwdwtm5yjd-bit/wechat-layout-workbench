import { describe, expect, it } from "vitest";

import {
  EDITOR_COMPONENT_SECTIONS,
  V0_COMPONENT_PREVIEWS,
  componentMatchesEditorScene,
  editorComponentSection,
  isPopularEditorComponent,
} from "./v0-catalog";

describe("editor component taxonomy", () => {
  it("places every component in one user-facing type without mixing format and purpose", () => {
    const counts = Object.fromEntries(
      EDITOR_COMPONENT_SECTIONS.filter((section) => section.id !== "popular").map((section) => [
        section.id,
        V0_COMPONENT_PREVIEWS.filter(
          (component) => editorComponentSection(component) === section.id,
        ).length,
      ]),
    );

    expect(counts).toEqual({
      card: 17,
      heading: 12,
      image: 7,
      layout: 7,
      svg: 3,
      utility: 7,
    });
    expect(Object.values(counts).reduce((total, count) => total + count, 0)).toBe(
      V0_COMPONENT_PREVIEWS.length,
    );
  });

  it("provides a deliberately curated popular shelf across the main types", () => {
    const popular = V0_COMPONENT_PREVIEWS.filter(isPopularEditorComponent);
    expect(popular).toHaveLength(14);
    expect(new Set(popular.map(editorComponentSection))).toEqual(
      new Set(["heading", "card", "image", "layout", "svg", "utility"]),
    );
  });

  it("treats usage scene as an independent filter", () => {
    const government = V0_COMPONENT_PREVIEWS.find(
      (component) => component.id === "cmp_gov_red_gold_banner_001",
    );
    const lifestyle = V0_COMPONENT_PREVIEWS.find(
      (component) => component.id === "cmp_intro_leaf_story_003",
    );

    expect(government).toBeDefined();
    expect(componentMatchesEditorScene(government!, "formal")).toBe(true);
    expect(componentMatchesEditorScene(government!, "lifestyle")).toBe(false);
    expect(lifestyle).toBeDefined();
    expect(componentMatchesEditorScene(lifestyle!, "lifestyle")).toBe(true);
  });
});
