import { describe, expect, it } from "vitest";

import { validMetricsAuthorization } from "./metrics-auth.js";

describe("validMetricsAuthorization", () => {
  const token = "metrics-token-that-is-at-least-32-characters";

  it("accepts only the exact bearer token", () => {
    expect(validMetricsAuthorization(`Bearer ${token}`, token)).toBe(true);
    expect(validMetricsAuthorization(`Bearer ${token}x`, token)).toBe(false);
    expect(validMetricsAuthorization("Bearer incorrect-token", token)).toBe(false);
    expect(validMetricsAuthorization(token, token)).toBe(false);
    expect(validMetricsAuthorization(undefined, token)).toBe(false);
  });
});
