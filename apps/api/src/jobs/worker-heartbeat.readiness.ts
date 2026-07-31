import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SECONDS } from "@wechat-layout/job-runtime";

import { ReadinessRegistry, type ReadinessProbe } from "../health/readiness-registry.service.js";
import { REDIS_CLIENT, type RedisClient } from "../redis/redis.module.js";

@Injectable()
export class WorkerHeartbeatReadiness implements OnModuleInit, OnModuleDestroy, ReadinessProbe {
  readonly name = "worker";

  #unregister?: () => void;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
    @Inject(ReadinessRegistry)
    private readonly readiness: ReadinessRegistry,
  ) {}

  onModuleInit(): void {
    this.#unregister = this.readiness.register(this);
  }

  onModuleDestroy(): void {
    this.#unregister?.();
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      const [raw, ttl] = await Promise.all([
        this.redis.get(WORKER_HEARTBEAT_KEY),
        this.redis.ttl(WORKER_HEARTBEAT_KEY),
      ]);
      if (raw === null || ttl <= 0) throw new Error("heartbeat missing");
      const heartbeat = JSON.parse(raw) as { timestamp?: unknown };
      if (typeof heartbeat.timestamp !== "string") throw new Error("heartbeat invalid");
      const age = Date.now() - Date.parse(heartbeat.timestamp);
      if (!Number.isFinite(age) || age > WORKER_HEARTBEAT_TTL_SECONDS * 1_000) {
        throw new Error("heartbeat stale");
      }
      return { worker: { status: "up", heartbeatAgeMs: Math.max(0, age) } };
    } catch {
      return { worker: { status: "down", message: "Worker 心跳缺失或已过期" } };
    }
  }
}
