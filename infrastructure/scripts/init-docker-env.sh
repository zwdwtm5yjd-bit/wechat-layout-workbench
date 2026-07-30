#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
env_file="$project_root/.env.docker"

if [[ -f "$env_file" ]]; then
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "无法生成本地开发密钥：未找到 openssl。" >&2
  exit 1
fi

umask 077
temp_file="$(mktemp "$project_root/.env.docker.tmp.XXXXXX")"
trap 'rm -f "$temp_file"' EXIT

postgres_password="$(openssl rand -hex 24)"
redis_password="$(openssl rand -hex 24)"
minio_password="$(openssl rand -hex 24)"

{
  echo "COMPOSE_PROJECT_NAME=wechat-layout"
  echo
  echo "WEB_PORT=3000"
  echo "API_PORT=3001"
  echo "POSTGRES_PORT=5432"
  echo "REDIS_PORT=6379"
  echo "MINIO_API_PORT=9000"
  echo "MINIO_CONSOLE_PORT=9001"
  echo "MAILPIT_SMTP_PORT=1025"
  echo "MAILPIT_UI_PORT=8025"
  echo
  echo "POSTGRES_DB=wechat_layout"
  echo "POSTGRES_USER=wechat_layout"
  echo "POSTGRES_PASSWORD=$postgres_password"
  echo
  echo "REDIS_PASSWORD=$redis_password"
  echo
  echo "MINIO_ROOT_USER=wechat_layout"
  echo "MINIO_ROOT_PASSWORD=$minio_password"
  echo "MINIO_BUCKET=wechat-layout-dev"
} >"$temp_file"

mv "$temp_file" "$env_file"
trap - EXIT

echo "已生成仅供本机使用的 .env.docker（权限 600）。"
