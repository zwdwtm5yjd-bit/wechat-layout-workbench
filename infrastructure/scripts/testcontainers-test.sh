#!/usr/bin/env bash

set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Testcontainers 需要可用的 Docker 运行时。" >&2
  exit 1
fi

docker_host_uri="${DOCKER_HOST:-}"
if [[ -z "$docker_host_uri" ]]; then
  docker_host_uri="$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
fi

if [[ -n "$docker_host_uri" ]]; then
  export DOCKER_HOST="$docker_host_uri"
fi

if [[ "$docker_host_uri" == unix://* && "$docker_host_uri" != "unix:///var/run/docker.sock" ]]; then
  export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE="${TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE:-/var/run/docker.sock}"
fi

pnpm exec vitest run --config vitest.integration.config.ts
