import type { DatabaseConnection } from "./client.js";

const expectedTables = [
  "audit.audit_logs",
  "auth.user_sessions",
  "auth.users",
  "content.article_documents",
  "content.article_resources",
  "content.article_snapshots",
  "content.article_status_history",
  "content.articles",
  "content.resources",
  "content.source_blocks",
  "content.source_documents",
  "operations.job_events",
  "operations.jobs",
] as const;

const expectedIndexes = [
  "idx_article_documents_document_json",
  "idx_article_status_history_actor_created",
  "idx_article_status_history_article_created",
  "idx_article_resources_article",
  "idx_article_resources_resource",
  "idx_article_resources_snapshot",
  "idx_snapshots_article_created",
  "idx_snapshots_article_number",
  "idx_snapshots_reason",
  "idx_articles_owner_updated",
  "idx_articles_account_status",
  "idx_articles_content_group",
  "idx_articles_theme",
  "idx_articles_deleted_at",
  "idx_articles_published_at",
  "idx_audit_actor_created",
  "idx_audit_target",
  "idx_audit_article",
  "idx_audit_account",
  "idx_audit_action_created",
  "idx_job_events_job_created",
  "idx_jobs_status_queue",
  "idx_jobs_article",
  "idx_jobs_scheduled",
  "idx_jobs_failed",
  "idx_resources_owner_type",
  "idx_resources_sha256",
  "idx_resources_parent",
  "idx_resources_status_purge",
  "idx_source_blocks_document_order",
  "idx_source_blocks_text_hash",
  "idx_source_documents_article",
  "idx_source_documents_resource",
  "idx_source_documents_import_job",
  "idx_user_sessions_user_id",
  "idx_user_sessions_expires_at",
  "idx_user_sessions_active",
  "idx_users_status",
  "idx_users_last_login_at",
  "uq_article_documents_article",
  "uq_article_snapshots_number",
  "uq_jobs_idempotency_key",
  "uq_resources_owner_content",
  "uq_resources_storage_object",
  "uq_source_blocks_source_id",
  "uq_source_documents_primary",
  "uq_user_sessions_token_hash",
  "uq_users_email_active",
  "uq_users_username_active",
] as const;

const expectedForeignKeyDeleteActions = new Map<string, "CASCADE" | "RESTRICT">([
  ["article_documents_article_id_articles_id_fk", "RESTRICT"],
  ["article_documents_last_saved_by_users_id_fk", "RESTRICT"],
  ["article_resources_article_id_articles_id_fk", "RESTRICT"],
  ["article_resources_resource_id_resources_id_fk", "RESTRICT"],
  ["article_resources_frozen_by_snapshot_id_article_snapshots_id_fk", "RESTRICT"],
  ["article_snapshots_article_id_articles_id_fk", "RESTRICT"],
  ["article_snapshots_created_by_users_id_fk", "RESTRICT"],
  ["article_status_history_article_id_articles_id_fk", "RESTRICT"],
  ["article_status_history_created_by_users_id_fk", "RESTRICT"],
  ["articles_owner_user_id_users_id_fk", "RESTRICT"],
  ["articles_current_snapshot_id_article_snapshots_id_fk", "RESTRICT"],
  ["audit_logs_actor_user_id_users_id_fk", "RESTRICT"],
  ["audit_logs_article_id_articles_id_fk", "RESTRICT"],
  ["job_events_job_id_jobs_id_fk", "CASCADE"],
  ["jobs_owner_user_id_users_id_fk", "RESTRICT"],
  ["jobs_article_id_articles_id_fk", "RESTRICT"],
  ["resources_owner_user_id_users_id_fk", "RESTRICT"],
  ["resources_parent_resource_id_resources_id_fk", "RESTRICT"],
  ["source_blocks_source_document_id_source_documents_id_fk", "RESTRICT"],
  ["source_documents_article_id_articles_id_fk", "RESTRICT"],
  ["source_documents_original_resource_id_resources_id_fk", "RESTRICT"],
  ["source_documents_import_job_id_jobs_id_fk", "RESTRICT"],
  ["user_sessions_user_id_users_id_fk", "CASCADE"],
  ["users_avatar_resource_id_resources_id_fk", "RESTRICT"],
]);

