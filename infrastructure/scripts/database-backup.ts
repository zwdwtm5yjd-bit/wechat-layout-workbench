import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, promises as fileSystem } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { parseEnv } from "node:util";

import { DOCUMENT_SCHEMA_VERSION } from "../../packages/document-schema/src/version.js";
import {
  BackupArchiveError,
  decryptBackupArchive,
  encryptBackupArchive,
  verifyBackupArchive,
  type EncryptedBackupArchive,
} from "./backup-archive.js";
import {
  BackupConfigurationError,
  validateBackupConfiguration,
  type BackupConfiguration,
} from "./backup-config.js";
import { uploadBackupArchive, type UploadedBackupArchive } from "./backup-storage.js";
import { validateProductionConfiguration } from "./production-config.js";

type Environment = Readonly<Record<string, string | undefined>>;

interface ComposeContext {
  readonly command: string;
  readonly composeFile: string;
  readonly envFile: string;
  readonly prefix: readonly string[];
}

interface RuntimeContext {
  readonly backup: BackupConfiguration;
  readonly compose: ComposeContext;
  readonly environment: Environment;
  readonly projectRoot: string;
}

interface RestoreCounts {
  readonly articleCount: number;
  readonly documentCount: number;
  readonly imageResourceCount: number;
  readonly resourceCount: number;
  readonly snapshotCount: number;
  readonly tableCount: number;
  readonly themedArticleCount: number;
}

class BackupOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackupOperationError";
  }
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) {
    throw new BackupOperationError("MISSING_ARGUMENT", `必须提供 ${name}`);
  }
  return resolve(value);
}

function composeRuntime(envFile: string, composeFile: string): ComposeContext {
  if (spawnSync("docker", ["compose", "version"], { stdio: "ignore" }).status === 0) {
    return { command: "docker", composeFile, envFile, prefix: ["compose"] };
  }
  if (spawnSync("docker-compose", ["version"], { stdio: "ignore" }).status === 0) {
    return { command: "docker-compose", composeFile, envFile, prefix: [] };
  }
  throw new BackupOperationError("COMPOSE_UNAVAILABLE", "生产备份需要 Docker Compose v2");
}

function findProjectRoot(startDirectory: string): string {
  let directory = resolve(startDirectory);
  while (true) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new BackupOperationError("PROJECT_ROOT_MISSING", "无法定位项目根目录");
    }
    directory = parent;
  }
}

function environmentValue(environment: Environment, key: string): string {
  const value = environment[key];
  if (!value) {
    throw new BackupOperationError("ENV_VALUE_MISSING", `${key} 未配置`);
  }
  return value;
}

function composeArguments(context: ComposeContext, args: readonly string[]): string[] {
  return [...context.prefix, "--env-file", context.envFile, "--file", context.composeFile, ...args];
}

function spawnCompose(
  context: ComposeContext,
  args: readonly string[],
): ChildProcessWithoutNullStreams {
  return spawn(context.command, composeArguments(context, args), {
    env: process.env,
    stdio: "pipe",
  });
}

async function childResult(
  child: ChildProcessWithoutNullStreams,
  operation: string,
): Promise<{ readonly stderr: string; readonly stdout: string }> {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let outputBytes = 0;
  child.stdout.on("data", (chunk: Buffer) => {
    outputBytes += chunk.byteLength;
    if (outputBytes <= 2 * 1024 * 1024) stdout.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (stderr.reduce((total, entry) => total + entry.byteLength, 0) < 64 * 1024) {
      stderr.push(chunk);
    }
  });
  child.stdin.end();
  const code = await new Promise<number>((resolveCode, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode) => resolveCode(exitCode ?? 1));
  });
  const errorText = Buffer.concat(stderr).toString("utf8").trim();
  if (code !== 0) {
    throw new BackupOperationError(
      "DATABASE_COMMAND_FAILED",
      `${operation}失败${errorText ? `：${errorText.slice(0, 1_000)}` : ""}`,
    );
  }
  return {
    stderr: errorText,
    stdout: Buffer.concat(stdout).toString("utf8").trim(),
  };
}

async function captureCompose(
  context: ComposeContext,
  args: readonly string[],
  operation: string,
): Promise<string> {
  return (await childResult(spawnCompose(context, args), operation)).stdout;
}

