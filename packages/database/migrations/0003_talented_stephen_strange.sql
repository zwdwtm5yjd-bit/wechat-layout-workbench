CREATE TABLE "content"."copy_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"render_output_id" uuid NOT NULL,
	"account_id" uuid,
	"status" varchar(32) NOT NULL,
	"copied_by" uuid NOT NULL,
	"copied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"browser_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_reason" varchar(500),
	CONSTRAINT "ck_copy_records_status" CHECK ("content"."copy_records"."status" in ('success', 'failed')),
	CONSTRAINT "ck_copy_records_failure_reason" CHECK (("content"."copy_records"."status" = 'success' and "content"."copy_records"."failure_reason" is null) or ("content"."copy_records"."status" = 'failed' and "content"."copy_records"."failure_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "content"."render_outputs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"output_type" varchar(50) DEFAULT 'wechat_html' NOT NULL,
	"output_mode" varchar(32) NOT NULL,
	"renderer_version" varchar(32) NOT NULL,
	"compatibility_rule_version" varchar(32) NOT NULL,
	"theme_version" varchar(32),
	"brand_version_id" uuid,
	"html_content" text,
	"plain_text" text,
	"output_sha256" varchar(64),
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) NOT NULL,
	"compatibility_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_by" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"error_json" jsonb,
	CONSTRAINT "ck_render_outputs_type" CHECK ("content"."render_outputs"."output_type" in ('wechat_html')),
	CONSTRAINT "ck_render_outputs_mode" CHECK ("content"."render_outputs"."output_mode" in ('standard', 'wechat_safe', 'static')),
	CONSTRAINT "ck_render_outputs_status" CHECK ("content"."render_outputs"."status" in ('ready', 'blocked', 'failed')),
	CONSTRAINT "ck_render_outputs_size" CHECK ("content"."render_outputs"."size_bytes" >= 0),
	CONSTRAINT "ck_render_outputs_sha256" CHECK ("content"."render_outputs"."output_sha256" is null or char_length("content"."render_outputs"."output_sha256") = 64),
	CONSTRAINT "ck_render_outputs_expiry" CHECK ("content"."render_outputs"."expires_at" > "content"."render_outputs"."generated_at")
);
--> statement-breakpoint
ALTER TABLE "content"."copy_records" ADD CONSTRAINT "copy_records_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."copy_records" ADD CONSTRAINT "copy_records_snapshot_id_article_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "content"."article_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."copy_records" ADD CONSTRAINT "copy_records_render_output_id_render_outputs_id_fk" FOREIGN KEY ("render_output_id") REFERENCES "content"."render_outputs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."copy_records" ADD CONSTRAINT "copy_records_copied_by_users_id_fk" FOREIGN KEY ("copied_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."render_outputs" ADD CONSTRAINT "render_outputs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."render_outputs" ADD CONSTRAINT "render_outputs_snapshot_id_article_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "content"."article_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."render_outputs" ADD CONSTRAINT "render_outputs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_copy_records_article_copied" ON "content"."copy_records" USING btree ("article_id","copied_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_copy_records_output" ON "content"."copy_records" USING btree ("render_output_id");--> statement-breakpoint
CREATE INDEX "idx_copy_records_actor_copied" ON "content"."copy_records" USING btree ("copied_by","copied_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_render_outputs_article_generated" ON "content"."render_outputs" USING btree ("article_id","generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_render_outputs_snapshot" ON "content"."render_outputs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_render_outputs_expiry" ON "content"."render_outputs" USING btree ("status","expires_at");