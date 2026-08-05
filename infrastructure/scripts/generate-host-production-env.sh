#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
env_file="${PRODUCTION_ENV_FILE:-$project_root/.env.production}"
credentials_file="${OWNER_CREDENTIALS_FILE:-$project_root/.env.owner-credentials}"
release_tag="${1:-$(git -C "$project_root" rev-parse --short=12 HEAD)}"
owner_email="${OWNER_EMAIL:-owner@ericmm.com}"

if [[ -e "$env_file" || -e "$credentials_file" ]]; then
  echo "拒绝覆盖已有生产配置或 Owner 凭据文件。" >&2
  exit 1
fi

random_secret() {
  openssl rand -hex 32
}

postgres_password="$(random_secret)"
redis_password="$(random_secret)"
s3_access_key_id="wechatlayout$(openssl rand -hex 6)"
s3_secret_access_key="$(random_secret)"
session_secret="$(random_secret)"
csrf_secret="$(random_secret)"
field_encryption_key="$(random_secret)"
asset_signing_key="$(random_secret)"
backup_encryption_key="$(random_secret)"
metrics_bearer_token="$(random_secret)"
grafana_admin_password="$(random_secret)"
owner_password="$(openssl rand -base64 24 | tr -d '\n')"

umask 077
{
  echo "APP_ENV=production"
  echo "NODE_ENV=production"
  echo "LOG_LEVEL=warn"
  echo
  echo "COMPOSE_PROJECT_NAME=wechat-layout-production"
  echo "APP_DOMAIN=visual.ericmm.com"
  echo "IMAGE_REPOSITORY=wechat-layout-local"
  echo "RELEASE_TAG=$release_tag"
  echo "TLS_CERTIFICATE_PATH=/etc/letsencrypt/live/visual.ericmm.com/fullchain.pem"
  echo "TLS_PRIVATE_KEY_PATH=/etc/letsencrypt/live/visual.ericmm.com/privkey.pem"
  echo
  echo "NEXT_PUBLIC_APP_NAME=公众号智能视觉排版工具"
  echo "NEXT_PUBLIC_APP_URL=https://visual.ericmm.com"
  echo "NEXT_PUBLIC_API_BASE_URL=https://visual.ericmm.com"
  echo "NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED=false"
  echo "NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED=false"
  echo
  echo "PUBLIC_WEB_URL=https://visual.ericmm.com"
  echo "WEB_PORT=3000"
  echo "API_PORT=3001"
  echo "WORKER_CONCURRENCY=1"
  echo "WEBPAGE_BROWSER_ENDPOINT=http://webpage-browser:3010"
  echo "WEBPAGE_FETCH_TIMEOUT_MS=15000"
  echo "WEBPAGE_BROWSER_TIMEOUT_MS=30000"
  echo "WEBPAGE_MAX_REDIRECTS=5"
  echo "MAX_WEBPAGE_HTML_BYTES=5242880"
  echo "SCHEDULER_INTERVAL_SECONDS=60"
  echo
  echo "METRICS_BEARER_TOKEN=$metrics_bearer_token"
  echo "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4318/v1/traces"
  echo "LOKI_PUSH_URL=http://loki:3100/loki/api/v1/push"
  echo "GRAFANA_ADMIN_PASSWORD=$grafana_admin_password"
  echo "GRAFANA_HOST_PORT=3202"
  echo "ALERTMANAGER_WEBHOOK_URL=https://visual.ericmm.com/hooks/observability"
  echo
  echo "POSTGRES_DB=wechat_layout"
  echo "POSTGRES_USER=wechat_app"
  echo "POSTGRES_PASSWORD=$postgres_password"
  echo "DATABASE_URL=postgresql://wechat_app:$postgres_password@postgres:5432/wechat_layout"
  echo
  echo "REDIS_PASSWORD=$redis_password"
  echo "REDIS_URL=redis://:$redis_password@redis:6379/0"
  echo
  echo "S3_ENDPOINT=https://assets.ericmm.com"
  echo "S3_PUBLIC_ENDPOINT=https://assets.ericmm.com"
  echo "S3_ADDRESSING_STYLE=path"
  echo "S3_PUBLIC_ADDRESSING_STYLE=path"
  echo "S3_METADATA_HEADER_PREFIX=x-amz-meta-"
  echo "S3_REGION=us-east-1"
  echo "S3_BUCKET=wechat-layout-assets"
  echo "S3_ACCESS_KEY_ID=$s3_access_key_id"
  echo "S3_SECRET_ACCESS_KEY=$s3_secret_access_key"
  echo
  echo "SMTP_HOST=smtp.invalid"
  echo "SMTP_PORT=465"
  echo
  echo "SESSION_SECRET=$session_secret"
  echo "CSRF_SECRET=$csrf_secret"
  echo "FIELD_ENCRYPTION_KEY=$field_encryption_key"
  echo "ASSET_SIGNING_KEY=$asset_signing_key"
  echo "BACKUP_ENCRYPTION_KEY=$backup_encryption_key"
  echo
  echo "BACKUP_DIRECTORY=/opt/wechat-layout/backups"
  echo "BACKUP_KEY_VERSION=backup-key-v1"
  echo "BACKUP_LOCAL_RETENTION_COUNT=3"
  echo "BACKUP_REMOTE_RETENTION_DAYS=30"
  echo "BACKUP_RESTORE_MIN_ARTICLES=5"
  echo "BACKUP_S3_ENDPOINT=https://assets.ericmm.com"
  echo "BACKUP_S3_ADDRESSING_STYLE=path"
  echo "BACKUP_S3_METADATA_HEADER_PREFIX=x-amz-meta-"
  echo "BACKUP_S3_REGION=us-east-1"
  echo "BACKUP_S3_BUCKET=wechat-layout-backups"
  echo "BACKUP_S3_PREFIX=production/postgresql"
  echo "BACKUP_S3_ACCESS_KEY_ID=$s3_access_key_id"
  echo "BACKUP_S3_SECRET_ACCESS_KEY=$s3_secret_access_key"
  echo "BACKUP_ALERT_WEBHOOK_URL=https://visual.ericmm.com/hooks/database-backup"
  echo
  echo "FEATURE_WECHAT_SYNC_ENABLED=false"
  echo "FEATURE_REMOTE_COMPONENTS_ENABLED=false"
  echo "MAX_JSON_BODY_BYTES=2097152"
  echo "MAX_DOCX_FILE_BYTES=52428800"
  echo "MAX_IMAGE_FILE_BYTES=20971520"
  echo "MAX_BRAND_PACKAGE_BYTES=104857600"
} >"$env_file"

{
  echo "SEED_OWNER_EMAIL=$owner_email"
  echo "SEED_OWNER_DISPLAY_NAME=Owner"
  echo "BOOTSTRAP_OWNER_PASSWORD=$owner_password"
} >"$credentials_file"

chmod 600 "$env_file" "$credentials_file"
echo "已生成生产配置：$env_file"
echo "已生成 Owner 凭据：$credentials_file"
