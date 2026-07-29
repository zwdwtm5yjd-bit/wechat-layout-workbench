import { z } from "zod";

const portSchema = z.coerce.number().int().min(1).max(65_535);

export const runtimeEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    WEB_PORT: portSchema.default(3000),
    API_PORT: portSchema.default(3001),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
    SCHEDULER_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(60),
  })
  .readonly();

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export function parseRuntimeEnvironment(
  input: Record<string, string | undefined>,
): RuntimeEnvironment {
  return runtimeEnvironmentSchema.parse(input);
}
