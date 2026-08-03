import { promises as fileSystem } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import {
  BackupArchiveError,
  decryptBackupArchive,
  encryptBackupArchive,
  verifyBackupArchive,
} from "./backup-archive.js";

const encryptionKey = "backup-encryption-key-000000000000000000000000005";
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await fileSystem.mkdtemp(join(tmpdir(), "wechat-layout-backup-archive-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function archive(plaintext = "postgresql custom dump fixture\n") {
  return encryptBackupArchive({
    applicationRelease: "v0.5.0-rc.1",
    backupId: "20260803T000000Z-abcdef123456",
    createdAt: new Date("2026-08-03T00:00:00.000Z"),
    database: {
      databaseName: "wechat_layout",
      dumpFormat: "postgresql-custom",
      migrationVersion: "0005",
      serverVersion: "180004",
      tables: ["content.articles", "content.article_snapshots", "content.resources"],
    },
    directory: await temporaryDirectory(),
    documentSchemaVersion: "0005",
    encryptionKey,
    keyVersion: "backup-key-v1",
    source: Readable.from(plaintext),
  });
}

async function decryptedText(input: Awaited<ReturnType<typeof archive>>, key = encryptionKey) {
  const chunks: Buffer[] = [];
  await decryptBackupArchive({
    archivePath: input.archivePath,
    destination: new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    }),
    encryptionKey: key,
    expectedKeyVersion: "backup-key-v1",
    manifestPath: input.manifestPath,
  });
  return Buffer.concat(chunks).toString("utf8");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fileSystem.rm(directory, { force: true, recursive: true })),
  );
});

describe("backup archive", () => {
  it("encrypts, authenticates and decrypts a streaming PostgreSQL dump", async () => {
    const created = await archive();
    const manifest = await verifyBackupArchive({
      archivePath: created.archivePath,
      encryptionKey,
      expectedKeyVersion: "backup-key-v1",
      manifestPath: created.manifestPath,
    });

    expect(manifest.payload.artifact.plaintextSizeBytes).toBeGreaterThan(0);
    expect(manifest.payload.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.payload.database.tables).toEqual([
      "content.article_snapshots",
      "content.articles",
      "content.resources",
    ]);
    expect(JSON.stringify(manifest)).not.toContain(encryptionKey);
    await expect(decryptedText(created)).resolves.toBe("postgresql custom dump fixture\n");
  });

  it("rejects encrypted bytes changed after the manifest was written", async () => {
    const created = await archive();
    const bytes = await fileSystem.readFile(created.archivePath);
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    await fileSystem.writeFile(created.archivePath, bytes);

    await expect(
      verifyBackupArchive({
        archivePath: created.archivePath,
        encryptionKey,
        manifestPath: created.manifestPath,
      }),
    ).rejects.toMatchObject({
      code: "ARCHIVE_HASH_MISMATCH",
    } satisfies Partial<BackupArchiveError>);
  });

  it("rejects manifest changes and the wrong encryption key", async () => {
    const changedManifestArchive = await archive("first fixture");
    const manifest = JSON.parse(
      await fileSystem.readFile(changedManifestArchive.manifestPath, "utf8"),
    ) as { payload: { applicationRelease: string } };
    manifest.payload.applicationRelease = "attacker-modified";
    await fileSystem.writeFile(
      changedManifestArchive.manifestPath,
      `${JSON.stringify(manifest)}\n`,
    );
    await expect(
      verifyBackupArchive({
        archivePath: changedManifestArchive.archivePath,
        encryptionKey,
        manifestPath: changedManifestArchive.manifestPath,
      }),
    ).rejects.toMatchObject({
      code: "MANIFEST_AUTHENTICATION_FAILED",
    } satisfies Partial<BackupArchiveError>);

    const wrongKeyArchive = await archive("second fixture");
    await expect(
      decryptedText(wrongKeyArchive, "wrong-backup-key-000000000000000000000000000000"),
    ).rejects.toMatchObject({
      code: "MANIFEST_AUTHENTICATION_FAILED",
    } satisfies Partial<BackupArchiveError>);
  });

  it("removes partial files when the input stream fails", async () => {
    const directory = await temporaryDirectory();
    const source = new Readable({
      read() {
        this.push("partial dump");
        this.destroy(new Error("pg_dump failed"));
      },
    });

    await expect(
      encryptBackupArchive({
        applicationRelease: "v0.5.0",
        backupId: "20260803T000001Z-fedcba654321",
        createdAt: new Date("2026-08-03T00:00:01.000Z"),
        database: {
          databaseName: "wechat_layout",
          dumpFormat: "postgresql-custom",
          migrationVersion: "0005",
          serverVersion: "180004",
          tables: ["content.articles"],
        },
        directory,
        documentSchemaVersion: "0005",
        encryptionKey,
        keyVersion: "backup-key-v1",
        source,
      }),
    ).rejects.toThrow("pg_dump failed");
    await expect(fileSystem.readdir(directory)).resolves.toEqual([]);
  });
});
