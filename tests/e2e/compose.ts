import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const projectRoot = process.cwd();
export const authDirectory = resolve(projectRoot, "tests/e2e/.auth");
export const ownerMetadataPath = resolve(authDirectory, "owner-metadata.json");

const dockerEnvironmentPath = resolve(projectRoot, ".env.docker");
const composePath = resolve(projectRoot, "infrastructure/compose/docker-compose.yml");
const composeDevelopmentPath = resolve(
  projectRoot,
  "infrastructure/compose/docker-compose.dev.yml",
);

export interface E2eOwnerMetadata {
  readonly email: string;
  readonly userId: string;
}

export function runInApiContainer(
  script: string,
  environment: Readonly<Record<string, string>> = {},
): string {
  if (!existsSync(dockerEnvironmentPath)) {
    throw new Error("缺少 .env.docker，请先运行 pnpm docker:dev 再执行 Playwright。");
  }

  const environmentArguments = Object.entries(environment).flatMap(([key, value]) => [
    "--env",
    `${key}=${value}`,
  ]);
  const dockerComposeV2 = spawnSync("docker", ["compose", "version"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  const composeExecutable = dockerComposeV2.status === 0 ? "docker" : "docker-compose";
  const composePrefix = dockerComposeV2.status === 0 ? ["compose"] : [];
  const result = spawnSync(
    composeExecutable,
    [
      ...composePrefix,
      "--env-file",
      dockerEnvironmentPath,
      "--file",
      composePath,
      "--file",
      composeDevelopmentPath,
      "exec",
      "-T",
      ...environmentArguments,
      "api",
      "node",
      "--input-type=module",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      input: script,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      ["无法在 Docker API 容器中准备 Playwright 数据。", result.stderr.trim(), result.stdout.trim()]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout.trim();
}
