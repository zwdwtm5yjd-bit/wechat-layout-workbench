# S2-OPS-002 日志、指标与告警

> 状态：仓库与本地容器制品验收完成，生产环境验收与真实告警接收待执行
> 适用阶段：V0.5 个人云端环境
> 依赖：`S2-OPS-001` 生产运行制品

## 已交付范围

- API 使用 OpenTelemetry Node 自动插桩，经 OTLP/HTTP 将 Trace 发送到内部
  OpenTelemetry Collector，再写入 Tempo；
- `/internal/metrics` 输出 Prometheus 文本，只接受独立 Bearer Token，Nginx 对公网精确返回
  `404`；
- API 请求总数、错误码、耗时直方图、进程 CPU/内存、Loki 投递状态；
- 从 PostgreSQL 聚合队列与状态计数、最老等待任务，从 Redis 读取 Worker 心跳；
- API 结构化日志保留 stdout，同时以有界批次写入 Loki；Loki 故障不会阻塞请求；
- Prometheus、Alertmanager、Grafana、Loki、Tempo、OpenTelemetry Collector、Node Exporter
  组成内部监控栈；
- Grafana 预置 Prometheus、Loki、Tempo 三个数据源和“运行总览”面板；
- 基础告警覆盖 API 不可用、5xx、保存失败、Worker 心跳、队列积压/停滞、CPU、内存、磁盘、
  指标采集失败和 Loki 投递失败；
- 监控基础镜像全部固定版本与多架构 digest，不挂载 Docker Socket；除 Grafana 的宿主机
  `127.0.0.1` 端口外，不新增宿主端口。

## 数据流

```text
API /internal/metrics ─┐
Node Exporter ─────────┼─> Prometheus ─> Alertmanager ─> HTTPS 告警中继
监控组件自身指标 ──────┘        │
                               └─> Grafana

API JSON 日志 ─> Loki ─────────────> Grafana
API OTLP Trace ─> OTel Collector ─> Tempo ─> Grafana
```

Trace 采用 Node SDK、OTLP Exporter 和 Collector 的组合；日志写入使用 Loki JSON Push API，时间戳
以字符串形式发送纳秒值。实现依据分别见
[OpenTelemetry JavaScript Exporters](https://opentelemetry.io/docs/languages/js/exporters/) 与
[Loki HTTP API](https://grafana.com/docs/loki/latest/reference/loki-http-api/)。

## 生产配置

在 `.env.production` 填写：

```dotenv
METRICS_BEARER_TOKEN=<至少32字符且不与其他Secret复用>
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4318/v1/traces
LOKI_PUSH_URL=http://loki:3100/loki/api/v1/push
GRAFANA_ADMIN_PASSWORD=<至少32字符>
GRAFANA_HOST_PORT=3002
ALERTMANAGER_WEBHOOK_URL=https://<告警中继>/hooks/observability
```

三个敏感值由 Compose Secret 文件挂入 Prometheus、Grafana 和 Alertmanager；不得把真实值写进
Prometheus、Grafana Provisioning 或 Alertmanager YAML。告警 URL 必须为 HTTPS。

运行部署前检查：

```bash
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:config
```

正常部署会先启动日志、Trace 和主机采集组件，再启动应用，最后启动 Prometheus 与 Grafana。
部署完成后同时检查公网 API 与五个内部监控服务：

```bash
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:health
```

## 查看方式

Grafana 只绑定 CVM 的 `127.0.0.1:${GRAFANA_HOST_PORT}`。在管理电脑建立 SSH 隧道：

```bash
ssh -L 3002:127.0.0.1:3002 <管理用户>@<CVM地址>
```

然后打开 `http://127.0.0.1:3002`，使用 `admin` 和生产 Secret 中的 Grafana 管理密码登录。不得将
Grafana 改为 `0.0.0.0` 或在安全组新增 3002 公网规则。

预置面板可以直接查看：

- API 可用性、5xx 比例、请求速率和 API 进程内存；
- Worker 心跳、各队列状态与等待任务；
- 主机 CPU、内存与最低磁盘余量；
- API 错误结构化日志，并通过 `traceId` 跳转 Tempo Trace。

## 告警链路测试

部署后主动发送一次 2 分钟测试告警：

```bash
PRODUCTION_ENV_FILE=.env.production pnpm docker:prod:alert-test
```

验收时必须在告警接收端记录 firing 与 resolved 两次通知的时间、接收人和截图。命令仅证明
Alertmanager 已接受测试告警；若接收端无通知，不能把 S2-OPS-002 判为通过。

## 保留与容量

- Prometheus：30 天，且最多 20 GB；
- Loki：7 天；
- Tempo：7 天；
- Docker stdout：每容器 5 个、每个 10 MB；
- Grafana、Prometheus、Alertmanager、Loki、Tempo 使用独立命名卷。

Node Exporter 只读挂载宿主根目录用于主机指标，不读取应用 Secret。当前没有挂载 Docker
Socket，因此不提供逐容器 cAdvisor 指标；CPU、内存和磁盘按主机监控，API 进程另有应用指标。

## 验收清单

- [ ] Prometheus 的 `api`、`node`、`loki`、`tempo`、`otel-collector` Target 全部为 UP；
- [ ] 无 Token 请求 `/internal/metrics` 返回 401，公网经 Nginx 请求返回 404；
- [ ] Grafana 能看到 API 请求、5xx、保存失败、队列、Worker、CPU、内存和磁盘；
- [ ] 制造一条受控 API 错误后，Loki 可按 `requestId` / `traceId` 检索；
- [ ] Tempo 能打开对应 Trace；
- [ ] 停止测试 Worker 后触发心跳告警，恢复后告警解决；
- [ ] `docker:prod:alert-test` 的 firing / resolved 均到达接收端；
- [ ] 重启监控容器后数据卷中的历史数据仍可查询。

仓库级单元、类型、配置和 Compose 模板检查不能代替以上生产等价或真实 CVM 验收。完成这些
项目之前，只能声明“监控制品已实现”，不能声明“生产监控已生效”。
