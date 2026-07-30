import { inspect } from "node:util";

import { describe, expect, it } from "vitest";

import { parseServerEnvironment, revealSecret, type ServerConfiguration } from "./server.js";

const validEnvironment = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/wechat_layout",
  REDIS_URL: "redis://:password@localhost:6379/0",
  S3_ACCESS_KEY_ID: "local-access-key",
  S3_SECRET_ACCESS_KEY: "local-secret-access-key",
  SESSION_SECRET: "session-secret-000000000000000000000000000000000001",
  CSRF_SECRET: "csrf-secret-00000000000000000000000000000000000002",
  FIELD_ENCRYPTION_KEY: "field-secret-0000000000000000000000000000000000003",
  ASSET_SIGNING_KEY: "asset-secret-0000000000000000000000000000000000004",
  BACKUP_ENCRYPTION_KEY: "backup-secret-000000000000000000000000000000000005",
} satisfies Record<string, string>;

describe("parseServerEnvironment", () => {
  it("builds a typed development configuration", () => {
    const configuration = parseServerEnvironment(validEnvironment);

    expect(configuration.application).toMatchObject({
      environment: "development",
      nodeEnvironment: "development",
      logLevel: "debug",
      apiPort: 3001,
    });
    expect(configuration.limits).toEqual({
      jsonBodyBytes: 2 * 1024 * 1024,
      docxFileBytes: 50 * 1024 * 1024,
      imageFileBytes: 20 * 1024 * 1024,
      brandPackageBytes: 100 * 1024 * 1024,
    });
  });

  it("reports missing critical keys without echoing another secret", () => {
    const sensitiveValue = "must-never-appear-00000000000000000000000000000000000";

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: undefined,
        SESSION_SECRET: sensitiveValue,
      }),
    ).toThrow(/DATABASE_URL/);

    try {
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: undefined,
        SESSION_SECRET: sensitiveValue,
      });
    } catch (error) {
      expect(String(error)).not.toContain(sensitiveValue);
    }
  });

  it("rejects example placeholders and reused security keys", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        S3_ACCESS_KEY_ID: "CHANGE_ME",
      }),
    ).toThrow(/S3_ACCESS_KEY_ID.*占位值/);

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        CSRF_SECRET: validEnvironment.SESSION_SECRET,
      }),
    ).toThrow(/安全密钥必须彼此不同/);
  });

  it("redacts secrets from strings, JSON and Node inspection", () => {
    const configuration: ServerConfiguration = parseServerEnvironment(validEnvironment);
    const secret = configuration.security.sessionSecret;

    expect(String(secret)).toBe("[REDACTED]");
    expect(JSON.stringify(configuration)).toContain("[REDACTED]");
    expect(JSON.stringify(configuration)).not.toContain(validEnvironment.SESSION_SECRET);
    expect(inspect(configuration)).not.toContain(validEnvironment.SESSION_SECRET);
    expect(revealSecret(secret)).toBe(validEnvironment.SESSION_SECRET);
  });

  it("enforces production-only safety constraints", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        PUBLIC_WEB_URL: "http://example.com",
        S3_ENDPOINT: "https://storage.example.com",
        S3_BUCKET: "wechat-layout-production",
        SMTP_HOST: "smtp.example.com",
      }),
    ).toThrow(/PUBLIC_WEB_URL.*HTTPS/);
  });

  it("rejects application and Node environment mixing", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "test",
        NODE_ENV: "production",
      }),
    ).toThrow(/NODE_ENV.*APP_ENV=test/);
  });
});
