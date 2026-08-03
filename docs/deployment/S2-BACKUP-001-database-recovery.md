# S2-BACKUP-001 数据库备份与恢复基础

> 状态：数据库备份制品完成，真实 COS 策略、每日 Timer 和季度人工演练待部署验收<br>
> 目标：V0.5 RPO 不超过 24 小时、RTO 不超过 4 小时

## 已实现

- PostgreSQL custom-format 流式 `pg_dump`，明文不落盘；
- AES-256-GCM 加密，HKDF-SHA256 从独立备份密钥派生每份归档密钥；
- Manifest HMAC 认证、密文 SHA-256、明文/密文大小、PostgreSQL 版本、迁移版本、
  文档 Schema、应用版本、表清单和密钥版本；
- 独立备份 Bucket 凭据，上传时由 `Content-MD5` 校验实际字节，密文再执行 HEAD
  大小/SHA-256 元数据校验，Manifest 最后上传；
- 本机仅保留最近 2—30 份完整归档，远端保留期由私有 Bucket 生命周期执行；
- 同一时间只允许一份备份运行，失败写入受限状态文件、返回非零状态并调用 HTTPS 告警中继；
- 恢复前先认证 Manifest 和密文，只允许恢复到全新的 `restore_*` 数据库；
- 恢复报告记录文章、文档、图片资源、主题引用、快照、表数量、RPO 和 RTO；
- CI 使用真实 PostgreSQL 18 执行迁移、5 篇测试文章备份、加密、校验和新数据库恢复。

这套入口不会备份 Redis；Redis 不得保存唯一业务数据。对象资源依赖原始私有 COS Bucket
开启版本控制，数据库加密归档写入独立备份 Bucket。

## 生产配置

`.env.production.example` 增加了全部 `BACKUP_*` 字段。必须使用：

- 独立随机 `BACKUP_ENCRYPTION_KEY` 和明确的 `BACKUP_KEY_VERSION`；
- 只允许写入/HEAD 指定前缀的备份 COS 子账号，不复用应用 COS 密钥；
- 私有、启用版本控制的备份 Bucket；
- 至少 30 天生命周期；
- 可接收通用 JSON 的外部 HTTPS 告警中继。

COS 区域级 Endpoint 应配置为 `https://cos.<region>.myqcloud.com`，并设置
`BACKUP_S3_ADDRESSING_STYLE=virtual-hosted`，签名器会生成
`<bucket>.cos.<region>.myqcloud.com/<key>`。如 Endpoint 本身已专属于单个 Bucket，
使用 `bucket-endpoint`；仅 MinIO 等路径寻址服务使用 `path`。上线时以 COS 控制台
当前区域的官方 Endpoint 为准。COS 的自定义元数据头使用
`BACKUP_S3_METADATA_HEADER_PREFIX=x-cos-meta-`；S3 / MinIO 则使用 `x-amz-meta-`。
COS 的 `BACKUP_S3_BUCKET` 必须使用控制台展示的 `<BucketName>-<APPID>` 完整名称。
配置依据见腾讯云的
[S3 兼容通用配置](https://intl.cloud.tencent.com/zh/document/product/436/34688) 与
[HEAD Object 响应头](https://cloud.tencent.com/document/product/436/7745)。

告警负载只包含 `event`、错误代码、时间和 release tag，不包含 URL、数据库内容或 Secret。
旧密钥轮换后必须安全保留，恢复旧归档时注入该归档 Manifest 指定版本对应的密钥。

## 创建与校验

```bash
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:backup

PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:backup:verify -- \
  --archive /var/lib/wechat-layout/backups/postgresql-<backup-id>.dump.enc \
  --manifest /var/lib/wechat-layout/backups/postgresql-<backup-id>.manifest.json
```

`latest-status.json` 是监控入口。只有 COS 密文和 Manifest 都上传并复核后，状态才会写为
`success`。远端以 Manifest 存在作为完整备份标志；孤立密文不是可恢复备份。

## 每日调度

仓库提供：

- `infrastructure/systemd/wechat-layout-backup.service.example`
- `infrastructure/systemd/wechat-layout-backup.timer.example`

部署时核对实际项目目录、pnpm 路径、环境文件和备份目录后，再复制到 `/etc/systemd/system`。
先以服务运行用户创建权限为 `0700` 的备份目录，再执行一次手工备份，随后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wechat-layout-backup.timer
systemctl list-timers wechat-layout-backup.timer
```

不得在未检查路径的情况下直接安装示例文件。Docker Socket 等同宿主高权限；Timer 只运行仓库内
固定备份入口，不接受网络传入命令。

## 恢复演练

先从私有 Bucket 下载相邻的 `.dump.enc` 和 `.manifest.json`，然后选择不存在的新数据库名：

```bash
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:restore-drill -- \
  --archive /secure/recovery/postgresql-<backup-id>.dump.enc \
  --manifest /secure/recovery/postgresql-<backup-id>.manifest.json \
  --target-database restore_2026q3_drill
```

入口拒绝覆盖当前生产库或已有数据库。恢复数据库会保留，供登录应用、打开至少 5 篇文章、
生成微信 HTML 和核对真实 COS 图片后人工确认；完成确认后再由运维人员显式清理。

## 尚未关闭的门槛

- 在真实 COS 创建独立私有备份 Bucket、最小权限账号、版本控制和 30 天以上生命周期；
- 在 CVM 安装并启用每日 Timer，制造一次失败并确认外部告警到达；
- 下载远端归档并在新数据库执行季度恢复演练；
- 在应用中打开 5 篇文章，验证实际图片、SVG、品牌、主题、快照、渲染和素材版本；
- 记录实测 RPO/RTO，并验证满足 24 小时/4 小时目标；
- 完成单篇文章可移植导出包和对象存储全量 Manifest。

这些真实环境与应用级导出门槛关闭前，只能声明“数据库备份恢复制品可验证”，不能声明
`S2-BACKUP-001` 全部完成。
