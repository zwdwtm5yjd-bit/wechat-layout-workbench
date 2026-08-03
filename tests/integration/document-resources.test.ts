import {
  articleDocuments,
  articles,
  createDatabaseConnection,
  createUuidV7,
  migrateDatabase,
  resources,
  users,
  type DatabaseConnection,
} from "../../packages/database/src/index.js";
import type { DocumentV1 } from "../../packages/document-schema/src/index.js";
import { WechatCompatibilityEngine } from "../../packages/wechat-renderer/src/index.js";
import { PostgresArticleRepository } from "../../apps/api/src/articles/postgres-article.repository.js";
import { PostgresCopyRepository } from "../../apps/api/src/copy/postgres-copy.repository.js";
import { statisticsForDocument } from "../../apps/api/src/documents/document-statistics.js";
import { PostgresDocumentRepository } from "../../apps/api/src/documents/postgres-document.repository.js";
import type { SaveArticleDocumentInput } from "../../apps/api/src/documents/document.types.js";
import { PostgresResourceRepository } from "../../apps/api/src/resources/postgres-resource.repository.js";
import { PostgresSnapshotRepository } from "../../apps/api/src/snapshots/postgres-snapshot.repository.js";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const postgresPassword = "document-resources-postgres-password";

async function waitForDatabase(databaseUrl: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const probe = createDatabaseConnection(databaseUrl, {
      applicationName: "document-resources-readiness",
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

function emptyDocument(documentId: string, articleId: string): DocumentV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0.0",
    documentId,
    articleId,
    accountId: null,
    content: { type: "doc", content: [] },
    meta: {
      sourceType: "manual",
      textLocked: true,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function documentWithImages(
  source: DocumentV1,
  images: readonly { readonly blockId: string; readonly resourceId: string }[],
): DocumentV1 {
  const document = structuredClone(source);
  document.meta.updatedAt = new Date().toISOString();
  document.content.content = images.map(({ blockId, resourceId }) => ({
    type: "imageBlock",
    attrs: {
      blockId,
      locked: false,
      resourceId,
      alt: blockId,
      widthMode: "full",
    },
  }));
  return document;
}

describe("transactional document resource bindings", () => {
  let postgres: StartedTestContainer;
  let connection: DatabaseConnection;
  let documents: PostgresDocumentRepository;
  let snapshots: PostgresSnapshotRepository;
  let resourceRepository: PostgresResourceRepository;
  let articleRepository: PostgresArticleRepository;
  let copyRepository: PostgresCopyRepository;

  beforeAll(async () => {
    postgres = await new GenericContainer("postgres:18.4-alpine")
      .withEnvironment({
        POSTGRES_DB: "document_resources_test",
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_USER: "wechat_layout",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forSuccessfulCommand(
          "pg_isready --username wechat_layout --dbname document_resources_test",
        ),
      )
      .withStartupTimeout(120_000)
      .start();
    const databaseUrl = `postgresql://wechat_layout:${postgresPassword}@${postgres.getHost()}:${String(postgres.getMappedPort(5432))}/document_resources_test`;
    await waitForDatabase(databaseUrl);
    await migrateDatabase(databaseUrl);
    connection = createDatabaseConnection(databaseUrl, {
      applicationName: "document-resources-integration",
    });
    documents = new PostgresDocumentRepository(connection);
    snapshots = new PostgresSnapshotRepository(connection);
    resourceRepository = new PostgresResourceRepository(connection);
    articleRepository = new PostgresArticleRepository(connection);
    copyRepository = new PostgresCopyRepository(connection);
  });

  afterAll(async () => {
    await connection?.close();
    await postgres?.stop();
  });

  async function createOwner(label: string): Promise<string> {
    const id = createUuidV7();
    await connection.db.insert(users).values({
      id,
      email: `${label}-${id}@example.invalid`,
      displayName: label,
      passwordHash: "!disabled:integration",
      role: "owner",
      status: "active",
      timezone: "Asia/Shanghai",
      locale: "zh-CN",
    });
    return id;
  }

  async function createResource(
    ownerUserId: string,
    label: string,
    status = "active",
  ): Promise<string> {
    const id = createUuidV7();
    await connection.db.insert(resources).values({
      id,
      ownerUserId,
      accountId: null,
      resourceType: "image",
      sourceType: "upload",
      originalFilename: `${label}.png`,
      storageProvider: "s3",
      storageBucket: "integration",
      storageKey: `document-resources/${id}.png`,
      mimeType: "image/png",
      fileExtension: "png",
      fileSize: 128,
      width: 32,
      height: 32,
      sha256: id.replaceAll("-", "").padEnd(64, "0").slice(0, 64),
      status,
      isPrivate: true,
    });
    return id;
  }

  async function createArticle(ownerUserId: string, label: string) {
    const articleId = createUuidV7();
    const documentId = createUuidV7();
    const document = emptyDocument(documentId, articleId);
    const now = new Date();
    await connection.db.insert(articles).values({
      id: articleId,
      ownerUserId,
      title: label,
      status: "pending_layout",
      textLocked: true,
      createdAt: now,
      updatedAt: now,
    });
    await connection.db.insert(articleDocuments).values({
      id: documentId,
      articleId,
      schemaVersion: "1.0.0",
      documentJson: document as unknown as Record<string, unknown>,
      documentVersion: 1,
      lastSavedBy: ownerUserId,
      lastSavedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { articleId, document };
  }

  function saveInput(
    ownerUserId: string,
    articleId: string,
    document: DocumentV1,
    baseVersion: number,
    lastTransactionId = createUuidV7(),
  ): SaveArticleDocumentInput {
    return {
      ownerUserId,
      articleId,
      baseVersion,
      schemaVersion: "1.0.0",
      document,
      lastTransactionId,
      transactionOrigin: "integration.test",
      statistics: statisticsForDocument(document),
      context: {
        actorUserId: ownerUserId,
        requestId: `request-${lastTransactionId}`,
        traceId: `trace-${lastTransactionId}`,
      },
    };
  }

  async function activeRows(articleId: string) {
    return connection.sql<
      {
        blockId: string;
        frozenBySnapshotId: string | null;
        resourceId: string;
        sortOrder: number;
      }[]
    >`
      select
        block_id as "blockId",
        frozen_by_snapshot_id as "frozenBySnapshotId",
        resource_id as "resourceId",
        sort_order as "sortOrder"
      from content.article_resources
      where article_id = ${articleId}::uuid
        and deleted_at is null
      order by frozen_by_snapshot_id nulls first, sort_order, block_id
    `;
  }

  it("saves, replays and deduplicates one resource used by multiple blocks", async () => {
    const ownerUserId = await createOwner("normal-owner");
    const { articleId, document } = await createArticle(ownerUserId, "normal article");
    const resourceId = await createResource(ownerUserId, "normal-image");
    const blockId128 = "b".repeat(128);
    const changed = documentWithImages(document, [
      { blockId: "image-a", resourceId },
      { blockId: blockId128, resourceId },
    ]);
    const transactionId = createUuidV7();
    const input = saveInput(ownerUserId, articleId, changed, 1, transactionId);

    await expect(documents.save(input)).resolves.toMatchObject({ kind: "saved" });
    await expect(documents.save(input)).resolves.toMatchObject({ kind: "replayed" });

    const rows = (await activeRows(articleId)).filter(
      ({ frozenBySnapshotId }) => frozenBySnapshotId === null,
    );
    expect(rows).toEqual([
      expect.objectContaining({ blockId: "image-a", resourceId, sortOrder: 0 }),
      expect.objectContaining({ blockId: blockId128, resourceId, sortOrder: 1 }),
    ]);
    await expect(copyRepository.findRenderSource(ownerUserId, articleId)).resolves.toMatchObject({
      resources: [{ id: resourceId }],
    });
  });

  it("commits only the winning document and its resources under concurrent saves", async () => {
    const ownerUserId = await createOwner("concurrent-owner");
    const { articleId, document } = await createArticle(ownerUserId, "concurrent article");
    const [resourceA, resourceB] = await Promise.all([
      createResource(ownerUserId, "winner-a"),
      createResource(ownerUserId, "winner-b"),
    ]);
    const documentA = documentWithImages(document, [{ blockId: "image-a", resourceId: resourceA }]);
    const documentB = documentWithImages(document, [{ blockId: "image-b", resourceId: resourceB }]);

    const results = await Promise.all([
      documents.save(saveInput(ownerUserId, articleId, documentA, 1)),
      documents.save(saveInput(ownerUserId, articleId, documentB, 1)),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual(["conflict", "saved"]);

    const current = await documents.findCurrent(ownerUserId, articleId);
    expect(current).not.toBeNull();
    const winningResourceId = current?.document.content.content[0];
    if (winningResourceId?.type !== "imageBlock") {
      throw new Error("Winning document did not contain its image");
    }
    const rows = (await activeRows(articleId)).filter(
      ({ frozenBySnapshotId }) => frozenBySnapshotId === null,
    );
    expect(rows).toEqual([
      expect.objectContaining({ resourceId: winningResourceId.attrs.resourceId }),
    ]);
  });

  it("never commits a live binding to a resource concurrently moved to trash", async () => {
    const ownerUserId = await createOwner("trash-race-owner");
    const { articleId, document } = await createArticle(ownerUserId, "trash race article");
    const resourceId = await createResource(ownerUserId, "trash-race-image");
    const changed = documentWithImages(document, [{ blockId: "trash-race", resourceId }]);

    const [saveResult, trashResult] = await Promise.all([
      documents.save(saveInput(ownerUserId, articleId, changed, 1)),
      resourceRepository.trashIfUnreferenced(ownerUserId, resourceId, {
        actorUserId: ownerUserId,
        requestId: `request-${createUuidV7()}`,
        traceId: `trace-${createUuidV7()}`,
      }),
    ]);
    const [resource] = await connection.sql<{ deletedAt: Date | null; status: string }[]>`
      select deleted_at as "deletedAt", status
      from content.resources
      where id = ${resourceId}::uuid
    `;
    const current = await documents.findCurrent(ownerUserId, articleId);
    const rows = (await activeRows(articleId)).filter(
      ({ frozenBySnapshotId }) => frozenBySnapshotId === null,
    );

    if (saveResult.kind === "saved") {
      expect(trashResult).toMatchObject({ kind: "in_use" });
      expect(resource).toMatchObject({ deletedAt: null, status: "active" });
      expect(current).toMatchObject({ documentVersion: 2, document: changed });
      expect(rows).toEqual([expect.objectContaining({ resourceId })]);
    } else {
      expect(saveResult).toMatchObject({ kind: "invalid_resources" });
      expect(trashResult).toMatchObject({ kind: "trashed" });
      expect(resource?.status).toBe("trash");
      expect(resource?.deletedAt).toBeInstanceOf(Date);
      expect(current).toMatchObject({ documentVersion: 1, document });
      expect(rows).toEqual([]);
    }
  });

  it("rejects malformed, missing, foreign and inactive resources atomically", async () => {
    const ownerUserId = await createOwner("validation-owner");
    const otherOwnerUserId = await createOwner("foreign-owner");
    const { articleId, document } = await createArticle(ownerUserId, "validation article");
    const foreign = await createResource(otherOwnerUserId, "foreign");
    const processing = await createResource(ownerUserId, "processing", "processing");
    const candidates = ["not-a-uuid", createUuidV7(), foreign, processing];

    for (const [index, resourceId] of candidates.entries()) {
      const changed = documentWithImages(document, [
        { blockId: `invalid-${String(index)}`, resourceId },
      ]);
      await expect(
        documents.save(saveInput(ownerUserId, articleId, changed, 1)),
      ).resolves.toMatchObject({ kind: "invalid_resources" });
    }

    const current = await documents.findCurrent(ownerUserId, articleId);
    expect(current).toMatchObject({ documentVersion: 1, document });
    expect(await activeRows(articleId)).toEqual([]);
    const [audit] = await connection.sql<{ count: number }[]>`
      select count(*)::integer as count
      from audit.audit_logs
      where article_id = ${articleId}::uuid
    `;
    expect(audit?.count).toBe(0);
  });

  it("keeps frozen resources protected while restore reconciles live bindings", async () => {
    const ownerUserId = await createOwner("snapshot-owner");
    const { articleId, document } = await createArticle(ownerUserId, "snapshot article");
    const [resourceA, resourceB] = await Promise.all([
      createResource(ownerUserId, "snapshot-a"),
      createResource(ownerUserId, "snapshot-b"),
    ]);
    const documentA = documentWithImages(document, [{ blockId: "image-a", resourceId: resourceA }]);
    await documents.save(saveInput(ownerUserId, articleId, documentA, 1));
    const snapshot = await snapshots.create({
      ownerUserId,
      articleId,
      reason: "manual",
      note: "resource A",
      context: {
        actorUserId: ownerUserId,
        requestId: `request-${createUuidV7()}`,
        traceId: `trace-${createUuidV7()}`,
      },
    });
    if (snapshot.kind !== "created") {
      throw new Error(`Snapshot was not created: ${snapshot.kind}`);
    }
    const documentB = documentWithImages(documentA, [
      { blockId: "image-b", resourceId: resourceB },
    ]);
    await documents.save(saveInput(ownerUserId, articleId, documentB, 2));

    await expect(
      resourceRepository.trashIfUnreferenced(ownerUserId, resourceA, {
        actorUserId: ownerUserId,
        requestId: `request-${createUuidV7()}`,
        traceId: `trace-${createUuidV7()}`,
      }),
    ).resolves.toMatchObject({ kind: "in_use" });

    const restored = await snapshots.restore({
      ownerUserId,
      articleId,
      snapshotId: snapshot.snapshot.id,
      baseVersion: 3,
      lastTransactionId: createUuidV7(),
      context: {
        actorUserId: ownerUserId,
        requestId: `request-${createUuidV7()}`,
        traceId: `trace-${createUuidV7()}`,
      },
    });
    expect(restored).toMatchObject({ kind: "restored", documentVersion: 4 });
    const rows = await activeRows(articleId);
    expect(rows.filter(({ frozenBySnapshotId }) => frozenBySnapshotId === null)).toEqual([
      expect.objectContaining({ resourceId: resourceA }),
    ]);
    expect(
      new Set(
        rows
          .filter(({ frozenBySnapshotId }) => frozenBySnapshotId !== null)
          .map(({ resourceId }) => resourceId),
      ),
    ).toEqual(new Set([resourceA, resourceB]));
  });

  it("freezes duplicate and formal-render snapshots without leaking them into live copy sources", async () => {
    const ownerUserId = await createOwner("entrypoint-owner");
    const { articleId, document } = await createArticle(ownerUserId, "entrypoint article");
    const resourceId = await createResource(ownerUserId, "entrypoint-image");
    const changed = documentWithImages(document, [{ blockId: "entrypoint-image", resourceId }]);
    await documents.save(saveInput(ownerUserId, articleId, changed, 1));

    const duplicated = await articleRepository.duplicate(ownerUserId, articleId, {
      title: "entrypoint duplicate",
      contentGroupMode: "independent",
      context: {
        actorUserId: ownerUserId,
        requestId: `request-${createUuidV7()}`,
        traceId: `trace-${createUuidV7()}`,
      },
    });
    if (duplicated.kind !== "created") {
      throw new Error(`Article was not duplicated: ${duplicated.kind}`);
    }
    const duplicateRows = await activeRows(duplicated.article.id);
    expect(duplicateRows).toEqual([
      expect.objectContaining({ frozenBySnapshotId: null, resourceId }),
    ]);
    expect(
      (await activeRows(articleId)).some(
        (row) => row.frozenBySnapshotId !== null && row.resourceId === resourceId,
      ),
    ).toBe(true);

    const source = await copyRepository.findRenderSource(ownerUserId, articleId);
    if (source === null) {
      throw new Error("Copy source was not found");
    }
    expect(source.resources).toEqual([expect.objectContaining({ id: resourceId })]);
    const checked = new WechatCompatibilityEngine().check({
      document: source.document,
      mode: "standard",
      resources: { [resourceId]: "https://cdn.example.com/entrypoint.png" },
      ...(source.currentTextHash === null
        ? {}
        : { expectedSourceTextHash: `sha256:${source.currentTextHash}` }),
    });
    const generatedAt = new Date();
    const persisted = await copyRepository.persistRenderOutput({
      ownerUserId,
      source,
      mode: "standard",
      report: checked.report,
      renderResult: checked.renderResult,
      generatedAt,
      expiresAt: new Date(generatedAt.getTime() + 15 * 60 * 1000),
      context: {
        actorUserId: ownerUserId,
        requestId: `request-${createUuidV7()}`,
        traceId: `trace-${createUuidV7()}`,
      },
    });
    expect(persisted).toMatchObject({ kind: "created" });
    if (persisted.kind !== "created") {
      throw new Error(`Render was not persisted: ${persisted.kind}`);
    }
    const [frozen] = await connection.sql<{ count: number }[]>`
      select count(*)::integer as count
      from content.article_resources
      where frozen_by_snapshot_id = ${persisted.output.snapshotId}::uuid
        and resource_id = ${resourceId}::uuid
        and deleted_at is null
    `;
    expect(frozen?.count).toBe(1);
    await expect(copyRepository.findRenderSource(ownerUserId, articleId)).resolves.toMatchObject({
      resources: [{ id: resourceId }],
    });
  });
});
