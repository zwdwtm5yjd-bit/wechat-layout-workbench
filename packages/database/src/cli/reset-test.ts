import { resetTestDatabase } from "../migrations.js";
import { loadDatabaseRuntime } from "./runtime.js";

async function main(): Promise<void> {
  const { configuration, url } = loadDatabaseRuntime();

  if (configuration.application.environment !== "test") {
    throw new Error("数据库重置只能在 APP_ENV=test 时执行");
  }

  await resetTestDatabase(url);
  process.stdout.write("测试数据库业务 Schema 与迁移记录已重置。\n");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知重置错误";
  process.stderr.write(`测试数据库重置失败：${message}\n`);
  process.exitCode = 1;
});
