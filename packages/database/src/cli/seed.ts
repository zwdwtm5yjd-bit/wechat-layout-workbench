import { createDatabaseConnection } from "../client.js";
import { seedBaseData } from "../seed.js";
import { loadDatabaseRuntime } from "./runtime.js";

async function main(): Promise<void> {
  const { configuration, url } = loadDatabaseRuntime();

  if (configuration.application.environment === "production") {
    throw new Error("基础开发种子禁止在生产环境执行");
  }

  const connection = createDatabaseConnection(url, {
    applicationName: "wechat-layout-seed",
    maxConnections: 1,
  });

  try {
    const ownerDisplayName = process.env.SEED_OWNER_DISPLAY_NAME;
    const ownerEmail = process.env.SEED_OWNER_EMAIL;
    const ownerTimezone = process.env.SEED_OWNER_TIMEZONE;
    const result = await seedBaseData(connection.db, {
      environment: configuration.application.environment,
      ...(ownerDisplayName ? { ownerDisplayName } : {}),
      ...(ownerEmail ? { ownerEmail } : {}),
      ...(ownerTimezone ? { ownerTimezone } : {}),
    });
    process.stdout.write(
      `${
        result.created
          ? `开发 Owner 种子已创建：${result.ownerId}（账号保持禁用，请运行 pnpm auth:bootstrap-owner 初始化凭据）`
          : `开发 Owner 种子已存在：${result.ownerId}`
      }；公众号种子新增 ${String(result.accountsCreated)} 个、现有 ${String(result.accountIds.length)} 个。\n`,
    );
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知种子错误";
  process.stderr.write(`数据库种子执行失败：${message}\n`);
  process.exitCode = 1;
});
