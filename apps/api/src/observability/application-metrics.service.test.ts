import { describe, expect, it } from "vitest";

import { ApplicationMetrics, normalizedMetricRoute } from "./application-metrics.service.js";

describe("ApplicationMetrics", () => {
  it("normalizes identifiers so request metrics have bounded route labels", () => {
    expect(
      normalizedMetricRoute(
        "/api/v1/articles/019fad05-92ef-76b0-a907-51d1198a00d9/resources/42?token=secret",
      ),
    ).toBe("/api/v1/articles/:id/resources/:id");
  });

  it("renders counters and duration histograms without request identifiers", () => {
    const metrics = new ApplicationMetrics();
    metrics.observeHttp({
      durationMs: 125,
      errorCode: "SAVE_FAILED",
      method: "post",
      path: "/api/v1/articles/019fad05-92ef-76b0-a907-51d1198a00d9/save",
      statusCode: 503,
    });

    const output = metrics.render();
    expect(output).toContain(
      'wechat_layout_http_requests_total{error_code="SAVE_FAILED",method="POST",route="/api/v1/articles/:id/save",status_code="503"} 1',
    );
    expect(output).toContain(
      'wechat_layout_http_request_duration_seconds_bucket{le="0.25",method="POST",route="/api/v1/articles/:id/save"} 1',
    );
    expect(output).not.toContain("019fad05-92ef-76b0-a907-51d1198a00d9");
  });

  it("tracks log delivery failures and queue overflow", () => {
    const metrics = new ApplicationMetrics();
    metrics.recordLokiDeliveryFailure(3);
    metrics.recordLokiQueueOverflow(2);

    expect(metrics.render()).toContain("wechat_layout_loki_delivery_failures_total 1");
    expect(metrics.render()).toContain("wechat_layout_loki_dropped_entries_total 5");
  });
});
