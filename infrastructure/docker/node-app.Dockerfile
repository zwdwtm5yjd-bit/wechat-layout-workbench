# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.0
FROM node:${NODE_VERSION}-bookworm-slim AS workspace

ENV CI=true \
    NODE_ENV=development

RUN corepack enable \
    && corepack prepare pnpm@10.33.0 --activate \
    && install -d -o node -g node /workspace

WORKDIR /workspace

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --chown=node:node turbo.json tsconfig.base.json tsconfig.package.json ./
COPY --chown=node:node eslint.config.mjs prettier.config.mjs vitest.config.ts ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages

USER node

RUN pnpm install --frozen-lockfile \
    && pnpm --filter @wechat-layout/config build

CMD ["pnpm", "dev"]
