import { describe, expect, it } from "vitest";

import {
  ProductionConfigurationError,
  validateProductionConfiguration,
} from "./production-config.js";

const postgresPassword = "prod-postgres-password-000001";
const redisPassword = "prod-redis-password-000000001";
const validEnvironment = {
  APP_DOMAIN: "app.example.com",
  APP_ENV: "production",
  ASSET_SIGNING_KEY: "asset-signing-key-000000000000000000000000000004",
  BACKUP_ALERT_WEBHOOK_URL: "https://alerts.example.com/hooks/database-backup",
  BACKUP_DIRECTORY: "/var/lib/wechat-layout/backups",
  BACKUP_ENCRYPTION_KEY: "backup-encryption-key-000000000000000000000000005",
  BACKUP_KEY_VERSION: "backup-key-v1",
  BACKUP_LOCAL_RETENTION_COUNT: "3",
  BACKUP_REMOTE_RETENTION_DAYS: "30",
  BACKUP_RESTORE_MIN_ARTICLES: "5",
  BACKUP_S3_ACCESS_KEY_ID: "backup-access-key",
  BACKUP_S3_ADDRESSING_STYLE: "virtual-hosted",
  BACKUP_S3_BUCKET: "wechat-layout-backups",
  BACKUP_S3_ENDPOINT: "https://cos-internal.example.com",
  BACKUP_S3_METADATA_HEADER_PREFIX: "x-cos-meta-",
  BACKUP_S3_PREFIX: "production/postgresql",
  BACKUP_S3_REGION: "ap-shanghai",
  BACKUP_S3_SECRET_ACCESS_KEY: "backup-secret-access-key",
  COMPOSE_PROJECT_NAME: "wechat-layout-production",
  CSRF_SECRET: "csrf-secret-000000000000000000000000000000000002",
  DATABASE_URL: `postgresql://wechat_app:${postgresPassword}@postgres:5432/wechat_layout`,
  FEATURE_REMOTE_COMPONENTS_ENABLED: "false",
  FEATURE_WECHAT_SYNC_ENABLED: "false",
  FIELD_ENCRYPTION_KEY: "field-encryption-key-000000000000000000000000003",
  IMAGE_REPOSITORY: "registry.example.com/wechat-layout",
  LOG_LEVEL: "info",
  NEXT_PUBLIC_API_BASE_URL: "https://app.example.com",
  NEXT_PUBLIC_APP_NAME: "公众号智能视觉排版工具",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED: "false",
  NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED: "false",
  NODE_ENV: "production",
  POSTGRES_DB: "wechat_layout",
  POSTGRES_PASSWORD: postgresPassword,
  POSTGRES_USER: "wechat_app",
  PUBLIC_WEB_URL: "https://app.example.com",
  REDIS_PASSWORD: redisPassword,
  REDIS_URL: `redis://:${redisPassword}@redis:6379/0`,
  RELEASE_TAG: "v0.5.0-rc.1",
  S3_ACCESS_KEY_ID: "production-access-key",
  S3_ADDRESSING_STYLE: "virtual-hosted",
  S3_BUCKET: "wechat-layout-production",
  S3_ENDPOINT: "https://cos-internal.example.com",
  S3_METADATA_HEADER_PREFIX: "x-cos-meta-",
  S3_PUBLIC_ENDPOINT: "https://assets.example.com",
  S3_PUBLIC_ADDRESSING_STYLE: "bucket-endpoint",
  S3_REGION: "ap-shanghai",
  S3_SECRET_ACCESS_KEY: "production-secret-access-key",
  SESSION_SECRET: "session-secret-0000000000000000000000000000000001",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "465",
  TLS_CERTIFICATE_PATH: "/run/secrets/fullchain.pem",
  TLS_PRIVATE_KEY_PATH: "/run/secrets/privkey.pem",
} satisfies Record<string, string>;

describe("validateProductionConfiguration", () => {
  it("accepts a consistent production Compose environment without exposing secrets", () => {
    const summary = validateProductionConfiguration(validEnvironment, {
      fileExists: () => true,
    });

    expect(summary).toEqual({
      appDomain: "app.example.com",
      imageRepository: "registry.example.com/wechat-layout",
      publicOrigin: "https://app.example.com",
      releaseTag: "v0.5.0-rc.1",
      tlsFilesPresent: true,
    });
    expect(JSON.stringify(summary)).not.toContain(postgresPassword);
    expect(JSON.stringify(summary)).not.toContain(redisPassword);
  });

  it("rejects mixed origins, unavailable TLS files and placeholder values", () => {
    expect(() =>
      validateProductionConfiguration(
        {
          ...validEnvironment,
          NEXT_PUBLIC_API_BASE_URL: "https://api.example.com",
          S3_ACCESS_KEY_ID: "CHANGE_ME",
        },
        { fileExists: () => false },
      ),
    ).toThrow(/TLS_CERTIFICATE_PATH.*TLS_PRIVATE_KEY_PATH.*NEXT_PUBLIC_API_BASE_URL.*占位值/);
  });

  it("rejects database and Redis credentials that diverge from their containers", () => {
    expect(() =>
      validateProductionConfiguration(
        {
          ...validEnvironment,
          DATABASE_URL: "postgresql://other:other-password@database.example.com/other",
          REDIS_URL: "rediss://:other-password@redis.example.com:6380/0",
        },
        { fileExists: () => true },
      ),
    ).toThrow(/DATABASE_URL.*POSTGRES.*REDIS_URL.*REDIS_PASSWORD/);
  });

  it("rejects ambiguous domains, tagged repositories and surrounding whitespace", () => {
    try {
      validateProductionConfiguration(
        {
          ...validEnvironment,
          APP_DOMAIN: "localhost",
          IMAGE_REPOSITORY: "registry.example.com/wechat-layout:latest",
          RELEASE_TAG: " v0.5.0 ",
        },
        { fileExists: () => true },
      );
      expect.fail("配置应被拒绝");
    } catch (error) {
      expect(error).toBeInstanceOf(ProductionConfigurationError);
      expect((error as ProductionConfigurationError).issues).toEqual(
        expect.arrayContaining([
          "APP_DOMAIN: 必须是单一 DNS 主机名，不能包含协议、端口或路径",
          "IMAGE_REPOSITORY: 必须是不含 tag、digest 或协议的镜像仓库路径",
          "RELEASE_TAG: 不能包含首尾空白字符",
        ]),
      );
    }
  });

  it("never includes secret values in validation errors", () => {
    try {
      validateProductionConfiguration(
        { ...validEnvironment, POSTGRES_DB: "invalid-name", POSTGRES_PASSWORD: "short" },
        { fileExists: () => true },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ProductionConfigurationError);
      expect(String(error)).not.toContain(redisPassword);
      expect(String(error)).not.toContain(postgresPassword);
      expect(String(error)).not.toContain(validEnvironment.SESSION_SECRET);
    }
  });
});
