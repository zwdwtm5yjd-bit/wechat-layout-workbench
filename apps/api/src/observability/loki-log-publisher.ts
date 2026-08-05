import type { ApplicationMetrics } from "./application-metrics.service.js";

interface LokiEntry {
  readonly level: string;
  readonly line: string;
  readonly timestampNanoseconds: string;
}

export interface LokiLogPublisherOptions {
  readonly endpoint: string | null;
  readonly environment: string;
  readonly maximumQueuedEntries?: number;
  readonly request?: typeof fetch;
  readonly service: string;
}

export class LokiLogPublisher {
  readonly #endpoint: string | null;
  readonly #environment: string;
  readonly #maximumQueuedEntries: number;
  readonly #metrics: ApplicationMetrics;
  readonly #request: typeof fetch;
  readonly #service: string;
  readonly #timer: ReturnType<typeof setInterval> | null;
  #flushing: Promise<void> | null = null;
  #queue: LokiEntry[] = [];

  constructor(options: LokiLogPublisherOptions, metrics: ApplicationMetrics) {
    this.#endpoint = options.endpoint;
    this.#environment = options.environment;
    this.#maximumQueuedEntries = options.maximumQueuedEntries ?? 5_000;
    this.#metrics = metrics;
    this.#request = options.request ?? fetch;
    this.#service = options.service;
    this.#timer = this.#endpoint === null ? null : setInterval(() => void this.flush(), 1_000);
    this.#timer?.unref();
  }

  enqueue(record: Readonly<{ level: string; timestamp: string }> & Record<string, unknown>): void {
    if (this.#endpoint === null) return;
    const timestampMilliseconds = Date.parse(record.timestamp);
    const timestampNanoseconds = Number.isFinite(timestampMilliseconds)
      ? `${String(Math.trunc(timestampMilliseconds))}000000`
      : `${String(Date.now())}000000`;
    this.#queue.push({
      level: record.level,
      line: JSON.stringify(record),
      timestampNanoseconds,
    });
    const overflow = this.#queue.length - this.#maximumQueuedEntries;
    if (overflow > 0) {
      this.#queue.splice(0, overflow);
      this.#metrics.recordLokiQueueOverflow(overflow);
    }
  }

  async flush(): Promise<void> {
    if (this.#endpoint === null || this.#queue.length === 0) return;
    if (this.#flushing !== null) return this.#flushing;
    const batch = this.#queue.splice(0, 250);
    this.#flushing = this.push(batch).finally(() => {
      this.#flushing = null;
    });
    return this.#flushing;
  }

  async close(): Promise<void> {
    if (this.#timer !== null) clearInterval(this.#timer);
    if (this.#flushing !== null) await this.#flushing;
    while (this.#queue.length > 0) await this.flush();
  }

  private async push(batch: readonly LokiEntry[]): Promise<void> {
    try {
      const byLevel = new Map<string, LokiEntry[]>();
      for (const entry of batch) {
        const entries = byLevel.get(entry.level) ?? [];
        entries.push(entry);
        byLevel.set(entry.level, entries);
      }
      const response = await this.#request(this.#endpoint!, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          streams: [...byLevel.entries()].map(([level, entries]) => ({
            stream: {
              environment: this.#environment,
              level,
              service_name: this.#service,
            },
            values: entries.map((entry) => [entry.timestampNanoseconds, entry.line]),
          })),
        }),
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error(`Loki returned ${String(response.status)}`);
    } catch {
      this.#metrics.recordLokiDeliveryFailure(batch.length);
    }
  }
}
