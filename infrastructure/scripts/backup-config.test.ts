import { describe, expect, it } from "vitest";

import { BackupConfigurationError, validateBackupConfiguration } from "./backup-config.js";

const validConfiguration = {
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
} satisfies Record<string, string>;

describe("validateBackupConfiguration", () => {
  it("accepts separated encrypted backup storage and retention settings", () => {
    const configuration = validateBackupConfiguration(validConfiguration);

    expect(configuration.directory).toBe("/var/lib/wechat-layout/backups");
    expect(configuration.localRetentionCount).toBe(3);
    expect(configuration.remoteRetentionDays).toBe(30);
    expect(JSON.stringify(configuration)).not.toContain(validConfiguration.BACKUP_ENCRYPTION_KEY);
  });

  it("rejects placeholders, broad directories, private webhooks and invalid retention", () => {
    expect(() =>
      validateBackupConfiguration({
        ...validConfiguration,
        BACKUP_ALERT_WEBHOOK_URL: "https://127.0.0.1/alert",
        BACKUP_DIRECTORY: "/var/lib",
        BACKUP_REMOTE_RETENTION_DAYS: "7",
        BACKUP_S3_ENDPOINT: "https://cos.example.com?credential=forbidden",
        BACKUP_S3_SECRET_ACCESS_KEY: "CHANGE_ME",
      }),
    ).toThrow(
      /BACKUP_DIRECTORY.*BACKUP_S3_ENDPOINT.*BACKUP_S3_SECRET_ACCESS_KEY.*BACKUP_ALERT_WEBHOOK_URL.*30/,
    );
  });

  it("rejects an ambiguous object-storage addressing style", () => {
    expect(() =>
      validateBackupConfiguration({
        ...validConfiguration,
        BACKUP_S3_ADDRESSING_STYLE: "auto",
        BACKUP_S3_METADATA_HEADER_PREFIX: "x-meta-",
      }),
    ).toThrow(/BACKUP_S3_ADDRESSING_STYLE.*virtual-hosted.*BACKUP_S3_METADATA_HEADER_PREFIX/);
  });

  it("never includes backup credentials in validation errors", () => {
    try {
      validateBackupConfiguration({
        ...validConfiguration,
        BACKUP_KEY_VERSION: "invalid version",
        BACKUP_S3_BUCKET: "Invalid_Bucket",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BackupConfigurationError);
      expect(String(error)).not.toContain(validConfiguration.BACKUP_ENCRYPTION_KEY);
      expect(String(error)).not.toContain(validConfiguration.BACKUP_S3_SECRET_ACCESS_KEY);
    }
  });
});
