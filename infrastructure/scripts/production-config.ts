import { isAbsolute } from "node:path";

import { parsePublicEnvironment } from "../../packages/config/src/public.js";
import { parseServerEnvironment } from "../../packages/config/src/server.js";

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export interface ProductionConfigurationValidationOptions {
  readonly fileExists?: (path: string) => boolean;
}

export interface ProductionConfigurationSummary {
  readonly appDomain: string;
  readonly imageRepository: string;
  readonly publicOrigin: string;
  readonly releaseTag: string;
  readonly tlsFilesPresent: boolean;
}

export class ProductionConfigurationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`生产部署配置无效：${issues.join("；")}`);
    this.name = "ProductionConfigurationError";
  }
}

const placeholderTokens = ["change_me", "replace_me"];

function hasPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return placeholderTokens.some((token) => normalized.includes(token));
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parsedUrl(value: string, key: string, issues: string[]): URL | null {
  try {
    return new URL(value);
  } catch {
    issues.push(`${key}: 必须是有效 URL`);
    return null;
  }
}

export function validateProductionConfiguration(
  input: EnvironmentInput,
  options: ProductionConfigurationValidationOptions = {},
): ProductionConfigurationSummary {
  const issues: string[] = [];
  const fileExists = options.fileExists ?? (() => true);

  const required = (key: string, minimumLength = 1, secret = false): string => {
    const rawValue = input[key] ?? "";
    const value = rawValue.trim();
    if (value.length < minimumLength) {
      issues.push(`${key}: 长度不能少于 ${String(minimumLength)} 个字符`);
    } else if (hasPlaceholder(value)) {
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

  const appDomain = required("APP_DOMAIN");
  const composeProjectName = required("COMPOSE_PROJECT_NAME");
  const imageRepository = required("IMAGE_REPOSITORY");
  const releaseTag = required("RELEASE_TAG");
  const postgresDatabase = required("POSTGRES_DB");
  const postgresUser = required("POSTGRES_USER");
  const postgresPassword = required("POSTGRES_PASSWORD", 24, true);
  const redisPassword = required("REDIS_PASSWORD", 24, true);
  const certificatePath = required("TLS_CERTIFICATE_PATH");
  const privateKeyPath = required("TLS_PRIVATE_KEY_PATH");

  const domainLabels = appDomain.split(".");
  if (
    appDomain.length > 253 ||
    domainLabels.length < 2 ||
    domainLabels.some(
      (label) => label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  ) {
    issues.push("APP_DOMAIN: 必须是单一 DNS 主机名，不能包含协议、端口或路径");
  }
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(composeProjectName)) {
    issues.push("COMPOSE_PROJECT_NAME: 只能包含字母、数字、下划线和连字符");
  }
  if (
    !/^[a-z0-9][a-z0-9._:/-]*[a-z0-9]$/i.test(imageRepository) ||
    imageRepository.includes("@") ||
    imageRepository.includes("//") ||
    imageRepository.split("/").at(-1)?.includes(":")
  ) {
    issues.push("IMAGE_REPOSITORY: 必须是不含 tag、digest 或协议的镜像仓库路径");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(releaseTag)) {
    issues.push("RELEASE_TAG: 不是有效的容器镜像 tag");
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(postgresDatabase)) {
    issues.push("POSTGRES_DB: 不是有效的 PostgreSQL 数据库名");
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(postgresUser)) {
    issues.push("POSTGRES_USER: 不是有效的 PostgreSQL 用户名");
  }

  for (const [key, path] of [
    ["TLS_CERTIFICATE_PATH", certificatePath],
    ["TLS_PRIVATE_KEY_PATH", privateKeyPath],
  ] as const) {
    if (!isAbsolute(path)) {
      issues.push(`${key}: 必须是绝对路径`);
    } else if (!fileExists(path)) {
      issues.push(`${key}: 文件不存在或不可访问`);
    }
  }

  const publicOrigin = required("NEXT_PUBLIC_APP_URL");
  const expectedOrigin = appDomain ? `https://${appDomain}` : "";
  for (const key of [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_API_BASE_URL",
    "PUBLIC_WEB_URL",
  ] as const) {
    const value = required(key);
    if (expectedOrigin && value !== expectedOrigin) {
      issues.push(`${key}: 必须与 APP_DOMAIN 对应的 HTTPS Origin 完全一致`);
    }
  }

  const databaseUrlValue = required("DATABASE_URL", 1, true);
  const databaseUrl = parsedUrl(databaseUrlValue, "DATABASE_URL", issues);
  if (databaseUrl !== null) {
    if (
      databaseUrl.protocol !== "postgresql:" ||
      databaseUrl.hostname !== "postgres" ||
      (databaseUrl.port && databaseUrl.port !== "5432") ||
      decodeUrlPart(databaseUrl.username) !== postgresUser ||
      decodeUrlPart(databaseUrl.password) !== postgresPassword ||
      decodeUrlPart(databaseUrl.pathname.slice(1)) !== postgresDatabase
    ) {
      issues.push("DATABASE_URL: 必须与 Compose 内部 postgres 服务及 POSTGRES_* 凭据一致");
    }
  }

  const redisUrlValue = required("REDIS_URL", 1, true);
  const redisUrl = parsedUrl(redisUrlValue, "REDIS_URL", issues);
  if (redisUrl !== null) {
    if (
      redisUrl.protocol !== "redis:" ||
      redisUrl.hostname !== "redis" ||
      (redisUrl.port && redisUrl.port !== "6379") ||
      decodeUrlPart(redisUrl.password) !== redisPassword
    ) {
      issues.push("REDIS_URL: 必须与 Compose 内部 redis 服务及 REDIS_PASSWORD 一致");
    }
  }

  try {
    parsePublicEnvironment({ ...input, APP_ENV: "production" });
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "前端公开配置校验失败");
  }

  try {
    parseServerEnvironment({
      ...input,
      APP_ENV: "production",
      NODE_ENV: "production",
    });
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "服务端配置校验失败");
  }

  if (issues.length > 0) {
    throw new ProductionConfigurationError([...new Set(issues)]);
  }

  return Object.freeze({
    appDomain,
    imageRepository,
    publicOrigin,
    releaseTag,
    tlsFilesPresent: true,
  });
}
