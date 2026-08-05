import process from "node:process";

import {
  decryptBackupArchive,
  encryptBackupArchive,
  verifyBackupArchive,
} from "./backup-archive.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function required(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`必须提供 ${name}`);
  return value;
}

function encryptionKey(): string {
  const value = process.env.BACKUP_ENCRYPTION_KEY;
  if (!value) throw new Error("必须提供 BACKUP_ENCRYPTION_KEY");
  return value;
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (action === "encrypt") {
    const backupId = option("--backup-id");
    const result = await encryptBackupArchive({
      applicationRelease: required("--release"),
      ...(backupId === undefined ? {} : { backupId }),
      database: {
        databaseName: required("--database-name"),
        dumpFormat: "postgresql-custom",
        migrationVersion: required("--migration-version"),
        serverVersion: required("--server-version"),
        tables: required("--tables").split(","),
      },
      directory: required("--directory"),
      documentSchemaVersion: required("--document-schema-version"),
      encryptionKey: encryptionKey(),
      keyVersion: required("--key-version"),
      source: process.stdin,
    });
    process.stdout.write(
      `${JSON.stringify({ archivePath: result.archivePath, manifestPath: result.manifestPath })}\n`,
    );
  } else if (action === "verify") {
    const manifest = await verifyBackupArchive({
      archivePath: required("--archive"),
      encryptionKey: encryptionKey(),
      expectedKeyVersion: required("--key-version"),
      manifestPath: required("--manifest"),
    });
    process.stdout.write(`${manifest.payload.backupId}\n`);
  } else if (action === "decrypt") {
    await decryptBackupArchive({
      archivePath: required("--archive"),
      destination: process.stdout,
      encryptionKey: encryptionKey(),
      expectedKeyVersion: required("--key-version"),
      manifestPath: required("--manifest"),
    });
  } else {
    throw new Error("归档操作必须是 encrypt、verify 或 decrypt");
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "备份归档操作失败"}\n`);
  process.exitCode = 1;
});
