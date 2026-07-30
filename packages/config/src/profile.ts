import { z } from "zod";

export const appEnvironmentSchema = z.enum(["development", "test", "production"]);

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

export function inferAppEnvironment(input: Record<string, string | undefined>): string {
  if (input.APP_ENV !== undefined) {
    return input.APP_ENV;
  }

  if (input.NODE_ENV === "test" || input.NODE_ENV === "production") {
    return input.NODE_ENV;
  }

  return "development";
}