function postgresCommand(
  context: RuntimeContext,
  args: readonly string[],
  operation: string,
): Promise<string> {
  return captureCompose(context.compose, ["exec", "-T", "postgres", ...args], operation);
}

async function runtimeContext(): Promise<RuntimeContext> {
  const projectRoot = findProjectRoot(process.cwd());
  const envFile = resolve(option("--env-file") ?? join(projectRoot, ".env.production"));
  if (!existsSync(envFile)) {
    throw new BackupOperationError("ENV_FILE_MISSING", "生产环境配置文件不存在");
  }
  const environment = parseEnv(await fileSystem.readFile(envFile, "utf8"));
  validateProductionConfiguration(environment, { fileExists: existsSync });
  const backup = validateBackupConfiguration(environment);
  const composeFile = resolve(
    process.env.PRODUCTION_COMPOSE_FILE ??
      join(projectRoot, "infrastructure/compose/docker-compose.prod.yml"),
  );
  if (!existsSync(composeFile)) {
    throw new BackupOperationError("COMPOSE_FILE_MISSING", "生产 Compose 文件不存在");
  }
  return {
    backup,
    compose: composeRuntime(envFile, composeFile),
    environment,
    projectRoot,
  };
}

async function databaseMigrationVersion(projectRoot: string): Promise<string> {
  const files = await fileSystem.readdir(join(projectRoot, "packages/database/migrations"));
  const migrations = files
    .map((file) => /^(\d{4})_.*\.sql$/.exec(file)?.[1])
    .filter((value): value is string => value !== undefined)
    .sort();
  const current = migrations.at(-1);
  if (!current) {
    throw new BackupOperationError("MIGRATION_VERSION_MISSING", "无法确定数据库迁移版本");
  }
  return current;
}

