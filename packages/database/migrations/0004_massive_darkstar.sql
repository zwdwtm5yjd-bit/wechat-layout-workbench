LOCK TABLE
  "content"."articles",
  "content"."article_documents",
  "content"."article_snapshots",
  "content"."resources",
  "content"."article_resources"
IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
CREATE TEMP TABLE "_v0004_document_resource_refs_raw" ON COMMIT DROP AS
WITH RECURSIVE "document_nodes" AS (
  SELECT
    "document"."article_id",
    "article"."owner_user_id",
    "node"."value" AS "node",
    ARRAY["node"."ordinality"::integer] AS "node_path"
  FROM "content"."article_documents" AS "document"
  INNER JOIN "content"."articles" AS "article"
    ON "article"."id" = "document"."article_id"
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof("document"."document_json" #> '{content,content}') = 'array'
        THEN "document"."document_json" #> '{content,content}'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS "node"("value", "ordinality")

  UNION ALL

  SELECT
    "parent"."article_id",
    "parent"."owner_user_id",
    "child"."value" AS "node",
    "parent"."node_path" || "child"."ordinality"::integer
  FROM "document_nodes" AS "parent"
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof("parent"."node" -> 'content') = 'array'
        THEN "parent"."node" -> 'content'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS "child"("value", "ordinality")
),
"document_refs" AS (
  SELECT
    "article_id",
    "owner_user_id",
    "node" -> 'attrs' ->> 'resourceId' AS "resource_id_text",
    "node" -> 'attrs' ->> 'blockId' AS "block_id",
    'image'::text AS "usage_type",
    "node_path",
    0 AS "usage_order"
  FROM "document_nodes"
  WHERE "node" ->> 'type' = 'imageBlock'

  UNION ALL

  SELECT
    "article_id",
    "owner_user_id",
    "node" -> 'attrs' ->> 'originalResourceId',
    "node" -> 'attrs' ->> 'blockId',
    'image_original'::text,
    "node_path",
    1
  FROM "document_nodes"
  WHERE "node" ->> 'type' = 'imageBlock'

  UNION ALL

  SELECT
    "article_id",
    "owner_user_id",
    "node" -> 'attrs' ->> 'watermarkId',
    "node" -> 'attrs' ->> 'blockId',
    'watermark'::text,
    "node_path",
    2
  FROM "document_nodes"
  WHERE "node" ->> 'type' = 'imageBlock'

  UNION ALL

  SELECT
    "parent"."article_id",
    "parent"."owner_user_id",
    "asset"."value",
    "parent"."node" -> 'attrs' ->> 'blockId',
    'svg_asset'::text,
    "parent"."node_path",
    3 + "asset"."ordinality"::integer
  FROM "document_nodes" AS "parent"
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof("parent"."node" -> 'attrs' -> 'resourceIds') = 'array'
        THEN "parent"."node" -> 'attrs' -> 'resourceIds'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS "asset"("value", "ordinality")
  WHERE "parent"."node" ->> 'type' = 'svgInteraction'

  UNION ALL

  SELECT
    "article_id",
    "owner_user_id",
    "node" -> 'attrs' ->> 'fallbackResourceId',
    "node" -> 'attrs' ->> 'blockId',
    'svg_fallback'::text,
    "node_path",
    100000
  FROM "document_nodes"
  WHERE "node" ->> 'type' = 'svgInteraction'
)
SELECT *
FROM "document_refs"
WHERE (
    "resource_id_text" IS NOT NULL
    OR "usage_type" IN ('image', 'svg_asset', 'svg_fallback')
  )
  AND (
    "resource_id_text" IS NULL
    OR "resource_id_text" NOT IN (
      'component_slot_image_pending',
      'component_slot_qrcode_pending'
    )
  );
--> statement-breakpoint
CREATE TEMP TABLE "_v0004_snapshot_resource_refs_raw" ON COMMIT DROP AS
SELECT
  "snapshot"."id" AS "snapshot_id",
  "snapshot"."article_id",
  "article"."owner_user_id",
  "resource_entry"."value" ->> 'resourceId' AS "resource_id_text",
  "reference"."value" ->> 'blockId' AS "block_id",
  "reference"."value" ->> 'usageType' AS "usage_type",
  "resource_entry"."ordinality"::integer AS "resource_order",
  "reference"."ordinality"::integer AS "reference_order",
  "snapshot"."created_at"
FROM "content"."article_snapshots" AS "snapshot"
INNER JOIN "content"."articles" AS "article"
  ON "article"."id" = "snapshot"."article_id"
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof("snapshot"."resource_manifest") = 'array'
      THEN "snapshot"."resource_manifest"
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS "resource_entry"("value", "ordinality")
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof("resource_entry"."value" -> 'references') = 'array'
      THEN "resource_entry"."value" -> 'references'
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS "reference"("value", "ordinality")
WHERE "resource_entry"."value" ->> 'resourceId' IS NULL
   OR "resource_entry"."value" ->> 'resourceId' NOT IN (
     'component_slot_image_pending',
     'component_slot_qrcode_pending'
   );
--> statement-breakpoint
DO $$
DECLARE
  "invalid_detail" text;
BEGIN
  SELECT format(
    'article_id=%s resource_id=%s block_id=%s usage_type=%s',
    "ref"."article_id",
    coalesce("ref"."resource_id_text", '<null>'),
    coalesce("ref"."block_id", '<null>'),
    coalesce("ref"."usage_type", '<null>')
  )
  INTO "invalid_detail"
  FROM "_v0004_document_resource_refs_raw" AS "ref"
  LEFT JOIN "content"."resources" AS "resource"
    ON "resource"."id" = CASE
      WHEN "ref"."resource_id_text" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN "ref"."resource_id_text"::uuid
      ELSE NULL
    END
  WHERE "ref"."resource_id_text" IS NULL
    OR "ref"."resource_id_text" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR "ref"."block_id" IS NULL
    OR char_length("ref"."block_id") = 0
    OR char_length("ref"."block_id") > 128
    OR "ref"."usage_type" NOT IN (
      'image',
      'image_original',
      'watermark',
      'svg_asset',
      'svg_fallback'
    )
    OR "resource"."id" IS NULL
    OR "resource"."owner_user_id" <> "ref"."owner_user_id"
    OR "resource"."status" <> 'active'
    OR "resource"."deleted_at" IS NOT NULL
  ORDER BY "ref"."article_id", "ref"."node_path", "ref"."usage_order"
  LIMIT 1;

  IF "invalid_detail" IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = '0004 document resource preflight failed',
      DETAIL = "invalid_detail";
  END IF;
END
$$;
--> statement-breakpoint
DO $$
DECLARE
  "invalid_detail" text;
BEGIN
  SELECT format(
    'snapshot_id=%s article_id=%s resource_id=%s block_id=%s usage_type=%s',
    "ref"."snapshot_id",
    "ref"."article_id",
    coalesce("ref"."resource_id_text", '<null>'),
    coalesce("ref"."block_id", '<null>'),
    coalesce("ref"."usage_type", '<null>')
  )
  INTO "invalid_detail"
  FROM "_v0004_snapshot_resource_refs_raw" AS "ref"
  LEFT JOIN "content"."resources" AS "resource"
    ON "resource"."id" = CASE
      WHEN "ref"."resource_id_text" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN "ref"."resource_id_text"::uuid
      ELSE NULL
    END
  WHERE "ref"."resource_id_text" IS NULL
    OR "ref"."resource_id_text" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR "ref"."block_id" IS NULL
    OR char_length("ref"."block_id") = 0
    OR char_length("ref"."block_id") > 128
    OR "ref"."usage_type" IS NULL
    OR "ref"."usage_type" NOT IN (
      'image',
      'image_original',
      'watermark',
      'svg_asset',
      'svg_fallback'
    )
    OR "resource"."id" IS NULL
    OR "resource"."owner_user_id" <> "ref"."owner_user_id"
    OR "resource"."status" <> 'active'
    OR "resource"."deleted_at" IS NOT NULL
  ORDER BY "ref"."snapshot_id", "ref"."resource_order", "ref"."reference_order"
  LIMIT 1;

  IF "invalid_detail" IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = '0004 snapshot resource preflight failed',
      DETAIL = "invalid_detail";
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "content"."article_resources" ALTER COLUMN "block_id" SET DATA TYPE varchar(128);
--> statement-breakpoint
CREATE TEMP TABLE "_v0004_document_resource_refs" ON COMMIT DROP AS
WITH "deduplicated_document_refs" AS (
  SELECT DISTINCT ON (
    "ref"."article_id",
    "ref"."resource_id_text",
    "ref"."block_id",
    "ref"."usage_type"
  )
    "ref"."article_id",
    "ref"."resource_id_text"::uuid AS "resource_id",
    "ref"."block_id",
    "ref"."usage_type",
    "ref"."node_path",
    "ref"."usage_order"
  FROM "_v0004_document_resource_refs_raw" AS "ref"
  ORDER BY
    "ref"."article_id",
    "ref"."resource_id_text",
    "ref"."block_id",
    "ref"."usage_type",
    "ref"."node_path",
    "ref"."usage_order"
)
SELECT
  "ref"."article_id",
  "ref"."resource_id",
  "ref"."block_id",
  "ref"."usage_type",
  row_number() OVER (
    PARTITION BY "ref"."article_id"
    ORDER BY "ref"."node_path", "ref"."usage_order", "ref"."resource_id"
  )::integer - 1 AS "sort_order"
FROM "deduplicated_document_refs" AS "ref";
--> statement-breakpoint
WITH "ranked_live_refs" AS (
  SELECT
    "existing"."id",
    "desired"."sort_order" AS "desired_sort_order",
    row_number() OVER (
      PARTITION BY
        "existing"."article_id",
        "existing"."resource_id",
        "existing"."block_id",
        "existing"."usage_type"
      ORDER BY "existing"."created_at", "existing"."id"
    ) AS "duplicate_rank"
  FROM "content"."article_resources" AS "existing"
  LEFT JOIN "_v0004_document_resource_refs" AS "desired"
    ON "desired"."article_id" = "existing"."article_id"
   AND "desired"."resource_id" = "existing"."resource_id"
   AND "desired"."block_id" IS NOT DISTINCT FROM "existing"."block_id"
   AND "desired"."usage_type" = "existing"."usage_type"
  WHERE "existing"."frozen_by_snapshot_id" IS NULL
    AND "existing"."deleted_at" IS NULL
)
UPDATE "content"."article_resources" AS "target"
SET
  "deleted_at" = CASE
    WHEN "ranked"."desired_sort_order" IS NULL OR "ranked"."duplicate_rank" > 1
      THEN now()
    ELSE "target"."deleted_at"
  END,
  "sort_order" = CASE
    WHEN "ranked"."desired_sort_order" IS NOT NULL AND "ranked"."duplicate_rank" = 1
      THEN "ranked"."desired_sort_order"
    ELSE "target"."sort_order"
  END
FROM "ranked_live_refs" AS "ranked"
WHERE "target"."id" = "ranked"."id"
  AND (
    "ranked"."desired_sort_order" IS NULL
    OR "ranked"."duplicate_rank" > 1
    OR "target"."sort_order" <> "ranked"."desired_sort_order"
  );
--> statement-breakpoint
INSERT INTO "content"."article_resources" (
  "id",
  "article_id",
  "resource_id",
  "block_id",
  "usage_type",
  "sort_order"
)
SELECT
  uuidv7(),
  "ref"."article_id",
  "ref"."resource_id",
  "ref"."block_id",
  "ref"."usage_type",
  "ref"."sort_order"
FROM "_v0004_document_resource_refs" AS "ref"
WHERE NOT EXISTS (
  SELECT 1
  FROM "content"."article_resources" AS "existing"
  WHERE "existing"."article_id" = "ref"."article_id"
    AND "existing"."resource_id" = "ref"."resource_id"
    AND "existing"."block_id" IS NOT DISTINCT FROM "ref"."block_id"
    AND "existing"."usage_type" = "ref"."usage_type"
    AND "existing"."frozen_by_snapshot_id" IS NULL
    AND "existing"."deleted_at" IS NULL
);
--> statement-breakpoint
CREATE TEMP TABLE "_v0004_snapshot_resource_refs" ON COMMIT DROP AS
WITH "deduplicated_snapshot_refs" AS (
  SELECT DISTINCT ON (
    "ref"."snapshot_id",
    "ref"."resource_id_text",
    "ref"."block_id",
    "ref"."usage_type"
  )
    "ref"."snapshot_id",
    "ref"."article_id",
    "ref"."resource_id_text"::uuid AS "resource_id",
    "ref"."block_id",
    "ref"."usage_type",
    "ref"."resource_order",
    "ref"."reference_order",
    "ref"."created_at"
  FROM "_v0004_snapshot_resource_refs_raw" AS "ref"
  ORDER BY
    "ref"."snapshot_id",
    "ref"."resource_id_text",
    "ref"."block_id",
    "ref"."usage_type",
    "ref"."resource_order",
    "ref"."reference_order"
)
SELECT
  "ref"."snapshot_id",
  "ref"."article_id",
  "ref"."resource_id",
  "ref"."block_id",
  "ref"."usage_type",
  row_number() OVER (
    PARTITION BY "ref"."snapshot_id"
    ORDER BY "ref"."resource_order", "ref"."reference_order", "ref"."resource_id"
  )::integer - 1 AS "sort_order",
  "ref"."created_at"
FROM "deduplicated_snapshot_refs" AS "ref";
--> statement-breakpoint
WITH "ranked_frozen_refs" AS (
  SELECT
    "existing"."id",
    "desired"."sort_order" AS "desired_sort_order",
    row_number() OVER (
      PARTITION BY
        "existing"."frozen_by_snapshot_id",
        "existing"."resource_id",
        "existing"."block_id",
        "existing"."usage_type"
      ORDER BY "existing"."created_at", "existing"."id"
    ) AS "duplicate_rank"
  FROM "content"."article_resources" AS "existing"
  LEFT JOIN "_v0004_snapshot_resource_refs" AS "desired"
    ON "desired"."snapshot_id" = "existing"."frozen_by_snapshot_id"
   AND "desired"."article_id" = "existing"."article_id"
   AND "desired"."resource_id" = "existing"."resource_id"
   AND "desired"."block_id" IS NOT DISTINCT FROM "existing"."block_id"
   AND "desired"."usage_type" = "existing"."usage_type"
  WHERE "existing"."frozen_by_snapshot_id" IS NOT NULL
    AND "existing"."deleted_at" IS NULL
)
UPDATE "content"."article_resources" AS "target"
SET
  "deleted_at" = CASE
    WHEN "ranked"."desired_sort_order" IS NULL OR "ranked"."duplicate_rank" > 1
      THEN now()
    ELSE "target"."deleted_at"
  END,
  "sort_order" = CASE
    WHEN "ranked"."desired_sort_order" IS NOT NULL AND "ranked"."duplicate_rank" = 1
      THEN "ranked"."desired_sort_order"
    ELSE "target"."sort_order"
  END
FROM "ranked_frozen_refs" AS "ranked"
WHERE "target"."id" = "ranked"."id"
  AND (
    "ranked"."desired_sort_order" IS NULL
    OR "ranked"."duplicate_rank" > 1
    OR "target"."sort_order" <> "ranked"."desired_sort_order"
  );
--> statement-breakpoint
INSERT INTO "content"."article_resources" (
  "id",
  "article_id",
  "resource_id",
  "block_id",
  "usage_type",
  "sort_order",
  "frozen_by_snapshot_id",
  "created_at"
)
SELECT
  uuidv7(),
  "ref"."article_id",
  "ref"."resource_id",
  "ref"."block_id",
  "ref"."usage_type",
  "ref"."sort_order",
  "ref"."snapshot_id",
  "ref"."created_at"
FROM "_v0004_snapshot_resource_refs" AS "ref"
WHERE NOT EXISTS (
  SELECT 1
  FROM "content"."article_resources" AS "existing"
  WHERE "existing"."article_id" = "ref"."article_id"
    AND "existing"."resource_id" = "ref"."resource_id"
    AND "existing"."block_id" IS NOT DISTINCT FROM "ref"."block_id"
    AND "existing"."usage_type" = "ref"."usage_type"
    AND "existing"."frozen_by_snapshot_id" = "ref"."snapshot_id"
    AND "existing"."deleted_at" IS NULL
);
