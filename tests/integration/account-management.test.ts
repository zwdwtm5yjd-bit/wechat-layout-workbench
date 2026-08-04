import {
  articles,
  auditLogs,
  createDatabaseConnection,
  createUuidV7,
  migrateDatabase,
  seedBaseData,
  users,
  type DatabaseConnection,
} from "../../packages/database/src/index.js";
import { PostgresAccountRepository } from "../../apps/api/src/accounts/postgres-account.repository.js";
import type { AccountMutationContext } from "../../apps/api/src/accounts/account.types.js";
import { eq } from "drizzle-orm";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const postgresPassword = "account-management-postgres-password";

async function waitForDatabase(databaseUrl: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const probe = createDatabaseConnection(databaseUrl, {
      applicationName: "account-management-readiness",
      connectTimeoutSeconds: 1,
      maxConnections: 1,
    });
    try {
      await probe.sql`select 1`;
      await probe.close();
      return;
    } catch (error) {
      lastError = error;
      await probe.close().catch(() => undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

describe("official account management transaction", () => {
  let postgres: StartedTestContainer;
  let connection: DatabaseConnection;
  let repository: PostgresAccountRepository;
  let ownerUserId: string;
  let otherUserId: string;
  let context: AccountMutationContext;

  beforeAll(async () => {
    postgres = await new GenericContainer("postgres:18.4-alpine")
      .withEnvironment({
        POSTGRES_DB: "account_management_test",
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_USER: "wechat_layout",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forSuccessfulCommand(
          "pg_isready --username wechat_layout --dbname account_management_test",
        ),
      )
      .withStartupTimeout(120_000)
      .start();
    const databaseUrl = `postgresql://wechat_layout:${postgresPassword}@${postgres.getHost()}:${String(postgres.getMappedPort(5432))}/account_management_test`;
    await waitForDatabase(databaseUrl);
    await migrateDatabase(databaseUrl);
    connection = createDatabaseConnection(databaseUrl, {
      applicationName: "account-management-test",
    });
    ownerUserId = createUuidV7();
    otherUserId = createUuidV7();
    await connection.db.insert(users).values([
      {
        id: ownerUserId,
        email: "account-owner@example.com",
        displayName: "Account Owner",
        passwordHash: "!disabled:test",
        role: "owner",
        status: "disabled",
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
      },
      {
        id: otherUserId,
        email: "account-other@example.com",
        displayName: "Other Owner",
        passwordHash: "!disabled:test",
        role: "owner",
        status: "disabled",
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
      },
    ]);
    repository = new PostgresAccountRepository(connection);
    context = {
      actorUserId: ownerUserId,
      requestId: "req_account_management",
      traceId: "trace_account_management",
    };
  }, 150_000);

  afterAll(async () => {
    await connection?.close();
    await postgres?.stop();
  });

  it("keeps one default, excludes archived accounts and blocks deletion with articles", async () => {
    const first = await repository.create({
      ownerUserId,
      name: "第一公众号",
      shortName: "第一",
      description: null,
      contentTypes: ["inspection"],
      accountType: "subscription",
      verificationStatus: "verified",
      defaultThemeId: null,
      isDefault: false,
      context,
    });
    const second = await repository.create({
      ownerUserId,
      name: "第二公众号",
      shortName: null,
      description: "政务内容",
      contentTypes: ["government"],
      accountType: "service",
      verificationStatus: "unverified",
      defaultThemeId: null,
      isDefault: false,
      context,
    });
    const third = await repository.create({
      ownerUserId,
      name: "第三公众号",
      shortName: null,
      description: null,
      contentTypes: ["culture"],
      accountType: "unknown",
      verificationStatus: "unknown",
      defaultThemeId: null,
      isDefault: true,
      context,
    });

    let listed = await repository.list(ownerUserId, { page: 1, pageSize: 20 });
    expect(listed.items).toHaveLength(3);
    expect(
      listed.items.filter((account) => account.isDefault).map((account) => account.id),
    ).toEqual([third.id]);

    await expect(repository.setDefault(ownerUserId, second.id, context)).resolves.toBe("updated");
    await expect(repository.transition(ownerUserId, second.id, "archive", context)).resolves.toBe(
      "updated",
    );
    listed = await repository.list(ownerUserId, { page: 1, pageSize: 20 });
    const archived = listed.items.find((account) => account.id === second.id);
    expect(archived).toMatchObject({ isDefault: false, status: "archived" });
    expect(listed.items.filter((account) => account.isDefault)).toHaveLength(1);
    await expect(repository.setDefault(ownerUserId, second.id, context)).resolves.toBe(
      "not_active",
    );

    await connection.db.insert(articles).values({
      id: createUuidV7(),
      ownerUserId,
      accountId: first.id,
      title: "有关联的文章",
      sourceType: "blank",
      status: "pending_layout",
    });
    await expect(repository.deleteImpact(ownerUserId, first.id)).resolves.toMatchObject({
      activeArticleCount: 1,
      articleCount: 1,
      canPermanentlyDelete: false,
    });
    await expect(repository.permanentlyDelete(ownerUserId, first.id, context)).resolves.toBe(
      "blocked",
    );
    await expect(repository.permanentlyDelete(ownerUserId, third.id, context)).resolves.toBe(
      "deleted",
    );
    await expect(repository.find(ownerUserId, third.id)).resolves.toBeNull();

    expect(await repository.find(otherUserId, first.id)).toBeNull();
    await expect(repository.setDefault(otherUserId, first.id, context)).resolves.toBe("not_found");

    const actions = await connection.db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.actorUserId, ownerUserId));
    expect(actions.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        "account.create",
        "account.default.set",
        "account.archive",
        "account.delete",
      ]),
    );
  });

  it("seeds exactly three idempotent account workspaces for a development owner", async () => {
    const first = await seedBaseData(connection.db, {
      environment: "test",
      ownerEmail: "account-seed@example.com",
    });
    const second = await seedBaseData(connection.db, {
      environment: "test",
      ownerEmail: "account-seed@example.com",
    });

    expect(first).toMatchObject({ accountsCreated: 3, created: true });
    expect(first.accountIds).toHaveLength(3);
    expect(second).toMatchObject({ accountsCreated: 0, created: false, ownerId: first.ownerId });
    expect(second.accountIds).toEqual(first.accountIds);
    const listed = await repository.list(first.ownerId, { page: 1, pageSize: 20 });
    expect(listed.items).toHaveLength(3);
    expect(listed.items.filter((account) => account.isDefault)).toHaveLength(1);
  });
});
