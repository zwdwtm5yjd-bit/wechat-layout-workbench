# S2-OPS-001 生产运行制品

> 状态：生产制品基础完成，真实腾讯云资源与公网验收待执行<br>
> 适用阶段：V0.5 个人云端环境<br>
> 依据：`14_公众号智能视觉排版工具_安全部署与备份方案.md`

## 已交付范围

- `node-app.prod.Dockerfile`：一次构建 Web、API、Worker、Scheduler 和独立数据库迁移镜像；
- `nginx.prod.Dockerfile`：固定摘要的非 root Nginx；
- `docker-compose.prod.yml`：单 CVM 低成本拓扑，内置私网 PostgreSQL / Redis，外接 COS 与 SMTP；
- HTTPS Nginx 入口：宿主仅发布 80 / 443，HTTP 强制跳转 HTTPS；
- API、Web、SSE 路由、请求限流和安全响应头；HSTS 待真实证书续期验证稳定后启用；
- 所有 Node 容器非 root、只读根文件系统、`no-new-privileges`、删除全部 capabilities；
- PostgreSQL / Redis 仅加入内部数据网络，不发布宿主端口；
- 生产资源限制、健康检查、日志轮转和持久数据卷；
- 数据库迁移使用显式 `migration` profile，不随应用启动自动执行；
- 部署前必须确认备份，回滚前必须确认数据库向后兼容；
- 生产配置在 Docker 启动前执行服务端、前端、TLS、镜像版本和内部凭据一致性校验；
- CI 构建全部生产镜像，并验证非 root 用户、迁移入口、Next 构建产物和 Nginx 配置。

生产镜像和 PostgreSQL / Redis / Nginx 基础镜像均固定版本；基础镜像同时固定多架构 digest。
镜像内不复制 `.env*`、Git 历史、开发输出、文档或本机依赖目录。

## 环境准备

复制模板，但不要把填写后的文件提交到 Git：

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

至少准备：

- 已解析到 CVM 稳定公网 IP 的 `APP_DOMAIN`；
- 对应域名的 TLS 完整证书链与私钥绝对路径；
- 镜像仓库路径及不可变 `RELEASE_TAG`；
- PostgreSQL 与 Redis 独立长密码；
- 公网 HTTPS COS Endpoint、Bucket 和最小权限密钥；
- SMTP 配置；
- 五个互不相同、至少 32 字符的应用安全密钥。

Nginx 固定以容器 UID / GID `101:101` 运行。TLS 文件在宿主机上必须对该 UID 可读，同时不得
对其他用户开放私钥写权限；推荐复制到专用受限目录，证书设为 `0644`、私钥由 `101:101`
持有并设为 `0600`。不要直接挂载只有宿主 root 可读的默认私钥路径后假设容器能够读取。

若数据库或 Redis 密码包含 URL 保留字符，`DATABASE_URL` / `REDIS_URL` 必须使用百分号编码，
同时解码后的凭据必须与 `POSTGRES_*` / `REDIS_PASSWORD` 一致。

## 构建与配置验收

```bash
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:config
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:build
```

`docker:prod:config` 不会启动服务。它会在任何迁移或部署前拒绝：

- `CHANGE_ME` / `REPLACE_ME` 占位值；
- HTTP 生产 URL 或多个不一致的应用 Origin；
- 不存在、非绝对路径的 TLS 文件；
- 过短或复用的关键应用密钥；
- 与内部 PostgreSQL / Redis 容器不一致的连接 URL；
- 无效镜像仓库和 release tag。

## 首次部署与升级

部署脚本不会自动备份。完成并验证备份后，才允许执行：

```bash
export CONFIRM_PRODUCTION_BACKUP=1
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:deploy
unset CONFIRM_PRODUCTION_BACKUP
```

固定顺序为：

1. 校验生产配置与 Compose；
2. 启动并等待 PostgreSQL / Redis；
3. 一次性运行显式迁移容器；
4. 启动 Web / API / Worker / Scheduler / Nginx；
5. 验证公网 `/health/ready`；
6. 输出最终容器状态。

`0004` 资源引用回填迁移期间必须停止旧版本写入。迁移失败不会继续启动新应用。

## 应用回滚

仅在数据库仍与上一版本向后兼容时切换旧镜像：

```bash
export PREVIOUS_RELEASE_TAG=<上一稳定镜像 tag>
export CONFIRM_DATABASE_COMPATIBLE_ROLLBACK=1
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:rollback
unset PREVIOUS_RELEASE_TAG CONFIRM_DATABASE_COMPATIBLE_ROLLBACK
```

回滚不会反向执行数据库迁移，也不会自动恢复备份。若迁移不兼容，必须按备份恢复方案处理，
不得使用本入口强行启动旧应用。

## 尚未关闭的 S2-OPS-001 门槛

以下内容需要真实腾讯云账号或服务器权限，本仓库不能冒充完成：

- 创建 CVM、稳定公网 IP、TCR 镜像仓库、COS、域名解析和 TLS 自动续期；
- 安全组只开放 80 / 443，限制 SSH 来源并禁止 root / 密码登录；
- 在真实 CVM 上配置 Docker、磁盘、时钟同步、系统补丁和日志轮转；
- 推送镜像、部署、重启恢复与公网 HTTPS / Clipboard API 验收；
- COS CORS、版本控制、生命周期和最小权限策略；
- S2-BACKUP-001 的自动备份、加密、哈希与恢复演练；
- S2-OPS-002 的日志、指标和告警。

完成这些真实环境门槛前，只能声明“生产制品可构建”，不能声明“已经公网生产上线”。
