import { createDatabaseConnection } from "../client.js";
import { verifyDatabaseSchema } from "../verification.js";
import { loadDatabaseRuntime } from "./runtime.js";

async function main(): Promise<void> {
  const { url } = loadDatabaseRuntime();
  const connection = createDatabaseConnection(url, {
    applicationName: "wechat-layout-database-check",
    maxConnections: 1,
  });

  try {
    const result = await verifyDatabaseSchema(connection);
    process.stdout.write(
      `数据库结构验收通过：${result.tableCount} 张表、${result.indexCount} 个索引、${result.foreignKeyCount} 个外键、${result.migrationCount} 个迁移。\n`,
    );
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知检查错误";
  process.stderr.write(`数据库结构验收失败：${message}\n`);
  process.exitCode = 1;
});
