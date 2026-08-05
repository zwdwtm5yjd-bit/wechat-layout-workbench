import { isIP } from "node:net";
import { isAbsolute, normalize, sep } from "node:path";

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export interface BackupConfiguration {
  readonly alertWebhookUrl: string;
  readonly directory: string;
  readonly keyVersion: string;
  readonly localRetentionCount: number;
  readonly minimumRestoreArticles: number;
  readonly remoteRetentionDays: number;
  readonly storage: Readonly<{
    accessKeyId: string;
    addressingStyle: "path" | "virtual-hosted" | "bucket-endpoint";
    metadataHeaderPrefix: "x-amz-meta-" | "x-cos-meta-";
    bucket: string;
    endpoint: string;
    prefix: string;
    region: string;
    secretAccessKey: string;
  }>;
}

export class BackupConfigurationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`生产备份配置无效：${issues.join("；")}`);
    this.name = "BackupConfigurationError";
  }
}

const placeholderTokens = ["change_me", "replace_me"];

function containsPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return placeholderTokens.some((placeholder) => normalized.includes(placeholder));
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function validExternalHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")
    ) {
      return false;
    }
    const ipVersion = isIP(hostname);
    return ipVersion === 0 || (ipVersion === 4 && !isPrivateIpv4(hostname));
  } catch {
    return false;
  }
}

export function validateBackupConfiguration(input: EnvironmentInput): BackupConfiguration {
  const issues: string[] = [];
  const required = (key: string, minimumLength = 1, secret = false): string => {
    const rawValue = input[key] ?? "";
    const value = rawValue.trim();
    if (value.length < minimumLength) {
      issues.push(`${key}: 长度不能少于 ${String(minimumLength)} 个字符`);
    } else if (containsPlaceholder(value)) {
      issues.push(`${key}: 不能使用示例占位值`);
    }
    if (rawValue !== value) {
      issues.push(`${key}: 不能包含首尾空白字符`);
    }
    if (secret && value.length > 0 && /\s/.test(value)) {
      issues.push(`${key}: 不能包含空白字符`);
    }
    return value;
  };
  const integer = (key: string, minimum: number, maximum: number): number => {
    const value = required(key);
    if (!/^\d+$/.test(value)) {
      issues.push(`${key}: 必须是整数`);
      return minimum;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
      issues.push(`${key}: 必须在 ${String(minimum)} 到 ${String(maximum)} 之间`);
    }
    return parsed;
  };

  const directory = required("BACKUP_DIRECTORY");
  const normalizedDirectory = normalize(directory);
  const pathSegments = normalizedDirectory.split(sep).filter(Boolean);
  if (!isAbsolute(directory) || pathSegments.length < 3) {
    issues.push("BACKUP_DIRECTORY: 必须是至少三级的绝对专用目录");
  }
  const keyVersion = required("BACKUP_KEY_VERSION");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(keyVersion)) {
    issues.push("BACKUP_KEY_VERSION: 不是有效的密钥版本标识");
  }
  required("BACKUP_ENCRYPTION_KEY", 32, true);

  const endpoint = required("BACKUP_S3_ENDPOINT");
  if (!validExternalHttpsUrl(endpoint)) {
    issues.push("BACKUP_S3_ENDPOINT: 必须是无凭据的外部 HTTPS URL");
  }
  const addressingStyleValue = required("BACKUP_S3_ADDRESSING_STYLE");
  if (!["path", "virtual-hosted", "bucket-endpoint"].includes(addressingStyleValue)) {
    issues.push("BACKUP_S3_ADDRESSING_STYLE: 必须是 path、virtual-hosted 或 bucket-endpoint");
  }
  const addressingStyle = addressingStyleValue as "path" | "virtual-hosted" | "bucket-endpoint";
  const metadataHeaderPrefixValue = required("BACKUP_S3_METADATA_HEADER_PREFIX");
  if (!["x-amz-meta-", "x-cos-meta-"].includes(metadataHeaderPrefixValue)) {
    issues.push("BACKUP_S3_METADATA_HEADER_PREFIX: 必须是 x-amz-meta- 或 x-cos-meta-");
  }
  const metadataHeaderPrefix = metadataHeaderPrefixValue as "x-amz-meta-" | "x-cos-meta-";
  const region = required("BACKUP_S3_REGION");
  const bucket = required("BACKUP_S3_BUCKET");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    issues.push("BACKUP_S3_BUCKET: 不是有效的私有 Bucket 名称");
  }
  const accessKeyId = required("BACKUP_S3_ACCESS_KEY_ID", 3, true);
  const secretAccessKey = required("BACKUP_S3_SECRET_ACCESS_KEY", 16, true);
  const prefix = required("BACKUP_S3_PREFIX");
  if (
    prefix.startsWith("/") ||
    prefix.endsWith("/") ||
    prefix.includes("//") ||
    prefix.split("/").some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment))
  ) {
    issues.push("BACKUP_S3_PREFIX: 必须是不含空路径段的安全对象前缀");
  }

  const alertWebhookUrl = required("BACKUP_ALERT_WEBHOOK_URL");
  if (!validExternalHttpsUrl(alertWebhookUrl)) {
    issues.push("BACKUP_ALERT_WEBHOOK_URL: 必须是外部 HTTPS URL");
  }

  const localRetentionCount = integer("BACKUP_LOCAL_RETENTION_COUNT", 2, 30);
  const remoteRetentionDays = integer("BACKUP_REMOTE_RETENTION_DAYS", 30, 3_650);
  const minimumRestoreArticles = integer("BACKUP_RESTORE_MIN_ARTICLES", 5, 100);

  if (issues.length > 0) {
    throw new BackupConfigurationError([...new Set(issues)]);
  }

  return Object.freeze({
    alertWebhookUrl,
    directory: normalizedDirectory,
    keyVersion,
    localRetentionCount,
    minimumRestoreArticles,
    remoteRetentionDays,
    storage: Object.freeze({
      accessKeyId,
      addressingStyle,
      bucket,
      endpoint,
      metadataHeaderPrefix,
      prefix,
      region,
      secretAccessKey,
    }),
  });
}
