#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
compose_file="$project_root/infrastructure/compose/docker-compose.prod.yml"
fixture_dir="$(mktemp -d "${TMPDIR:-/tmp}/wechat-layout-production-config.XXXXXX")"
env_file="$fixture_dir/production.env"
certificate_path="$fixture_dir/fullchain.pem"
private_key_path="$fixture_dir/privkey.pem"
compose_json="$fixture_dir/compose.json"

cleanup() {
  rm -rf -- "$fixture_dir"
}
trap cleanup EXIT

if ! command -v openssl >/dev/null 2>&1; then
  echo "生产模板验收需要 openssl 生成一次性测试证书。" >&2
  exit 1
fi

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -days 1 \
  -subj "/CN=app.example.com" \
  -keyout "$private_key_path" \
  -out "$certificate_path" \
  >/dev/null 2>&1
chmod 0644 "$certificate_path" "$private_key_path"

cat >"$env_file" <<EOF
APP_DOMAIN=app.example.com
APP_ENV=production
NODE_ENV=production
COMPOSE_PROJECT_NAME=wechat-layout-production-test
IMAGE_REPOSITORY=wechat-layout-production-test
RELEASE_TAG=production-template-test
TLS_CERTIFICATE_PATH=$certificate_path
TLS_PRIVATE_KEY_PATH=$private_key_path
NEXT_PUBLIC_APP_NAME=公众号智能视觉排版工具
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_API_BASE_URL=https://app.example.com
NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED=false
NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED=false
PUBLIC_WEB_URL=https://app.example.com
LOG_LEVEL=info
METRICS_BEARER_TOKEN=metrics-bearer-token-000000000000001
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4318/v1/traces
LOKI_PUSH_URL=http://loki:3100/loki/api/v1/push
GRAFANA_ADMIN_PASSWORD=grafana-admin-password-000000000000001
GRAFANA_HOST_PORT=3002
ALERTMANAGER_WEBHOOK_URL=https://alerts.example.com/hooks/observability
POSTGRES_DB=wechat_layout
POSTGRES_USER=wechat_app
POSTGRES_PASSWORD=prod-postgres-password-000001
DATABASE_URL=postgresql://wechat_app:prod-postgres-password-000001@postgres:5432/wechat_layout
REDIS_PASSWORD=prod-redis-password-000000001
REDIS_URL=redis://:prod-redis-password-000000001@redis:6379/0
S3_ENDPOINT=https://cos-internal.example.com
S3_PUBLIC_ENDPOINT=https://assets.example.com
S3_ADDRESSING_STYLE=virtual-hosted
S3_PUBLIC_ADDRESSING_STYLE=bucket-endpoint
S3_METADATA_HEADER_PREFIX=x-cos-meta-
S3_REGION=ap-shanghai
S3_BUCKET=wechat-layout-production
S3_ACCESS_KEY_ID=production-access-key
S3_SECRET_ACCESS_KEY=production-secret-access-key
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SESSION_SECRET=session-secret-0000000000000000000000000000000001
CSRF_SECRET=csrf-secret-000000000000000000000000000000000002
FIELD_ENCRYPTION_KEY=field-encryption-key-000000000000000000000000003
ASSET_SIGNING_KEY=asset-signing-key-000000000000000000000000000004
BACKUP_ENCRYPTION_KEY=backup-encryption-key-000000000000000000000000005
BACKUP_DIRECTORY=$fixture_dir/backups
BACKUP_KEY_VERSION=backup-key-v1
BACKUP_LOCAL_RETENTION_COUNT=3
BACKUP_REMOTE_RETENTION_DAYS=30
BACKUP_RESTORE_MIN_ARTICLES=5
BACKUP_S3_ENDPOINT=https://backup-cos-internal.example.com
BACKUP_S3_ADDRESSING_STYLE=virtual-hosted
BACKUP_S3_METADATA_HEADER_PREFIX=x-cos-meta-
BACKUP_S3_REGION=ap-shanghai
BACKUP_S3_BUCKET=wechat-layout-backups
BACKUP_S3_PREFIX=production/postgresql
BACKUP_S3_ACCESS_KEY_ID=backup-access-key
BACKUP_S3_SECRET_ACCESS_KEY=backup-secret-access-key
BACKUP_ALERT_WEBHOOK_URL=https://alerts.example.com/hooks/database-backup
FEATURE_WECHAT_SYNC_ENABLED=false
FEATURE_REMOTE_COMPONENTS_ENABLED=false
MAX_JSON_BODY_BYTES=2097152
MAX_DOCX_FILE_BYTES=52428800
MAX_IMAGE_FILE_BYTES=20971520
MAX_BRAND_PACKAGE_BYTES=104857600
WORKER_CONCURRENCY=4
SCHEDULER_INTERVAL_SECONDS=60
EOF

