import { describe, expect, it } from "vitest";

import { decideRouteAccess } from "./route-policy";

describe("route policy", () => {
  it("allows public routes without a session hint", () => {
    expect(decideRouteAccess("/login", false)).toEqual({ allowed: true });
  });

  it("redirects an anonymous workspace request to login", () => {
    expect(decideRouteAccess("/workspace", false)).toEqual({
      allowed: false,
      redirectPath: "/login",
    });
  });

  it("protects nested workspace routes", () => {
    expect(decideRouteAccess("/workspace/articles/one", false).allowed).toBe(false);
  });

  it("allows a workspace request with a session hint", () => {
    expect(decideRouteAccess("/workspace", true)).toEqual({ allowed: true });
  });
});
