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
  METRICS_BEARER_TOKEN: "metrics-token-000000000000000000000000000000000006",
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
    expect(configuration.objectStorage.publicEndpoint).toBe("http://localhost:9000");
    expect(configuration.objectStorage.addressingStyle).toBe("path");
    expect(configuration.objectStorage.publicAddressingStyle).toBe("path");
    expect(configuration.objectStorage.metadataHeaderPrefix).toBe("x-amz-meta-");
    expect(configuration.webpageImport).toEqual({
      browserEndpoint: "http://localhost:3010",
      browserTimeoutMs: 30_000,
      fetchTimeoutMs: 15_000,
      maximumHtmlBytes: 5 * 1024 * 1024,
      maximumRedirects: 5,
    });
    expect(configuration.aiLayout).toEqual({
      apiKey: null,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.6-sol",
      protocol: "responses",
      provider: "openai-compatible",
      timeoutMs: 90_000,
    });
  });

  it("keeps the optional AI layout key redacted", () => {
    const configuration = parseServerEnvironment({
      ...validEnvironment,
      AI_LAYOUT_API_KEY: "sk-test-ai-layout-secret",
      AI_LAYOUT_BASE_URL: "https://example.com/v1/",
      AI_LAYOUT_MODEL: "layout-model",
      AI_LAYOUT_PROTOCOL: "chat-completions",
      AI_LAYOUT_PROVIDER: "kimi-code",
    });

    expect(configuration.aiLayout).toMatchObject({
      baseUrl: "https://example.com/v1",
      model: "layout-model",
      protocol: "chat-completions",
      provider: "kimi-code",
    });
    expect(JSON.stringify(configuration)).not.toContain("sk-test-ai-layout-secret");
    expect(revealSecret(configuration.aiLayout.apiKey!)).toBe("sk-test-ai-layout-secret");
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
        PUBLIC_WEB_URL: "https://app.example.com",
        S3_ENDPOINT: "https://storage.example.com",
        S3_PUBLIC_ENDPOINT: "https://assets.example.com",
        S3_BUCKET: "wechat-layout-production",
        SMTP_HOST: "smtp.example.com",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otel-collector:4318/v1/traces",
        LOKI_PUSH_URL: "http://loki:3100/loki/api/v1/push",
      }),
    ).toThrow(/S3_ADDRESSING_STYLE.*S3_PUBLIC_ADDRESSING_STYLE/);

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        PUBLIC_WEB_URL: "http://example.com",
        S3_ADDRESSING_STYLE: "virtual-hosted",
        S3_ENDPOINT: "https://storage.example.com",
        S3_BUCKET: "wechat-layout-production",
        S3_METADATA_HEADER_PREFIX: "x-cos-meta-",
        S3_PUBLIC_ADDRESSING_STYLE: "virtual-hosted",
        SMTP_HOST: "smtp.example.com",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otel-collector:4318/v1/traces",
        LOKI_PUSH_URL: "http://loki:3100/loki/api/v1/push",
      }),
    ).toThrow(/PUBLIC_WEB_URL.*HTTPS/);

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        PUBLIC_WEB_URL: "https://app.example.com",
        S3_ADDRESSING_STYLE: "virtual-hosted",
        S3_ENDPOINT: "https://storage.internal.example.com",
        S3_PUBLIC_ENDPOINT: "http://storage.example.com",
        S3_METADATA_HEADER_PREFIX: "x-cos-meta-",
        S3_PUBLIC_ADDRESSING_STYLE: "virtual-hosted",
        S3_BUCKET: "wechat-layout-production",
        SMTP_HOST: "smtp.example.com",
      }),
    ).toThrow(/S3_PUBLIC_ENDPOINT.*HTTPS/);

    const configuration = parseServerEnvironment({
      ...validEnvironment,
      APP_ENV: "production",
      PUBLIC_WEB_URL: "https://app.example.com",
      S3_ADDRESSING_STYLE: "virtual-hosted",
      S3_BUCKET: "wechat-layout-production",
      S3_ENDPOINT: "https://cos.ap-shanghai.myqcloud.com",
      S3_METADATA_HEADER_PREFIX: "x-cos-meta-",
      S3_PUBLIC_ADDRESSING_STYLE: "bucket-endpoint",
      S3_PUBLIC_ENDPOINT: "https://assets.example.com",
      SMTP_HOST: "smtp.example.com",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otel-collector:4318/v1/traces",
      LOKI_PUSH_URL: "http://loki:3100/loki/api/v1/push",
    });
    expect(configuration.objectStorage).toMatchObject({
      addressingStyle: "virtual-hosted",
      metadataHeaderPrefix: "x-cos-meta-",
      publicAddressingStyle: "bucket-endpoint",
    });
    expect(configuration.observability).toEqual({
      lokiPushUrl: "http://loki:3100/loki/api/v1/push",
      otlpTracesEndpoint: "http://otel-collector:4318/v1/traces",
    });
    expect(configuration.webpageImport.browserEndpoint).toBe("http://webpage-browser:3010");
  });

  it("rejects a production browser renderer outside the isolated service", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        PUBLIC_WEB_URL: "https://app.example.com",
        S3_ADDRESSING_STYLE: "virtual-hosted",
        S3_BUCKET: "wechat-layout-production",
        S3_ENDPOINT: "https://cos-internal.example.com",
        S3_METADATA_HEADER_PREFIX: "x-cos-meta-",
        S3_PUBLIC_ADDRESSING_STYLE: "bucket-endpoint",
        S3_PUBLIC_ENDPOINT: "https://assets.example.com",
        SMTP_HOST: "smtp.example.com",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://otel-collector:4318/v1/traces",
        LOKI_PUSH_URL: "http://loki:3100/loki/api/v1/push",
        WEBPAGE_BROWSER_ENDPOINT: "https://browser.example.com",
      }),
    ).toThrow(/WEBPAGE_BROWSER_ENDPOINT.*webpage-browser:3010/);
  });

  it("rejects observability endpoints outside their exact internal services", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        LOKI_PUSH_URL: "http://loki:9999/loki/api/v1/push",
        LOG_LEVEL: "info",
        NODE_ENV: "production",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
          "http://otel-collector:4318/v1/traces?token=not-allowed",
        PUBLIC_WEB_URL: "https://app.example.com",
        S3_ADDRESSING_STYLE: "virtual-hosted",
        S3_BUCKET: "wechat-layout-production",
        S3_ENDPOINT: "https://cos-internal.example.com",
        S3_METADATA_HEADER_PREFIX: "x-cos-meta-",
        S3_PUBLIC_ADDRESSING_STYLE: "bucket-endpoint",
        S3_PUBLIC_ENDPOINT: "https://assets.example.com",
        SMTP_HOST: "smtp.example.com",
      }),
    ).toThrow(/OTEL_EXPORTER_OTLP_TRACES_ENDPOINT.*otel-collector:4318.*LOKI_PUSH_URL.*loki:3100/);
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