if docker compose version >/dev/null 2>&1; then
  compose_command=(docker compose)
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
  compose_command=(docker-compose)
else
  echo "生产模板验收需要 Docker Compose v2。" >&2
  exit 1
fi

pnpm --filter @wechat-layout/config build >/dev/null
node --import tsx "$script_dir/validate-production-config.ts" --env-file "$env_file"

"${compose_command[@]}" \
  --env-file "$env_file" \
  --file "$compose_file" \
  --profile migration \
  config \
  --format json >"$compose_json"

node - "$compose_json" <<'NODE'
const { readFileSync } = require("node:fs");
const compose = JSON.parse(readFileSync(process.argv[2], "utf8"));
const requiredServices = [
  "alertmanager",
  "api",
  "database-migrate",
  "grafana",
  "loki",
  "nginx",
  "node-exporter",
  "otel-collector",
  "postgres",
  "prometheus",
  "redis",
  "scheduler",
  "tempo",
  "web",
  "worker",
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

invariant(
  requiredServices.every((service) => compose.services[service]),
  "生产 Compose 服务集合不完整",
);

for (const [name, service] of Object.entries(compose.services)) {
  const ports = service.ports ?? [];
  if (name === "nginx") {
    invariant(ports.length === 2, "Nginx 必须且只能发布 80/443");
    invariant(
      JSON.stringify(ports.map((port) => String(port.published)).sort()) ===
        JSON.stringify(["443", "80"]),
      "Nginx 必须精确发布宿主机 80/443",
    );
    invariant(
      JSON.stringify(ports.map((port) => String(port.target)).sort()) ===
        JSON.stringify(["8080", "8443"]),
      "Nginx 必须将 80/443 映射到非特权端口 8080/8443",
    );
  } else if (name === "grafana") {
    invariant(ports.length === 1, "Grafana 必须且只能发布一个回环端口");
    invariant(ports[0].host_ip === "127.0.0.1", "Grafana 只允许绑定宿主机回环地址");
    invariant(String(ports[0].target) === "3000", "Grafana 必须映射容器 3000 端口");
  } else {
    invariant(ports.length === 0, `${name} 不得发布宿主端口`);
  }
  invariant(service.privileged !== true, `${name} 不得使用 privileged`);
  const mounts = service.volumes ?? [];
  invariant(
    mounts.every((mount) => !JSON.stringify(mount).includes("docker.sock")),
    `${name} 不得挂载 Docker Socket`,
  );
}

for (const name of [
  "alertmanager",
  "api",
  "database-migrate",
  "grafana",
  "loki",
  "node-exporter",
  "otel-collector",
  "prometheus",
  "scheduler",
  "tempo",
  "web",
  "worker",
]) {
  const service = compose.services[name];
  invariant(service.read_only === true, `${name} 根文件系统必须只读`);
  invariant(service.cap_drop?.includes("ALL"), `${name} 必须删除全部 Linux capabilities`);
  invariant(
    service.security_opt?.includes("no-new-privileges:true"),
    `${name} 必须启用 no-new-privileges`,
  );
  invariant(!String(service.user ?? "0").startsWith("0"), `${name} 必须显式使用非 root 用户`);
}

invariant(compose.services.nginx.user === "101:101", "Nginx 必须以非 root 用户运行");
invariant(
  compose.services["database-migrate"].profiles?.includes("migration"),
  "迁移服务必须显式启用",
);
invariant(compose.networks.data.internal === true, "数据网络必须禁止外部路由");
invariant(compose.networks.observability.internal === true, "监控网络必须禁止外部路由");
invariant(
  compose.services.postgres.image.includes("@sha256:"),
  "PostgreSQL 镜像必须固定 digest",
);
invariant(compose.services.redis.image.includes("@sha256:"), "Redis 镜像必须固定 digest");
for (const name of [
  "alertmanager",
  "grafana",
  "loki",
  "node-exporter",
  "otel-collector",
  "prometheus",
  "tempo",
]) {
  invariant(compose.services[name].image.includes("@sha256:"), `${name} 镜像必须固定 digest`);
}
invariant(compose.services.api.environment.APP_ENV === "production", "API 必须使用生产配置");
invariant(
  compose.services.api.environment.S3_ADDRESSING_STYLE === "virtual-hosted",
  "API 必须传入服务端对象存储寻址方式",
);
invariant(
  compose.services.api.environment.S3_PUBLIC_ADDRESSING_STYLE === "bucket-endpoint",
  "API 必须传入公开对象存储寻址方式",
);
invariant(
  compose.services.api.environment.S3_METADATA_HEADER_PREFIX === "x-cos-meta-",
  "API 必须传入对象存储自定义元数据头前缀",
);
invariant(
  compose.services.api.networks.observability !== undefined,
  "API 必须接入内部监控网络",
);
invariant(
  compose.services.prometheus.secrets.some((secret) => secret.source === "metrics_bearer_token"),
  "Prometheus 必须通过 Compose Secret 读取指标凭据",
);

process.stdout.write("生产 Compose 模板安全约束验收通过。\n");
NODE

if [[ "${PRODUCTION_TEMPLATE_BUILD:-}" == "1" ]]; then
  production_compose=(
    "${compose_command[@]}"
    --env-file "$env_file"
    --file "$compose_file"
    --profile migration
  )
  "${production_compose[@]}" build nginx
  for service in web api worker scheduler database-migrate; do
    "${production_compose[@]}" build "$service"
  done

  for service in web api worker scheduler database-migrate; do
    image="wechat-layout-production-test/$service:production-template-test"
    test "$(docker image inspect --format '{{.Config.User}}' "$image")" = "node"
  done
  test "$(docker image inspect --format '{{.Config.User}}' wechat-layout-production-test/nginx:production-template-test)" = "101:101"

  docker run \
    --rm \
    --read-only \
    --add-host api:127.0.0.1 \
    --add-host web:127.0.0.1 \
    --tmpfs /tmp:rw,size=16m,mode=1777 \
    --tmpfs /var/cache/nginx:rw,size=32m,mode=0755,uid=101,gid=101 \
    --tmpfs /etc/nginx/conf.d:rw,size=4m,mode=0755,uid=101,gid=101 \
    --env APP_DOMAIN=app.example.com \
    --env 'NGINX_ENVSUBST_FILTER=^(APP_DOMAIN)$' \
    --volume "$certificate_path:/etc/nginx/tls/fullchain.pem:ro" \
    --volume "$private_key_path:/etc/nginx/tls/privkey.pem:ro" \
    wechat-layout-production-test/nginx:production-template-test \
    nginx -t

  docker run \
    --rm \
    --entrypoint node \
    wechat-layout-production-test/database-migrate:production-template-test \
    -e "const fs=require('node:fs');if(!fs.existsSync('dist/cli/migrate.js'))process.exit(1)"
  docker run \
    --rm \
    --entrypoint node \
    wechat-layout-production-test/web:production-template-test \
    -e "const fs=require('node:fs');if(!fs.existsSync('.next/BUILD_ID'))process.exit(1)"
  echo "生产镜像全部构建通过。"
fi
