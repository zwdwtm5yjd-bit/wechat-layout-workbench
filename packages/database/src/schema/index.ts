import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

type JsonObject = Record<string, unknown>;
type JsonValue = JsonObject | readonly unknown[];

const emptyJsonObject = sql`'{}'::jsonb`;
const emptyJsonArray = sql`'[]'::jsonb`;

export const authSchema = pgSchema("auth");
export const contentSchema = pgSchema("content");
export const designSchema = pgSchema("design");
export const brandSchema = pgSchema("brand");
export const integrationSchema = pgSchema("integration");
export const operationsSchema = pgSchema("operations");
export const auditSchema = pgSchema("audit");

export const users = authSchema.table(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    username: varchar("username", { length: 100 }),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    avatarResourceId: uuid("avatar_resource_id").references((): AnyPgColumn => resources.id, {
      onDelete: "restrict",
    }),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 32 }).notNull().default("owner"),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Singapore"),
    locale: varchar("locale", { length: 20 }).notNull().default("zh-CN"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    twoFactorSecretEncrypted: text("two_factor_secret_encrypted"),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true, mode: "date" }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("uq_users_email_active")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("uq_users_username_active")
      .on(sql`lower(${table.username})`)
      .where(sql`${table.username} is not null and ${table.deletedAt} is null`),
    index("idx_users_status")
      .on(table.status)
      .where(sql`${table.deletedAt} is null`),
    index("idx_users_last_login_at").on(table.lastLoginAt.desc()),
    check("ck_users_email_not_blank", sql`char_length(trim(${table.email})) > 0`),
    check("ck_users_display_name_not_blank", sql`char_length(trim(${table.displayName})) > 0`),
    check("ck_users_role", sql`${table.role} in ('owner', 'editor', 'publisher', 'viewer')`),
    check("ck_users_status", sql`${table.status} in ('active', 'disabled', 'locked')`),
    check("ck_users_failed_login_count", sql`${table.failedLoginCount} >= 0`),
  ],
);

