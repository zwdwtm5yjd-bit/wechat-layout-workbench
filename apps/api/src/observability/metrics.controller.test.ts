import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { MetricsController } from "./metrics.controller.js";
import type { PrometheusMetricsService } from "./prometheus-metrics.service.js";

describe("MetricsController", () => {
  const token = "metrics-token-that-is-at-least-32-characters";

  it("rejects missing and incorrect credentials before collecting metrics", async () => {
    const metrics = { render: vi.fn() } as unknown as PrometheusMetricsService;
    const controller = new MetricsController(metrics, token);
    const response = { send: vi.fn(), setHeader: vi.fn() };

    await expect(controller.getMetrics(undefined, response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.getMetrics("Bearer incorrect", response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(metrics.render).not.toHaveBeenCalled();
  });

  it("returns Prometheus text with no-store for the exact bearer token", async () => {
    const metrics = {
      render: vi.fn().mockResolvedValue("wechat_layout_worker_up 1\n"),
    } as unknown as PrometheusMetricsService;
    const controller = new MetricsController(metrics, token);
    const response = { send: vi.fn(), setHeader: vi.fn() };

    await controller.getMetrics(`Bearer ${token}`, response);

    expect(response.setHeader).toHaveBeenCalledWith("cache-control", "no-store");
    expect(response.setHeader).toHaveBeenCalledWith(
      "content-type",
      "text/plain; version=0.0.4; charset=utf-8",
    );
    expect(response.send).toHaveBeenCalledWith("wechat_layout_worker_up 1\n");
  });
});
