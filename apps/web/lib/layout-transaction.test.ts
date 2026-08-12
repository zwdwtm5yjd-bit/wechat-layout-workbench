import { describe, expect, it } from "vitest";

import {
  layoutDraftModeFromOrigin,
  layoutDraftTransactionOrigin,
  layoutTransactionOrigin,
} from "./layout-transaction";

describe("layoutTransactionOrigin", () => {
  it.each(["ai", "rule"] as const)("returns an API-safe origin for %s layouts", (mode) => {
    expect(layoutTransactionOrigin(mode)).toMatch(/^[a-z][a-z0-9_.-]*$/);
  });

  it("does not include the layout plan id", () => {
    expect(layoutTransactionOrigin("ai")).toBe("layout.ai.apply");
  });

  it.each(["ai", "rule"] as const)("round-trips a manual %s layout draft", (mode) => {
    const origin = layoutDraftTransactionOrigin(mode);
    expect(origin).toMatch(/^[a-z][a-z0-9_.-]*$/);
    expect(layoutDraftModeFromOrigin(origin)).toBe(mode);
  });

  it("does not mistake normal editor changes for layout drafts", () => {
    expect(layoutDraftModeFromOrigin("editor.input")).toBeNull();
  });
});
