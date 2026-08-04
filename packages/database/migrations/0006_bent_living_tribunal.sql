CREATE TABLE "brand"."official_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(100),
	"slug" varchar(120) NOT NULL,
	"description" text,
	"content_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"account_type" varchar(32) DEFAULT 'unknown' NOT NULL,
	"verification_status" varchar(32) DEFAULT 'unknown' NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"default_theme_id" uuid,
	"default_palette_id" uuid,
	"current_brand_version_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_official_accounts_name_not_blank" CHECK (char_length(trim("brand"."official_accounts"."name")) > 0),
	CONSTRAINT "ck_official_accounts_slug_not_blank" CHECK (char_length(trim("brand"."official_accounts"."slug")) > 0),
	CONSTRAINT "ck_official_accounts_content_types" CHECK (jsonb_typeof("brand"."official_accounts"."content_types") = 'array'),
	CONSTRAINT "ck_official_accounts_account_type" CHECK ("brand"."official_accounts"."account_type" in ('service', 'subscription', 'unknown')),
	CONSTRAINT "ck_official_accounts_verification_status" CHECK ("brand"."official_accounts"."verification_status" in ('unknown', 'unverified', 'verified')),
	CONSTRAINT "ck_official_accounts_status" CHECK ("brand"."official_accounts"."status" in ('draft', 'active', 'disabled', 'archived')),
	CONSTRAINT "ck_official_accounts_archive_consistency" CHECK (("brand"."official_accounts"."status" = 'archived') = ("brand"."official_accounts"."archived_at" is not null)),
	CONSTRAINT "ck_official_accounts_default_not_archived" CHECK (not ("brand"."official_accounts"."is_default" and "brand"."official_accounts"."status" = 'archived'))
);
--> statement-breakpoint
ALTER TABLE "brand"."official_accounts" ADD CONSTRAINT "official_accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_official_accounts_owner_slug" ON "brand"."official_accounts" USING btree ("owner_user_id","slug") WHERE "brand"."official_accounts"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_official_accounts_default_owner" ON "brand"."official_accounts" USING btree ("owner_user_id") WHERE "brand"."official_accounts"."is_default" = true and "brand"."official_accounts"."deleted_at" is null and "brand"."official_accounts"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX "idx_official_accounts_owner_status" ON "brand"."official_accounts" USING btree ("owner_user_id","status","updated_at" DESC NULLS LAST) WHERE "brand"."official_accounts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_official_accounts_owner_default" ON "brand"."official_accounts" USING btree ("owner_user_id","is_default") WHERE "brand"."official_accounts"."deleted_at" is null;