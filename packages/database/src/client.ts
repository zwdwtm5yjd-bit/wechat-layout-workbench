import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { databaseTables } from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof databaseTables>;

export interface DatabaseConnectionOptions {
  readonly applicationName?: string;
  readonly connectTimeoutSeconds?: number;
  readonly idleTimeoutSeconds?: number;
  readonly maxConnections?: number;
}

export interface DatabaseConnection {
  readonly db: Database;
  readonly sql: Sql;
  close(): Promise<void>;
}

export function createDatabaseConnection(
  url: string,
  options: DatabaseConnectionOptions = {},
): DatabaseConnection {
  const client = postgres(url, {
    connect_timeout: options.connectTimeoutSeconds ?? 10,
    connection: {
      application_name: options.applicationName ?? "wechat-layout",
    },
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    max: options.maxConnections ?? 10,
    prepare: false,
  });
  const db = drizzle(client, { schema: databaseTables });

  return {
    db,
    sql: client,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

export async function checkDatabaseConnection(connection: DatabaseConnection): Promise<void> {
  await connection.sql`select 1`;
}
