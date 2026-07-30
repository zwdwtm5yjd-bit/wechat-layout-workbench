import "reflect-metadata";

import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";
import { createDatabaseConnection } from "@wechat-layout/database";

import { Argon2PasswordHasher } from "../auth.crypto.js";
import { PostgresAuthRepository } from "../postgres-auth.repository.js";

async function main(): Promise<void> {
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  if (password === undefined || password.length < 12 || password.length > 256) {
    throw new Error("BOOTSTRAP_OWNER_PASSWORD 必须为 12—256 个字符");
  }

  const configuration = loadServerEnvironment();
  const connection = createDatabaseConnection(revealSecret(configuration.database.url), {
    applicationName: "wechat-layout-auth-bootstrap",
    maxConnections: 1,
  });

  try {
    const repository = new PostgresAuthRepository(connection);
    const passwordHasher = new Argon2PasswordHasher();
    const passwordHash = await passwordHasher.hashPassword(password);
    const result = await repository.provisionOwner({
      email: process.env.SEED_OWNER_EMAIL ?? "owner@example.invalid",
      displayName: process.env.SEED_OWNER_DISPLAY_NAME?.trim() || "Owner",
      timezone: process.env.SEED_OWNER_TIMEZONE?.trim() || "Asia/Shanghai",
      passwordHash,
    });

    process.stdout.write(
      result.created
        ? `Owner 已创建并启用：${result.userId}\n`
        : `Owner 凭据已轮换并启用：${result.userId}\n`,
    );
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知初始化错误";
  process.stderr.write(`Owner 凭据初始化失败：${message}\n`);
  process.exitCode = 1;
});
