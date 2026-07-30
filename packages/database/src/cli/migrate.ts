import { migrateDatabase } from "../migrations.js";
import { loadDatabaseRuntime } from "./runtime.js";

async function main(): Promise<void> {
  const { url } = loadDatabaseRuntime();

  await migrateDatabase(url);
  process.stdout.write("数据库迁移完成。\n");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知迁移错误";
  process.stderr.write(`数据库迁移失败：${message}\n`);
  process.exitCode = 1;
});
