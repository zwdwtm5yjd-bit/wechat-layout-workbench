#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
env_file="$project_root/.env.docker"
compose_file="$project_root/infrastructure/compose/docker-compose.yml"
dev_compose_file="$project_root/infrastructure/compose/docker-compose.dev.yml"
test_database="wechat_layout_migration_test"

if [[ ! -f "$env_file" ]]; then
  echo "缺少 .env.docker，请先运行 pnpm docker:dev。" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose_command=(docker compose)
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
  compose_command=(docker-compose)
else
  echo "当前 Docker 未提供 Compose v2。" >&2
  exit 1
fi

compose() {
  "${compose_command[@]}" \
    --env-file "$env_file" \
    --file "$compose_file" \
    --file "$dev_compose_file" \
    "$@"
}

cleanup() {
  compose exec -T postgres sh -ec \
    'dropdb --if-exists --force --username "$POSTGRES_USER" wechat_layout_migration_test' \
    >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "1/8 准备一次性测试数据库和最新 Node 镜像"
compose build api
compose up --detach --wait postgres
cleanup
compose exec -T postgres sh -ec \
  'createdb --username "$POSTGRES_USER" wechat_layout_migration_test'

test_database_url="$(
  compose run \
    --rm \
    --no-deps \
    --entrypoint node \
    database-migrate \
    -e "const url=new URL(process.env.DATABASE_URL);url.pathname='/$test_database';process.stdout.write(url.toString())"
)"

run_database_command() {
  compose run \
    --rm \
    --no-deps \
    --env APP_ENV=test \
    --env NODE_ENV=test \
    --env DATABASE_URL="$test_database_url" \
    database-migrate \
    pnpm \
    --filter \
    @wechat-layout/database \
    "$1"
}

echo "2/8 从空数据库执行迁移并验收结构"
run_database_command db:migrate
run_database_command db:check

echo "3/8 连续执行两次种子数据"
run_database_command db:seed
run_database_command db:seed

echo "4/8 验证种子数据幂等与 UUIDv7"
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname wechat_layout_migration_test --tuples-only --no-align --set ON_ERROR_STOP=1 --command "SELECT count(*) FROM auth.users WHERE lower(email) = '\''owner@example.invalid'\'' AND deleted_at IS NULL" | grep -qx 1'
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname wechat_layout_migration_test --tuples-only --no-align --set ON_ERROR_STOP=1 --command "SELECT substring(id::text, 15, 1) FROM auth.users WHERE lower(email) = '\''owner@example.invalid'\'' AND deleted_at IS NULL" | grep -qx 7'

echo "5/8 回滚测试数据库业务 Schema"
run_database_command db:reset:test

echo "6/8 确认回滚后业务表已移除"
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname wechat_layout_migration_test --tuples-only --no-align --set ON_ERROR_STOP=1 --command "SELECT to_regclass('\''auth.users'\'') IS NULL" | grep -qx t'

echo "7/8 回滚后重新迁移并再次验收"
run_database_command db:migrate
run_database_command db:check

echo "8/8 清理一次性测试数据库"
cleanup
trap - EXIT

echo "数据库迁移、幂等种子、回滚和重迁移验收通过。"
