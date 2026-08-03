import { describe, expect, it, vi } from "vitest";

import { ApplicationMetrics } from "./application-metrics.service.js";
import { LokiLogPublisher } from "./loki-log-publisher.js";

describe("LokiLogPublisher", () => {
  it("pushes JSON streams with fixed labels and nanosecond timestamps", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const publisher = new LokiLogPublisher(
      {
        endpoint: "http://loki:3100/loki/api/v1/push",
        environment: "production",
        request,
        service: "api",
      },
      new ApplicationMetrics(),
    );
    publisher.enqueue({
      articleId: "article-1",
      level: "error",
      message: "save failed",
      timestamp: "2026-08-03T08:00:00.000Z",
    });

    await publisher.close();

    expect(request).toHaveBeenCalledOnce();
    const [, init] = request.mock.calls[0]!;
    const payload = JSON.parse(String(init?.body)) as {
      streams: Array<{ stream: Record<string, string>; values: string[][] }>;
    };
    expect(payload.streams[0]?.stream).toEqual({
      environment: "production",
      level: "error",
      service_name: "api",
    });
    expect(payload.streams[0]?.values[0]?.[0]).toMatch(/^\d{19}$/);
    expect(payload.streams[0]?.values[0]?.[1]).toContain('"articleId":"article-1"');
  });

  it("counts failed batches and bounded-queue overflow", async () => {
    const metrics = new ApplicationMetrics();
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const publisher = new LokiLogPublisher(
      {
        endpoint: "http://loki:3100/loki/api/v1/push",
        environment: "production",
        maximumQueuedEntries: 1,
        request,
        service: "api",
      },
      metrics,
    );
    publisher.enqueue({ level: "info", timestamp: "2026-08-03T08:00:00.000Z" });
    publisher.enqueue({ level: "error", timestamp: "2026-08-03T08:00:01.000Z" });

    await publisher.close();

    const output = metrics.render();
    expect(output).toContain("wechat_layout_loki_delivery_failures_total 1");
    expect(output).toContain("wechat_layout_loki_dropped_entries_total 2");
  });
});
