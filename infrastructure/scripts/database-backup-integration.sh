#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
fixture_dir="$(mktemp -d "${TMPDIR:-/tmp}/wechat-layout-backup-integration.XXXXXX")"
container_name="wechat-layout-backup-integration-$$"
postgres_image="postgres:18.4-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15"
backup_id="20260803T000000Z-abcdef123456"
archive_path="$fixture_dir/postgresql-$backup_id.dump.enc"
manifest_path="$fixture_dir/postgresql-$backup_id.manifest.json"
export BACKUP_ENCRYPTION_KEY="backup-integration-key-000000000000000000000000001"

cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  rm -rf -- "$fixture_dir"
}
trap cleanup EXIT

docker run \
  --detach \
  --name "$container_name" \
  --env POSTGRES_DB=backup_source \
  --env POSTGRES_PASSWORD=backup-test-postgres-password \
  --env POSTGRES_USER=wechat_app \
  "$postgres_image" >/dev/null

for _attempt in $(seq 1 30); do
  if docker exec "$container_name" \
    psql --username wechat_app --dbname backup_source --command "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$container_name" \
  psql --username wechat_app --dbname backup_source --command "SELECT 1" >/dev/null

for migration in "$project_root"/packages/database/migrations/*.sql; do
  docker exec --interactive "$container_name" \
    psql --username wechat_app --dbname backup_source --set ON_ERROR_STOP=1 --single-transaction \
    <"$migration" >/dev/null
done

docker exec --interactive "$container_name" \
  psql --username wechat_app --dbname backup_source --set ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, display_name, password_hash)
VALUES ('00000000-0000-4000-8000-000000000001', 'backup@example.com', 'Backup Fixture', 'fixture-hash');

INSERT INTO content.articles (
  id, owner_user_id, title, status, theme_id, theme_version, image_count
)
SELECT
  ('00000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  'Backup article ' || series,
  'layout_editing',
  '00000000-0000-4000-8000-000000000099'::uuid,
  '1.0.0',
  1
FROM generate_series(10, 14) AS series;

INSERT INTO content.resources (
  id, owner_user_id, resource_type, source_type, original_filename,
  storage_provider, storage_bucket, storage_key, mime_type, file_extension,
  file_size, sha256
)
SELECT
  ('01980000-0000-7000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  'image', 'upload', 'fixture-' || series || '.png', 's3', 'fixture-bucket',
  'fixtures/' || series || '.png', 'image/png', 'png', 128,
  repeat(to_hex(series), 64 / length(to_hex(series)))
FROM generate_series(10, 14) AS series;

INSERT INTO content.article_documents (
  id, article_id, schema_version, document_json, last_saved_by
)
SELECT
  ('10000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '1.0.0',
  jsonb_build_object('schemaVersion', '1.0.0', 'content', jsonb_build_object('content', '[]'::jsonb)),
  '00000000-0000-4000-8000-000000000001'::uuid
FROM generate_series(10, 14) AS series;

INSERT INTO content.article_snapshots (
  id, article_id, snapshot_number, reason, document_schema_version,
  document_json, theme_id, theme_version, resource_manifest, created_by
)
SELECT
  ('20000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  1, 'manual', '1.0.0',
  jsonb_build_object('schemaVersion', '1.0.0', 'content', jsonb_build_object('content', '[]'::jsonb)),
  '00000000-0000-4000-8000-000000000099'::uuid, '1.0.0',
  jsonb_build_array(jsonb_build_object(
    'resourceId', ('01980000-0000-7000-8000-' || lpad(series::text, 12, '0')),
    'sha256', repeat(to_hex(series), 64 / length(to_hex(series))),
    'references', '[]'::jsonb
  )),
  '00000000-0000-4000-8000-000000000001'::uuid
FROM generate_series(10, 14) AS series;
SQL

tables="$(docker exec "$container_name" psql --username wechat_app --dbname backup_source --tuples-only --no-align --command "SELECT string_agg(schemaname || '.' || tablename, ',' ORDER BY schemaname, tablename) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')")"
server_version="$(docker exec "$container_name" psql --username wechat_app --dbname backup_source --tuples-only --no-align --command 'SHOW server_version_num')"

docker exec "$container_name" \
  pg_dump --username wechat_app --dbname backup_source --format=custom --compress=6 --no-owner --no-privileges \
  | node --import tsx "$script_dir/backup-archive-cli.ts" encrypt \
    --backup-id "$backup_id" \
    --database-name backup_source \
    --directory "$fixture_dir" \
    --document-schema-version 1.0.0 \
    --key-version backup-key-v1 \
    --migration-version 0005 \
    --release integration-test \
    --server-version "$server_version" \
    --tables "$tables" >/dev/null

node --import tsx "$script_dir/backup-archive-cli.ts" verify \
  --archive "$archive_path" \
  --key-version backup-key-v1 \
  --manifest "$manifest_path" >/dev/null

docker exec "$container_name" createdb --username wechat_app --template template0 backup_restore
node --import tsx "$script_dir/backup-archive-cli.ts" decrypt \
  --archive "$archive_path" \
  --key-version backup-key-v1 \
  --manifest "$manifest_path" \
  | docker exec --interactive "$container_name" \
    pg_restore --username wechat_app --dbname backup_restore --exit-on-error --no-owner --no-privileges

counts="$(docker exec "$container_name" psql --username wechat_app --dbname backup_restore --tuples-only --no-align --command "SELECT concat_ws(',', (SELECT count(*) FROM content.articles), (SELECT count(*) FROM content.article_documents), (SELECT count(*) FROM content.article_snapshots), (SELECT count(*) FROM content.resources WHERE mime_type LIKE 'image/%'), (SELECT count(*) FROM content.articles WHERE theme_id IS NOT NULL))")"
test "$counts" = "5,5,5,5,5"
echo "PostgreSQL 加密备份与新数据库恢复验收通过（${counts}）。"
