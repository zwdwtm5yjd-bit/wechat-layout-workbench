# 公众号智能视觉排版工具

面向定稿文章的云端智能视觉排版工作台。

## 当前开发状态

当前已完成 `S0-ARCH-001 Monorepo 初始化`、`S0-ARCH-002 Docker 开发环境`、
`S0-ARCH-003 配置管理`、`S0-API-001 NestJS 基础框架`、
`S0-WEB-001 Next.js 基础框架`、`S0-DB-001 数据库基础 Schema` 和
`S1-EDITOR-001 文档 Schema V1`、`S1-AUTH-001 登录与会话`、
`S1-ARTICLE-001 文章 CRUD`、`S1-DOC-001 文档保存与乐观锁`：

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
- 服务健康检查、命名数据卷与持久化验收脚本；
- Drizzle ORM、Postgres.js 数据库连接和应用生成 UUIDv7；
- `auth`、`content`、`operations`、`audit` 基础表及 7 个业务 Schema；
- SQL 迁移、迁移互斥锁、结构校验和 API 数据库就绪探针；
- 可重复执行的禁用 Owner 开发种子及测试库回滚/重迁移验收；
- `doc`、基础文本、列表、图片、语义卡片、品牌页脚和 SVG 占位共 14 种文档节点；
- bold、italic、underline、strike、颜色、链接和字号共 8 种受控 Marks；
- Document Schema V1 TypeScript 类型、JSON Schema 2020-12 和 AJV 运行时校验；
- Block ID 全文唯一校验、Source Block ID 稳定性检查、JSON 往返和版本迁移注册表。
- 邮箱/用户名登录、Argon2id 密码哈希与通用错误响应；
- PostgreSQL 权威会话、Redis 登录限流和随机 Session ID 的 HMAC 存储；
- HttpOnly Session Cookie、生产 Secure、SameSite=Lax 与会话绑定的双提交 CSRF；
- 当前用户、退出登录、指定会话撤销与即时失效；
- 登录成功/失败、退出和撤销的审计事件，以及不记录请求正文的密码日志边界；
- 可重复执行的 Owner 凭据初始化命令、真实登录页面和工作台会话校验；
- Owner 隔离的文章新建、列表、详情、元数据更新、复制、归档、回收站与恢复；
- 文章状态流转、状态历史、审计日志和基础搜索筛选；
- 文章创建/复制时事务化生成独立 Document Schema V1 文档；
- 响应式文章工作台、状态标签页、搜索、创建与行级操作。
- Owner 隔离的权威文档读取与保存，以及严格的 Document Schema V1 身份校验；
- 基于 `documentVersion` 的原子乐观锁、409 冲突详情和事务 ID 幂等重放；
- 文档版本、内容哈希、文章统计与摘要审计日志的事务化更新；
- IndexedDB 本地草稿、断网恢复重试、刷新后已提交事务识别与冲突保留；
- 已保存、保存中、已保存到本地、保存失败和版本冲突五态 UI。

本阶段尚未实现 Tiptap 编辑器核心、文档快照、主题、组件渲染、SVG 执行、微信连接或
微信草稿同步。

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
pnpm db:migrate
pnpm db:seed
read -s BOOTSTRAP_OWNER_PASSWORD
export BOOTSTRAP_OWNER_PASSWORD
pnpm auth:bootstrap-owner
unset BOOTSTRAP_OWNER_PASSWORD
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

认证端点：

- 获取 CSRF Token：`GET /api/v1/auth/csrf`；
- 登录：`POST /api/v1/auth/login`；
- 当前用户：`GET /api/v1/auth/me`；
- 退出登录：`POST /api/v1/auth/logout`；
- 撤销会话：`DELETE /api/v1/auth/sessions/:sessionId`。

文章端点：

- 列表与新建：`GET|POST /api/v1/articles`；
- 详情与元数据更新：`GET|PATCH /api/v1/articles/:articleId`；
- 复制：`POST /api/v1/articles/:articleId/duplicate`；
- 归档与取消归档：`POST /api/v1/articles/:articleId/archive|unarchive`；
- 移入回收站与恢复：`DELETE /api/v1/articles/:articleId`、
  `POST /api/v1/articles/:articleId/restore`；
- 状态历史：`GET /api/v1/articles/:articleId/status-history`。
- 当前文档：`GET /api/v1/articles/:articleId/document`；
- 乐观锁保存：`PUT /api/v1/articles/:articleId/document`。

Web 基础页面：

- 登录页：`http://localhost:3000/login`；
- 工作台首页：`http://localhost:3000/workspace`；
- 文章工作台：`http://localhost:3000/workspace/articles`；
- 文档会话：`http://localhost:3000/workspace/articles/:articleId`。

缺少数据库、Redis、对象存储或安全密钥时，API、Worker、Scheduler 会在启动前
给出具体变量名并退出。登录页通过认证 API 建立 HttpOnly 会话；工作台先做 Session Cookie
乐观路由预检，进入页面后仍会请求 `/api/v1/auth/me` 验证数据库中的权威会话。前端不在
Local Storage 保存认证 Token。

## Docker 开发环境

启动 Docker Desktop 或 Colima 后执行：

```bash
pnpm docker:dev
```

首次运行会自动生成权限为 `600` 的 `.env.docker`，其中的本地密码和应用密钥不会提交到 Git；
已有文件会只补齐新增密钥，不会轮换现有凭据。
该命令会先执行一次性数据库迁移，再启动全部开发服务，等待健康检查通过后输出容器状态。

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
数据库表/外键/索引、登录页、文章工作台和乐观路由保护，并在真实数据库中完成文章
新建、发布、复制、回收站、恢复、状态历史以及两客户端并发文档保存的 200/409
乐观锁验收；还会通过重启 PostgreSQL、Redis、MinIO 检查命名卷的数据持久性。探针数据
会在测试结束时清理；MinIO 的
`healthcheck.txt` 会保留用于后续检查。

数据库命令：

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:seed
pnpm db:test:migrations
```

`db:generate` 只生成可审查的 SQL，不直接修改数据库；已提交的历史迁移不得改写。
`db:seed` 仅用于开发/测试，默认创建一个不可登录的禁用 Owner。设置至少 12 个字符的
`BOOTSTRAP_OWNER_PASSWORD` 后执行 `pnpm auth:bootstrap-owner`，会用 Argon2id 创建或
轮换 Owner 凭据并启用账号；密码不会写入日志。`db:test:migrations` 使用一次性
`wechat_layout_migration_test` 数据库验证空库迁移、幂等种子、回滚和重迁移，并在结束后清理。

## 根级命令

```bash
pnpm dev
pnpm docker:dev
pnpm docker:smoke
pnpm docker:down
pnpm api:generate
pnpm db:migrate
pnpm db:check
pnpm db:seed
pnpm db:test:migrations
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
  database/                    Drizzle Schema、连接、迁移与种子
  design-tokens/
  document-schema/             Document Schema V1、校验、迁移与 Fixture
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

`S1-DOC-001` 验收通过后，开发总指令指定的下一任务是
`S1-VERSION-001 快照系统`。
完整设计依据见 [docs](./docs/)。
