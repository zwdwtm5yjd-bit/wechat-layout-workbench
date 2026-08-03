import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  articleDocuments,
  articleResources,
  articleSnapshots,
  articles,
  createDatabaseConnection,
  createUuidV7,
  defaultMigrationsFolder,
  migrateDatabase,
  resetTestDatabase,
  resources,
  users,
  verifyDatabaseSchema,
  type DatabaseConnection,
} from "../../packages/database/src/index.js";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const postgresPassword = "document-resource-backfill-password";

interface MigrationJournal {
  readonly dialect: string;
  readonly entries: readonly {
    readonly breakpoints: boolean;
    readonly idx: number;
    readonly tag: string;
    readonly version: string;
    readonly when: number;
  }[];
  readonly version: string;
}

async function partialMigrationsFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "wechat-layout-migrations-"));
  await mkdir(join(folder, "meta"));
  const journal = JSON.parse(
    await readFile(join(defaultMigrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as MigrationJournal;
  const entries = journal.entries.filter(({ idx }) => idx <= 3);
  await writeFile(
    join(folder, "meta", "_journal.json"),
    `${JSON.stringify({ ...journal, entries }, null, 2)}\n`,
  );
  await Promise.all(
    entries.map(({ tag }) =>
      copyFile(join(defaultMigrationsFolder, `${tag}.sql`), join(folder, `${tag}.sql`)),
    ),
  );
  return folder;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { readonly cause?: unknown; readonly code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : errorCode(candidate.cause);
}

function errorText(error: unknown): string {
  if (typeof error !== "object" || error === null) return String(error);
  const candidate = error as { readonly cause?: unknown; readonly message?: unknown };
  return [
    typeof candidate.message === "string" ? candidate.message : String(error),
    ...(candidate.cause === undefined ? [] : [errorText(candidate.cause)]),
  ].join(" ");
}

function resourceValue(
  id: string,
  ownerUserId: string,
  label: string,
  options: { readonly deleted?: boolean; readonly status?: string } = {},
) {
  const now = new Date();
  const status = options.status ?? "active";
  return {
    id,
    ownerUserId,
    resourceType: "image",
    sourceType: "upload",
    originalFilename: `${label}.png`,
    storageProvider: "s3",
    storageBucket: "integration",
    storageKey: `backfill/${id}.png`,
    mimeType: "image/png",
    fileExtension: "png",
    fileSize: 128,
    sha256: id.replaceAll("-", "").padEnd(64, "0").slice(0, 64),
    status,
    isPrivate: true,
    ...((options.deleted ?? false) || status === "trash"
      ? {
          deletedAt: new Date(now.valueOf() - 60_000),
          purgeAfter: new Date(now.valueOf() + 86_400_000),
        }
      : {}),
  };
}

async function insertUsers(connection: DatabaseConnection, ownerUserId: string, otherId: string) {
  await connection.db.insert(users).values([
    {
      id: ownerUserId,
      email: `backfill-owner-${ownerUserId}@example.invalid`,
      displayName: "Backfill owner",
      passwordHash: "!disabled:integration",
      role: "owner",
      status: "active",
      timezone: "Asia/Shanghai",
      locale: "zh-CN",
    },
    {
      id: otherId,
      email: `backfill-foreign-${otherId}@example.invalid`,
      displayName: "Backfill foreign owner",
      passwordHash: "!disabled:integration",
      role: "owner",
      status: "active",
      timezone: "Asia/Shanghai",
      locale: "zh-CN",
    },
  ]);
}

function documentJson(input: {
  readonly articleId: string;
  readonly content: readonly unknown[];
  readonly documentId: string;
  readonly now: Date;
}) {
  return {
    schemaVersion: "1.0.0",
    documentId: input.documentId,
    articleId: input.articleId,
    accountId: null,
    content: { type: "doc", content: input.content },
    meta: {
      sourceType: "manual",
      textLocked: true,
      createdAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    },
  };
}

async function insertArticleDocument(
  connection: DatabaseConnection,
  input: {
    readonly articleId: string;
    readonly document: ReturnType<typeof documentJson>;
    readonly documentId: string;
    readonly now: Date;
    readonly ownerUserId: string;
  },
) {
  await connection.db.insert(articles).values({
    id: input.articleId,
    ownerUserId: input.ownerUserId,
    title: "Document resource backfill",
    status: "pending_layout",
    createdAt: input.now,
    updatedAt: input.now,
  });
  await connection.db.insert(articleDocuments).values({
    id: input.documentId,
    articleId: input.articleId,
    schemaVersion: "1.0.0",
    documentJson: input.document,
    documentVersion: 7,
    lastSavedBy: input.ownerUserId,
    lastSavedAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function expectMigrationStayedAt0003(
  connection: DatabaseConnection,
  input: { readonly bindingId: string; readonly expectedSortOrder: number },
) {
  const [column] = await connection.sql<{ maximumLength: number }[]>`
    select character_maximum_length::int as "maximumLength"
    from information_schema.columns
    where table_schema = 'content'
      and table_name = 'article_resources'
      and column_name = 'block_id'
  `;
  const [binding] = await connection.sql<{ deletedAt: Date | null; sortOrder: number }[]>`
    select deleted_at as "deletedAt", sort_order as "sortOrder"
    from content.article_resources
    where id = ${input.bindingId}::uuid
  `;
  const [migration] = await connection.sql<{ count: number }[]>`
    select count(*)::int as count from drizzle.__drizzle_migrations
  `;
  const [indexes] = await connection.sql<{ count: number }[]>`
    select count(*)::int as count
    from pg_indexes
    where schemaname = 'content'
      and indexname in (
        'uq_article_resources_live_binding',
        'uq_article_resources_snapshot_binding'
      )
  `;

  expect(column?.maximumLength).toBe(100);
  expect(binding).toEqual({ deletedAt: null, sortOrder: input.expectedSortOrder });
  expect(migration?.count).toBe(4);
  expect(indexes?.count).toBe(0);
  await expect(verifyDatabaseSchema(connection)).rejects.toThrow("数据库迁移数量不足：4/6");
}

async function expectUniqueViolation(operation: () => Promise<unknown>) {
  let duplicateError: unknown;
  try {
    await operation();
  } catch (error) {
    duplicateError = error;
  }
  expect(errorCode(duplicateError)).toBe("23505");
}

describe("document resource migration backfill", () => {
  let postgres: StartedTestContainer;
  let connection: DatabaseConnection;
  let databaseUrl: string;
  let partialFolder: string;

  beforeAll(async () => {
    postgres = await new GenericContainer("postgres:18.4-alpine")
      .withEnvironment({
        POSTGRES_DB: "document_resource_backfill_test",
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_USER: "wechat_layout",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forSuccessfulCommand(
          "pg_isready --username wechat_layout --dbname document_resource_backfill_test",
        ),
      )
      .withStartupTimeout(120_000)
      .start();
    databaseUrl = `postgresql://wechat_layout:${postgresPassword}@${postgres.getHost()}:${String(postgres.getMappedPort(5432))}/document_resource_backfill_test`;
    partialFolder = await partialMigrationsFolder();
  });

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl);
    await migrateDatabase(databaseUrl, partialFolder);
    connection = createDatabaseConnection(databaseUrl, {
      applicationName: "document-resource-backfill-integration",
    });
  });

  afterEach(async () => {
    await connection?.close();
  });

  afterAll(async () => {
    await postgres?.stop();
    if (partialFolder !== undefined) {
      await rm(partialFolder, { force: true, recursive: true });
    }
  });

  it("backfills exact active live and frozen sets and enforces all binding identities", async () => {
    const ownerUserId = createUuidV7();
    const otherOwnerUserId = createUuidV7();
    const articleId = createUuidV7();
    const documentId = createUuidV7();
    const snapshotId = createUuidV7();
    const liveResourceId = createUuidV7();
    const longBlockResourceId = createUuidV7();
    const snapshotResourceId = createUuidV7();
    const staleResourceId = createUuidV7();
    const unusedTrashResourceId = createUuidV7();
    const longBlockId = "b".repeat(128);
    const now = new Date();

    await insertUsers(connection, ownerUserId, otherOwnerUserId);
    await connection.db
      .insert(resources)
      .values([
        resourceValue(liveResourceId, ownerUserId, "live"),
        resourceValue(longBlockResourceId, ownerUserId, "long-block"),
        resourceValue(snapshotResourceId, ownerUserId, "snapshot"),
        resourceValue(staleResourceId, ownerUserId, "stale"),
        resourceValue(unusedTrashResourceId, ownerUserId, "unused-trash", { status: "trash" }),
      ]);
    const document = documentJson({
      articleId,
      documentId,
      now,
      content: [
        {
          type: "imageBlock",
          attrs: { blockId: "image-current", locked: false, resourceId: liveResourceId },
        },
        {
          type: "imageBlock",
          attrs: { blockId: longBlockId, locked: false, resourceId: longBlockResourceId },
        },
        {
          type: "imageBlock",
          attrs: {
            blockId: "image-pending",
            locked: false,
            resourceId: "component_slot_image_pending",
          },
        },
      ],
    });
    await insertArticleDocument(connection, {
      articleId,
      document,
      documentId,
      now,
      ownerUserId,
    });
    await connection.db.insert(articleSnapshots).values({
      id: snapshotId,
      articleId,
      snapshotNumber: 1,
      reason: "manual",
      documentSchemaVersion: "1.0.0",
      documentJson: document,
      resourceManifest: [
        {
          resourceId: snapshotResourceId,
          references: [{ blockId: "snapshot-live", usageType: "image" }],
        },
        {
          resourceId: longBlockResourceId,
          references: [{ blockId: "snapshot-long", usageType: "image_original" }],
        },
        {
          resourceId: "component_slot_qrcode_pending",
          references: [{ blockId: "", usageType: "not-a-usage" }],
        },
      ],
      packageManifest: [],
      createdBy: ownerUserId,
      createdAt: now,
    });

    await connection.db.insert(articleResources).values([
      {
        id: createUuidV7(),
        articleId,
        resourceId: liveResourceId,
        blockId: "image-current",
        usageType: "image",
        sortOrder: 91,
      },
      {
        id: createUuidV7(),
        articleId,
        resourceId: liveResourceId,
        blockId: "image-current",
        usageType: "image",
        sortOrder: 92,
      },
      {
        id: createUuidV7(),
        articleId,
        resourceId: staleResourceId,
        blockId: "stale-live",
        usageType: "inline_image",
        sortOrder: 93,
      },
      {
        id: createUuidV7(),
        articleId,
        resourceId: snapshotResourceId,
        blockId: "snapshot-live",
        usageType: "image",
        sortOrder: 94,
        frozenBySnapshotId: snapshotId,
      },
      {
        id: createUuidV7(),
        articleId,
        resourceId: snapshotResourceId,
        blockId: "snapshot-live",
        usageType: "image",
        sortOrder: 95,
        frozenBySnapshotId: snapshotId,
      },
      {
        id: createUuidV7(),
        articleId,
        resourceId: liveResourceId,
        blockId: "snapshot-stale",
        usageType: "image",
        sortOrder: 96,
        frozenBySnapshotId: snapshotId,
      },
    ]);

    await migrateDatabase(databaseUrl);

    const rows = await connection.sql<
      {
        blockId: string | null;
        deletedAt: Date | null;
        frozenBySnapshotId: string | null;
        resourceId: string;
        sortOrder: number;
        usageType: string;
      }[]
    >`
      select
        block_id as "blockId",
        deleted_at as "deletedAt",
        frozen_by_snapshot_id as "frozenBySnapshotId",
        resource_id as "resourceId",
        sort_order as "sortOrder",
        usage_type as "usageType"
      from content.article_resources
      where article_id = ${articleId}::uuid
      order by frozen_by_snapshot_id nulls first, deleted_at nulls first, sort_order, block_id
    `;
    expect(
      rows
        .filter(
          ({ deletedAt, frozenBySnapshotId }) => deletedAt === null && frozenBySnapshotId === null,
        )
        .map(({ blockId, resourceId, sortOrder, usageType }) => ({
          blockId,
          resourceId,
          sortOrder,
          usageType,
        })),
    ).toEqual([
      { blockId: "image-current", resourceId: liveResourceId, sortOrder: 0, usageType: "image" },
      { blockId: longBlockId, resourceId: longBlockResourceId, sortOrder: 1, usageType: "image" },
    ]);
    expect(
      rows
        .filter(
          ({ deletedAt, frozenBySnapshotId }) =>
            deletedAt === null && frozenBySnapshotId === snapshotId,
        )
        .map(({ blockId, resourceId, sortOrder, usageType }) => ({
          blockId,
          resourceId,
          sortOrder,
          usageType,
        })),
    ).toEqual([
      {
        blockId: "snapshot-live",
        resourceId: snapshotResourceId,
        sortOrder: 0,
        usageType: "image",
      },
      {
        blockId: "snapshot-long",
        resourceId: longBlockResourceId,
        sortOrder: 1,
        usageType: "image_original",
      },
    ]);
    expect(rows.filter(({ deletedAt }) => deletedAt !== null)).toHaveLength(4);
    expect(rows.some(({ resourceId }) => resourceId === unusedTrashResourceId)).toBe(false);

    const availableResources = await connection.sql<
      { deletedAt: Date | null; id: string; status: string }[]
    >`
      select id, status, deleted_at as "deletedAt"
      from content.resources
      where id in (
        ${liveResourceId}::uuid,
        ${longBlockResourceId}::uuid,
        ${snapshotResourceId}::uuid
      )
      order by id
    `;
    expect(availableResources).toHaveLength(3);
    expect(
      availableResources.every(
        ({ deletedAt, status }) => deletedAt === null && status === "active",
      ),
    ).toBe(true);

    const [column] = await connection.sql<{ maximumLength: number }[]>`
      select character_maximum_length::int as "maximumLength"
      from information_schema.columns
      where table_schema = 'content'
        and table_name = 'article_resources'
        and column_name = 'block_id'
    `;
    expect(column?.maximumLength).toBe(128);
    const verification = await verifyDatabaseSchema(connection);
    expect(verification.migrationCount).toBe(6);

    await expectUniqueViolation(() =>
      connection.db.insert(articleResources).values({
        id: createUuidV7(),
        articleId,
        resourceId: liveResourceId,
        blockId: "image-current",
        usageType: "image",
        sortOrder: 0,
      }),
    );
    await expectUniqueViolation(() =>
      connection.db.insert(articleResources).values({
        id: createUuidV7(),
        articleId,
        resourceId: snapshotResourceId,
        blockId: "snapshot-live",
        usageType: "image",
        sortOrder: 0,
        frozenBySnapshotId: snapshotId,
      }),
    );

    await connection.db.insert(articleResources).values({
      id: createUuidV7(),
      articleId,
      resourceId: staleResourceId,
      blockId: null,
      usageType: "watermark",
      sortOrder: 0,
    });
    await expectUniqueViolation(() =>
      connection.db.insert(articleResources).values({
        id: createUuidV7(),
        articleId,
        resourceId: staleResourceId,
        blockId: "",
        usageType: "watermark",
        sortOrder: 1,
      }),
    );
    await connection.db.insert(articleResources).values({
      id: createUuidV7(),
      articleId,
      resourceId: staleResourceId,
      blockId: null,
      usageType: "svg_asset",
      sortOrder: 0,
      frozenBySnapshotId: snapshotId,
    });
    await expectUniqueViolation(() =>
      connection.db.insert(articleResources).values({
        id: createUuidV7(),
        articleId,
        resourceId: staleResourceId,
        blockId: "",
        usageType: "svg_asset",
        sortOrder: 1,
        frozenBySnapshotId: snapshotId,
      }),
    );

    const indexDefinitions = await connection.sql<{ definition: string }[]>`
      select pg_get_indexdef(indexrelid) as definition
      from pg_index
      where indexrelid in (
        'content.uq_article_resources_live_binding'::regclass,
        'content.uq_article_resources_snapshot_binding'::regclass
      )
    `;
    expect(indexDefinitions).toHaveLength(2);
    expect(
      indexDefinitions.every(({ definition }) => definition.toLowerCase().includes("coalesce")),
    ).toBe(true);

    await connection.sql`drop index content.uq_article_resources_snapshot_binding`;
    await expect(verifyDatabaseSchema(connection)).rejects.toThrow(
      "uq_article_resources_snapshot_binding",
    );
  });

  it("rejects unavailable or malformed current-document references atomically", async () => {
    const ownerUserId = createUuidV7();
    const otherOwnerUserId = createUuidV7();
    const articleId = createUuidV7();
    const documentId = createUuidV7();
    const activeResourceId = createUuidV7();
    const legacyUuidV4ResourceId = "00000000-0000-4000-8000-000000000001";
    const foreignResourceId = createUuidV7();
    const trashResourceId = createUuidV7();
    const deletedResourceId = createUuidV7();
    const missingResourceId = createUuidV7();
    const bindingId = createUuidV7();
    const now = new Date();

    await insertUsers(connection, ownerUserId, otherOwnerUserId);
    await connection.db
      .insert(resources)
      .values([
        resourceValue(activeResourceId, ownerUserId, "active"),
        resourceValue(legacyUuidV4ResourceId, ownerUserId, "legacy-v4"),
        resourceValue(foreignResourceId, otherOwnerUserId, "foreign"),
        resourceValue(trashResourceId, ownerUserId, "trash", { status: "trash" }),
        resourceValue(deletedResourceId, ownerUserId, "deleted", { deleted: true }),
      ]);
    const document = documentJson({
      articleId,
      documentId,
      now,
      content: [
        {
          type: "imageBlock",
          attrs: {
            blockId: "",
            locked: false,
            resourceId: "component_slot_image_pending",
          },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "required-null", locked: false, resourceId: null },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "bad-uuid", locked: false, resourceId: "not-a-uuid" },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "legacy-v4", locked: false, resourceId: legacyUuidV4ResourceId },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "missing", locked: false, resourceId: missingResourceId },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "foreign", locked: false, resourceId: foreignResourceId },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "trash", locked: false, resourceId: trashResourceId },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "deleted", locked: false, resourceId: deletedResourceId },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "", locked: false, resourceId: activeResourceId },
        },
        {
          type: "imageBlock",
          attrs: { blockId: "x".repeat(129), locked: false, resourceId: activeResourceId },
        },
      ],
    });
    await insertArticleDocument(connection, {
      articleId,
      document,
      documentId,
      now,
      ownerUserId,
    });
    await connection.db.insert(articleResources).values({
      id: bindingId,
      articleId,
      resourceId: activeResourceId,
      blockId: "legacy-current",
      usageType: "image",
      sortOrder: 77,
    });

    let migrationError: unknown;
    try {
      await migrateDatabase(databaseUrl);
    } catch (error) {
      migrationError = error;
    }
    expect(errorCode(migrationError)).toBe("22023");
    expect(errorText(migrationError)).toContain("0004 document resource preflight failed");
    await expectMigrationStayedAt0003(connection, { bindingId, expectedSortOrder: 77 });
  });

  it("rejects unavailable or malformed snapshot-manifest references atomically", async () => {
    const ownerUserId = createUuidV7();
    const otherOwnerUserId = createUuidV7();
    const articleId = createUuidV7();
    const documentId = createUuidV7();
    const snapshotId = createUuidV7();
    const activeResourceId = createUuidV7();
    const foreignResourceId = createUuidV7();
    const trashResourceId = createUuidV7();
    const missingResourceId = createUuidV7();
    const bindingId = createUuidV7();
    const now = new Date();

    await insertUsers(connection, ownerUserId, otherOwnerUserId);
    await connection.db
      .insert(resources)
      .values([
        resourceValue(activeResourceId, ownerUserId, "active"),
        resourceValue(foreignResourceId, otherOwnerUserId, "foreign"),
        resourceValue(trashResourceId, ownerUserId, "trash", { status: "trash" }),
      ]);
    const document = documentJson({
      articleId,
      documentId,
      now,
      content: [
        {
          type: "imageBlock",
          attrs: { blockId: "legacy-current", locked: false, resourceId: activeResourceId },
        },
      ],
    });
    await insertArticleDocument(connection, {
      articleId,
      document,
      documentId,
      now,
      ownerUserId,
    });
    await connection.db.insert(articleSnapshots).values({
      id: snapshotId,
      articleId,
      snapshotNumber: 1,
      reason: "manual",
      documentSchemaVersion: "1.0.0",
      documentJson: document,
      resourceManifest: [
        {
          resourceId: "component_slot_qrcode_pending",
          references: [{ blockId: "", usageType: "not-a-usage" }],
        },
        {
          resourceId: activeResourceId,
          references: [{ blockId: "snapshot", usageType: "invalid_usage" }],
        },
        {
          resourceId: activeResourceId,
          references: [{ blockId: "", usageType: "image" }],
        },
        {
          resourceId: foreignResourceId,
          references: [{ blockId: "foreign", usageType: "image" }],
        },
        {
          resourceId: trashResourceId,
          references: [{ blockId: "trash", usageType: "image" }],
        },
        {
          resourceId: missingResourceId,
          references: [{ blockId: "missing", usageType: "image" }],
        },
      ],
      packageManifest: [],
      createdBy: ownerUserId,
      createdAt: now,
    });
    await connection.db.insert(articleResources).values({
      id: bindingId,
      articleId,
      resourceId: activeResourceId,
      blockId: "legacy-current",
      usageType: "image",
      sortOrder: 88,
    });

    let migrationError: unknown;
    try {
      await migrateDatabase(databaseUrl);
    } catch (error) {
      migrationError = error;
    }
    expect(errorCode(migrationError)).toBe("22023");
    expect(errorText(migrationError)).toContain("0004 snapshot resource preflight failed");
    await expectMigrationStayedAt0003(connection, { bindingId, expectedSortOrder: 88 });
  });
});
