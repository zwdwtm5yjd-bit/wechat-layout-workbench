import { describe, expect, it } from "vitest";

import { parsePublicEnvironment } from "./public.js";

describe("parsePublicEnvironment", () => {
  it("provides browser-safe local defaults", () => {
    expect(parsePublicEnvironment({})).toEqual({
      environment: "development",
      appName: "公众号智能视觉排版工具",
      appUrl: "http://localhost:3000",
      apiBaseUrl: "http://localhost:3001",
      features: {
        wechatSync: false,
        remoteComponents: false,
      },
    });
  });

  it("requires explicit HTTPS URLs in production", () => {
    expect(() =>
      parsePublicEnvironment({
        APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://example.com",
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL.*HTTPS/);
  });

  it("does not return unknown server-only values", () => {
    const configuration = parsePublicEnvironment({
      DATABASE_URL: "postgresql://sensitive-value",
      SESSION_SECRET: "sensitive-value",
    });

    expect(JSON.stringify(configuration)).not.toContain("sensitive-value");
    expect(configuration).not.toHaveProperty("DATABASE_URL");
  });
});
