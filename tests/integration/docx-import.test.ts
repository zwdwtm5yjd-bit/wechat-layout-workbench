import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  articleDocuments,
  articleResources,
  articles,
  createDatabaseConnection,
  createUuidV7,
  jobs,
  migrateDatabase,
  resources,
  seedBaseData,
  sourceBlocks,
  sourceDocuments,
  type DatabaseConnection,
} from "../../packages/database/src/index.js";
import { validateDocument } from "../../packages/document-schema/src/index.js";
import { JobStore } from "../../packages/job-runtime/src/index.js";
import type {
  ObjectStorage,
  ObjectStorageStat,
  SignedObjectRequest,
} from "../../packages/storage-adapter/src/index.js";
import { createDocxImportHandler } from "../../apps/worker/src/docx-handler.js";
import { and, asc, eq } from "drizzle-orm";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const postgresPassword = "docx-import-postgres-password";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

class MemoryObjectStorage implements ObjectStorage {
  readonly bucket = "docx-import-test";
  readonly objects = new Map<
    string,
    {
      readonly bytes: Uint8Array;
      readonly contentType: string;
      readonly metadata: Readonly<Record<string, string>>;
    }
  >();

  createUploadUrl(): Promise<SignedObjectRequest> {
    throw new Error("not used");
  }

  createDownloadUrl(): Promise<SignedObjectRequest> {
    throw new Error("not used");
  }

  statObject(key: string): Promise<ObjectStorageStat> {
    const value = this.objects.get(key);
    if (value === undefined) throw new Error("missing object");
    return Promise.resolve({
      size: value.bytes.byteLength,
      contentType: value.contentType,
      etag: digest(value.bytes),
      metadata: value.metadata,
      lastModified: new Date(),
    });
  }

  getObject(key: string, maximumBytes: number): Promise<Uint8Array> {
    const value = this.objects.get(key);
    if (value === undefined) throw new Error("missing object");
    if (value.bytes.byteLength > maximumBytes) throw new Error("oversized object");
    return Promise.resolve(value.bytes);
  }

