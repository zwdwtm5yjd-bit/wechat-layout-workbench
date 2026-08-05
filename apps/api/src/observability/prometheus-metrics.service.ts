import { Inject, Injectable } from "@nestjs/common";
import { WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SECONDS } from "@wechat-layout/job-runtime";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import type { DatabaseConnection } from "@wechat-layout/database";
import { REDIS_CLIENT, type RedisClient } from "../redis/redis.module.js";
import { ApplicationMetrics } from "./application-metrics.service.js";

interface JobCountRow {
  readonly queue_name: string;
  readonly status: string;
  readonly total: string;
}

interface OldestJobRow {
  readonly age_seconds: number;
  readonly queue_name: string;
}

function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function metric(
  name: string,
  value: number,
  labels: Readonly<Record<string, string>> = {},
): string {
  const renderedLabels = Object.entries(labels)
    .map(([key, label]) => `${key}="${escapeLabel(label)}"`)
    .join(",");
  return `${name}${renderedLabels ? `{${renderedLabels}}` : ""} ${String(value)}`;
}

@Injectable()
export class PrometheusMetricsService {
  constructor(
    @Inject(ApplicationMetrics)
    private readonly applicationMetrics: ApplicationMetrics,
    @Inject(DATABASE_CONNECTION)
    private readonly database: DatabaseConnection,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
  ) {}

  async render(): Promise<string> {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const lines = [
      this.applicationMetrics.render().trimEnd(),
      "# HELP wechat_layout_process_uptime_seconds API process uptime.",
      "# TYPE wechat_layout_process_uptime_seconds gauge",
      metric("wechat_layout_process_uptime_seconds", process.uptime()),
      "# HELP wechat_layout_process_resident_memory_bytes API resident memory.",
      "# TYPE wechat_layout_process_resident_memory_bytes gauge",
      metric("wechat_layout_process_resident_memory_bytes", memory.rss),
      "# HELP wechat_layout_process_heap_used_bytes API V8 heap in use.",
      "# TYPE wechat_layout_process_heap_used_bytes gauge",
      metric("wechat_layout_process_heap_used_bytes", memory.heapUsed),
      "# HELP wechat_layout_process_cpu_seconds_total API process CPU time.",
      "# TYPE wechat_layout_process_cpu_seconds_total counter",
      metric("wechat_layout_process_cpu_seconds_total", (cpu.user + cpu.system) / 1_000_000),
      "# HELP wechat_layout_observability_collection_success Whether an operational collector succeeded.",
      "# TYPE wechat_layout_observability_collection_success gauge",
    ];

    await this.collectJobs(lines);
    await this.collectWorker(lines);
    return `${lines.join("\n")}\n`;
  }

  private async collectJobs(lines: string[]): Promise<void> {
    try {
      const counts = (await this.database.sql`
        select queue_name, status, count(*)::text as total
        from operations.jobs
        group by queue_name, status
        order by queue_name, status
      `) as unknown as readonly JobCountRow[];
      const oldest = (await this.database.sql`
        select
          queue_name,
          extract(epoch from (now() - min(scheduled_at)))::double precision as age_seconds
        from operations.jobs
        where status in ('queued', 'retry_pending')
        group by queue_name
        order by queue_name
      `) as unknown as readonly OldestJobRow[];
      lines.push(
        metric("wechat_layout_observability_collection_success", 1, { collector: "database" }),
        "# HELP wechat_layout_jobs Current jobs by queue and status.",
        "# TYPE wechat_layout_jobs gauge",
        ...counts.map((row) =>
          metric("wechat_layout_jobs", Number(row.total), {
            queue_name: row.queue_name,
            status: row.status,
          }),
        ),
        "# HELP wechat_layout_oldest_waiting_job_age_seconds Age of the oldest queued or retry-pending job.",
        "# TYPE wechat_layout_oldest_waiting_job_age_seconds gauge",
        ...oldest.map((row) =>
          metric("wechat_layout_oldest_waiting_job_age_seconds", row.age_seconds, {
            queue_name: row.queue_name,
          }),
        ),
      );
    } catch {
      lines.push(
        metric("wechat_layout_observability_collection_success", 0, { collector: "database" }),
      );
    }
  }

  private async collectWorker(lines: string[]): Promise<void> {
    try {
      const raw = await this.redis.get(WORKER_HEARTBEAT_KEY);
      const heartbeat = raw === null ? null : (JSON.parse(raw) as { timestamp?: unknown });
      const timestamp =
        typeof heartbeat?.timestamp === "string" ? Date.parse(heartbeat.timestamp) : NaN;
      const ageSeconds = Number.isFinite(timestamp)
        ? Math.max(0, Date.now() - timestamp) / 1_000
        : Infinity;
      const workerUp = Number.isFinite(ageSeconds) && ageSeconds <= WORKER_HEARTBEAT_TTL_SECONDS;
      lines.push(
        metric("wechat_layout_observability_collection_success", 1, { collector: "worker" }),
        "# HELP wechat_layout_worker_up Whether the Redis worker heartbeat is fresh.",
        "# TYPE wechat_layout_worker_up gauge",
        metric("wechat_layout_worker_up", workerUp ? 1 : 0),
        "# HELP wechat_layout_worker_heartbeat_age_seconds Age of the latest worker heartbeat.",
        "# TYPE wechat_layout_worker_heartbeat_age_seconds gauge",
        metric(
          "wechat_layout_worker_heartbeat_age_seconds",
          Number.isFinite(ageSeconds) ? ageSeconds : WORKER_HEARTBEAT_TTL_SECONDS * 2,
        ),
      );
    } catch {
      lines.push(
        metric("wechat_layout_observability_collection_success", 0, { collector: "worker" }),
        metric("wechat_layout_worker_up", 0),
      );
    }
  }
}
