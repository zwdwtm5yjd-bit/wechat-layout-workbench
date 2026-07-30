CREATE FUNCTION "content"."reject_article_snapshot_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'article snapshots are immutable'
		USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "trg_article_snapshots_immutable"
BEFORE UPDATE OR DELETE ON "content"."article_snapshots"
FOR EACH ROW
EXECUTE FUNCTION "content"."reject_article_snapshot_mutation"();
