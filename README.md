# 公众号智能视觉排版工具

面向定稿文章的云端智能视觉排版工作台。

## 当前开发状态

当前已完成 `S0-ARCH-001 Monorepo 初始化`、`S0-ARCH-002 Docker 开发环境`、
`S0-ARCH-003 配置管理`、`S0-API-001 NestJS 基础框架`、
`S0-WEB-001 Next.js 基础框架`、`S0-DB-001 数据库基础 Schema` 和
`S1-EDITOR-001 文档 Schema V1`、`S1-AUTH-001 登录与会话`、
`S1-ARTICLE-001 文章 CRUD`、`S1-DOC-001 文档保存与乐观锁` 和
`S1-VERSION-001 快照系统`、`S1-IMPORT-001 粘贴导入` 和
`S1-RESOURCE-001 基础资源服务`、`S1-EDITOR-002 Tiptap 编辑器核心` 和
`S1-EDITOR-003 原文锁定`、`S1-THEME-001 Token 引擎` 和
`S1-COMPONENT-001 组件注册中心`、`S1-RENDER-001 微信 HTML Renderer 核心` 和
`S1-COMPAT-001 兼容规则基础`、`S1-COPY-001 一键复制` 和
`S1-WEB-002 V0.1 页面`、`S1-TEST-001 V0.1 测试基线` 和
`S1-JOB-001 BullMQ 任务中心`、`S1-THEME-002 首批基础主题` 和
`S1-COMPONENT-002 首批基础组件`、`S2-OPS-001 生产运行制品`、
`S2-BACKUP-001 数据库备份恢复` 和 `S2-OPS-002 日志监控仓库制品`：

- pnpm Workspace 与 Turborepo；
- Next.js Web 空骨架；
- NestJS API 基础框架；
- BullMQ Node.js Worker 与 Scheduler 调度骨架；
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
- Block ID 全文唯一校验、Source Block ID 稳定性检查、JSON 往返和版本迁移注册表；
- 邮箱/用户名登录、Argon2id 密码哈希与通用错误响应；
- PostgreSQL 权威会话、Redis 登录限流和随机 Session ID 的 HMAC 存储；
- HttpOnly Session Cookie、生产 Secure、SameSite=Lax 与会话绑定的双提交 CSRF；
- 当前用户、退出登录、指定会话撤销与即时失效；
- 登录成功/失败、退出和撤销的审计事件，以及不记录请求正文的密码日志边界；
- 可重复执行的 Owner 凭据初始化命令、真实登录页面和工作台会话校验；
- Owner 隔离的文章新建、列表、详情、元数据更新、复制、归档、回收站与恢复；
- 文章状态流转、状态历史、审计日志和基础搜索筛选；
- 文章创建/复制时事务化生成独立 Document Schema V1 文档；
- 响应式文章工作台、状态标签页、搜索、创建与行级操作；
- Owner 隔离的权威文档读取与保存，以及严格的 Document Schema V1 身份校验；
- 基于 `documentVersion` 的原子乐观锁、409 冲突详情和事务 ID 幂等重放；
- 文档版本、内容哈希、文章统计与摘要审计日志的事务化更新；
- IndexedDB 本地草稿、断网恢复重试、刷新后已提交事务识别与冲突保留；
- 已保存、保存中、已保存到本地、保存失败和版本冲突五态 UI；
- Owner 隔离的手动快照、自动快照钩子、时间倒序版本列表和只读预览；
- 快照内固化 Document Schema V1、主题、品牌、资源清单与包版本清单；
- 恢复前安全快照、恢复后新版本、文档乐观锁和失败事务全量回滚；
- PostgreSQL 触发器保护快照不可更新、不可删除，复制文章前自动留存快照；
- 文档会话内的版本备注、版本预览、恢复确认和恢复后自动保存状态同步；
- Word / WPS、网页、微信公众号、Markdown、纯文本与 AI 工具剪贴板来源识别；
- 基于 HTML AST 的脚本、隐藏节点、危险链接与冗余样式清洗，原始 HTML 永不落库；
- 标题、段落、引用、列表、表格文本与外链图片引用提取，以及稳定 Source Block 追踪；
- 三种导入清洗模式、清洗统计与可操作的兼容警告；
- Owner 隔离的导入创建、刷新恢复和完整结构确认接口；
- 原文/识别结果双栏校对、逐块与批量角色调整、排除和重置；
- 导入确认的文档乐观锁、事务 ID 幂等重放、状态流转和原子 `after_import` 快照；
- Redis 短时上传会话、浏览器到 MinIO 的 SigV4 私有桶直传和完成确认；
- SHA-256、对象元数据、大小、ETag、文件魔数与 Sharp 真实图片解码的多层校验；
- PNG、JPEG、WebP、GIF 原图登记和 320px WebP 缩略图生成；
- 当前用户维度的内容去重、内容寻址对象 Key 和并发唯一约束兜底；
- 原图/缩略图短时签名访问、匿名访问拒绝和独立内外网对象存储 Endpoint；
- 文章、来源文档、头像与派生资源引用查询，以及事务化删除保护和 30 天软删除；
- PostgreSQL 资源元数据与审计、Redis 上传会话和对象存储三依赖就绪探针；
- Tiptap 3 编辑器核心与 Document Schema V1 的严格 JSON 双向适配；
- 文档结构、公众号画布和区块属性三栏编辑器，以及空文档可编辑启动块；
- 区块选中、Block Handle、插入、删除、深复制、上下移动和画布/结构树拖放；
- 加粗、斜体、下划线、删除线、标题层级、对齐与基础快捷键；
- ProseMirror History 撤销重做、唯一 Block ID 自动修复和标准事务来源；
- 编辑器变更到 IndexedDB 本地草稿、乐观锁自动保存和快照恢复后的画布刷新；
- 基于稳定 Block ID 的 Source Block 原文事务拦截，锁定时允许样式与整块移动；
- 显式局部解锁、保存后开放文字编辑、重新锁定全文和服务端二次校验；
- 原文哈希稳定性、持久化 Source Block 基线和文字、顺序、样式及设计组件差异报告；
- Token Schema V1，以及颜色、排印、间距、圆角、边框、阴影、图片、动效和兼容 Token；
- 系统、主题、品牌占位、组件、文章、节点和行内七层确定性优先级解析；
- Token 引用与循环检测、任意 CSS 拒绝、受控局部覆盖和微信安全模式强制降级；
- 深冻结解析结果、分层追踪和有界 LRU 缓存；
- “高级极简”和“现代政务红”两套官方不可变主题包，完整包含 Token、三级标题、正文、引用、
  图片、数据卡、分割线、文末、预览资产与安全模式元数据；
