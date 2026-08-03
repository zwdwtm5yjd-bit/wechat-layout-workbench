# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f

FROM ${NODE_IMAGE} AS source

ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable \
    && corepack prepare pnpm@10.33.0 --activate \
    && install -d -o node -g node /workspace /pnpm

WORKDIR /workspace

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --chown=node:node turbo.json tsconfig.base.json tsconfig.package.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages

FROM source AS dependencies

ENV NODE_ENV=development

USER node

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED=false
ARG NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED=false

ENV APP_ENV=production \
    NODE_ENV=production \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED=${NEXT_PUBLIC_FEATURE_WECHAT_SYNC_ENABLED} \
    NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED=${NEXT_PUBLIC_FEATURE_REMOTE_COMPONENTS_ENABLED}

RUN test -n "$NEXT_PUBLIC_APP_NAME" \
    && test -n "$NEXT_PUBLIC_APP_URL" \
    && test -n "$NEXT_PUBLIC_API_BASE_URL" \
    && pnpm turbo run build

FROM source AS production-dependencies

ENV NODE_ENV=production

USER node

RUN pnpm install --prod --frozen-lockfile

FROM ${NODE_IMAGE} AS node-runtime

ENV APP_ENV=production \
    NODE_ENV=production

WORKDIR /workspace

COPY --from=production-dependencies --chown=node:node /workspace /workspace

COPY --from=builder --chown=node:node /workspace/apps/api/dist /workspace/apps/api/dist
COPY --from=builder --chown=node:node /workspace/apps/worker/dist /workspace/apps/worker/dist
COPY --from=builder --chown=node:node /workspace/apps/scheduler/dist /workspace/apps/scheduler/dist
COPY --from=builder --chown=node:node /workspace/apps/web/.next /workspace/apps/web/.next

COPY --from=builder --chown=node:node /workspace/packages/api-contracts/dist /workspace/packages/api-contracts/dist
COPY --from=builder --chown=node:node /workspace/packages/component-registry/dist /workspace/packages/component-registry/dist
COPY --from=builder --chown=node:node /workspace/packages/config/dist /workspace/packages/config/dist
COPY --from=builder --chown=node:node /workspace/packages/database/dist /workspace/packages/database/dist
COPY --from=builder --chown=node:node /workspace/packages/database/migrations /workspace/packages/database/migrations
COPY --from=builder --chown=node:node /workspace/packages/design-tokens/dist /workspace/packages/design-tokens/dist
COPY --from=builder --chown=node:node /workspace/packages/document-schema/dist /workspace/packages/document-schema/dist
COPY --from=builder --chown=node:node /workspace/packages/editor-core/dist /workspace/packages/editor-core/dist
COPY --from=builder --chown=node:node /workspace/packages/job-runtime/dist /workspace/packages/job-runtime/dist
COPY --from=builder --chown=node:node /workspace/packages/storage-adapter/dist /workspace/packages/storage-adapter/dist
COPY --from=builder --chown=node:node /workspace/packages/svg-protocol/dist /workspace/packages/svg-protocol/dist
COPY --from=builder --chown=node:node /workspace/packages/test-fixtures/dist /workspace/packages/test-fixtures/dist
COPY --from=builder --chown=node:node /workspace/packages/wechat-connector/dist /workspace/packages/wechat-connector/dist
COPY --from=builder --chown=node:node /workspace/packages/wechat-renderer/dist /workspace/packages/wechat-renderer/dist

USER node

FROM node-runtime AS api

WORKDIR /workspace/apps/api

CMD ["node", "dist/main.js"]

FROM node-runtime AS worker

WORKDIR /workspace/apps/worker

CMD ["node", "dist/main.js"]

FROM node-runtime AS scheduler

WORKDIR /workspace/apps/scheduler

CMD ["node", "dist/main.js"]

FROM node-runtime AS database-migrate

WORKDIR /workspace/packages/database

CMD ["node", "dist/cli/migrate.js"]

FROM node-runtime AS web

ENV HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /workspace/apps/web

CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
