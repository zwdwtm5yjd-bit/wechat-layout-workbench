import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseEnv } from "node:util";

import { z } from "zod";

import { ConfigurationError } from "./configuration-error.js";
import { appEnvironmentSchema, inferAppEnvironment, type AppEnvironment } from "./profile.js";
import { SecretValue } from "./secret.js";

const portSchema = z.coerce.number().int().min(1).max(65_535);
const positiveIntegerSchema = z.coerce.number().int().positive();
const placeholderTokens = ["change_me", "replace_me"];

const booleanStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "true" || normalizedValue === "1") {
    return true;
  }
  if (normalizedValue === "false" || normalizedValue === "0") {
    return false;
  }

  return value;
}, z.boolean());

function secretSchema(minimumLength: number) {
  return z
    .string({ error: "必须提供" })
    .trim()
    .min(minimumLength, `长度不能少于 ${minimumLength} 个字符`)
    .refine((value) => !placeholderTokens.some((token) => value.toLowerCase().includes(token)), {
      message: "不能使用示例占位值",
    });
}

export const serverEnvironmentSchema = z
  .object({
    APP_ENV: appEnvironmentSchema,
    NODE_ENV: z.enum(["development", "test", "production"]),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]),
    PUBLIC_WEB_URL: z.url(),
    WEB_PORT: portSchema,
    API_PORT: portSchema,
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32),
    SCHEDULER_INTERVAL_SECONDS: z.coerce.number().int().min(10),
    DATABASE_URL: secretSchema(1).refine((value) => /^postgres(?:ql)?:\/\//.test(value), {
      message: "必须是 PostgreSQL 连接地址",
    }),
    REDIS_URL: secretSchema(1).refine((value) => /^rediss?:\/\//.test(value), {
      message: "必须是 Redis 连接地址",
    }),
    S3_ENDPOINT: z.url(),
    S3_PUBLIC_ENDPOINT: z.url(),
    S3_REGION: z.string().trim().min(1),
    S3_BUCKET: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "不是有效的存储桶名称"),
    S3_ACCESS_KEY_ID: secretSchema(3),
    S3_SECRET_ACCESS_KEY: secretSchema(8),
    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: portSchema,
    SESSION_SECRET: secretSchema(32),
    CSRF_SECRET: secretSchema(32),
    FIELD_ENCRYPTION_KEY: secretSchema(32),
    ASSET_SIGNING_KEY: secretSchema(32),
    BACKUP_ENCRYPTION_KEY: secretSchema(32),
    FEATURE_WECHAT_SYNC_ENABLED: booleanStringSchema,
    FEATURE_REMOTE_COMPONENTS_ENABLED: booleanStringSchema,
    MAX_JSON_BODY_BYTES: positiveIntegerSchema,
    MAX_DOCX_FILE_BYTES: positiveIntegerSchema,
    MAX_IMAGE_FILE_BYTES: positiveIntegerSchema,
    MAX_BRAND_PACKAGE_BYTES: positiveIntegerSchema,
  })
  .superRefine((value, context) => {
    const secrets = [
      ["SESSION_SECRET", value.SESSION_SECRET],
      ["CSRF_SECRET", value.CSRF_SECRET],
      ["FIELD_ENCRYPTION_KEY", value.FIELD_ENCRYPTION_KEY],
      ["ASSET_SIGNING_KEY", value.ASSET_SIGNING_KEY],
      ["BACKUP_ENCRYPTION_KEY", value.BACKUP_ENCRYPTION_KEY],
    ] as const;

    if (new Set(secrets.map(([, secret]) => secret)).size !== secrets.length) {
      for (const [key] of secrets) {
        context.addIssue({
          code: "custom",
          message: "安全密钥必须彼此不同",
          path: [key],
        });
      }
    }

    const expectedNodeEnvironment = value.APP_ENV === "development" ? "development" : value.APP_ENV;
    if (value.NODE_ENV !== expectedNodeEnvironment) {
      context.addIssue({
        code: "custom",
        message: `必须与 APP_ENV=${value.APP_ENV} 匹配`,
        path: ["NODE_ENV"],
      });
    }

    if (value.APP_ENV === "production") {
      for (const key of ["PUBLIC_WEB_URL", "S3_ENDPOINT", "S3_PUBLIC_ENDPOINT"] as const) {
        if (!value[key].startsWith("https://")) {
          context.addIssue({
            code: "custom",
            message: "生产环境必须使用 HTTPS",
            path: [key],
          });
        }
      }

      if (value.LOG_LEVEL === "trace" || value.LOG_LEVEL === "debug") {
        context.addIssue({
          code: "custom",
          message: "生产环境不能启用详细调试日志",
          path: ["LOG_LEVEL"],
        });
      }
    }
  });

