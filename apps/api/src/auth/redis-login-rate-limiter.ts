import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { REDIS_CLIENT, type RedisClient } from "../redis/redis.module.js";
import { AUTH_OPTIONS } from "./auth.constants.js";
import type { AuthRuntimeOptions, LoginRateLimiter, LoginRateLimitState } from "./auth.types.js";

const incrementScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { count, ttl }
`;

interface CounterState {
  readonly count: number;
  readonly ttlSeconds: number;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class RedisLoginRateLimiter implements LoginRateLimiter {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthRuntimeOptions,
  ) {}

  async check(identifier: string, ipAddress: string | null): Promise<LoginRateLimitState> {
    const [identifierState, ipState] = await Promise.all([
      this.readCounter(this.identifierKey(identifier)),
      this.readCounter(this.ipKey(ipAddress)),
    ]);

    return this.toLimitState(identifierState, ipState);
  }

  async recordFailure(identifier: string, ipAddress: string | null): Promise<LoginRateLimitState> {
    const [identifierState, ipState] = await Promise.all([
      this.increment(this.identifierKey(identifier)),
      this.increment(this.ipKey(ipAddress)),
    ]);

    return this.toLimitState(identifierState, ipState);
  }

  async resetIdentifier(identifier: string): Promise<void> {
    await this.redis.del(this.identifierKey(identifier));
  }

  private identifierKey(identifier: string): string {
    return `auth:login:identifier:${digest(identifier)}`;
  }

  private ipKey(ipAddress: string | null): string {
    return `auth:login:ip:${digest(ipAddress ?? "unknown")}`;
  }

  private async readCounter(key: string): Promise<CounterState> {
    const [countValue, ttlValue] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);

    return {
      count: Number.parseInt(countValue ?? "0", 10) || 0,
      ttlSeconds: Math.max(0, ttlValue),
    };
  }

  private async increment(key: string): Promise<CounterState> {
    const result = await this.redis.eval(incrementScript, {
      keys: [key],
      arguments: [String(this.options.loginRateLimitWindowSeconds)],
    });

    if (!Array.isArray(result) || result.length < 2) {
      throw new Error("Redis 登录限流脚本返回无效结果");
    }

    return {
      count: Number(result[0]),
      ttlSeconds: Math.max(0, Number(result[1])),
    };
  }

  private toLimitState(identifier: CounterState, ipAddress: CounterState): LoginRateLimitState {
    const identifierBlocked = identifier.count >= this.options.loginIdentifierMaxAttempts;
    const ipBlocked = ipAddress.count >= this.options.loginIpMaxAttempts;

    return {
      allowed: !identifierBlocked && !ipBlocked,
      retryAfterSeconds: Math.max(
        identifierBlocked ? identifier.ttlSeconds : 0,
        ipBlocked ? ipAddress.ttlSeconds : 0,
      ),
    };
  }
}