- 官方主题目录、详情和精确版本 API，以及编辑器内不落库试穿；
- 主题正式应用使用文档乐观锁、`before_theme_apply` 安全快照、审计日志和单事务持久化，原文
  内容保持不变；
- 正式微信渲染与复制从文章绑定的精确主题版本取 Token，避免编辑器预览和最终输出漂移；
- 声明式 Component Manifest、21 类组件编码、Slot Schema、Variant 和兼容等级；
- `componentId@version` 不可变精确引用、多版本共存、最新版本解析和分类/语义查询；
- Slot 必填、类型、长度、编辑器绑定和微信导出方式的插入前校验；
- 编辑器与微信 Renderer 共用 Manifest 的 Renderer Key，组件收藏保留显式占位接口；
- 注册组件的 Tiptap 插入命令、精确版本固化和可用/缺失状态 Node View；
- 缺失、未安装或停用组件的安全占位，以及原始文字保留。
- Document JSON 到微信 HTML 的服务端派生渲染，不依赖编辑器 DOM；
- 可冻结的 Node / Component Renderer 注册表，以及 Manifest 精确组件版本解析；
- 安全 HTML AST、标签/属性/CSS 白名单、文本转义和公网 HTTPS URL 清洗；
- 标准、安全和静态三种输出模式，以及 SVG 静态备用图基础降级；
- 全内联 CSS、确定性 HTML、输出 SHA-256、Renderer 版本和资源/组件清单；
- 渲染前后原文哈希校验，以及缺失资源、缺失组件和高风险样式的安全退化。
- 版本化微信兼容规则包，以及 Document JSON / Renderer HTML 双层检查；
- HTML 标签、属性、CSS、URL、图片、布局、组件和 SVG 静态降级规则；
- 0—100 兼容评分、严重/警告/建议分组、确定性 Issue ID 和 Block ID 定位；
- 严重问题阻止正式复制，以及不修改权威文档的安全自动修复预览。
- 正式复制由服务端从指定 `documentVersion` 的权威 JSON 重新渲染，不读取编辑器 DOM；
- `before_copy` 不可变快照、`render_outputs` 正式输出和 `copy_records` 浏览器结果记录；
- Copy Payload 绑定快照、Renderer、兼容规则和输出哈希，并使用 15 分钟短时有效期；
- 兼容报告随渲染输出持久化，严重问题不发放 Copy Payload；
- 生成与写剪贴板分成两次明确用户点击，避免依赖异步任务后的浏览器激活状态；
- Clipboard API 通过单个 `ClipboardItem` 同时写入 `text/html` 和 `text/plain`；
- HTTPS 安全上下文、用户激活、`ClipboardItem.supports("text/html")` 和权限拒绝运行时门禁；
- 富文本复制失败时展示经过 Renderer 清洗的受控手动复制区，并支持一键全选；
- 浏览器成功/失败回写、文章 `copied / copy_failed` 状态、状态历史和审计日志；
- 成功提示只声明“已写入系统剪贴板”，明确要求到微信公众号后台粘贴、预览和发布。
- 工作台最近文章接入真实列表数据，并覆盖加载、失败和空状态；
- 主题中心读取两套已安装官方主题及版本资产，编辑器可分别执行临时试穿和正式应用；
- 组件中心提供 29 个正式基础组件，目录、编辑器插入、快照依赖与微信 Renderer 共用同一份
  精确版本 Manifest；
