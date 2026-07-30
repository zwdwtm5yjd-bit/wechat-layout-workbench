#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
env_file="$project_root/.env.docker"
compose_file="$project_root/infrastructure/compose/docker-compose.yml"
dev_compose_file="$project_root/infrastructure/compose/docker-compose.dev.yml"
action="${1:-up}"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 Docker。请先安装并启动 Docker Desktop，然后重试。" >&2
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

"$script_dir/init-docker-env.sh"

compose() {
  "${compose_command[@]}" \
    --env-file "$env_file" \
    --file "$compose_file" \
    --file "$dev_compose_file" \
    "$@"
}

case "$action" in
  up)
    compose up --build --detach --wait
    compose ps
    ;;
  down)
    compose down
    ;;
  logs)
    compose logs --follow --tail=200
    ;;
  ps)
    compose ps
    ;;
  config)
    compose config --quiet
    ;;
  smoke)
    "$script_dir/smoke-test.sh"
    ;;
  *)
    echo "未知操作：$action。可用操作：up、down、logs、ps、config、smoke。" >&2
    exit 2
    ;;
esac
