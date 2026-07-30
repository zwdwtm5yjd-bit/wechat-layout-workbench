import { describe, expect, it } from "vitest";

import type { AuthRuntimeOptions } from "./auth.types.js";
import {
  buildCsrfBindingCookie,
  buildCsrfCookie,
  buildSessionCookie,
  clearAuthCookies,
  parseCookieHeader,
} from "./cookies.js";

const developmentOptions: AuthRuntimeOptions = {
  environment: "development",
  sessionSecret: "session-secret-for-cookie-tests",
  csrfSecret: "csrf-secret-for-cookie-tests",
  sessionTtlSeconds: 60,
  rememberedSessionTtlSeconds: 2_592_000,
  loginIdentifierMaxAttempts: 5,
  loginIpMaxAttempts: 25,
  loginRateLimitWindowSeconds: 900,
  loginLockoutSeconds: 900,
  sessionTouchIntervalSeconds: 300,
};

describe("authentication cookies", () => {
  it("keeps the session token HttpOnly and adds Secure in production", () => {
    const productionOptions: AuthRuntimeOptions = {
      ...developmentOptions,
      environment: "production",
    };
    const sessionCookie = buildSessionCookie("opaque-token", productionOptions, true);

    expect(sessionCookie).toContain("session_id=opaque-token");
    expect(sessionCookie).toContain("Path=/");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("Max-Age=2592000");
  });

  it("uses a session cookie by default and leaves the CSRF token readable", () => {
    const sessionCookie = buildSessionCookie("opaque-token", developmentOptions, false);
    const csrfCookie = buildCsrfCookie("csrf-token", developmentOptions);
    const bindingCookie = buildCsrfBindingCookie("binding", developmentOptions);

    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).not.toContain("Max-Age");
    expect(sessionCookie).not.toContain("Secure");
    expect(csrfCookie).not.toContain("HttpOnly");
    expect(bindingCookie).toContain("HttpOnly");
  });

  it("clears all authentication cookies and safely parses encoded values", () => {
    const clearedCookies = clearAuthCookies(developmentOptions);
    const parsed = parseCookieHeader("first=hello%20world; malformed; second=value%2Ftwo");

    expect(clearedCookies).toHaveLength(3);
    for (const cookie of clearedCookies) {
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    }
    expect(parsed.get("first")).toBe("hello world");
    expect(parsed.get("second")).toBe("value/two");
  });
});
