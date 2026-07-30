#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
env_file="$project_root/.env.docker"
compose_file="$project_root/infrastructure/compose/docker-compose.yml"
dev_compose_file="$project_root/infrastructure/compose/docker-compose.dev.yml"

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

probe_written=false

cleanup_probes() {
  if [[ "$probe_written" != "true" ]]; then
    return
  fi

  compose exec -T postgres sh -ec \
    'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --command "DROP TABLE IF EXISTS public.__s0_arch_persistence_probe" >/dev/null' \
    2>&1 || true
  compose exec -T redis sh -ec \
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli del __s0_arch_persistence_probe >/dev/null' \
    2>&1 || true
}

trap cleanup_probes EXIT

assert_minio_object() {
  compose run \
    --rm \
    --no-deps \
    --entrypoint /bin/sh \
    minio-init \
    -ec \
    'mc alias set probe http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc stat "probe/$MINIO_BUCKET/healthcheck.txt" >/dev/null'
}

assert_healthy() {
  local service_name="$1"
  local container_id
  local health_status

  container_id="$(compose ps --quiet "$service_name")"
  if [[ -z "$container_id" ]]; then
    echo "$service_name 容器未运行。" >&2
    exit 1
  fi

  health_status="$(docker inspect --format '{{.State.Health.Status}}' "$container_id")"
  if [[ "$health_status" != "healthy" ]]; then
    echo "$service_name 健康状态异常：$health_status。" >&2
    exit 1
  fi
}

echo "1/8 检查应用与基础服务健康状态"
for service_name in postgres redis minio mailpit api web worker scheduler; do
  assert_healthy "$service_name"
done

echo "2/8 验证 API 健康检查、数据库探针与 OpenAPI"
compose exec -T api node -e \
  "Promise.all(['/health/live','/health/ready','/api/openapi.json'].map(async(path)=>{const response=await fetch('http://127.0.0.1:3001'+path);if(!response.ok)throw new Error(path+' returned '+response.status);const body=await response.json();if(path.startsWith('/health/')&&body.status!=='ok')throw new Error(path+' is not ok');if(path==='/health/ready'&&(body.info?.database?.status!=='up'||body.info?.api?.registeredDependencyChecks!==1))throw new Error('database readiness probe is unavailable');if(path==='/api/openapi.json'&&!body.openapi)throw new Error('OpenAPI document is invalid')})).then(()=>process.exit(0)).catch((error)=>{console.error(error.message);process.exit(1)})"

echo "3/8 验证 Web 页面与乐观路由保护"
compose exec -T web node -e \
  "Promise.all([fetch('http://127.0.0.1:3000/login',{redirect:'manual'}),fetch('http://127.0.0.1:3000/workspace',{redirect:'manual'}),fetch('http://127.0.0.1:3000/workspace',{headers:{cookie:'session_id=foundation-smoke'},redirect:'manual'})]).then(async([login,anonymousWorkspace,sessionWorkspace])=>{const loginBody=await login.text();const workspaceBody=await sessionWorkspace.text();if(login.status!==200||!loginBody.includes('登录你的工作台'))throw new Error('login page is unavailable');if(anonymousWorkspace.status!==307||!anonymousWorkspace.headers.get('location')?.startsWith('/login?next='))throw new Error('workspace route protection is unavailable');if(sessionWorkspace.status!==200||!workspaceBody.includes('早上好，欢迎来到一键视觉'))throw new Error('workspace page is unavailable')}).then(()=>process.exit(0)).catch((error)=>{console.error(error.message);process.exit(1)})"

echo "4/8 验证 PostgreSQL 与 Redis 连接"
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "SELECT 1" >/dev/null'
compose exec -T redis sh -ec \
  'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping | grep -q PONG'

echo "5/8 验证数据库迁移、外键与索引"
compose run \
  --rm \
  --no-deps \
  database-migrate \
  pnpm \
  --filter \
  @wechat-layout/database \
  db:check

echo "6/8 写入持久化探针并验证 MinIO 测试对象"
probe_written=true
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "CREATE TABLE IF NOT EXISTS public.__s0_arch_persistence_probe (id integer PRIMARY KEY, marker text NOT NULL); INSERT INTO public.__s0_arch_persistence_probe (id, marker) VALUES (1, '\''persisted'\'') ON CONFLICT (id) DO UPDATE SET marker = EXCLUDED.marker;" >/dev/null'
compose exec -T redis sh -ec \
  'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli set __s0_arch_persistence_probe persisted | grep -q OK'
assert_minio_object

echo "7/8 重启有状态服务并验证数据仍然存在"
compose restart postgres redis minio
compose up --detach --wait postgres redis minio
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "SELECT marker FROM public.__s0_arch_persistence_probe WHERE id = 1" | grep -qx persisted'
compose exec -T redis sh -ec \
  'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli get __s0_arch_persistence_probe | grep -qx persisted'
assert_minio_object

echo "8/8 清理探针并确认应用恢复健康"
cleanup_probes
probe_written=false
compose up --detach --wait api web worker scheduler
assert_healthy api
assert_healthy web

echo "Docker 开发环境验收通过。"
