import { describe, expect, it } from "vitest";

import { layoutTransactionOrigin } from "./layout-transaction";

describe("layoutTransactionOrigin", () => {
  it.each(["ai", "rule"] as const)("returns an API-safe origin for %s layouts", (mode) => {
    expect(layoutTransactionOrigin(mode)).toMatch(/^[a-z][a-z0-9_.-]*$/);
  });

  it("does not include the layout plan id", () => {
    expect(layoutTransactionOrigin("ai")).toBe("layout.ai.apply");
  });
});
