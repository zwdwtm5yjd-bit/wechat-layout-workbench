import { describe, expect, it } from "vitest";

import { readableTextColor } from "./color-contrast";

describe("readableTextColor", () => {
  it("uses dark text for light cyan, gold and shorthand colors", () => {
    expect(readableTextColor("#22D3EE")).toBe("#111827");
    expect(readableTextColor("#D29A54")).toBe("#111827");
    expect(readableTextColor("#fff")).toBe("#111827");
  });

  it("uses white text for dark backgrounds", () => {
    expect(readableTextColor("#17324D")).toBe("#FFFFFF");
    expect(readableTextColor("#111827")).toBe("#FFFFFF");
  });

  it("fails safely for an invalid color", () => {
    expect(readableTextColor("not-a-color")).toBe("#111827");
  });
});
