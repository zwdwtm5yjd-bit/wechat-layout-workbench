CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "brand";
--> statement-breakpoint
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "design";
--> statement-breakpoint
CREATE SCHEMA "integration";
--> statement-breakpoint
CREATE SCHEMA "operations";
--> statement-breakpoint
CREATE TABLE "content"."article_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"schema_version" varchar(32) NOT NULL,
	"document_json" jsonb NOT NULL,
	"document_version" bigint DEFAULT 1 NOT NULL,
	"original_text_hash" varchar(64),
	"current_text_hash" varchar(64),
	"text_change_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_transaction_id" uuid,
	"last_saved_by" uuid NOT NULL,
	"last_saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_article_documents_version" CHECK ("content"."article_documents"."document_version" > 0),
	CONSTRAINT "ck_article_documents_original_hash" CHECK ("content"."article_documents"."original_text_hash" is null or char_length("content"."article_documents"."original_text_hash") = 64),
	CONSTRAINT "ck_article_documents_current_hash" CHECK ("content"."article_documents"."current_text_hash" is null or char_length("content"."article_documents"."current_text_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "content"."article_resources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"block_id" varchar(100),
	"usage_type" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"frozen_by_snapshot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_article_resources_sort_order" CHECK ("content"."article_resources"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content"."article_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"snapshot_number" bigint NOT NULL,
	"reason" varchar(50) NOT NULL,
	"document_schema_version" varchar(32) NOT NULL,
	"document_json" jsonb NOT NULL,
	"theme_id" uuid,
	"theme_version" varchar(32),
	"brand_version_id" uuid,
	"compatibility_rule_version" varchar(32),
	"renderer_version" varchar(32),
	"resource_manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"package_manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"text_hash" varchar(64),
	"compatibility_score" smallint,
	"html_hash" varchar(64),
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_article_snapshots_number" CHECK ("content"."article_snapshots"."snapshot_number" > 0),
	CONSTRAINT "ck_article_snapshots_text_hash" CHECK ("content"."article_snapshots"."text_hash" is null or char_length("content"."article_snapshots"."text_hash") = 64),
	CONSTRAINT "ck_article_snapshots_html_hash" CHECK ("content"."article_snapshots"."html_hash" is null or char_length("content"."article_snapshots"."html_hash") = 64),
	CONSTRAINT "ck_article_snapshots_compatibility_score" CHECK ("content"."article_snapshots"."compatibility_score" is null or "content"."article_snapshots"."compatibility_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "content"."articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"account_id" uuid,
	"content_group_id" uuid,
	"title" varchar(500) NOT NULL,
	"subtitle" varchar(500),
	"slug" varchar(160),
	"content_type" varchar(50) DEFAULT 'general' NOT NULL,
	"source_type" varchar(32) DEFAULT 'blank' NOT NULL,
	"status" varchar(32) DEFAULT 'pending_import' NOT NULL,
	"theme_id" uuid,
	"theme_version" varchar(32),
	"palette_id" uuid,
	"brand_version_id" uuid,
	"layout_strength" varchar(32) DEFAULT 'standard' NOT NULL,
	"text_locked" boolean DEFAULT true NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"svg_count" integer DEFAULT 0 NOT NULL,
	"compatibility_score" smallint,
	"compatibility_status" varchar(32),
	"current_snapshot_id" uuid,
	"copied_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_purge_after" timestamp with time zone,
	CONSTRAINT "ck_articles_title_not_blank" CHECK (char_length(trim("content"."articles"."title")) > 0),
	CONSTRAINT "ck_articles_source_type" CHECK ("content"."articles"."source_type" in ('docx', 'paste', 'web', 'blank', 'copy')),
	CONSTRAINT "ck_articles_status" CHECK ("content"."articles"."status" in (
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
      )),
	CONSTRAINT "ck_articles_layout_strength" CHECK ("content"."articles"."layout_strength" in ('light', 'standard', 'strong')),
	CONSTRAINT "ck_articles_word_count" CHECK ("content"."articles"."word_count" >= 0),
	CONSTRAINT "ck_articles_image_count" CHECK ("content"."articles"."image_count" >= 0),
	CONSTRAINT "ck_articles_svg_count" CHECK ("content"."articles"."svg_count" >= 0),
	CONSTRAINT "ck_articles_compatibility_score" CHECK ("content"."articles"."compatibility_score" is null or "content"."articles"."compatibility_score" between 0 and 100),
	CONSTRAINT "ck_articles_compatibility_status" CHECK ("content"."articles"."compatibility_status" is null or "content"."articles"."compatibility_status" in ('excellent', 'usable', 'risk'))
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"actor_type" varchar(32) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid,
	"account_id" uuid,
	"article_id" uuid,
	"request_id" varchar(100),
	"trace_id" varchar(100),
	"ip_address" "inet",
	"user_agent" text,
	"before_summary" jsonb,
	"after_summary" jsonb,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_audit_logs_actor_type" CHECK ("audit"."audit_logs"."actor_type" in ('user', 'system', 'worker'))
);
--> statement-breakpoint
CREATE TABLE "operations"."job_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"progress" smallint,
	"message" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_job_events_type" CHECK ("operations"."job_events"."event_type" in ('queued', 'started', 'progress', 'warning', 'completed', 'failed', 'cancelled')),
	CONSTRAINT "ck_job_events_progress" CHECK ("operations"."job_events"."progress" is null or "operations"."job_events"."progress" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "operations"."jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue_name" varchar(100) NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"article_id" uuid,
	"account_id" uuid,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"idempotency_key" varchar(200),
	"payload_ref" text,
	"payload_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_ref" text,
	"result_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_code" varchar(100),
	"error_message" text,
	"trace_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_jobs_status" CHECK ("operations"."jobs"."status" in ('queued', 'running', 'success', 'failed', 'cancelled', 'retry_pending')),
	CONSTRAINT "ck_jobs_priority" CHECK ("operations"."jobs"."priority" >= 0),
	CONSTRAINT "ck_jobs_progress" CHECK ("operations"."jobs"."progress" between 0 and 100),
	CONSTRAINT "ck_jobs_attempt_count" CHECK ("operations"."jobs"."attempt_count" >= 0),
	CONSTRAINT "ck_jobs_max_attempts" CHECK ("operations"."jobs"."max_attempts" > 0),
	CONSTRAINT "ck_jobs_attempt_limit" CHECK ("operations"."jobs"."attempt_count" <= "operations"."jobs"."max_attempts")
);
--> statement-breakpoint
CREATE TABLE "content"."resources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"account_id" uuid,
	"resource_type" varchar(50) NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"original_filename" text,
	"storage_provider" varchar(32) NOT NULL,
	"storage_bucket" varchar(100) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_extension" varchar(20),
	"file_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"sha256" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parent_resource_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	CONSTRAINT "ck_resources_source_type" CHECK ("content"."resources"."source_type" in ('upload', 'import', 'generated', 'system')),
	CONSTRAINT "ck_resources_status" CHECK ("content"."resources"."status" in ('active', 'processing', 'failed', 'trash')),
	CONSTRAINT "ck_resources_file_size" CHECK ("content"."resources"."file_size" >= 0),
	CONSTRAINT "ck_resources_width" CHECK ("content"."resources"."width" is null or "content"."resources"."width" > 0),
	CONSTRAINT "ck_resources_height" CHECK ("content"."resources"."height" is null or "content"."resources"."height" > 0),
	CONSTRAINT "ck_resources_duration_ms" CHECK ("content"."resources"."duration_ms" is null or "content"."resources"."duration_ms" >= 0),
	CONSTRAINT "ck_resources_sha256" CHECK (char_length("content"."resources"."sha256") = 64)
);
--> statement-breakpoint
CREATE TABLE "content"."source_blocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_document_id" uuid NOT NULL,
	"source_block_id" varchar(100) NOT NULL,
	"block_type" varchar(50) NOT NULL,
	"text_content" text,
	"text_hash" varchar(64),
	"order_index" integer NOT NULL,
	"style_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relation_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_source_blocks_order_index" CHECK ("content"."source_blocks"."order_index" >= 0),
	CONSTRAINT "ck_source_blocks_text_hash" CHECK ("content"."source_blocks"."text_hash" is null or char_length("content"."source_blocks"."text_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "content"."source_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"original_resource_id" uuid,
	"original_url" text,
	"original_text" text,
	"original_text_hash" varchar(64),
	"source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"import_job_id" uuid,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_source_documents_source_type" CHECK ("content"."source_documents"."source_type" in ('docx', 'paste', 'web')),
	CONSTRAINT "ck_source_documents_original_hash" CHECK ("content"."source_documents"."original_text_hash" is null or char_length("content"."source_documents"."original_text_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "auth"."user_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token_hash" varchar(64) NOT NULL,
	"device_id" uuid,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" varchar(100),
	CONSTRAINT "ck_user_sessions_token_hash" CHECK (char_length("auth"."user_sessions"."session_token_hash") = 64),
	CONSTRAINT "ck_user_sessions_expiry" CHECK ("auth"."user_sessions"."expires_at" > "auth"."user_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"username" varchar(100),
	"display_name" varchar(100) NOT NULL,
	"avatar_resource_id" uuid,
	"password_hash" text NOT NULL,
	"role" varchar(32) DEFAULT 'owner' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Singapore' NOT NULL,
	"locale" varchar(20) DEFAULT 'zh-CN' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret_encrypted" text,
	"password_changed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_users_email_not_blank" CHECK (char_length(trim("auth"."users"."email")) > 0),
	CONSTRAINT "ck_users_display_name_not_blank" CHECK (char_length(trim("auth"."users"."display_name")) > 0),
	CONSTRAINT "ck_users_role" CHECK ("auth"."users"."role" in ('owner', 'editor', 'publisher', 'viewer')),
	CONSTRAINT "ck_users_status" CHECK ("auth"."users"."status" in ('active', 'disabled', 'locked')),
	CONSTRAINT "ck_users_failed_login_count" CHECK ("auth"."users"."failed_login_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "content"."article_documents" ADD CONSTRAINT "article_documents_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_documents" ADD CONSTRAINT "article_documents_last_saved_by_users_id_fk" FOREIGN KEY ("last_saved_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_resources" ADD CONSTRAINT "article_resources_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_resources" ADD CONSTRAINT "article_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "content"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_resources" ADD CONSTRAINT "article_resources_frozen_by_snapshot_id_article_snapshots_id_fk" FOREIGN KEY ("frozen_by_snapshot_id") REFERENCES "content"."article_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_snapshots" ADD CONSTRAINT "article_snapshots_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_snapshots" ADD CONSTRAINT "article_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."articles" ADD CONSTRAINT "articles_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."articles" ADD CONSTRAINT "articles_current_snapshot_id_article_snapshots_id_fk" FOREIGN KEY ("current_snapshot_id") REFERENCES "content"."article_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ADD CONSTRAINT "audit_logs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."job_events" ADD CONSTRAINT "job_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "operations"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."jobs" ADD CONSTRAINT "jobs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations"."jobs" ADD CONSTRAINT "jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."resources" ADD CONSTRAINT "resources_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."resources" ADD CONSTRAINT "resources_parent_resource_id_resources_id_fk" FOREIGN KEY ("parent_resource_id") REFERENCES "content"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."source_blocks" ADD CONSTRAINT "source_blocks_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "content"."source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."source_documents" ADD CONSTRAINT "source_documents_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."source_documents" ADD CONSTRAINT "source_documents_original_resource_id_resources_id_fk" FOREIGN KEY ("original_resource_id") REFERENCES "content"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."source_documents" ADD CONSTRAINT "source_documents_import_job_id_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "operations"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD CONSTRAINT "users_avatar_resource_id_resources_id_fk" FOREIGN KEY ("avatar_resource_id") REFERENCES "content"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_documents_article" ON "content"."article_documents" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_documents_document_json" ON "content"."article_documents" USING gin ("document_json" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "idx_article_resources_article" ON "content"."article_resources" USING btree ("article_id","sort_order") WHERE "content"."article_resources"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_article_resources_resource" ON "content"."article_resources" USING btree ("resource_id") WHERE "content"."article_resources"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_article_resources_snapshot" ON "content"."article_resources" USING btree ("frozen_by_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_snapshots_number" ON "content"."article_snapshots" USING btree ("article_id","snapshot_number");--> statement-breakpoint
CREATE INDEX "idx_snapshots_article_created" ON "content"."article_snapshots" USING btree ("article_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_snapshots_article_number" ON "content"."article_snapshots" USING btree ("article_id","snapshot_number" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_snapshots_reason" ON "content"."article_snapshots" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "idx_articles_owner_updated" ON "content"."articles" USING btree ("owner_user_id","updated_at" DESC NULLS LAST) WHERE "content"."articles"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_articles_account_status" ON "content"."articles" USING btree ("account_id","status","updated_at" DESC NULLS LAST) WHERE "content"."articles"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_articles_content_group" ON "content"."articles" USING btree ("content_group_id");--> statement-breakpoint
CREATE INDEX "idx_articles_theme" ON "content"."articles" USING btree ("theme_id","theme_version");--> statement-breakpoint
CREATE INDEX "idx_articles_deleted_at" ON "content"."articles" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_articles_published_at" ON "content"."articles" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_actor_created" ON "audit"."audit_logs" USING btree ("actor_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_target" ON "audit"."audit_logs" USING btree ("target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_article" ON "audit"."audit_logs" USING btree ("article_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_account" ON "audit"."audit_logs" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_action_created" ON "audit"."audit_logs" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_job_events_job_created" ON "operations"."job_events" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_idempotency_key" ON "operations"."jobs" USING btree ("idempotency_key") WHERE "operations"."jobs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "idx_jobs_status_queue" ON "operations"."jobs" USING btree ("status","queue_name","created_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_article" ON "operations"."jobs" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_scheduled" ON "operations"."jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_failed" ON "operations"."jobs" USING btree ("failed_at") WHERE "operations"."jobs"."status" = 'failed';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_resources_owner_content" ON "content"."resources" USING btree ("owner_user_id","sha256","storage_provider","storage_bucket") WHERE "content"."resources"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_resources_storage_object" ON "content"."resources" USING btree ("storage_provider","storage_bucket","storage_key");--> statement-breakpoint
CREATE INDEX "idx_resources_owner_type" ON "content"."resources" USING btree ("owner_user_id","resource_type","created_at" DESC NULLS LAST) WHERE "content"."resources"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_resources_sha256" ON "content"."resources" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "idx_resources_parent" ON "content"."resources" USING btree ("parent_resource_id");--> statement-breakpoint
CREATE INDEX "idx_resources_status_purge" ON "content"."resources" USING btree ("status","purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_source_blocks_source_id" ON "content"."source_blocks" USING btree ("source_document_id","source_block_id");--> statement-breakpoint
CREATE INDEX "idx_source_blocks_document_order" ON "content"."source_blocks" USING btree ("source_document_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_source_blocks_text_hash" ON "content"."source_blocks" USING btree ("text_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_source_documents_primary" ON "content"."source_documents" USING btree ("article_id") WHERE "content"."source_documents"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "idx_source_documents_article" ON "content"."source_documents" USING btree ("article_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_source_documents_resource" ON "content"."source_documents" USING btree ("original_resource_id");--> statement-breakpoint
CREATE INDEX "idx_source_documents_import_job" ON "content"."source_documents" USING btree ("import_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_sessions_token_hash" ON "auth"."user_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "auth"."user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires_at" ON "auth"."user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_active" ON "auth"."user_sessions" USING btree ("user_id","expires_at") WHERE "auth"."user_sessions"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_active" ON "auth"."users" USING btree (lower("email")) WHERE "auth"."users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_username_active" ON "auth"."users" USING btree (lower("username")) WHERE "auth"."users"."username" is not null and "auth"."users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "auth"."users" USING btree ("status") WHERE "auth"."users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_users_last_login_at" ON "auth"."users" USING btree ("last_login_at" DESC NULLS LAST);