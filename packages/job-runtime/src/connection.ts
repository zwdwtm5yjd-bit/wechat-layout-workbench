import type { ConnectionOptions } from "bullmq";

export const JOB_QUEUE_PREFIX = "wechat-layout";
export const JOB_CANCELLATION_CHANNEL = "wechat-layout:jobs:cancel";
export const WORKER_HEARTBEAT_KEY = "wechat-layout:worker:heartbeat";
export const WORKER_HEARTBEAT_TTL_SECONDS = 15;

export function parseBullMqConnection(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error("BullMQ 仅支持 redis:// 或 rediss:// 连接");
  }

  const databaseText = parsed.pathname.replace(/^\//, "");
  const database = databaseText === "" ? 0 : Number(databaseText);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error("REDIS_URL 的数据库编号无效");
  }

  return {
    host: parsed.hostname,
    port: parsed.port === "" ? 6379 : Number(parsed.port),
    db: database,
    maxRetriesPerRequest: null,
    ...(parsed.username === "" ? {} : { username: decodeURIComponent(parsed.username) }),
    ...(parsed.password === "" ? {} : { password: decodeURIComponent(parsed.password) }),
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
