import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";

export interface ReadinessProbe {
  readonly name: string;
  check(): Promise<HealthIndicatorResult>;
}

@Injectable()
export class ReadinessRegistry {
  readonly #probes = new Map<string, ReadinessProbe>();

  register(probe: ReadinessProbe): () => void {
    if (this.#probes.has(probe.name)) {
      throw new Error(`就绪探针已注册：${probe.name}`);
    }

    this.#probes.set(probe.name, probe);
    return () => {
      this.#probes.delete(probe.name);
    };
  }

  async check(): Promise<HealthIndicatorResult> {
    const results = await Promise.all([...this.#probes.values()].map((probe) => probe.check()));

    return Object.assign(
      {
        api: {
          status: "up" as const,
          registeredDependencyChecks: this.#probes.size,
        },
      },
      ...results,
    );
  }
}
