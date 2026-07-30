import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabaseConnection } from "./client.js";

const migrationLockId = 1_047_001_001;

export const defaultMigrationsFolder = fileURLToPath(new URL("../migrations/", import.meta.url));

export async function migrateDatabase(
  url: string,
  migrationsFolder = defaultMigrationsFolder,
): Promise<void> {
  const connection = createDatabaseConnection(url, {
    applicationName: "wechat-layout-migrator",
    maxConnections: 1,
  });

  try {
    await connection.sql`select pg_advisory_lock(${migrationLockId})`;
    await migrate(connection.db, {
      migrationsFolder,
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
  } finally {
    try {
      await connection.sql`select pg_advisory_unlock(${migrationLockId})`;
    } finally {
      await connection.close();
    }
  }
}

export async function resetTestDatabase(url: string): Promise<void> {
  const parsedUrl = new URL(url);
  const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));

  if (!/(?:_test|_migration_test)$/.test(databaseName)) {
    throw new Error(
      `拒绝重置非测试数据库：数据库名必须以 _test 或 _migration_test 结尾，当前为 ${databaseName || "空值"}`,
    );
  }

  const connection = createDatabaseConnection(url, {
    applicationName: "wechat-layout-test-reset",
    maxConnections: 1,
  });

  try {
    await connection.sql`
      drop schema if exists audit, operations, integration, brand, design, content, auth, drizzle cascade
    `;
  } finally {
    await connection.close();
  }
}
