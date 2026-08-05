import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import { ApplicationMetrics } from "../../observability/application-metrics.service.js";
import { LokiLogPublisher } from "../../observability/loki-log-publisher.js";
import type { RequestContext } from "./request-context.js";

export interface HttpLogRecord {
  readonly context: RequestContext;
  readonly durationMs: number;
  readonly errorCode?: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
}

@Injectable()
export class StructuredLoggerService implements OnModuleDestroy {
  readonly #publisher: LokiLogPublisher;

  constructor(@Inject(ApplicationMetrics) metrics: ApplicationMetrics) {
    this.#publisher = new LokiLogPublisher(
      {
        endpoint: process.env.LOKI_PUSH_URL ?? null,
        environment: process.env.APP_ENV ?? "development",
        service: "api",
      },
      metrics,
    );
  }

  logHttpRequest(record: HttpLogRecord): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level: record.statusCode >= 500 ? "error" : "info",
      service: "api",
      requestId: record.context.requestId,
      traceId: record.context.traceId,
      event: "http.request.completed",
      method: record.method,
      path: record.path,
      statusCode: record.statusCode,
      durationMs: Math.round(record.durationMs),
      ...(record.errorCode === undefined ? {} : { errorCode: record.errorCode }),
    };

    process.stdout.write(`${JSON.stringify(payload)}\n`);
    this.#publisher.enqueue(payload);
  }

  onModuleDestroy(): Promise<void> {
    return this.#publisher.close();
  }
}
