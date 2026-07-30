import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadServerEnvironment } from "./server.js";

const temporaryDirectories: string[] = [];
const validSecrets = [
  "DATABASE_URL=postgresql://user:password@localhost:5432/base",
  "REDIS_URL=redis://:password@localhost:6379/0",
  "S3_ACCESS_KEY_ID=local-access-key",
  "S3_SECRET_ACCESS_KEY=local-secret-access-key",
  "SESSION_SECRET=session-secret-000000000000000000000000000000000001",
  "CSRF_SECRET=csrf-secret-00000000000000000000000000000000000002",
  "FIELD_ENCRYPTION_KEY=field-secret-0000000000000000000000000000000000003",
  "ASSET_SIGNING_KEY=asset-secret-0000000000000000000000000000000000004",
  "BACKUP_ENCRYPTION_KEY=backup-secret-000000000000000000000000000000000005",
].join("\n");

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("loadServerEnvironment", () => {
  it("loads the selected profile and keeps process variables highest priority", () => {
    const workspace = mkdtempSync(join(tmpdir(), "wechat-layout-config-"));
    temporaryDirectories.push(workspace);
    writeFileSync(join(workspace, "pnpm-workspace.yaml"), "packages: []\n");
    writeFileSync(join(workspace, ".env"), `${validSecrets}\nAPI_PORT=3001\n`);
    writeFileSync(join(workspace, ".env.test"), "API_PORT=3101\n");
    writeFileSync(join(workspace, ".env.local"), "API_PORT=3201\n");
    writeFileSync(join(workspace, ".env.test.local"), "API_PORT=3301\n");

    const fileConfiguration = loadServerEnvironment({
      cwd: workspace,
      environment: "test",
      processEnvironment: {},
    });
    const processConfiguration = loadServerEnvironment({
      cwd: workspace,
      environment: "test",
      processEnvironment: { API_PORT: "3401" },
    });

    expect(fileConfiguration.application.environment).toBe("test");
    expect(fileConfiguration.application.apiPort).toBe(3301);
    expect(processConfiguration.application.apiPort).toBe(3401);
  });
});
