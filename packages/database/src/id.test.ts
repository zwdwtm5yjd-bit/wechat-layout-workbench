import { describe, expect, it } from "vitest";

import { createUuidV7, isUuidV7 } from "./id.js";

describe("UUIDv7", () => {
  it("generates application-owned RFC 9562 version 7 identifiers", () => {
    const identifiers = Array.from({ length: 20 }, () => createUuidV7());

    expect(identifiers.every(isUuidV7)).toBe(true);
    expect(new Set(identifiers)).toHaveLength(identifiers.length);
    expect([...identifiers].sort()).toEqual(identifiers);
  });

  it("rejects non-v7 identifiers", () => {
    expect(isUuidV7("not-a-uuid")).toBe(false);
    expect(isUuidV7("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