async function databaseMetadata(context: RuntimeContext) {
  const user = environmentValue(context.environment, "POSTGRES_USER");
  const database = environmentValue(context.environment, "POSTGRES_DB");
  const serverVersion = await postgresCommand(
    context,
    [
      "psql",
      "--username",
      user,
      "--dbname",
      database,
      "--tuples-only",
      "--no-align",
      "--command",
      "SHOW server_version_num",
    ],
    "读取 PostgreSQL 版本",
  );
  const tables = (
    await postgresCommand(
      context,
      [
        "psql",
        "--username",
        user,
        "--dbname",
        database,
        "--tuples-only",
        "--no-align",
        "--command",
        "SELECT schemaname || '.' || tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY 1",
      ],
      "读取数据库表清单",
    )
  )
    .split("\n")
    .map((table) => table.trim())
    .filter(Boolean);
  return {
    databaseName: database,
    dumpFormat: "postgresql-custom" as const,
    migrationVersion: await databaseMigrationVersion(context.projectRoot),
    serverVersion,
    tables,
  };
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.partial`;
  await fileSystem.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await fileSystem.rename(temporaryPath, path);
}

async function notifyFailure(
  configuration: BackupConfiguration,
  input: { readonly code: string; readonly releaseTag: string },
): Promise<void> {
  const response = await fetch(configuration.alertWebhookUrl, {
    body: JSON.stringify({
      code: input.code,
      event: "database_backup_failed",
      releaseTag: input.releaseTag,
      timestamp: new Date().toISOString(),
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`备份失败告警发送失败（HTTP ${String(response.status)}）`);
  }
}

async function cleanupLocalBackups(configuration: BackupConfiguration): Promise<void> {
  const entries = await fileSystem.readdir(configuration.directory);
  const identifiers = [
    ...new Set(
      entries
        .map(
          (entry) =>
            /^postgresql-(\d{8}T\d{6}Z-[0-9a-f]{12})\.(?:dump\.enc|manifest\.json)$/.exec(
              entry,
            )?.[1],
        )
        .filter((value): value is string => value !== undefined),
    ),
  ].sort();
  const expired = identifiers.slice(
    0,
    Math.max(0, identifiers.length - configuration.localRetentionCount),
  );
  await Promise.all(
    expired.flatMap((identifier) => [
      fileSystem
        .unlink(join(configuration.directory, `postgresql-${identifier}.dump.enc`))
        .catch(() => undefined),
      fileSystem
        .unlink(join(configuration.directory, `postgresql-${identifier}.manifest.json`))
        .catch(() => undefined),
    ]),
  );
}

async function createDatabaseBackup(context: RuntimeContext): Promise<void> {
  await fileSystem.mkdir(context.backup.directory, { mode: 0o700, recursive: true });
  const lockDirectory = join(context.backup.directory, ".database-backup.lock");
  try {
    await fileSystem.mkdir(lockDirectory, { mode: 0o700 });
  } catch {
    throw new BackupOperationError("BACKUP_ALREADY_RUNNING", "已有数据库备份正在运行或锁未清理");
  }
  const statusPath = join(context.backup.directory, "latest-status.json");
  const startedAt = new Date();
  let archive: EncryptedBackupArchive | undefined;
  try {
    await writeJsonAtomic(join(lockDirectory, "owner.json"), {
      pid: process.pid,
      startedAt: startedAt.toISOString(),
    });
    const metadata = await databaseMetadata(context);
    const dump = spawnCompose(context.compose, [
      "exec",
      "-T",
      "postgres",
      "pg_dump",
      "--username",
      environmentValue(context.environment, "POSTGRES_USER"),
      "--dbname",
      environmentValue(context.environment, "POSTGRES_DB"),
      "--format=custom",
      "--compress=6",
      "--no-owner",
      "--no-privileges",
    ]);
    dump.stdin.end();
    const dumpErrors: Buffer[] = [];
    dump.stderr.on("data", (chunk: Buffer) => dumpErrors.push(chunk));
    const archivePromise = encryptBackupArchive({
      applicationRelease: environmentValue(context.environment, "RELEASE_TAG"),
      database: metadata,
      directory: context.backup.directory,
      documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
      encryptionKey: environmentValue(context.environment, "BACKUP_ENCRYPTION_KEY"),
      keyVersion: context.backup.keyVersion,
      source: dump.stdout,
    });
    const exitPromise = new Promise<void>((resolveExit, reject) => {
      dump.once("error", reject);
      dump.once("close", (code) => {
        if (code === 0) resolveExit();
        else {
          const detail = Buffer.concat(dumpErrors).toString("utf8").trim().slice(0, 1_000);
          reject(
            new BackupOperationError(
              "PG_DUMP_FAILED",
              `pg_dump 失败${detail ? `：${detail}` : ""}`,
            ),
          );
        }
      });
    });
    const [archiveResult, exitResult] = await Promise.allSettled([archivePromise, exitPromise]);
    if (archiveResult.status === "rejected") {
      throw archiveResult.reason;
    }
    archive = archiveResult.value;
    if (exitResult.status === "rejected") {
      if (archive) {
        await Promise.allSettled([
          fileSystem.unlink(archive.archivePath),
          fileSystem.unlink(archive.manifestPath),
        ]);
      }
      throw exitResult.reason;
    }
    if (!archive) {
      throw new BackupOperationError("BACKUP_ARCHIVE_MISSING", "加密备份未生成");
    }
    const uploaded: UploadedBackupArchive = await uploadBackupArchive(archive, context.backup);
    await writeJsonAtomic(statusPath, {
      archive: {
        encryptedSizeBytes: archive.manifest.payload.artifact.encryptedSizeBytes,
        sha256: archive.manifest.payload.artifact.sha256,
      },
      backupId: archive.manifest.payload.backupId,
      completedAt: new Date().toISOString(),
      createdAt: archive.manifest.payload.createdAt,
      databaseMigrationVersion: archive.manifest.payload.database.migrationVersion,
      documentSchemaVersion: archive.manifest.payload.documentSchemaVersion,
      keyVersion: archive.manifest.payload.encryption.keyVersion,
      remote: uploaded,
      status: "success",
    });
    await cleanupLocalBackups(context.backup);
    process.stdout.write(
      `数据库加密备份完成：${archive.manifest.payload.backupId}，远端 ${uploaded.archiveKey}。\n`,
    );
  } catch (error) {
    const code =
      error instanceof BackupOperationError || error instanceof BackupArchiveError
        ? error.code
        : "BACKUP_FAILED";
    await writeJsonAtomic(statusPath, {
      code,
      failedAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      status: "failed",
    }).catch(() => undefined);
    await notifyFailure(context.backup, {
      code,
      releaseTag: environmentValue(context.environment, "RELEASE_TAG"),
    }).catch((alertError) => {
      process.stderr.write(
        `${alertError instanceof Error ? alertError.message : "备份失败告警发送失败"}\n`,
      );
    });
    throw error;
  } finally {
    await fileSystem.rm(lockDirectory, { force: true, recursive: true });
  }
}

function restoreTarget(): string {
  const value = option("--target-database") ?? "";
  if (!/^restore_[a-z0-9_]{8,54}$/.test(value)) {
    throw new BackupOperationError(
      "INVALID_RESTORE_TARGET",
      "恢复目标必须是 restore_ 开头的全新数据库名",
    );
  }
  return value;
}

async function restoreCounts(
  context: RuntimeContext,
  targetDatabase: string,
): Promise<RestoreCounts> {
  const sql = `SELECT json_build_object(
    'tableCount', (SELECT count(*)::int FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')),
    'articleCount', (SELECT count(*)::int FROM content.articles),
    'documentCount', (SELECT count(*)::int FROM content.article_documents),
    'snapshotCount', (SELECT count(*)::int FROM content.article_snapshots),
    'resourceCount', (SELECT count(*)::int FROM content.resources),
    'imageResourceCount', (SELECT count(*)::int FROM content.resources WHERE mime_type LIKE 'image/%'),
    'themedArticleCount', (SELECT count(*)::int FROM content.articles WHERE theme_id IS NOT NULL)
  )::text`;
  const output = await postgresCommand(
    context,
    [
      "psql",
      "--username",
      environmentValue(context.environment, "POSTGRES_USER"),
      "--dbname",
      targetDatabase,
      "--tuples-only",
      "--no-align",
      "--command",
      sql,
    ],
    "读取恢复数据库计数",
  );
  return JSON.parse(output) as RestoreCounts;
}

async function performRestoreDrill(
  context: RuntimeContext,
  targetDatabase: string,
  startedAt: Date,
): Promise<void> {
  const archivePath = requiredOption("--archive");
  const manifestPath = requiredOption("--manifest");
  if (targetDatabase === environmentValue(context.environment, "POSTGRES_DB")) {
    throw new BackupOperationError("PRODUCTION_OVERWRITE_REFUSED", "恢复入口拒绝覆盖生产数据库");
  }
  const manifest = await verifyBackupArchive({
    archivePath,
    encryptionKey: environmentValue(context.environment, "BACKUP_ENCRYPTION_KEY"),
    expectedKeyVersion: context.backup.keyVersion,
    manifestPath,
  });
  const existing = await postgresCommand(
    context,
    [
      "psql",
      "--username",
      environmentValue(context.environment, "POSTGRES_USER"),
      "--dbname",
      "postgres",
      "--tuples-only",
      "--no-align",
      "--command",
      `SELECT 1 FROM pg_database WHERE datname = '${targetDatabase}'`,
    ],
    "检查恢复目标",
  );
  if (existing === "1") {
    throw new BackupOperationError("RESTORE_TARGET_EXISTS", "恢复目标数据库已存在，拒绝覆盖");
  }
  await postgresCommand(
    context,
    [
      "createdb",
      "--username",
      environmentValue(context.environment, "POSTGRES_USER"),
      "--template=template0",
      "--encoding=UTF8",
      targetDatabase,
    ],
    "创建恢复目标数据库",
  );
  const restore = spawnCompose(context.compose, [
    "exec",
    "-T",
    "postgres",
    "pg_restore",
    "--username",
    environmentValue(context.environment, "POSTGRES_USER"),
    "--dbname",
    targetDatabase,
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
  ]);
  const restoreErrors: Buffer[] = [];
  restore.stderr.on("data", (chunk: Buffer) => restoreErrors.push(chunk));
  restore.stdout.resume();
  const decryptResult = decryptBackupArchive({
    archivePath,
    destination: restore.stdin,
    encryptionKey: environmentValue(context.environment, "BACKUP_ENCRYPTION_KEY"),
    expectedKeyVersion: context.backup.keyVersion,
    manifestPath,
  });
  const exitResult = new Promise<void>((resolveExit, reject) => {
    restore.once("error", reject);
    restore.once("close", (code) => {
      if (code === 0) resolveExit();
      else {
        const detail = Buffer.concat(restoreErrors).toString("utf8").trim().slice(0, 1_000);
        reject(
          new BackupOperationError(
            "PG_RESTORE_FAILED",
            `pg_restore 失败${detail ? `：${detail}` : ""}`,
          ),
        );
      }
    });
  });
  const results = await Promise.allSettled([decryptResult, exitResult]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;

  const counts = await restoreCounts(context, targetDatabase);
  const checks = {
    articles: counts.articleCount >= context.backup.minimumRestoreArticles,
    documents: counts.documentCount >= context.backup.minimumRestoreArticles,
    images: counts.imageResourceCount >= context.backup.minimumRestoreArticles,
    snapshots: counts.snapshotCount >= context.backup.minimumRestoreArticles,
    tables: counts.tableCount === manifest.payload.database.tables.length,
    themes: counts.themedArticleCount >= context.backup.minimumRestoreArticles,
  };
  const completedAt = new Date();
  const report = {
    backupId: manifest.payload.backupId,
    checks,
    completedAt: completedAt.toISOString(),
    counts,
    databaseMigrationVersion: manifest.payload.database.migrationVersion,
    documentSchemaVersion: manifest.payload.documentSchemaVersion,
    rpoHoursAtDrill: Number(
      ((startedAt.valueOf() - new Date(manifest.payload.createdAt).valueOf()) / 3_600_000).toFixed(
        3,
      ),
    ),
    rtoSeconds: Number(((completedAt.valueOf() - startedAt.valueOf()) / 1_000).toFixed(3)),
    startedAt: startedAt.toISOString(),
    status: Object.values(checks).every(Boolean) ? "success" : "failed",
    targetDatabase,
  };
  const reportPath = join(
    context.backup.directory,
    `restore-report-${targetDatabase}-${completedAt.toISOString().replaceAll(/[:.]/g, "-")}.json`,
  );
  await writeJsonAtomic(reportPath, report);
  if (report.status !== "success") {
    throw new BackupOperationError(
      "RESTORE_VALIDATION_FAILED",
      `恢复完成但业务完整性验收失败，报告：${basename(reportPath)}`,
    );
  }
  process.stdout.write(
    `恢复演练通过：${targetDatabase}，${String(counts.articleCount)} 篇文章，报告 ${reportPath}。\n`,
  );
}

async function restoreDrill(context: RuntimeContext): Promise<void> {
  const targetDatabase = restoreTarget();
  const startedAt = new Date();
  try {
    await performRestoreDrill(context, targetDatabase, startedAt);
  } catch (error) {
    const code =
      error instanceof BackupOperationError || error instanceof BackupArchiveError
        ? error.code
        : "RESTORE_FAILED";
    if (code !== "RESTORE_VALIDATION_FAILED") {
      const failedAt = new Date();
      const reportPath = join(
        context.backup.directory,
        `restore-report-${targetDatabase}-${failedAt.toISOString().replaceAll(/[:.]/g, "-")}.json`,
      );
      await fileSystem.mkdir(context.backup.directory, { mode: 0o700, recursive: true });
      await writeJsonAtomic(reportPath, {
        code,
        failedAt: failedAt.toISOString(),
        rtoSeconds: Number(((failedAt.valueOf() - startedAt.valueOf()) / 1_000).toFixed(3)),
        startedAt: startedAt.toISOString(),
        status: "failed",
        targetDatabase,
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function verifyArchive(context: RuntimeContext): Promise<void> {
  const manifest = await verifyBackupArchive({
    archivePath: requiredOption("--archive"),
    encryptionKey: environmentValue(context.environment, "BACKUP_ENCRYPTION_KEY"),
    expectedKeyVersion: context.backup.keyVersion,
    manifestPath: requiredOption("--manifest"),
  });
  process.stdout.write(
    `备份校验通过：${manifest.payload.backupId}，SHA-256 ${manifest.payload.artifact.sha256}。\n`,
  );
}

async function main(): Promise<void> {
  const action = process.argv[2];
  const context = await runtimeContext();
  if (action === "create") {
    await createDatabaseBackup(context);
  } else if (action === "verify") {
    await verifyArchive(context);
  } else if (action === "restore-drill") {
    await restoreDrill(context);
  } else {
    throw new BackupOperationError(
      "UNKNOWN_ACTION",
      "备份操作必须是 create、verify 或 restore-drill",
    );
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof BackupOperationError ||
    error instanceof BackupArchiveError ||
    error instanceof BackupConfigurationError
      ? error.message
      : "数据库备份操作失败";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
