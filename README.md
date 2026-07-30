# 公众号智能视觉排版工具

面向定稿文章的云端智能视觉排版工作台。

## 当前开发状态

当前已完成 `S0-ARCH-001 Monorepo 初始化`，并进入
`S0-ARCH-002 Docker 开发环境`：

- pnpm Workspace 与 Turborepo；
- Next.js Web 空骨架；
- NestJS API 空骨架；
- Node.js Worker 与 Scheduler 空骨架；
- Python DOCX Worker 服务占位；
- 共享包边界；
- TypeScript、ESLint、Prettier 与 Vitest 基线；
- 非敏感环境变量 Schema 与示例文件。
- PostgreSQL、Redis、MinIO、Mailpit 本地开发服务；
- Web、API、Worker、Scheduler 容器化开发进程；
- 服务健康检查、命名数据卷与持久化验收脚本。

本阶段没有实现文章业务、数据库业务表、Tiptap 节点、主题、组件、SVG、微信连接或草稿同步。

## 环境要求

- Node.js `24.13.0`；
- pnpm `10.33.0`；
- Python `3.14.2`；
- Docker Desktop，或 Docker CLI + Colima（均需 Compose v2）。

## 快速开始

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

默认地址：

- Web：`http://localhost:3000`；
- API：`http://localhost:3001`。

当前 API 仅启动 NestJS 应用，不提前提供健康检查或业务路由。

## Docker 开发环境

启动 Docker Desktop 或 Colima 后执行：

```bash
pnpm docker:dev
```

首次运行会自动生成权限为 `600` 的 `.env.docker`，其中的本地密码不会提交到 Git。
该命令构建并启动全部开发服务，等待健康检查通过后输出容器状态。

默认端口：

- Web：`3000`；
- API：`3001`；
- PostgreSQL：`5432`；
- Redis：`6379`；
- MinIO API / Console：`9000` / `9001`；
- Mailpit SMTP / Web：`1025` / `8025`。

常用命令：

```bash
pnpm docker:ps
pnpm docker:logs
pnpm docker:smoke
pnpm docker:down
```

`pnpm docker:smoke` 会验证 PostgreSQL、Redis、MinIO、API 健康状态，并通过重启
PostgreSQL、Redis、MinIO 检查命名卷的数据持久性。探针数据会在测试结束时清理；
MinIO 的 `healthcheck.txt` 会保留用于后续检查。

## 根级命令

```bash
pnpm dev
pnpm docker:dev
pnpm docker:smoke
pnpm docker:down
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
pnpm format:check
```

单独启动应用：

```bash
pnpm --filter @wechat-layout/web dev
pnpm --filter @wechat-layout/api dev
pnpm --filter @wechat-layout/worker dev
pnpm --filter @wechat-layout/scheduler dev
```

Python 服务占位验证：

```bash
PYTHONPATH=services/docx-worker-python/src python3 -m docx_worker
```

## 目录

```text
apps/
  web/                       Next.js Web
  api/                       NestJS API
  worker/                    异步任务进程占位
  scheduler/                 调度进程占位
services/
  docx-worker-python/        Python DOCX Worker 占位
packages/
  api-contracts/
  component-registry/
  config/
  design-tokens/
  document-schema/
  editor-core/
  storage-adapter/
  svg-protocol/
  test-fixtures/
  wechat-connector/
  wechat-renderer/
infrastructure/
  compose/
  docker/
  monitoring/
  nginx/
  scripts/
docs/                        00—16 号开发文件与开发记录
```

## 配置与安全

- `.env.example` 只包含公开的本地默认值；
- `.env`、`.env.local`、`.env.test`、`.env.production` 均被 Git 忽略；
- 数据库密码、Session 密钥、对象存储密钥和微信凭据不得写入代码、文档、前端或日志；
- 完整配置管理将在 `S0-ARCH-003` 中实现。

## 下一步

`S0-ARCH-002` 验收通过后，文档指定的下一任务是 `S0-ARCH-003 配置与密钥管理`。
完整设计依据见 [docs](./docs/)。
