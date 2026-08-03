#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
env_file="${PRODUCTION_ENV_FILE:-$project_root/.env.production}"
compose_file="$project_root/infrastructure/compose/docker-compose.prod.yml"
action="${1:-config}"
if [[ $# -gt 0 ]]; then
  shift
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 Docker。生产部署需要 Docker Engine 与 Compose v2。" >&2
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

if [[ ! -f "$env_file" ]]; then
  echo "缺少生产配置 $env_file。请从 .env.production.example 创建并通过 Secret 管理填写。" >&2
  exit 1
fi

compose() {
  "${compose_command[@]}" \
    --env-file "$env_file" \
    --file "$compose_file" \
    "$@"
}

validate() {
  node --import tsx "$script_dir/validate-production-config.ts" --env-file "$env_file"
  compose --profile migration config --quiet
}

environment_value() {
  node -e \
    "const {readFileSync}=require('node:fs');const {parseEnv}=require('node:util');process.stdout.write(parseEnv(readFileSync(process.argv[1],'utf8'))[process.argv[2]]||'')" \
    "$env_file" \
    "$1"
}

health() {
  local app_domain
  app_domain="$(environment_value APP_DOMAIN)"
  local health_url="${PRODUCTION_HEALTHCHECK_URL:-https://$app_domain/health/ready}"
  curl --fail --silent --show-error --max-time 15 "$health_url" >/dev/null
  echo "生产健康检查通过：$health_url"
}

observability_health() {
  compose exec -T api node -e \
    "const targets=['http://prometheus:9090/-/healthy','http://alertmanager:9093/-/healthy','http://grafana:3000/api/health','http://loki:3100/ready','http://tempo:3200/ready','http://otel-collector:8888/metrics','http://node-exporter:9100/metrics'];Promise.all(targets.map(async(url)=>{const response=await fetch(url);if(!response.ok)throw new Error(url+' returned '+response.status)})).catch(error=>{console.error(error.message);process.exit(1)})"
  echo "Prometheus、Alertmanager、Grafana、Loki、Tempo、OpenTelemetry Collector 与 Node Exporter 健康检查通过。"
}

send_synthetic_alert() {
  compose exec -T api node -e \
    "const now=new Date();const end=new Date(now.getTime()+120000);fetch('http://alertmanager:9093/api/v2/alerts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify([{labels:{alertname:'WechatLayoutSyntheticAlert',severity:'warning',service:'operations-test'},annotations:{summary:'公众号智能视觉排版监控链路测试',description:'这是由 docker:prod:alert-test 主动发送的测试告警。'},startsAt:now.toISOString(),endsAt:end.toISOString(),generatorURL:'https://prometheus.io/'}])}).then(response=>{if(!response.ok)throw new Error('Alertmanager returned '+response.status)}).catch(error=>{console.error(error.message);process.exit(1)})"
  echo "测试告警已提交至 Alertmanager；请在告警接收端确认 firing 与后续 resolved 通知。"
}

case "$action" in
  config)
    validate
    ;;
  build)
    validate
    compose build --pull nginx
    for service in web api worker scheduler database-migrate; do
      compose --profile migration build "$service"
    done
    ;;
  backup)
    validate
    node --import tsx "$script_dir/database-backup.ts" create --env-file "$env_file" "$@"
    ;;
  backup-verify)
    validate
    node --import tsx "$script_dir/database-backup.ts" verify --env-file "$env_file" "$@"
    ;;
  deploy)
    validate
    if [[ "${CONFIRM_PRODUCTION_BACKUP:-}" != "1" ]]; then
      echo "拒绝部署：请先完成数据库备份，再设置 CONFIRM_PRODUCTION_BACKUP=1。" >&2
      exit 1
    fi
    compose up --detach --wait --no-build postgres redis
    compose up --detach --wait --no-build alertmanager loki tempo otel-collector node-exporter
    compose --profile migration run --rm --no-deps database-migrate
    compose up --detach --wait --no-build web api worker scheduler nginx
    compose up --detach --wait --no-build prometheus grafana
    health
    observability_health
    compose ps
    ;;
  rollback)
    validate
    previous_release_tag="${PREVIOUS_RELEASE_TAG:-}"
    if [[ -z "$previous_release_tag" ]]; then
      echo "拒绝回滚：必须设置 PREVIOUS_RELEASE_TAG。" >&2
      exit 1
    fi
    if [[ "${CONFIRM_DATABASE_COMPATIBLE_ROLLBACK:-}" != "1" ]]; then
      echo "拒绝回滚：确认数据库向后兼容后设置 CONFIRM_DATABASE_COMPATIBLE_ROLLBACK=1。" >&2
      exit 1
    fi
    (
      export RELEASE_TAG="$previous_release_tag"
      compose up --detach --wait --no-build web api worker scheduler nginx
    )
    health
    compose ps
    ;;
  restore-drill)
    validate
    node --import tsx "$script_dir/database-backup.ts" restore-drill --env-file "$env_file" "$@"
    ;;
  health)
    validate
    health
    observability_health
    ;;
  alert-test)
    validate
    observability_health
    send_synthetic_alert
    ;;
  ps)
    compose ps
    ;;
  logs)
    compose logs --follow --tail=200 nginx web api worker scheduler prometheus alertmanager grafana loki tempo otel-collector node-exporter
    ;;
  down)
    compose down
    ;;
  *)
    echo "未知操作：$action。可用操作：config、build、backup、backup-verify、deploy、rollback、restore-drill、health、alert-test、ps、logs、down。" >&2
    exit 2
    ;;
esac