- 设置页开放浏览器本机偏好和快捷键说明，未接入的账号、公众号与通知能力明确禁用；
- 主导航、命令面板、文章已复制/已同步筛选和全局新建/导入快捷键完成闭环；
- 文章预览页读取真实文章与文档，支持手机、平板、桌面宽度和 75%—100% 缩放；
- 编辑器交付工具串联快速排版说明、设备预览、兼容抽屉和一键复制弹窗；
- 兼容抽屉与正式微信输出共享同一份服务端规则报告，不另造前端评分；
- 编辑器左栏支持结构、主题、组件三态，主题试穿不落库，正式应用后同步权威文档版本；
- 编辑器路由自动使用 72px 导航，在 1366 与 1920 宽度下保持 250px / 画布 / 280px 三栏。
- PostgreSQL 权威任务与事件存储，Redis / BullMQ 只负责任务调度和运行时协调；
- 12 个规范队列名、Owner 级幂等键、指数退避与抖动、可重试/永久错误明确分类；
- BullMQ Worker 进度上报、自动与手动重试、排队中/运行中取消和 15 秒 TTL 心跳；
- Owner 隔离的任务列表、详情、取消、重试 API，以及基于数据库事件的 SSE 实时流；
- `Last-Event-ID` 原精度断线续传，Redis 重启后任务记录与完整事件仍可读取；
- Testcontainers 覆盖成功、幂等、自动/手动重试、永久失败、取消和 Redis 重启持久性。
- `S2-OPS-001` 生产制品基础：固定摘要的多阶段 Node / Nginx 镜像、生产 Compose、HTTPS 入口、
  仅 80 / 443 暴露、非 root 与只读容器、内部数据网络、显式迁移及受保护的部署/回滚命令；
- 生产配置会在启动前校验 HTTPS Origin、TLS 文件、占位值、镜像版本、Secret 强度以及
  PostgreSQL / Redis 内部凭据一致性；CI 构建并检查全部生产镜像。
- `S2-BACKUP-001` 数据库备份基础：PostgreSQL 流式备份、AES-256-GCM、HMAC Manifest、
  SHA-256、独立备份 Bucket 上传、失败告警、每日 Timer 示例及只恢复到新数据库的演练报告；
- CI 使用真实 PostgreSQL 18 验证 5 篇含图片、主题引用和快照的测试文章可加密备份并恢复。
- `S2-OPS-002` 监控制品：受保护 Prometheus 指标、API/队列/Worker 指标、Loki 结构化日志、
  OpenTelemetry Trace、Tempo、Grafana 预置面板、Node Exporter、Alertmanager 与基础告警；
  Grafana 只绑定宿主回环地址，真实告警接收仍需在生产等价环境验收。

