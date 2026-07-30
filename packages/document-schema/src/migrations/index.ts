import type { DocumentV1 } from "../document.js";
import { DOCUMENT_SCHEMA_VERSION } from "../version.js";
import { parseDocument } from "../validation.js";

export interface MigrationContext {
  fromVersion: string;
  toVersion: string;
  step: number;
}

export interface DocumentMigration<TFrom = unknown, TTo = unknown> {
  fromVersion: string;
  toVersion: string;
  migrate(input: TFrom, context: MigrationContext): TTo;
}

interface RegisteredMigration {
  fromVersion: string;
  toVersion: string;
  migrate(input: unknown, context: MigrationContext): unknown;
}

export interface AppliedDocumentMigration {
  fromVersion: string;
  toVersion: string;
}

export interface DocumentMigrationResult {
  document: DocumentV1;
  appliedMigrations: AppliedDocumentMigration[];
}

export class DocumentMigrationError extends Error {
  override readonly name = "DocumentMigrationError";
}

export class DocumentMigrationRegistry {
  readonly #migrations = new Map<string, RegisteredMigration>();

  register<TFrom, TTo>(migration: DocumentMigration<TFrom, TTo>): void {
    if (migration.fromVersion === migration.toVersion) {
      throw new DocumentMigrationError("迁移起止版本不能相同");
    }

    if (this.#migrations.has(migration.fromVersion)) {
      throw new DocumentMigrationError(`版本 ${migration.fromVersion} 已注册迁移`);
    }

    this.#migrations.set(migration.fromVersion, {
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      migrate(input, context) {
        return migration.migrate(input as TFrom, context);
      },
    });
  }

  get(fromVersion: string): RegisteredMigration | undefined {
    return this.#migrations.get(fromVersion);
  }
}

function readSchemaVersion(input: unknown): string {
  if (
    typeof input !== "object" ||
    input === null ||
    !("schemaVersion" in input) ||
    typeof input.schemaVersion !== "string"
  ) {
    throw new DocumentMigrationError("待迁移文档缺少 schemaVersion");
  }

  return input.schemaVersion;
}

export function migrateDocumentToCurrent(
  input: unknown,
  registry = new DocumentMigrationRegistry(),
): DocumentMigrationResult {
  let current: unknown = structuredClone(input);
  let currentVersion = readSchemaVersion(current);
  const appliedMigrations: AppliedDocumentMigration[] = [];
  const visitedVersions = new Set<string>();

  while (currentVersion !== DOCUMENT_SCHEMA_VERSION) {
    if (visitedVersions.has(currentVersion)) {
      throw new DocumentMigrationError(`检测到迁移循环：${currentVersion}`);
    }

    visitedVersions.add(currentVersion);
    const migration = registry.get(currentVersion);

    if (migration === undefined) {
      throw new DocumentMigrationError(
        `不存在从 ${currentVersion} 到 ${DOCUMENT_SCHEMA_VERSION} 的迁移路径`,
      );
    }

    const context: MigrationContext = {
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      step: appliedMigrations.length + 1,
    };

    current = migration.migrate(structuredClone(current), context);
    const migratedVersion = readSchemaVersion(current);

    if (migratedVersion !== migration.toVersion) {
      throw new DocumentMigrationError(
        `迁移 ${migration.fromVersion} → ${migration.toVersion} 返回了错误版本 ${migratedVersion}`,
      );
    }

    appliedMigrations.push({
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
    });
    currentVersion = migratedVersion;

    if (appliedMigrations.length > 100) {
      throw new DocumentMigrationError("迁移链超过 100 步，已中止");
    }
  }

  return {
    document: parseDocument(current),
    appliedMigrations,
  };
}
