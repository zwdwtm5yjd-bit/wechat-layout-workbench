import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const monitoringRoot = resolve(root, "infrastructure/monitoring");

function read(relativePath: string): string {
  return readFileSync(resolve(monitoringRoot, relativePath), "utf8");
}

describe("production observability configuration", () => {
  it("scrapes protected API, host and telemetry services without inline credentials", () => {
    const prometheus = read("prometheus/prometheus.yml");
    expect(prometheus).toContain("credentials_file: /run/secrets/metrics-bearer-token");
    expect(prometheus).toContain("targets: [api:3001]");
    expect(prometheus).toContain("targets: [node-exporter:9100]");
    expect(prometheus).toContain("targets: [otel-collector:8888]");
    expect(prometheus).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{16,}/);
  });

  it("defines availability, save, queue, host and log-delivery alerts", () => {
    const alerts = read("prometheus/alerts.yml");
    for (const alert of [
      "WechatLayoutApiUnavailable",
      "WechatLayoutWorkerHeartbeatMissing",
      "WechatLayoutDocumentSaveFailures",
      "WechatLayoutQueueBacklog",
      "WechatLayoutHostHighCpu",
      "WechatLayoutHostLowMemory",
      "WechatLayoutHostLowDisk",
      "WechatLayoutLokiDeliveryFailure",
    ]) {
      expect(alerts).toContain(`alert: ${alert}`);
    }
  });

  it("routes Alertmanager through a file-backed secret", () => {
    const alertmanager = read("alertmanager/alertmanager.yml");
    expect(alertmanager).toContain("url_file: /run/secrets/alertmanager-webhook-url");
    expect(alertmanager).not.toContain("https://");
  });

  it("provisions a parseable operations dashboard and all three data sources", () => {
    const dashboard = JSON.parse(read("grafana/dashboards/operations.json")) as {
      panels: Array<{ title: string }>;
      uid: string;
    };
    const datasources = read("grafana/provisioning/datasources/datasources.yml");

    expect(dashboard.uid).toBe("wechat-layout-operations");
    expect(dashboard.panels.map((panel) => panel.title)).toEqual(
      expect.arrayContaining([
        "API 可用",
        "Worker 心跳",
        "队列状态",
        "API 错误日志",
        "保存失败（当前时间范围）",
      ]),
    );
    expect(datasources).toContain("uid: prometheus");
    expect(datasources).toContain("uid: loki");
    expect(datasources).toContain("uid: tempo");
  });

  it("keeps Grafana immutable by disabling background plugin installation", () => {
    const compose = readFileSync(
      resolve(root, "infrastructure/compose/docker-compose.prod.yml"),
      "utf8",
    );
    expect(compose).toContain('GF_ANALYTICS_CHECK_FOR_PLUGIN_UPDATES: "false"');
    expect(compose).toContain('GF_PLUGINS_PREINSTALL_DISABLED: "true"');
  });

  it("keeps the public reverse proxy away from the protected metrics endpoint", () => {
    const nginx = readFileSync(resolve(root, "infrastructure/nginx/app.conf.template"), "utf8");
    expect(nginx).toMatch(/location = \/internal\/metrics\s*\{\s*return 404;\s*\}/);
  });
});