  putObject(input: {
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<ObjectStorageStat> {
    this.objects.set(input.key, {
      bytes: input.bytes,
      contentType: input.contentType,
      metadata: input.metadata ?? {},
    });
    return this.statObject(input.key);
  }

  deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

async function waitForDatabase(databaseUrl: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const probe = createDatabaseConnection(databaseUrl, {
      applicationName: "docx-import-readiness",
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
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  throw lastError;
}

describe("DOCX import transaction", () => {
  let postgres: StartedTestContainer;
  let connection: DatabaseConnection;
  let ownerUserId: string;
  let storage: MemoryObjectStorage;
  let temporary: string;

  beforeAll(async () => {
    postgres = await new GenericContainer("postgres:18.4-alpine")
      .withEnvironment({
        POSTGRES_DB: "docx_import_test",
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_USER: "wechat_layout",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forSuccessfulCommand("pg_isready --username wechat_layout --dbname docx_import_test"),
      )
      .withStartupTimeout(120_000)
      .start();
    const databaseUrl = `postgresql://wechat_layout:${postgresPassword}@${postgres.getHost()}:${String(postgres.getMappedPort(5432))}/docx_import_test`;
    await waitForDatabase(databaseUrl);
    await migrateDatabase(databaseUrl);
    connection = createDatabaseConnection(databaseUrl, { applicationName: "docx-import-test" });
    ownerUserId = (
      await seedBaseData(connection.db, {
        environment: "test",
        ownerEmail: "docx-owner@example.com",
      })
    ).ownerId;
    storage = new MemoryObjectStorage();
    temporary = await mkdtemp(join(tmpdir(), "docx-import-integration-"));
  });

  afterAll(async () => {
    await connection?.close();
    await postgres?.stop();
    if (temporary) await rm(temporary, { recursive: true, force: true });
  });

  async function pendingImport(sourceBytes: Uint8Array, label: string) {
    const resourceId = createUuidV7();
    const articleId = createUuidV7();
    const sourceDocumentId = createUuidV7();
    const jobId = createUuidV7();
    const storageKey = `source/${resourceId}.docx`;
    storage.objects.set(storageKey, { bytes: sourceBytes, contentType: DOCX_MIME, metadata: {} });
    await connection.db.insert(resources).values({
      id: resourceId,
      ownerUserId,
      resourceType: "document",
      sourceType: "upload",
      originalFilename: `${label}.docx`,
      storageProvider: "memory",
      storageBucket: storage.bucket,
      storageKey,
      mimeType: DOCX_MIME,
      fileExtension: "docx",
      fileSize: sourceBytes.byteLength,
      sha256: digest(sourceBytes),
      status: "active",
      isPrivate: true,
    });
    await connection.db.insert(articles).values({
      id: articleId,
      ownerUserId,
      title: label,
      sourceType: "docx",
      status: "pending_import",
      textLocked: true,
    });
    await connection.db.insert(sourceDocuments).values({
      id: sourceDocumentId,
      articleId,
      sourceType: "docx",
      originalResourceId: resourceId,
      sourceMetadata: { cleaningMode: "preserve_structure" },
      isPrimary: true,
    });
    await connection.db.insert(jobs).values({
      id: jobId,
      queueName: "import-docx",
      jobType: "import.docx.parse",
      ownerUserId,
      articleId,
      status: "running",
      attemptCount: 1,
      maxAttempts: 3,
      payloadSummary: { resourceId, sourceDocumentId },
      traceId: `trace-${label}`,
    });
    await connection.db
      .update(sourceDocuments)
      .set({ importJobId: jobId })
      .where(eq(sourceDocuments.id, sourceDocumentId));
    const job = await new JobStore(connection).find(jobId);
    if (job === null) throw new Error("job fixture missing");
    return { articleId, job, jobId, resourceId, sourceDocumentId, storageKey };
  }

  it("parses Word/WPS, keeps the original and commits blocks, images and Document V1", async () => {
    const repositoryRoot = resolve(import.meta.dirname, "../..");
    const sourcePath = join(temporary, "wps-source.docx");
    await execFileAsync(
      "python3",
      [
        "-c",
        "from pathlib import Path; from docx_fixture import write_docx; write_docx(Path(__import__('sys').argv[1]), application='WPS Office')",
        sourcePath,
      ],
      {
        env: {
          ...process.env,
          PYTHONPATH: join(repositoryRoot, "services/docx-worker-python/tests"),
        },
      },
    );
    const sourceBytes = await readFile(sourcePath);
    const fixture = await pendingImport(sourceBytes, "wps-source");
    const progress: number[] = [];
    const handler = createDocxImportHandler({
      database: connection,
      storage,
      maximumDocxBytes: 50 * 1024 * 1024,
      pythonExecutable: "python3",
      pythonPath: join(repositoryRoot, "services/docx-worker-python/src"),
    });
    const result = await handler({
      attempt: 1,
      job: fixture.job,
      signal: undefined,
      assertNotCancelled: () => Promise.resolve(),
      progress: (value) => {
        progress.push(value);
        return Promise.resolve();
      },
    });

    expect(result).toMatchObject({
      articleId: fixture.articleId,
      detectedSource: "wps",
      blockCount: 8,
      imageCount: 2,
      tableCount: 1,
    });
    expect(progress).toEqual([5, 20, 60, 85, 95]);
    const [article] = await connection.db
      .select({ status: articles.status, imageCount: articles.imageCount })
      .from(articles)
      .where(eq(articles.id, fixture.articleId));
    expect(article).toEqual({ status: "pending_recognition", imageCount: 2 });
    const [document] = await connection.db
      .select({ value: articleDocuments.documentJson })
      .from(articleDocuments)
      .where(eq(articleDocuments.articleId, fixture.articleId));
    expect(validateDocument(document?.value).success).toBe(true);
    const blocks = await connection.db
      .select({ role: sourceBlocks.blockType, order: sourceBlocks.orderIndex })
      .from(sourceBlocks)
      .innerJoin(sourceDocuments, eq(sourceDocuments.id, sourceBlocks.sourceDocumentId))
      .where(eq(sourceDocuments.articleId, fixture.articleId))
      .orderBy(asc(sourceBlocks.orderIndex));
    expect(blocks.map(({ role }) => role)).toEqual([
      "title",
      "heading_1",
      "ordered_item",
      "ordered_item",
      "paragraph",
      "image_reference",
      "paragraph",
      "image_reference",
    ]);
    const bindings = await connection.db
      .select({ resourceId: articleResources.resourceId })
      .from(articleResources)
      .where(
        and(
          eq(articleResources.articleId, fixture.articleId),
          eq(articleResources.usageType, "image"),
        ),
      );
    expect(bindings).toHaveLength(2);
    expect(storage.objects.has(fixture.storageKey)).toBe(true);
    expect(
      [...storage.objects.keys()].some((key) => key.endsWith("/docx-intermediate-v1.json")),
    ).toBe(true);
  });

  it("rejects an invalid package permanently and marks the article failed", async () => {
    const fixture = await pendingImport(new TextEncoder().encode("not a zip"), "broken-source");
    const handler = createDocxImportHandler({
      database: connection,
      storage,
      maximumDocxBytes: 50 * 1024 * 1024,
      pythonExecutable: "python3",
      pythonPath: resolve(import.meta.dirname, "../../services/docx-worker-python/src"),
    });
    const error = await handler({
      attempt: 1,
      job: fixture.job,
      signal: undefined,
      assertNotCancelled: () => Promise.resolve(),
      progress: () => Promise.resolve(),
    }).catch((reason) => reason);
    expect(error).toMatchObject({ retryable: false });
    expect(error.code).toBe("DOCX_INVALID_PACKAGE");
    const [article] = await connection.db
      .select({ status: articles.status })
      .from(articles)
      .where(eq(articles.id, fixture.articleId));
    expect(article?.status).toBe("import_failed");
    const [document] = await connection.db
      .select({ id: articleDocuments.id })
      .from(articleDocuments)
      .where(eq(articleDocuments.articleId, fixture.articleId));
    const blocks = await connection.db
      .select({ id: sourceBlocks.id })
      .from(sourceBlocks)
      .innerJoin(sourceDocuments, eq(sourceDocuments.id, sourceBlocks.sourceDocumentId))
      .where(eq(sourceDocuments.articleId, fixture.articleId));
    const derivedResources = await connection.db
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.parentResourceId, fixture.resourceId));
    expect(document).toBeUndefined();
    expect(blocks).toEqual([]);
    expect(derivedResources).toEqual([]);
    expect(storage.objects.has(fixture.storageKey)).toBe(true);
  });
});