本阶段尚未实现资源管理 UI、DOCX 文件导入、扩展组件包、兼容问题自动修复管理、SVG 执行、
微信连接或微信草稿同步。

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

任务端点：

- 任务列表：`GET /api/v1/jobs`；
- 任务详情：`GET /api/v1/jobs/:jobId`；
- 取消任务：`POST /api/v1/jobs/:jobId/cancel`；
- 手动重试：`POST /api/v1/jobs/:jobId/retry`；
- 事件流与断线续传：`GET /api/v1/jobs/:jobId/events`。

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

快照端点：

- 版本列表与手动创建：`GET|POST /api/v1/articles/:articleId/snapshots`；
- 版本详情：`GET /api/v1/articles/:articleId/snapshots/:snapshotId`；
- 只读预览：`POST /api/v1/articles/:articleId/snapshots/:snapshotId/preview`；
- 乐观锁恢复：`POST /api/v1/articles/:articleId/snapshots/:snapshotId/restore`。

导入端点：

- 创建粘贴导入：`POST /api/v1/imports/paste`；
- 读取可刷新恢复的结构：`GET /api/v1/imports/:articleId/structure`；
- 确认完整结构并生成快照：`PUT /api/v1/imports/:articleId/structure`。

资源端点：

- 创建直传会话或去重：`POST /api/v1/resources/uploads`；
- 完成上传并校验登记：`POST /api/v1/resources/uploads/:uploadId/complete`；
- 读取资源元数据：`GET /api/v1/resources/:resourceId`；
- 获取原图或缩略图短签名：`POST /api/v1/resources/:resourceId/access-url`；
- 查询删除阻塞引用：`GET /api/v1/resources/:resourceId/references`；
- 将未被引用的资源移入回收站：`DELETE /api/v1/resources/:resourceId`。

主题端点：

- 已安装主题目录与详情：`GET /api/v1/themes`、`GET /api/v1/themes/:themeId`；
- 不可变版本列表与详情：`GET /api/v1/themes/:themeId/versions`、
  `GET /api/v1/themes/:themeId/versions/:version`；
- 不落库试穿：`POST /api/v1/articles/:articleId/themes/:themeId/preview`；
- 创建安全快照并正式应用：`POST /api/v1/articles/:articleId/themes/:themeId/apply`。

微信复制端点：

- 生成正式输出与复制前快照：`POST /api/v1/articles/:articleId/render-wechat`；
- 读取渲染结果与兼容报告：
  `GET /api/v1/articles/:articleId/render-outputs/:renderOutputId`；
- 获取短时双格式 Payload：`POST /api/v1/articles/:articleId/copy-payload`；
- 回写浏览器复制成功或失败：`POST /api/v1/articles/:articleId/copy-records`。

Web 基础页面：

- 登录页：`http://localhost:3000/login`；
- 工作台首页：`http://localhost:3000/workspace`；
- 文章工作台：`http://localhost:3000/workspace/articles`；
- 粘贴导入：`http://localhost:3000/workspace/imports/paste`；
- 结构确认：`http://localhost:3000/workspace/imports/:articleId/structure`；
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

