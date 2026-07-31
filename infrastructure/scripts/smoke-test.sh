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

echo "1/10 检查应用与基础服务健康状态"
for service_name in postgres redis minio mailpit api web worker scheduler; do
  assert_healthy "$service_name"
done

echo "2/10 验证 API 健康检查、依赖探针与 OpenAPI"
compose exec -T api node -e \
  "Promise.all(['/health/live','/health/ready','/api/openapi.json'].map(async(path)=>{const response=await fetch('http://127.0.0.1:3001'+path);if(!response.ok)throw new Error(path+' returned '+response.status);const body=await response.json();if(path.startsWith('/health/')&&body.status!=='ok')throw new Error(path+' is not ok');if(path==='/health/ready'&&(body.info?.database?.status!=='up'||body.info?.redis?.status!=='up'||body.info?.objectStorage?.status!=='up'||body.info?.api?.registeredDependencyChecks!==3))throw new Error('database, Redis or object storage readiness probe is unavailable');if(path==='/api/openapi.json'&&(!body.openapi||!body.paths?.['/api/v1/auth/login']||!body.paths?.['/api/v1/auth/me']||!body.paths?.['/api/v1/articles']||!body.paths?.['/api/v1/articles/{articleId}/duplicate']||!body.paths?.['/api/v1/articles/{articleId}/document']?.put||!body.paths?.['/api/v1/articles/{articleId}/snapshots']?.post||!body.paths?.['/api/v1/articles/{articleId}/snapshots/{snapshotId}/restore']?.post||!body.paths?.['/api/v1/articles/{articleId}/render-wechat']?.post||!body.paths?.['/api/v1/articles/{articleId}/copy-payload']?.post||!body.paths?.['/api/v1/articles/{articleId}/copy-records']?.post||!body.paths?.['/api/v1/imports/paste']?.post||!body.paths?.['/api/v1/imports/{articleId}/structure']?.get||!body.paths?.['/api/v1/imports/{articleId}/structure']?.put||!body.paths?.['/api/v1/resources/uploads']?.post||!body.paths?.['/api/v1/resources/uploads/{uploadId}/complete']?.post||!body.paths?.['/api/v1/resources/{resourceId}/access-url']?.post||!body.paths?.['/api/v1/resources/{resourceId}/references']?.get))throw new Error('OpenAPI authentication, content, copy or resource contract is invalid')})).then(()=>process.exit(0)).catch((error)=>{console.error(error.message);process.exit(1)})"

echo "3/10 验证认证边界、CSRF 与匿名会话拒绝"
compose exec -T api node -e \
  "async function run(){const base='http://127.0.0.1:3001';const csrfResponse=await fetch(base+'/api/v1/auth/csrf');const csrfBody=await csrfResponse.json();const csrfToken=csrfBody.data?.csrfToken;const cookies=csrfResponse.headers.getSetCookie().map((value)=>value.split(';',1)[0]).join('; ');if(csrfResponse.status!==200||typeof csrfToken!=='string'||!cookies.includes('csrf_binding='))throw new Error('CSRF bootstrap is unavailable');const body=JSON.stringify({identifier:'smoke-'+crypto.randomUUID()+'@example.invalid',password:'not-a-real-password'});const missingCsrf=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body});if(missingCsrf.status!==403||(await missingCsrf.json()).error?.code!=='CSRF_INVALID')throw new Error('missing CSRF was not rejected');const invalidLogin=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{cookie:cookies,'content-type':'application/json','x-csrf-token':csrfToken},body});if(invalidLogin.status!==401||(await invalidLogin.json()).error?.code!=='AUTH_INVALID_CREDENTIALS')throw new Error('invalid credentials response is unstable');const currentUser=await fetch(base+'/api/v1/auth/me');if(currentUser.status!==401||(await currentUser.json()).error?.code!=='AUTH_REQUIRED')throw new Error('anonymous session was not rejected')}run().then(()=>process.exit(0)).catch((error)=>{console.error(error.message);process.exit(1)})"

echo "4/10 验证资源直传、粘贴导入、文章 CRUD、文档并发锁与不可变快照"
compose exec -T api node --input-type=module < "$script_dir/resource-smoke.mjs"
compose exec -T api node --input-type=module < "$script_dir/article-smoke.mjs"

echo "5/10 验证 Web 页面、导入入口与乐观路由保护"
compose exec -T web node -e \
  "Promise.all([fetch('http://127.0.0.1:3000/login',{redirect:'manual'}),fetch('http://127.0.0.1:3000/workspace',{redirect:'manual'}),fetch('http://127.0.0.1:3000/workspace',{headers:{cookie:'session_id=foundation-smoke'},redirect:'manual'}),fetch('http://127.0.0.1:3000/workspace/articles',{headers:{cookie:'session_id=foundation-smoke'},redirect:'manual'}),fetch('http://127.0.0.1:3000/workspace/imports/paste',{headers:{cookie:'session_id=foundation-smoke'},redirect:'manual'})]).then(async([login,anonymousWorkspace,sessionWorkspace,articlesWorkspace,pasteImport])=>{const loginBody=await login.text();const workspaceBody=await sessionWorkspace.text();const articlesBody=await articlesWorkspace.text();const pasteImportBody=await pasteImport.text();if(login.status!==200||!loginBody.includes('登录你的工作台'))throw new Error('login page is unavailable');if(anonymousWorkspace.status!==307||!anonymousWorkspace.headers.get('location')?.startsWith('/login?next='))throw new Error('workspace route protection is unavailable');if(sessionWorkspace.status!==200||!workspaceBody.includes('早上好，欢迎来到一键视觉'))throw new Error('workspace page is unavailable');if(articlesWorkspace.status!==200||!articlesBody.includes('集中管理文章状态'))throw new Error('article workspace is unavailable');if(pasteImport.status!==200||!pasteImportBody.includes('原始 HTML 不会保存'))throw new Error('paste import workspace is unavailable')}).then(()=>process.exit(0)).catch((error)=>{console.error(error.message);process.exit(1)})"

echo "6/10 验证 PostgreSQL 与 Redis 连接"
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "SELECT 1" >/dev/null'
compose exec -T redis sh -ec \
  'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping | grep -q PONG'

echo "7/10 验证数据库迁移、外键与索引"
compose run \
  --rm \
  --no-deps \
  database-migrate \
  pnpm \
  --filter \
  @wechat-layout/database \
  db:check

echo "8/10 写入持久化探针并验证 MinIO 测试对象"
probe_written=true
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --command "CREATE TABLE IF NOT EXISTS public.__s0_arch_persistence_probe (id integer PRIMARY KEY, marker text NOT NULL); INSERT INTO public.__s0_arch_persistence_probe (id, marker) VALUES (1, '\''persisted'\'') ON CONFLICT (id) DO UPDATE SET marker = EXCLUDED.marker;" >/dev/null'
compose exec -T redis sh -ec \
  'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli set __s0_arch_persistence_probe persisted | grep -q OK'
assert_minio_object

echo "9/10 重启有状态服务并验证数据仍然存在"
compose restart postgres redis minio
compose up --detach --wait postgres redis minio
compose exec -T postgres sh -ec \
  'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "SELECT marker FROM public.__s0_arch_persistence_probe WHERE id = 1" | grep -qx persisted'
compose exec -T redis sh -ec \
  'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli get __s0_arch_persistence_probe | grep -qx persisted'
assert_minio_object

echo "10/10 清理探针并确认应用恢复健康"
cleanup_probes
probe_written=false
compose up --detach --wait api web worker scheduler
assert_healthy api
assert_healthy web

echo "Docker 开发环境验收通过。"
