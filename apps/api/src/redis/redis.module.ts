import {
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";
import { createClient } from "redis";

import { HealthModule } from "../health/health.module.js";
import { ReadinessRegistry, type ReadinessProbe } from "../health/readiness-registry.service.js";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");
export interface RedisClient {
  readonly isOpen: boolean;
  connect(): Promise<unknown>;
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
  eval(
    script: string,
    options: Readonly<{ keys: string[]; arguments: string[] }>,
  ): Promise<unknown>;
  close(): Promise<void>;
  destroy(): void;
}

@Injectable()
class RedisLifecycle implements OnModuleInit, OnModuleDestroy, ReadinessProbe {
  readonly name = "redis";

  #unregister?: () => void;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: RedisClient,
    @Inject(ReadinessRegistry)
    private readonly readiness: ReadinessRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
    this.#unregister = this.readiness.register(this);
  }

  async onModuleDestroy(): Promise<void> {
    this.#unregister?.();

    if (!this.client.isOpen) {
      return;
    }

    try {
      await this.client.close();
    } catch {
      this.client.destroy();
    }
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.client.ping();
      return {
        redis: {
          status: "up",
        },
      };
    } catch {
      return {
        redis: {
          status: "down",
          message: "Redis 连接不可用",
        },
      };
    }
  }
}

@Module({
  imports: [HealthModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): RedisClient => {
        const configuration = loadServerEnvironment();
        const client = createClient({
          url: revealSecret(configuration.redis.url),
          socket: {
            connectTimeout: 10_000,
            reconnectStrategy(retries) {
              return retries >= 5
                ? new Error("Redis 重连次数已耗尽")
                : Math.min(200 * 2 ** retries, 3_000);
            },
          },
        });

        client.on("error", () => undefined);
        return client as unknown as RedisClient;
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