export interface ServerConfiguration {
  readonly application: Readonly<{
    environment: AppEnvironment;
    nodeEnvironment: "development" | "test" | "production";
    logLevel: "trace" | "debug" | "info" | "warn" | "error";
    publicWebUrl: string;
    webPort: number;
    apiPort: number;
    workerConcurrency: number;
    schedulerIntervalSeconds: number;
  }>;
  readonly database: Readonly<{ url: SecretValue }>;
  readonly redis: Readonly<{ url: SecretValue }>;
  readonly objectStorage: Readonly<{
    endpoint: string;
    publicEndpoint: string;
    region: string;
    bucket: string;
    accessKeyId: SecretValue;
    secretAccessKey: SecretValue;
  }>;
  readonly email: Readonly<{ smtpHost: string; smtpPort: number }>;
  readonly security: Readonly<{
    sessionSecret: SecretValue;
    csrfSecret: SecretValue;
    fieldEncryptionKey: SecretValue;
    assetSigningKey: SecretValue;
    backupEncryptionKey: SecretValue;
  }>;
  readonly features: Readonly<{
    wechatSync: boolean;
    remoteComponents: boolean;
  }>;
  readonly limits: Readonly<{
    jsonBodyBytes: number;
    docxFileBytes: number;
    imageFileBytes: number;
    brandPackageBytes: number;
  }>;
}

type EnvironmentInput = Record<string, string | undefined>;

function defaultNodeEnvironment(environment: string): "development" | "test" | "production" {
  if (environment === "test" || environment === "production") {
    return environment;
  }

  return "development";
}

