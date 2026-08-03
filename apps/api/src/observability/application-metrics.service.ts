import { Injectable } from "@nestjs/common";

const durationBucketsSeconds = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

interface HttpCounter {
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly errorCode: string;
  count: number;
}

interface HttpDuration {
  readonly method: string;
  readonly route: string;
  count: number;
  sumSeconds: number;
  readonly buckets: number[];
}

function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function labels(values: Readonly<Record<string, string | number>>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}="${escapeLabel(String(value))}"`)
    .join(",");
}

export function normalizedMetricRoute(path: string): string {
  return path
    .split("?", 1)[0]!
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      "/:id",
    )
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

@Injectable()
export class ApplicationMetrics {
  readonly #httpCounters = new Map<string, HttpCounter>();
  readonly #httpDurations = new Map<string, HttpDuration>();
  #lokiDeliveryFailures = 0;
  #lokiDroppedEntries = 0;

  observeHttp(input: {
    readonly durationMs: number;
    readonly errorCode?: string;
    readonly method: string;
    readonly path: string;
    readonly statusCode: number;
  }): void {
    const method = input.method.toUpperCase();
    const route = normalizedMetricRoute(input.path);
    if (route === "/internal/metrics") return;
    const errorCode = input.errorCode ?? "";
    const counterKey = JSON.stringify([method, route, input.statusCode, errorCode]);
    const counter = this.#httpCounters.get(counterKey) ?? {
      method,
      route,
      statusCode: input.statusCode,
      errorCode,
      count: 0,
    };
    counter.count += 1;
    this.#httpCounters.set(counterKey, counter);

    const durationKey = JSON.stringify([method, route]);
    const duration = this.#httpDurations.get(durationKey) ?? {
      method,
      route,
      count: 0,
      sumSeconds: 0,
      buckets: durationBucketsSeconds.map(() => 0),
    };
    const durationSeconds = Math.max(0, input.durationMs) / 1_000;
    duration.count += 1;
    duration.sumSeconds += durationSeconds;
    durationBucketsSeconds.forEach((upperBound, index) => {
      if (durationSeconds <= upperBound) duration.buckets[index]! += 1;
    });
    this.#httpDurations.set(durationKey, duration);
  }

  recordLokiDeliveryFailure(droppedEntries: number): void {
    this.#lokiDeliveryFailures += 1;
    this.#lokiDroppedEntries += Math.max(0, droppedEntries);
  }

  recordLokiQueueOverflow(droppedEntries: number): void {
    this.#lokiDroppedEntries += Math.max(0, droppedEntries);
  }

  render(): string {
    const lines = [
      "# HELP wechat_layout_http_requests_total Completed API requests.",
      "# TYPE wechat_layout_http_requests_total counter",
    ];
    for (const counter of this.#httpCounters.values()) {
      lines.push(
        `wechat_layout_http_requests_total{${labels({ error_code: counter.errorCode, method: counter.method, route: counter.route, status_code: counter.statusCode })}} ${String(counter.count)}`,
      );
    }
    lines.push(
      "# HELP wechat_layout_http_request_duration_seconds API request duration.",
      "# TYPE wechat_layout_http_request_duration_seconds histogram",
    );
    for (const duration of this.#httpDurations.values()) {
      durationBucketsSeconds.forEach((upperBound, index) => {
        lines.push(
          `wechat_layout_http_request_duration_seconds_bucket{${labels({ le: upperBound, method: duration.method, route: duration.route })}} ${String(duration.buckets[index])}`,
        );
      });
      lines.push(
        `wechat_layout_http_request_duration_seconds_bucket{${labels({ le: "+Inf", method: duration.method, route: duration.route })}} ${String(duration.count)}`,
        `wechat_layout_http_request_duration_seconds_sum{${labels({ method: duration.method, route: duration.route })}} ${String(duration.sumSeconds)}`,
        `wechat_layout_http_request_duration_seconds_count{${labels({ method: duration.method, route: duration.route })}} ${String(duration.count)}`,
      );
    }
    lines.push(
      "# HELP wechat_layout_loki_delivery_failures_total Failed Loki push batches.",
      "# TYPE wechat_layout_loki_delivery_failures_total counter",
      `wechat_layout_loki_delivery_failures_total ${String(this.#lokiDeliveryFailures)}`,
      "# HELP wechat_layout_loki_dropped_entries_total Structured log entries dropped before Loki accepted them.",
      "# TYPE wechat_layout_loki_dropped_entries_total counter",
      `wechat_layout_loki_dropped_entries_total ${String(this.#lokiDroppedEntries)}`,
    );
    return `${lines.join("\n")}\n`;
  }
}
