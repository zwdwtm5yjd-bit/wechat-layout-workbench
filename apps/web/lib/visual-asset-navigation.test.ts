import { describe, expect, it } from "vitest";

import {
  VISUAL_ASSET_TASK_GROUPS,
  visualAssetMatchesTaskGroup,
  visualAssetTaskGroupFunctions,
} from "./visual-asset-navigation";

describe("visual asset task navigation", () => {
  it("organizes every visual asset function into one user task", () => {
    const functions = VISUAL_ASSET_TASK_GROUPS.flatMap((group) => [...group.functions]);

    expect(functions).toHaveLength(10);
    expect(new Set(functions).size).toBe(10);
  });

  it("matches assets through explicit task groups", () => {
    const sticker = { function: "sticker" } as Parameters<typeof visualAssetMatchesTaskGroup>[0];

    expect(visualAssetMatchesTaskGroup(sticker, "decoration")).toBe(true);
    expect(visualAssetMatchesTaskGroup(sticker, "imagery")).toBe(false);
    expect(visualAssetMatchesTaskGroup(sticker, "all")).toBe(true);
    expect(visualAssetTaskGroupFunctions("information")).toEqual([
      "heading",
      "divider",
      "badge",
      "ribbon",
    ]);
  });
});
