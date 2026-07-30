import { z } from "zod";

import { ConfigurationError } from "./configuration-error.js";
import { appEnvironmentSchema, inferAppEnvironment, type AppEnvironment } from "./profile.js";

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

export const publicEnvironmentSchema = z
  .object({
    APP_ENV: appEnvironmentSchema,
    NEXT_PUBLIC_APP_NAME: z.string().trim().min(1),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_API_BASE_URL: z.url(),
    NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED: booleanStringSchema,
    NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED: booleanStringSchema,
  })
  .superRefine((value, context) => {
    if (value.APP_ENV !== "production") {
      return;
    }

    for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_API_BASE_URL"] as const) {
      if (!value[key].startsWith("https://")) {
        context.addIssue({
          code: "custom",
          message: "生产环境必须使用 HTTPS",
          path: [key],
        });
      }
    }
  });

export interface PublicConfiguration {
  readonly environment: AppEnvironment;
  readonly appName: string;
  readonly appUrl: string;
  readonly apiBaseUrl: string;
  readonly features: Readonly<{
    wechatSync: boolean;
    remoteComponents: boolean;
  }>;
}

export function parsePublicEnvironment(
  input: Record<string, string | undefined>,
): PublicConfiguration {
  const environment = inferAppEnvironment(input);
  const isProduction = environment === "production";
  const result = publicEnvironmentSchema.safeParse({
    APP_ENV: environment,
    NEXT_PUBLIC_APP_NAME: input.NEXT_PUBLIC_APP_NAME ?? "公众号智能视觉排版工具",
    NEXT_PUBLIC_APP_URL:
      input.NEXT_PUBLIC_APP_URL ?? (isProduction ? undefined : "http://localhost:3000"),
    NEXT_PUBLIC_API_BASE_URL:
      input.NEXT_PUBLIC_API_BASE_URL ?? (isProduction ? undefined : "http://localhost:3001"),
    NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED:
      input.NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED ?? "false",
    NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED:
      input.NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED ?? "false",
  });

  if (!result.success) {
    throw new ConfigurationError("前端公开", result.error);
  }

  return Object.freeze({
    environment: result.data.APP_ENV,
    appName: result.data.NEXT_PUBLIC_APP_NAME,
    appUrl: result.data.NEXT_PUBLIC_APP_URL,
    apiBaseUrl: result.data.NEXT_PUBLIC_API_BASE_URL,
    features: Object.freeze({
      wechatSync: result.data.NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED,
      remoteComponents: result.data.NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED,
    }),
  });
}
