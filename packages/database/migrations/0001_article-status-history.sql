CREATE TABLE "content"."article_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32) NOT NULL,
	"reason" varchar(200) NOT NULL,
	"source" varchar(32) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_article_status_history_source" CHECK ("content"."article_status_history"."source" in ('user', 'system', 'import', 'copy', 'restore'))
);
--> statement-breakpoint
ALTER TABLE "content"."article_status_history" ADD CONSTRAINT "article_status_history_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "content"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."article_status_history" ADD CONSTRAINT "article_status_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_article_status_history_article_created" ON "content"."article_status_history" USING btree ("article_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_article_status_history_actor_created" ON "content"."article_status_history" USING btree ("created_by","created_at" DESC NULLS LAST);