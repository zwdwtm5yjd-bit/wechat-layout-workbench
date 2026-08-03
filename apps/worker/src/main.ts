import { randomUUID } from "node:crypto";

import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";
import {
  createDatabaseConnection,
  verifyDatabaseSchema,
  type DatabaseConnection,
} from "@wechat-layout/database";
import {
  createRegisteredWorkers,
  JOB_CANCELLATION_CHANNEL,
  JobQueueRegistry,
  JobStore,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from "@wechat-layout/job-runtime";
import { S3CompatibleObjectStorage } from "@wechat-layout/storage-adapter";
import { createClient, type RedisClientType } from "redis";

import { createDocxImportHandler } from "./docx-handler.js";
import { maintenanceProbeHandler } from "./maintenance-handler.js";

interface CancellationMessage {
  readonly jobId: string;
  readonly reason?: string;
}

function parseCancellation(raw: string): CancellationMessage | null {
  try {
    const value = JSON.parse(raw) as { jobId?: unknown; reason?: unknown };
    if (typeof value.jobId !== "string") return null;
    return {
      jobId: value.jobId,
      ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    };
  } catch {
    return null;
  }
}

async function bootstrap(): Promise<void> {
  const configuration = loadServerEnvironment();
  const redisUrl = revealSecret(configuration.redis.url);
  const database: DatabaseConnection = createDatabaseConnection(
    revealSecret(configuration.database.url),
    { applicationName: "wechat-layout-worker" },
  );
  const queues = new JobQueueRegistry(redisUrl);
  const storage = new S3CompatibleObjectStorage({
    endpoint: configuration.objectStorage.endpoint,
    publicEndpoint: configuration.objectStorage.publicEndpoint,
    addressingStyle: configuration.objectStorage.addressingStyle,
    publicAddressingStyle: configuration.objectStorage.publicAddressingStyle,
    metadataHeaderPrefix: configuration.objectStorage.metadataHeaderPrefix,
    region: configuration.objectStorage.region,
    bucket: configuration.objectStorage.bucket,
    accessKeyId: revealSecret(configuration.objectStorage.accessKeyId),
    secretAccessKey: revealSecret(configuration.objectStorage.secretAccessKey),
  });
  const heartbeat: RedisClientType = createClient({ url: redisUrl });
  const cancellation: RedisClientType = heartbeat.duplicate();
  heartbeat.on("error", () => undefined);
  cancellation.on("error", () => undefined);

  try {
    await verifyDatabaseSchema(database);
    await Promise.all([heartbeat.connect(), cancellation.connect()]);

    const store = new JobStore(database);
    const workers = createRegisteredWorkers({
      concurrency: configuration.application.workerConcurrency,
      queues,
      registrations: [
        {
          queueName: "import-docx",
          handlers: {
            "import.docx.parse": createDocxImportHandler({
              database,
              storage,
              maximumDocxBytes: configuration.limits.docxFileBytes,
            }),
          },
        },
        {
          queueName: "maintenance",
          handlers: { "maintenance.probe": maintenanceProbeHandler },
        },
      ],
      store,
    });
    const instanceId = randomUUID();
    const writeHeartbeat = () =>
      heartbeat.set(
        WORKER_HEARTBEAT_KEY,
        JSON.stringify({
          instanceId,
          timestamp: new Date().toISOString(),
          queues: ["import-docx", "maintenance"],
          concurrency: configuration.application.workerConcurrency,
        }),
        { EX: WORKER_HEARTBEAT_TTL_SECONDS },
      );

    await writeHeartbeat();
    const heartbeatTimer = setInterval(() => void writeHeartbeat().catch(() => undefined), 5_000);
    await cancellation.subscribe(JOB_CANCELLATION_CHANNEL, (raw) => {
      const message = parseCancellation(raw);
      if (message === null) return;
      for (const worker of workers) {
        worker.cancelJob(message.jobId, message.reason);
      }
    });

    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;
      clearInterval(heartbeatTimer);
      process.stdout.write(`Worker 收到 ${signal}，正在安全退出。\n`);
      await Promise.allSettled(workers.map((worker) => worker.close()));
      await queues.close();
      if (cancellation.isOpen) await cancellation.close();
      if (heartbeat.isOpen) await heartbeat.close();
      await database.close();
    };

    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.stdout.write(
      `Worker ready (${configuration.application.environment}, concurrency=${String(configuration.application.workerConcurrency)}).\n`,
    );
  } catch (error) {
    await queues.close();
    if (cancellation.isOpen) await cancellation.close();
    if (heartbeat.isOpen) await heartbeat.close();
    await database.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知启动错误";
  process.stderr.write(`Worker 启动失败：${message}\n`);
  process.exitCode = 1;
});
