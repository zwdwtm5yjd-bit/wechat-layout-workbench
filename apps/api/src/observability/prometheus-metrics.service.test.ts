import type { DatabaseConnection } from "@wechat-layout/database";
import { describe, expect, it, vi } from "vitest";

import type { RedisClient } from "../redis/redis.module.js";
import { ApplicationMetrics } from "./application-metrics.service.js";
import { PrometheusMetricsService } from "./prometheus-metrics.service.js";

function databaseWithResults(results: readonly unknown[]): DatabaseConnection {
  const pendingResults = [...results];
  const sql = vi.fn().mockImplementation(() => Promise.resolve(pendingResults.shift()));
  return { sql } as unknown as DatabaseConnection;
}

function redisWithHeartbeat(timestamp: string | null): RedisClient {
  return {
    get: vi.fn().mockResolvedValue(timestamp === null ? null : JSON.stringify({ timestamp })),
  } as unknown as RedisClient;
}

describe("PrometheusMetricsService", () => {
  it("collects queue backlog and a fresh worker heartbeat", async () => {
    const database = databaseWithResults([
      [{ queue_name: "layout", status: "queued", total: "4" }],
      [{ age_seconds: 12.5, queue_name: "layout" }],
    ]);
    const service = new PrometheusMetricsService(
      new ApplicationMetrics(),
      database,
      redisWithHeartbeat(new Date().toISOString()),
    );

    const output = await service.render();

    expect(output).toContain('wechat_layout_jobs{queue_name="layout",status="queued"} 4');
    expect(output).toContain(
      'wechat_layout_oldest_waiting_job_age_seconds{queue_name="layout"} 12.5',
    );
    expect(output).toContain("wechat_layout_worker_up 1");
    expect(output).toContain(
      'wechat_layout_observability_collection_success{collector="database"} 1',
    );
  });

  it("exports failure gauges when dependencies cannot be collected", async () => {
    const database = {
      sql: vi.fn().mockRejectedValue(new Error("database unavailable")),
    } as unknown as DatabaseConnection;
    const redis = {
      get: vi.fn().mockRejectedValue(new Error("redis unavailable")),
    } as unknown as RedisClient;
    const service = new PrometheusMetricsService(new ApplicationMetrics(), database, redis);

    const output = await service.render();

    expect(output).toContain(
      'wechat_layout_observability_collection_success{collector="database"} 0',
    );
    expect(output).toContain(
      'wechat_layout_observability_collection_success{collector="worker"} 0',
    );
    expect(output).toContain("wechat_layout_worker_up 0");
  });
});