`pnpm docker:smoke` 会验证 PostgreSQL、Redis、MinIO、API live / ready、Worker 心跳、OpenAPI、
数据库表/外键/索引、登录页、文章工作台和乐观路由保护，并在真实数据库中完成文章
新建、发布、复制、回收站、恢复、状态历史以及两客户端并发文档保存的 200/409
乐观锁验收；同时覆盖手动快照、编辑后快照游离、恢复前安全版本、恢复后新版本、
陈旧版本恢复回滚、复制前快照和数据库不可变触发器；粘贴导入还会验证危险内容清洗、
Source Blocks、刷新恢复、结构确认、幂等重放、版本冲突和导入后快照；资源流程会真实验证
私有直传、签名下载、匿名拒绝、去重、错误 MIME、伪图片、文档保存自动绑定/解绑、引用保护
和软删除；最后通过重启
PostgreSQL、Redis、MinIO 检查命名卷的数据持久性；正式复制流程会验证服务端渲染、
兼容门禁、双格式 Payload、复制记录、快照和审计持久化；任务中心还会覆盖幂等创建、SSE
回放、自动/手动重试、永久失败只执行一次和运行中取消；主题流程会验证目录、试穿不落库、
原文不变、乐观锁冲突、安全快照、正式复制绑定主题和审计记录。探针与烟测数据会在测试
结束时清理；MinIO 的 `healthcheck.txt` 会保留用于后续检查。

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
pnpm acceptance:seed
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm format
pnpm format:check
```

`pnpm test:integration` 使用 Testcontainers 启动隔离的 PostgreSQL、Redis 和 MinIO；
`pnpm test:e2e` 要求先运行 `pnpm docker:dev`，并使用 Chromium 与 WebKit 验证核心用户流程。
首次执行 E2E 前可用 `pnpm exec playwright install chromium webkit` 安装测试浏览器。
`pnpm acceptance:seed` 需显式设置 `ACCEPTANCE_SCOPE=safari` 或 `wechat`，用于通过正式 API
准备人工验收文章；它不写复制成功记录，也不会发布内容。完整命令和记录模板见
[微信公众号后台人工测试记录](./docs/testing/wechat-manual-test-record.md)。

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

Web 生产构建固定使用 Next.js 的 Webpack 模式；开发环境仍使用默认开发构建器。这样可以
规避 Next.js 16.2.12 Turbopack 在中文工作区路径下的 UTF-8 标识符崩溃。

## 目录

```text
apps/
  web/                       Next.js Web
  api/                       NestJS API
  worker/                    BullMQ 异步任务 Worker
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
  job-runtime/                PostgreSQL 权威任务存储、BullMQ 队列与 Worker 运行时
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
- `S3_ENDPOINT` 用于服务端内网访问，`S3_PUBLIC_ENDPOINT` 用于生成浏览器可访问的签名
  URL；生产环境两者都必须使用 HTTPS；
- `S3_ADDRESSING_STYLE` 与 `S3_PUBLIC_ADDRESSING_STYLE` 分别声明两个 Endpoint 的寻址
  方式：MinIO 使用 `path`，区域级 COS 域名使用 `virtual-hosted`，已绑定单个
  Bucket 的自定义域名使用 `bucket-endpoint`；
- COS 使用 `S3_METADATA_HEADER_PREFIX=x-cos-meta-`，S3 / MinIO 使用
  `x-amz-meta-`；读取器同时识别两种响应头；
- 微信含图验收时，运行中的 API 与 `acceptance:seed` 必须使用同一个公网 HTTPS
  `S3_PUBLIC_ENDPOINT`。Docker Compose 支持用宿主环境变量覆盖本地默认值；变更后必须重建或
  重启 API，不能只给 seed 进程临时设置；
- 服务端 Secret 在字符串化、JSON 序列化和 Node.js 检查输出中默认显示为 `[REDACTED]`。

## 下一步

`S1-TEST-001` 的自动化与验收数据准备、`S1-JOB-001`、`S1-THEME-002` 和
`S1-COMPONENT-002` 已实现。V0.1 标签前还需关闭真实 Safari / Edge 与微信公众号后台人工
门禁。`S2-OPS-001` 生产运行制品和 `S2-BACKUP-001` 数据库备份恢复制品均已通过自动化验收；
公网部署仍需真实 CVM、域名与 TLS、COS、Secret 注入、每日 Timer、季度恢复演练和监控实效验收。
详细状态见
[V0.1 发布检查清单](./docs/testing/V0.1-release-checklist.md)。
生产部署入口与未关闭门槛见
[S2-OPS-001 生产运行制品](./docs/deployment/S2-OPS-001-production-runtime.md)。
数据库备份格式、每日调度与恢复演练见
[S2-BACKUP-001 数据库备份与恢复基础](./docs/deployment/S2-BACKUP-001-database-recovery.md)。
日志、指标、Trace、Grafana 与告警见
[S2-OPS-002 日志、指标与告警](./docs/deployment/S2-OPS-002-observability.md)。
完整设计依据见 [docs](./docs/)。
