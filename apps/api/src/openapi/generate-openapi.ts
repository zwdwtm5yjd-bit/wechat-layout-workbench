import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { NestFactory } from "@nestjs/core";

import { configureApplication } from "../configure-application.js";
import { RuntimeModule } from "../runtime.module.js";

function applySchemaGenerationEnvironment(): void {
  Object.assign(process.env, {
    APP_ENV: "test",
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://openapi:openapi@127.0.0.1:1/openapi",
    REDIS_URL: "redis://127.0.0.1:1/0",
    S3_ACCESS_KEY_ID: "openapi-access-key",
    S3_SECRET_ACCESS_KEY: "openapi-secret-key",
    SESSION_SECRET: "openapi-session-secret-000000000000000000000001",
    CSRF_SECRET: "openapi-csrf-secret-000000000000000000000000002",
    FIELD_ENCRYPTION_KEY: "openapi-field-key-000000000000000000000000003",
    ASSET_SIGNING_KEY: "openapi-asset-key-000000000000000000000000004",
    BACKUP_ENCRYPTION_KEY: "openapi-backup-key-00000000000000000000000005",
    METRICS_BEARER_TOKEN: "openapi-metrics-token-0000000000000000000000006",
  });
}

async function main(): Promise<void> {
  applySchemaGenerationEnvironment();
  const outputPath = resolve(process.argv[2] ?? "openapi.json");
  const application = await NestFactory.create(RuntimeModule, {
    abortOnError: false,
    logger: false,
  });
  try {
    const document = configureApplication(application, "development", "http://localhost:3000");
    await writeFile(outputPath, `${JSON.stringify(document)}\n`, "utf8");
    process.stdout.write(`OpenAPI schema written to ${outputPath}\n`);
  } finally {
    await application.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