interface NamedRow {
  readonly name: string;
}

interface ForeignKeyRow extends NamedRow {
  readonly deleteAction: "CASCADE" | "NO ACTION" | "RESTRICT" | "SET DEFAULT" | "SET NULL";
}

interface IdentifierColumnRow {
  readonly name: string;
  readonly dataType: string;
  readonly defaultValue: string | null;
}

export interface DatabaseVerification {
  readonly tableCount: number;
  readonly indexCount: number;
  readonly foreignKeyCount: number;
  readonly migrationCount: number;
}

function difference(expected: readonly string[], actual: ReadonlySet<string>): string[] {
  return expected.filter((name) => !actual.has(name));
}

export async function verifyDatabaseSchema(
  connection: DatabaseConnection,
): Promise<DatabaseVerification> {
  await connection.sql`select 1`;

  const tables = await connection.sql<NamedRow[]>`
    select table_schema || '.' || table_name as name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema in ('auth', 'content', 'operations', 'audit')
  `;
  const tableNames = new Set(tables.map((row) => row.name));
  const missingTables = difference(expectedTables, tableNames);

  const indexes = await connection.sql<NamedRow[]>`
    select indexname as name
    from pg_indexes
    where schemaname in ('auth', 'content', 'operations', 'audit')
  `;
  const indexNames = new Set(indexes.map((row) => row.name));
  const missingIndexes = difference(expectedIndexes, indexNames);

  const foreignKeys = await connection.sql<ForeignKeyRow[]>`
    select
      constraint_name as name,
      delete_rule as "deleteAction"
    from information_schema.referential_constraints
    where constraint_schema in ('auth', 'content', 'operations', 'audit')
  `;
  const actualForeignKeys = new Map(
    foreignKeys.map((row) => [row.name, row.deleteAction] as const),
  );
  const invalidForeignKeys = [...expectedForeignKeyDeleteActions].flatMap(
    ([name, expectedAction]) =>
      actualForeignKeys.get(name) === expectedAction
        ? []
        : [`${name}:${actualForeignKeys.get(name) ?? "MISSING"}!=${expectedAction}`],
  );

  const identifierColumns = await connection.sql<IdentifierColumnRow[]>`
    select
      table_schema || '.' || table_name as name,
      data_type as "dataType",
      column_default as "defaultValue"
    from information_schema.columns
    where column_name = 'id'
      and table_schema in ('auth', 'content', 'operations', 'audit')
  `;
  const invalidIdentifierColumns = identifierColumns
    .filter((column) => column.dataType !== "uuid" || column.defaultValue !== null)
    .map((column) => column.name);

  const migrationRows = await connection.sql<{ readonly count: number }[]>`
    select count(*)::integer as count
    from drizzle.__drizzle_migrations
  `;
  const migrationCount = migrationRows[0]?.count ?? 0;

  const problems = [
    missingTables.length > 0 ? `缺少表：${missingTables.join(", ")}` : undefined,
    missingIndexes.length > 0 ? `缺少索引：${missingIndexes.join(", ")}` : undefined,
    invalidForeignKeys.length > 0 ? `外键策略错误：${invalidForeignKeys.join(", ")}` : undefined,
    identifierColumns.length !== expectedTables.length
      ? `UUID 主键数量错误：${identifierColumns.length}/${expectedTables.length}`
      : undefined,
    invalidIdentifierColumns.length > 0
      ? `主键不是无默认值 UUID：${invalidIdentifierColumns.join(", ")}`
      : undefined,
    migrationCount < 1 ? "没有已应用的数据库迁移" : undefined,
  ].filter((problem): problem is string => problem !== undefined);

  if (problems.length > 0) {
    throw new Error(`数据库结构未就绪。${problems.join("；")}`);
  }

  return {
    tableCount: expectedTables.length,
    indexCount: expectedIndexes.length,
    foreignKeyCount: expectedForeignKeyDeleteActions.size,
    migrationCount,
  };
}