export function parseServerEnvironment(input: EnvironmentInput): ServerConfiguration {
  const environment = inferAppEnvironment(input);
  const isProduction = environment === "production";
  const result = serverEnvironmentSchema.safeParse({
    ...input,
    APP_ENV: environment,
    NODE_ENV: input.NODE_ENV ?? defaultNodeEnvironment(environment),
    LOG_LEVEL:
      input.LOG_LEVEL ??
      (environment === "development" ? "debug" : environment === "test" ? "warn" : "info"),
    PUBLIC_WEB_URL: input.PUBLIC_WEB_URL ?? (isProduction ? undefined : "http://localhost:3000"),
    WEB_PORT: input.WEB_PORT ?? "3000",
    API_PORT: input.API_PORT ?? "3001",
    WORKER_CONCURRENCY: input.WORKER_CONCURRENCY ?? "2",
    SCHEDULER_INTERVAL_SECONDS: input.SCHEDULER_INTERVAL_SECONDS ?? "60",
    S3_ENDPOINT: input.S3_ENDPOINT ?? (isProduction ? undefined : "http://localhost:9000"),
    S3_PUBLIC_ENDPOINT:
      input.S3_PUBLIC_ENDPOINT ??
      input.S3_ENDPOINT ??
      (isProduction ? undefined : "http://localhost:9000"),
    S3_REGION: input.S3_REGION ?? "us-east-1",
    S3_BUCKET: input.S3_BUCKET ?? (isProduction ? undefined : `wechat-layout-${environment}`),
    SMTP_HOST: input.SMTP_HOST ?? (isProduction ? undefined : "localhost"),
    SMTP_PORT: input.SMTP_PORT ?? "1025",
    FEATURE_WECHAT_SYNC_ENABLED: input.FEATURE_WECHAT_SYNC_ENABLED ?? "false",
    FEATURE_REMOTE_COMPONENTS_ENABLED: input.FEATURE_REMOTE_COMPONENTS_ENABLED ?? "false",
    MAX_JSON_BODY_BYTES: input.MAX_JSON_BODY_BYTES ?? String(2 * 1024 * 1024),
    MAX_DOCX_FILE_BYTES: input.MAX_DOCX_FILE_BYTES ?? String(50 * 1024 * 1024),
    MAX_IMAGE_FILE_BYTES: input.MAX_IMAGE_FILE_BYTES ?? String(20 * 1024 * 1024),
    MAX_BRAND_PACKAGE_BYTES: input.MAX_BRAND_PACKAGE_BYTES ?? String(100 * 1024 * 1024),
  });

  if (!result.success) {
    throw new ConfigurationError("服务端", result.error);
  }

  const value = result.data;

  return Object.freeze({
    application: Object.freeze({
      environment: value.APP_ENV,
      nodeEnvironment: value.NODE_ENV,
      logLevel: value.LOG_LEVEL,
      publicWebUrl: value.PUBLIC_WEB_URL,
      webPort: value.WEB_PORT,
      apiPort: value.API_PORT,
      workerConcurrency: value.WORKER_CONCURRENCY,
      schedulerIntervalSeconds: value.SCHEDULER_INTERVAL_SECONDS,
    }),
    database: Object.freeze({ url: new SecretValue(value.DATABASE_URL) }),
    redis: Object.freeze({ url: new SecretValue(value.REDIS_URL) }),
    objectStorage: Object.freeze({
      endpoint: value.S3_ENDPOINT,
      publicEndpoint: value.S3_PUBLIC_ENDPOINT,
      region: value.S3_REGION,
      bucket: value.S3_BUCKET,
      accessKeyId: new SecretValue(value.S3_ACCESS_KEY_ID),
      secretAccessKey: new SecretValue(value.S3_SECRET_ACCESS_KEY),
    }),
    email: Object.freeze({
      smtpHost: value.SMTP_HOST,
      smtpPort: value.SMTP_PORT,
    }),
    security: Object.freeze({
      sessionSecret: new SecretValue(value.SESSION_SECRET),
      csrfSecret: new SecretValue(value.CSRF_SECRET),
      fieldEncryptionKey: new SecretValue(value.FIELD_ENCRYPTION_KEY),
      assetSigningKey: new SecretValue(value.ASSET_SIGNING_KEY),
      backupEncryptionKey: new SecretValue(value.BACKUP_ENCRYPTION_KEY),
    }),
    features: Object.freeze({
      wechatSync: value.FEATURE_WECHAT_SYNC_ENABLED,
      remoteComponents: value.FEATURE_REMOTE_COMPONENTS_ENABLED,
    }),
    limits: Object.freeze({
      jsonBodyBytes: value.MAX_JSON_BODY_BYTES,
      docxFileBytes: value.MAX_DOCX_FILE_BYTES,
      imageFileBytes: value.MAX_IMAGE_FILE_BYTES,
      brandPackageBytes: value.MAX_BRAND_PACKAGE_BYTES,
    }),
  });
}

export interface LoadServerEnvironmentOptions {
  readonly cwd?: string;
  readonly environment?: AppEnvironment;
  readonly processEnvironment?: EnvironmentInput;
}

function findWorkspaceRoot(startDirectory: string): string {
  let directory = resolve(startDirectory);

  while (true) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) {
      return directory;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error("无法定位包含 pnpm-workspace.yaml 的项目根目录");
    }
    directory = parent;
  }
}

function readEnvironmentFile(filePath: string): EnvironmentInput {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    return parseEnv(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`环境配置文件 ${basename(filePath)} 格式无效`);
  }
}

export function loadServerEnvironment(
  options: LoadServerEnvironmentOptions = {},
): ServerConfiguration {
  const workspaceRoot = findWorkspaceRoot(options.cwd ?? process.cwd());
  const processEnvironment = options.processEnvironment ?? process.env;
  const baseEnvironment = readEnvironmentFile(join(workspaceRoot, ".env"));
  const environment =
    options.environment ?? inferAppEnvironment({ ...baseEnvironment, ...processEnvironment });
  const environmentFiles = [
    ".env",
    `.env.${environment}`,
    ...(environment === "test" ? [] : [".env.local"]),
    `.env.${environment}.local`,
  ];
  const fileEnvironment = environmentFiles.reduce<EnvironmentInput>(
    (accumulator, fileName) => ({
      ...accumulator,
      ...readEnvironmentFile(join(workspaceRoot, fileName)),
    }),
    {},
  );

  return parseServerEnvironment({
    ...fileEnvironment,
    ...processEnvironment,
    APP_ENV: environment,
  });
}

export { ConfigurationError } from "./configuration-error.js";
export { SecretValue, revealSecret } from "./secret.js";
