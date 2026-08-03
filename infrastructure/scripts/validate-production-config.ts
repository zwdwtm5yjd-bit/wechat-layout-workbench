import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { parseEnv } from "node:util";

import { validateProductionConfiguration } from "./production-config.js";

function environmentFileArgument(): string {
  const index = process.argv.indexOf("--env-file");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error("必须通过 --env-file 指定生产环境配置文件");
  }
  return resolve(value);
}

try {
  const environmentFile = environmentFileArgument();
  if (!existsSync(environmentFile)) {
    throw new Error("生产环境配置文件不存在");
  }
  const environment = parseEnv(readFileSync(environmentFile, "utf8"));
  const summary = validateProductionConfiguration(environment, { fileExists: existsSync });
  process.stdout.write(
    `生产配置通过：${summary.appDomain}，镜像 ${summary.imageRepository}/*:${summary.releaseTag}。\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "未知生产配置错误";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
