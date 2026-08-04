#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
env_file="${PRODUCTION_ENV_FILE:-$project_root/.env.production}"
credentials_file="${OWNER_CREDENTIALS_FILE:-$project_root/.env.owner-credentials}"
production_compose="$project_root/infrastructure/compose/docker-compose.prod.yml"
host_override="$project_root/infrastructure/compose/docker-compose.host-lean.yml"
action="${1:-config}"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "精简生产部署需要 Docker Engine 与 Compose v2。" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "缺少生产配置 $env_file。" >&2
  exit 1
fi

compose() {
  docker compose \
    --env-file "$env_file" \
    --file "$production_compose" \
    --file "$host_override" \
    "$@"
}

validate() {
  sudo -n env "PATH=$PATH" node --import tsx "$script_dir/validate-production-config.ts" --env-file "$env_file"
  compose --profile migration --profile storage-init config --quiet
}

health() {
  local app_domain
  app_domain="$(node -e "const {readFileSync}=require('node:fs');const {parseEnv}=require('node:util');process.stdout.write(parseEnv(readFileSync(process.argv[1],'utf8')).APP_DOMAIN||'')" "$env_file")"
  curl --fail --silent --show-error --max-time 15 "https://$app_domain/health/ready" >/dev/null
  echo "精简生产健康检查通过：https://$app_domain/health/ready"
}

case "$action" in
  config)
    validate
    ;;
  build)
    validate
    for service in web api worker scheduler database-migrate webpage-browser; do
      compose --profile migration build "$service"
    done
    ;;
  deploy)
    validate
    compose up --detach --wait --no-build postgres redis minio
    compose --profile storage-init run --rm minio-init
    compose --profile migration run --rm --no-deps database-migrate
    compose up --detach --wait --no-build web api webpage-browser worker scheduler
    health
    compose ps
    ;;
  bootstrap-owner)
    validate
    if [[ ! -f "$credentials_file" ]]; then
      echo "缺少 Owner 凭据文件 $credentials_file。" >&2
      exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    source "$credentials_file"
    set +a
    if [[ -z "${BOOTSTRAP_OWNER_PASSWORD:-}" || -z "${SEED_OWNER_EMAIL:-}" ]]; then
      echo "BOOTSTRAP_OWNER_PASSWORD 与 SEED_OWNER_EMAIL 均为必填。" >&2
      exit 1
    fi
    compose run --rm --no-deps \
      --env BOOTSTRAP_OWNER_PASSWORD \
      --env SEED_OWNER_EMAIL \
      --env SEED_OWNER_DISPLAY_NAME \
      api node dist/auth/cli/bootstrap-owner.js
    ;;
  health)
    validate
    health
    ;;
  ps)
    compose ps
    ;;
  logs)
    compose logs --follow --tail=200 web api webpage-browser worker scheduler postgres redis minio
    ;;
  down)
    compose down
    ;;
  *)
    echo "未知操作：$action。可用操作：config、build、deploy、bootstrap-owner、health、ps、logs、down。" >&2
    exit 2
    ;;
esac
