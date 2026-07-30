import type { ZodError } from "zod";

export class ConfigurationError extends Error {
  constructor(scope: string, error: ZodError) {
    const details = error.issues
      .map((issue) => {
        const path =
          issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join(".") : "配置";

        return `${path}: ${issue.message}`;
      })
      .join("；");

    super(`${scope}配置无效：${details}`);
    this.name = "ConfigurationError";
  }
}
