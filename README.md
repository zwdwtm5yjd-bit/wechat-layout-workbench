# 公众号智能视觉排版工具

面向定稿文章的云端智能视觉排版工作台。

## 当前开发状态

当前已完成 `S0-ARCH-001 Monorepo 初始化`、`S0-ARCH-002 Docker 开发环境`、
`S0-ARCH-003 配置管理`、`S0-API-001 NestJS 基础框架` 和
`S0-WEB-001 Next.js 基础框架`：

- pnpm Workspace 与 Turborepo；
- Next.js Web 空骨架；
- NestJS API 基础框架；
- Node.js Worker 与 Scheduler 空骨架；
- Python DOCX Worker 服务占位；
- 共享包边界；
- TypeScript、ESLint、Prettier 与 Vitest 基线；
- public / server 分层配置入口与 Zod 启动校验；
- 开发、测试、生产三套配置策略与示例；
- Secret 默认脱敏与浏览器打包隔离；
- `/api/v1` 版本前缀、统一响应与全局异常格式；
- Request ID、Trace ID 与脱敏结构化请求日志；
- class-validator DTO / Zod DTO 双校验管道；
- `/health/live`、`/health/ready` 与可扩展就绪探针；
- 开发环境 Swagger UI 与持续可生成的 OpenAPI JSON；
- Tailwind CSS 系统 UI 变量和 Radix UI 无障碍交互基础；
- TanStack Query 服务端状态 Provider 与 Zustand 本地 UI 状态；
- 登录外壳、响应式空工作台和 224 / 72px 可折叠导航；
- Toast、全局命令面板、应用错误边界与 404 恢复页面；
- Session Cookie 乐观路由预检和 OpenAPI 类型安全 Client 生成流程；
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
# 替换 .env.local 中全部 CHANGE_ME
pnpm dev
```

默认地址：

- Web：`http://localhost:3000`；
- API：`http://localhost:3001`。

API 基础端点：

- 存活检查：`http://localhost:3001/health/live`；
- 就绪检查：`http://localhost:3001/health/ready`；
- Swagger UI（非生产）：`http://localhost:3001/api/docs`；
- OpenAPI JSON：`http://localhost:3001/api/openapi.json`。

Web 基础页面：

- 登录页：`http://localhost:3000/login`；
- 空工作台：`http://localhost:3000/workspace`。

缺少数据库、Redis、对象存储或安全密钥时，API、Worker、Scheduler 会在启动前
给出具体变量名并退出。当前登录页不会提交账号信息；真实登录、Session 校验和 CSRF
将在 `S1-AUTH-001` 实现。工作台路由当前只按 Session Cookie 是否存在进行无数据访问的
乐观预检，不作为服务端授权依据。

## Docker 开发环境

启动 Docker Desktop 或 Colima 后执行：

```bash
pnpm docker:dev
```

首次运行会自动生成权限为 `600` 的 `.env.docker`，其中的本地密码和应用密钥不会提交到 Git；
已有文件会只补齐新增密钥，不会轮换现有凭据。
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

`pnpm docker:smoke` 会验证 PostgreSQL、Redis、MinIO、API live / ready、OpenAPI、
登录页、空工作台和乐观路由保护，并通过重启 PostgreSQL、Redis、MinIO 检查命名卷的
数据持久性。探针数据会在测试结束时清理；MinIO 的 `healthcheck.txt` 会保留用于后续检查。

## 根级命令

```bash
pnpm dev
pnpm docker:dev
pnpm docker:smoke
pnpm docker:down
pnpm api:generate
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

API 启动后执行 `pnpm api:generate`，会读取 `/api/openapi.json` 并刷新 Web 使用的
OpenAPI 类型。生成文件不可手工编辑。

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

- `.env.example`、`.env.test.example`、`.env.production.example` 只提供变量结构和占位值；
- `.env`、`.env.local`、`.env.test`、`.env.production` 均被 Git 忽略；
- 配置按 `.env` → `.env.<环境>` → 本机覆盖 → 进程环境变量的顺序加载，进程变量优先级最高；
- 生产构建与运行必须显式设置 `APP_ENV=production`，并使用 HTTPS 公开地址；
- `@wechat-layout/config` 默认入口只导出公开配置，服务端必须显式使用 `/server` 入口；
- 数据库密码、Session 密钥、对象存储密钥和微信凭据不得写入代码、文档、前端或日志；
- 服务端 Secret 在字符串化、JSON 序列化和 Node.js 检查输出中默认显示为 `[REDACTED]`。

## 下一步

`S0-WEB-001` 验收通过后，开发总指令指定的下一任务是
`S0-DB-001 数据库初始化`。
完整设计依据见 [docs](./docs/)。