export const userSessions = authSchema.table(
  "user_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: varchar("session_token_hash", { length: 64 }).notNull(),
    deviceId: uuid("device_id"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokeReason: varchar("revoke_reason", { length: 100 }),
  },
  (table) => [
    uniqueIndex("uq_user_sessions_token_hash").on(table.sessionTokenHash),
    index("idx_user_sessions_user_id").on(table.userId),
    index("idx_user_sessions_expires_at").on(table.expiresAt),
    index("idx_user_sessions_active")
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
    check("ck_user_sessions_token_hash", sql`char_length(${table.sessionTokenHash}) = 64`),
    check("ck_user_sessions_expiry", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const resources = contentSchema.table(
  "resources",
  {
    id: uuid("id").primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    accountId: uuid("account_id"),
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    sourceType: varchar("source_type", { length: 32 }).notNull(),
    originalFilename: text("original_filename"),
    storageProvider: varchar("storage_provider", { length: 32 }).notNull(),
    storageBucket: varchar("storage_bucket", { length: 100 }).notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileExtension: varchar("file_extension", { length: 20 }),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    isPrivate: boolean("is_private").notNull().default(true),
    metadataJson: jsonb("metadata_json").$type<JsonObject>().notNull().default(emptyJsonObject),
    parentResourceId: uuid("parent_resource_id").references((): AnyPgColumn => resources.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    purgeAfter: timestamp("purge_after", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("uq_resources_owner_content")
      .on(table.ownerUserId, table.sha256, table.storageProvider, table.storageBucket)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("uq_resources_storage_object").on(
      table.storageProvider,
      table.storageBucket,
      table.storageKey,
    ),
    index("idx_resources_owner_type")
      .on(table.ownerUserId, table.resourceType, table.createdAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("idx_resources_sha256").on(table.sha256),
    index("idx_resources_parent").on(table.parentResourceId),
    index("idx_resources_status_purge").on(table.status, table.purgeAfter),
    check(
      "ck_resources_source_type",
      sql`${table.sourceType} in ('upload', 'import', 'generated', 'system')`,
    ),
    check(
      "ck_resources_status",
      sql`${table.status} in ('active', 'processing', 'failed', 'trash')`,
    ),
    check("ck_resources_file_size", sql`${table.fileSize} >= 0`),
    check("ck_resources_width", sql`${table.width} is null or ${table.width} > 0`),
    check("ck_resources_height", sql`${table.height} is null or ${table.height} > 0`),
    check("ck_resources_duration_ms", sql`${table.durationMs} is null or ${table.durationMs} >= 0`),
    check("ck_resources_sha256", sql`char_length(${table.sha256}) = 64`),
  ],
);

export const articles = contentSchema.table(
  "articles",
  {
    id: uuid("id").primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    accountId: uuid("account_id"),
    contentGroupId: uuid("content_group_id"),
    title: varchar("title", { length: 500 }).notNull(),
    subtitle: varchar("subtitle", { length: 500 }),
    slug: varchar("slug", { length: 160 }),
    contentType: varchar("content_type", { length: 50 }).notNull().default("general"),
    sourceType: varchar("source_type", { length: 32 }).notNull().default("blank"),
    status: varchar("status", { length: 32 }).notNull().default("pending_import"),
    themeId: uuid("theme_id"),
    themeVersion: varchar("theme_version", { length: 32 }),
    paletteId: uuid("palette_id"),
    brandVersionId: uuid("brand_version_id"),
    layoutStrength: varchar("layout_strength", { length: 32 }).notNull().default("standard"),
    textLocked: boolean("text_locked").notNull().default(true),
    wordCount: integer("word_count").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    svgCount: integer("svg_count").notNull().default(0),
    compatibilityScore: smallint("compatibility_score"),
    compatibilityStatus: varchar("compatibility_status", { length: 32 }),
    currentSnapshotId: uuid("current_snapshot_id").references(
      (): AnyPgColumn => articleSnapshots.id,
      { onDelete: "restrict" },
    ),
    copiedAt: timestamp("copied_at", { withTimezone: true, mode: "date" }),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletePurgeAfter: timestamp("delete_purge_after", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("idx_articles_owner_updated")
      .on(table.ownerUserId, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("idx_articles_account_status")
      .on(table.accountId, table.status, table.updatedAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("idx_articles_content_group").on(table.contentGroupId),
    index("idx_articles_theme").on(table.themeId, table.themeVersion),
    index("idx_articles_deleted_at").on(table.deletedAt),
    index("idx_articles_published_at").on(table.publishedAt.desc()),
    check("ck_articles_title_not_blank", sql`char_length(trim(${table.title})) > 0`),
    check(
      "ck_articles_source_type",
      sql`${table.sourceType} in ('docx', 'paste', 'web', 'blank', 'copy')`,
    ),
    check(
      "ck_articles_status",
      sql`${table.status} in (
        'pending_import',
        'pending_recognition',
        'pending_layout',
        'layout_editing',
        'pending_check',
        'copied',
        'synced',
        'published',
        'archived',
        'import_failed',
        'recognition_failed',
        'save_failed',
        'compatibility_failed',
        'copy_failed',
        'sync_failed'
      )`,
    ),
    check(
      "ck_articles_layout_strength",
      sql`${table.layoutStrength} in ('light', 'standard', 'strong')`,
    ),
    check("ck_articles_word_count", sql`${table.wordCount} >= 0`),
    check("ck_articles_image_count", sql`${table.imageCount} >= 0`),
    check("ck_articles_svg_count", sql`${table.svgCount} >= 0`),
    check(
      "ck_articles_compatibility_score",
      sql`${table.compatibilityScore} is null or ${table.compatibilityScore} between 0 and 100`,
    ),
    check(
      "ck_articles_compatibility_status",
      sql`${table.compatibilityStatus} is null or ${table.compatibilityStatus} in ('excellent', 'usable', 'risk')`,
    ),
  ],
);

export const articleDocuments = contentSchema.table(
  "article_documents",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    schemaVersion: varchar("schema_version", { length: 32 }).notNull(),
    documentJson: jsonb("document_json").$type<JsonObject>().notNull(),
    documentVersion: bigint("document_version", { mode: "number" }).notNull().default(1),
    originalTextHash: varchar("original_text_hash", { length: 64 }),
    currentTextHash: varchar("current_text_hash", { length: 64 }),
    textChangeSummary: jsonb("text_change_summary")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    lastTransactionId: uuid("last_transaction_id"),
    lastSavedBy: uuid("last_saved_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_article_documents_article").on(table.articleId),
    index("idx_article_documents_document_json").using(
      "gin",
      table.documentJson.op("jsonb_path_ops"),
    ),
    check("ck_article_documents_version", sql`${table.documentVersion} > 0`),
    check(
      "ck_article_documents_original_hash",
      sql`${table.originalTextHash} is null or char_length(${table.originalTextHash}) = 64`,
    ),
    check(
      "ck_article_documents_current_hash",
      sql`${table.currentTextHash} is null or char_length(${table.currentTextHash}) = 64`,
    ),
  ],
);

export const articleStatusHistory = contentSchema.table(
  "article_status_history",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }).notNull(),
    reason: varchar("reason", { length: 200 }).notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_article_status_history_article_created").on(table.articleId, table.createdAt.desc()),
    index("idx_article_status_history_actor_created").on(table.createdBy, table.createdAt.desc()),
    check(
      "ck_article_status_history_source",
      sql`${table.source} in ('user', 'system', 'import', 'copy', 'restore')`,
    ),
  ],
);

export const articleSnapshots = contentSchema.table(
  "article_snapshots",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    snapshotNumber: bigint("snapshot_number", { mode: "number" }).notNull(),
    reason: varchar("reason", { length: 50 }).notNull(),
    documentSchemaVersion: varchar("document_schema_version", { length: 32 }).notNull(),
    documentJson: jsonb("document_json").$type<JsonObject>().notNull(),
    themeId: uuid("theme_id"),
    themeVersion: varchar("theme_version", { length: 32 }),
    brandVersionId: uuid("brand_version_id"),
    compatibilityRuleVersion: varchar("compatibility_rule_version", { length: 32 }),
    rendererVersion: varchar("renderer_version", { length: 32 }),
    resourceManifest: jsonb("resource_manifest")
      .$type<JsonValue>()
      .notNull()
      .default(emptyJsonArray),
    packageManifest: jsonb("package_manifest").$type<JsonValue>().notNull().default(emptyJsonArray),
    textHash: varchar("text_hash", { length: 64 }),
    compatibilityScore: smallint("compatibility_score"),
    htmlHash: varchar("html_hash", { length: 64 }),
    note: text("note"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_article_snapshots_number").on(table.articleId, table.snapshotNumber),
    index("idx_snapshots_article_created").on(table.articleId, table.createdAt.desc()),
    index("idx_snapshots_article_number").on(table.articleId, table.snapshotNumber.desc()),
    index("idx_snapshots_reason").on(table.reason),
    check("ck_article_snapshots_number", sql`${table.snapshotNumber} > 0`),
    check(
      "ck_article_snapshots_text_hash",
      sql`${table.textHash} is null or char_length(${table.textHash}) = 64`,
    ),
    check(
      "ck_article_snapshots_html_hash",
      sql`${table.htmlHash} is null or char_length(${table.htmlHash}) = 64`,
    ),
    check(
      "ck_article_snapshots_compatibility_score",
      sql`${table.compatibilityScore} is null or ${table.compatibilityScore} between 0 and 100`,
    ),
  ],
);

export const renderOutputs = contentSchema.table(
  "render_outputs",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => articleSnapshots.id, { onDelete: "restrict" }),
    outputType: varchar("output_type", { length: 50 }).notNull().default("wechat_html"),
    outputMode: varchar("output_mode", { length: 32 }).notNull(),
    rendererVersion: varchar("renderer_version", { length: 32 }).notNull(),
    compatibilityRuleVersion: varchar("compatibility_rule_version", { length: 32 }).notNull(),
    themeVersion: varchar("theme_version", { length: 32 }),
    brandVersionId: uuid("brand_version_id"),
    htmlContent: text("html_content"),
    plainText: text("plain_text"),
    outputSha256: varchar("output_sha256", { length: 64 }),
    sizeBytes: integer("size_bytes").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull(),
    compatibilityReport: jsonb("compatibility_report")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    generatedAt: timestamp("generated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    errorJson: jsonb("error_json").$type<JsonObject>(),
  },
  (table) => [
    index("idx_render_outputs_article_generated").on(table.articleId, table.generatedAt.desc()),
    index("idx_render_outputs_snapshot").on(table.snapshotId),
    index("idx_render_outputs_expiry").on(table.status, table.expiresAt),
    check("ck_render_outputs_type", sql`${table.outputType} in ('wechat_html')`),
    check(
      "ck_render_outputs_mode",
      sql`${table.outputMode} in ('standard', 'wechat_safe', 'static')`,
    ),
    check("ck_render_outputs_status", sql`${table.status} in ('ready', 'blocked', 'failed')`),
    check("ck_render_outputs_size", sql`${table.sizeBytes} >= 0`),
    check(
      "ck_render_outputs_sha256",
      sql`${table.outputSha256} is null or char_length(${table.outputSha256}) = 64`,
    ),
    check("ck_render_outputs_expiry", sql`${table.expiresAt} > ${table.generatedAt}`),
  ],
);

export const copyRecords = contentSchema.table(
  "copy_records",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => articleSnapshots.id, { onDelete: "restrict" }),
    renderOutputId: uuid("render_output_id")
      .notNull()
      .references(() => renderOutputs.id, { onDelete: "restrict" }),
    accountId: uuid("account_id"),
    status: varchar("status", { length: 32 }).notNull(),
    copiedBy: uuid("copied_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    copiedAt: timestamp("copied_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    browserInfo: jsonb("browser_info").$type<JsonObject>().notNull().default(emptyJsonObject),
    failureReason: varchar("failure_reason", { length: 500 }),
  },
  (table) => [
    index("idx_copy_records_article_copied").on(table.articleId, table.copiedAt.desc()),
    index("idx_copy_records_output").on(table.renderOutputId),
    index("idx_copy_records_actor_copied").on(table.copiedBy, table.copiedAt.desc()),
    check("ck_copy_records_status", sql`${table.status} in ('success', 'failed')`),
    check(
      "ck_copy_records_failure_reason",
      sql`(${table.status} = 'success' and ${table.failureReason} is null) or (${table.status} = 'failed' and ${table.failureReason} is not null)`,
    ),
  ],
);

export const sourceDocuments = contentSchema.table(
  "source_documents",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    sourceType: varchar("source_type", { length: 32 }).notNull(),
    originalResourceId: uuid("original_resource_id").references(() => resources.id, {
      onDelete: "restrict",
    }),
    originalUrl: text("original_url"),
    originalText: text("original_text"),
    originalTextHash: varchar("original_text_hash", { length: 64 }),
    sourceMetadata: jsonb("source_metadata").$type<JsonObject>().notNull().default(emptyJsonObject),
    importJobId: uuid("import_job_id").references((): AnyPgColumn => jobs.id, {
      onDelete: "restrict",
    }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_source_documents_primary")
      .on(table.articleId)
      .where(sql`${table.isPrimary} = true`),
    index("idx_source_documents_article").on(table.articleId, table.createdAt.desc()),
    index("idx_source_documents_resource").on(table.originalResourceId),
    index("idx_source_documents_import_job").on(table.importJobId),
    check("ck_source_documents_source_type", sql`${table.sourceType} in ('docx', 'paste', 'web')`),
    check(
      "ck_source_documents_original_hash",
      sql`${table.originalTextHash} is null or char_length(${table.originalTextHash}) = 64`,
    ),
  ],
);

export const sourceBlocks = contentSchema.table(
  "source_blocks",
  {
    id: uuid("id").primaryKey(),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    sourceBlockId: varchar("source_block_id", { length: 100 }).notNull(),
    blockType: varchar("block_type", { length: 50 }).notNull(),
    textContent: text("text_content"),
    textHash: varchar("text_hash", { length: 64 }),
    orderIndex: integer("order_index").notNull(),
    styleMetadata: jsonb("style_metadata").$type<JsonObject>().notNull().default(emptyJsonObject),
    relationMetadata: jsonb("relation_metadata")
      .$type<JsonObject>()
      .notNull()
      .default(emptyJsonObject),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_source_blocks_source_id").on(table.sourceDocumentId, table.sourceBlockId),
    index("idx_source_blocks_document_order").on(table.sourceDocumentId, table.orderIndex),
    index("idx_source_blocks_text_hash").on(table.textHash),
    check("ck_source_blocks_order_index", sql`${table.orderIndex} >= 0`),
    check(
      "ck_source_blocks_text_hash",
      sql`${table.textHash} is null or char_length(${table.textHash}) = 64`,
    ),
  ],
);

export const articleResources = contentSchema.table(
  "article_resources",
  {
    id: uuid("id").primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    blockId: varchar("block_id", { length: 128 }),
    usageType: varchar("usage_type", { length: 50 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    frozenBySnapshotId: uuid("frozen_by_snapshot_id").references(() => articleSnapshots.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("idx_article_resources_article")
      .on(table.articleId, table.sortOrder)
      .where(sql`${table.deletedAt} is null`),
    index("idx_article_resources_resource")
      .on(table.resourceId)
      .where(sql`${table.deletedAt} is null`),
    index("idx_article_resources_snapshot").on(table.frozenBySnapshotId),
    uniqueIndex("uq_article_resources_live_binding")
      .on(table.articleId, table.resourceId, sql`coalesce(${table.blockId}, '')`, table.usageType)
      .where(sql`${table.frozenBySnapshotId} is null and ${table.deletedAt} is null`),
    uniqueIndex("uq_article_resources_snapshot_binding")
      .on(
        table.frozenBySnapshotId,
        table.resourceId,
        sql`coalesce(${table.blockId}, '')`,
        table.usageType,
      )
      .where(sql`${table.frozenBySnapshotId} is not null and ${table.deletedAt} is null`),
    check("ck_article_resources_sort_order", sql`${table.sortOrder} >= 0`),
  ],
);

export const jobs = operationsSchema.table(
  "jobs",
  {
    id: uuid("id").primaryKey(),
    queueName: varchar("queue_name", { length: 100 }).notNull(),
    jobType: varchar("job_type", { length: 100 }).notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "restrict" }),
    accountId: uuid("account_id"),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    priority: smallint("priority").notNull().default(0),
    progress: smallint("progress").notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 200 }),
    payloadRef: text("payload_ref"),
    payloadSummary: jsonb("payload_summary").$type<JsonObject>().notNull().default(emptyJsonObject),
    resultRef: text("result_ref"),
    resultSummary: jsonb("result_summary").$type<JsonObject>().notNull().default(emptyJsonObject),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    traceId: varchar("trace_id", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_jobs_idempotency_key")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("idx_jobs_status_queue").on(table.status, table.queueName, table.createdAt),
    index("idx_jobs_article").on(table.articleId),
    index("idx_jobs_scheduled").on(table.status, table.scheduledAt),
    index("idx_jobs_failed")
      .on(table.failedAt)
      .where(sql`${table.status} = 'failed'`),
    check(
      "ck_jobs_status",
      sql`${table.status} in ('queued', 'running', 'success', 'failed', 'cancelled', 'retry_pending')`,
    ),
    check("ck_jobs_priority", sql`${table.priority} >= 0`),
    check("ck_jobs_progress", sql`${table.progress} between 0 and 100`),
    check("ck_jobs_attempt_count", sql`${table.attemptCount} >= 0`),
    check("ck_jobs_max_attempts", sql`${table.maxAttempts} > 0`),
    check("ck_jobs_attempt_limit", sql`${table.attemptCount} <= ${table.maxAttempts}`),
  ],
);

export const jobEvents = operationsSchema.table(
  "job_events",
  {
    id: uuid("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    progress: smallint("progress"),
    message: text("message"),
    metadataJson: jsonb("metadata_json").$type<JsonObject>().notNull().default(emptyJsonObject),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_job_events_job_created").on(table.jobId, table.createdAt),
    check(
      "ck_job_events_type",
      sql`${table.eventType} in ('queued', 'started', 'progress', 'warning', 'completed', 'failed', 'cancelled')`,
    ),
    check(
      "ck_job_events_progress",
      sql`${table.progress} is null or ${table.progress} between 0 and 100`,
    ),
  ],
);

export const auditLogs = auditSchema.table(
  "audit_logs",
  {
    id: uuid("id").primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    actorType: varchar("actor_type", { length: 32 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: uuid("target_id"),
    accountId: uuid("account_id"),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "restrict" }),
    requestId: varchar("request_id", { length: 100 }),
    traceId: varchar("trace_id", { length: 100 }),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    beforeSummary: jsonb("before_summary").$type<JsonObject>(),
    afterSummary: jsonb("after_summary").$type<JsonObject>(),
    metadataJson: jsonb("metadata_json").$type<JsonObject>().notNull().default(emptyJsonObject),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_actor_created").on(table.actorUserId, table.createdAt.desc()),
    index("idx_audit_target").on(table.targetType, table.targetId, table.createdAt.desc()),
    index("idx_audit_article").on(table.articleId, table.createdAt.desc()),
    index("idx_audit_account").on(table.accountId, table.createdAt.desc()),
    index("idx_audit_action_created").on(table.action, table.createdAt.desc()),
    check("ck_audit_logs_actor_type", sql`${table.actorType} in ('user', 'system', 'worker')`),
  ],
);

export const databaseTables = {
  users,
  userSessions,
  articles,
  articleDocuments,
  articleStatusHistory,
  articleSnapshots,
  renderOutputs,
  copyRecords,
  sourceDocuments,
  sourceBlocks,
  resources,
  articleResources,
  jobs,
  jobEvents,
  auditLogs,
} as const;
