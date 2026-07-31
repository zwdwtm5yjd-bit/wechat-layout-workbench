import {
  createDatabaseConnection,
  createUuidV7,
  migrateDatabase,
  seedBaseData,
  users,
  type DatabaseConnection,
} from "../../packages/database/src/index.js";
import {
  createRegisteredWorkers,
  JobCoordinator,
  JobQueueRegistry,
  JobStore,
  type JobRecord,
} from "../../packages/job-runtime/src/index.js";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { maintenanceProbeHandler } from "../../apps/worker/src/maintenance-handler.js";

const postgresPassword = "job-runtime-postgres-password";
const redisPassword = "job-runtime-redis-password";

async function waitForDatabase(databaseUrl: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const probe = createDatabaseConnection(databaseUrl, {
      applicationName: "job-runtime-readiness",
      connectTimeoutSeconds: 1,
      maxConnections: 1,
    });
    try {
      await probe.sql`select 1`;
      await probe.close();
      return;
    } catch (error) {
      lastError = error;
      await probe.close().catch(() => undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

async function waitForStatus(
  store: JobStore,
  jobId: string,
  statuses: readonly JobRecord["status"][],
  timeoutMs = 20_000,
): Promise<JobRecord> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await store.find(jobId);
    if (job !== null && statuses.includes(job.status)) return job;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`等待任务状态超时：${jobId} -> ${statuses.join(",")}`);
}

async function waitForStartedEvents(
  store: JobStore,
  ownerUserId: string,
  jobId: string,
  count: number,
): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const events = await store.eventsOwned(ownerUserId, jobId);
    if (
      events !== null &&
      events.filter((event) => event.eventType === "started").length >= count
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`等待任务第 ${String(count)} 次启动超时：${jobId}`);
}

describe("PostgreSQL-authoritative BullMQ job runtime", () => {
  let postgres: StartedTestContainer;
  let redis: StartedTestContainer;
  let connection: DatabaseConnection;
  let queues: JobQueueRegistry;
  let workers: ReturnType<typeof createRegisteredWorkers>;
  let store: JobStore;
  let coordinator: JobCoordinator;
  let ownerUserId: string;
  let otherUserId: string;
  let redisUrl: string;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      new GenericContainer("postgres:18.4-alpine")
        .withEnvironment({
          POSTGRES_DB: "job_runtime_test",
          POSTGRES_PASSWORD: postgresPassword,
          POSTGRES_USER: "wechat_layout",
        })
        .withExposedPorts(5432)
        .withWaitStrategy(
          Wait.forSuccessfulCommand(
            "pg_isready --username wechat_layout --dbname job_runtime_test",
          ),
        )
        .withStartupTimeout(120_000)
        .start(),
      new GenericContainer("redis:8.2.8-alpine")
        .withCommand(["redis-server", "--appendonly", "yes", "--requirepass", redisPassword])
        .withExposedPorts(6379)
        .withWaitStrategy(
          Wait.forSuccessfulCommand(
            `redis-cli -a ${redisPassword} --no-auth-warning PING | grep -q PONG`,
          ),
        )
        .withStartupTimeout(120_000)
        .start(),
    ]);

    const databaseUrl = `postgresql://wechat_layout:${postgresPassword}@${postgres.getHost()}:${String(postgres.getMappedPort(5432))}/job_runtime_test`;
    redisUrl = `redis://:${redisPassword}@${redis.getHost()}:${String(redis.getMappedPort(6379))}/0`;
    await waitForDatabase(databaseUrl);
    await migrateDatabase(databaseUrl);
    connection = createDatabaseConnection(databaseUrl, { applicationName: "job-runtime-test" });
    ownerUserId = (
      await seedBaseData(connection.db, {
        environment: "test",
        ownerEmail: "jobs-owner@example.com",
      })
    ).ownerId;
    otherUserId = createUuidV7();
    await connection.db.insert(users).values({
      id: otherUserId,
      email: "jobs-other@example.com",
      displayName: "Other",
      passwordHash: "!disabled:test",
      role: "viewer",
      status: "disabled",
      timezone: "Asia/Shanghai",
      locale: "zh-CN",
    });

    store = new JobStore(connection);
    queues = new JobQueueRegistry(redisUrl);
    coordinator = new JobCoordinator(store, queues);
    workers = createRegisteredWorkers({
      concurrency: 2,
      queues,
      registrations: [
        {
          queueName: "maintenance",
          handlers: { "maintenance.probe": maintenanceProbeHandler },
        },
      ],
      store,
    });
  });

  afterAll(async () => {
    await Promise.allSettled(workers?.map((worker) => worker.close()) ?? []);
    await queues?.close();
    await connection?.close();
    await Promise.allSettled([postgres?.stop(), redis?.stop()]);
  });

  it("persists idempotent progress, retry, cancellation and permanent failure semantics", async () => {
    const successful = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId,
      idempotencyKey: "integration-success",
      payloadSummary: { durationMs: 50 },
      maxAttempts: 3,
    });
    const duplicate = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId,
      idempotencyKey: "integration-success",
      payloadSummary: { durationMs: 50 },
      maxAttempts: 3,
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.job.id).toBe(successful.job.id);

    const completed = await waitForStatus(store, successful.job.id, ["success"]);
    expect(completed.progress).toBe(100);
    const completedEvents = await store.eventsOwned(ownerUserId, successful.job.id);
    expect(completedEvents?.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["queued", "started", "progress", "completed"]),
    );
    const replayCursor = completedEvents?.[0];
    expect(replayCursor).toBeDefined();
    if (replayCursor !== undefined) {
      const replayed = await store.eventsOwned(ownerUserId, successful.job.id, replayCursor.id);
      expect(replayed?.some((event) => event.id === replayCursor.id)).toBe(false);
      expect(replayed?.at(-1)?.eventType).toBe("completed");
    }
    expect(await store.eventsOwned(otherUserId, successful.job.id)).toBeNull();

    const otherOwner = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId: otherUserId,
      idempotencyKey: "integration-success",
      payloadSummary: { durationMs: 0 },
    });
    expect(otherOwner.job.id).not.toBe(successful.job.id);
    await waitForStatus(store, otherOwner.job.id, ["success"]);

    const transient = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId,
      payloadSummary: { durationMs: 0, failureMode: "retryable_once" },
      maxAttempts: 3,
    });
    const retried = await waitForStatus(store, transient.job.id, ["success"]);
    expect(retried.attemptCount).toBe(2);
    const retriedEvents = await store.eventsOwned(ownerUserId, transient.job.id);
    expect(retriedEvents?.filter((event) => event.eventType === "started")).toHaveLength(2);
    expect(retriedEvents?.some((event) => event.eventType === "warning")).toBe(true);

    const permanent = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId,
      payloadSummary: { failureMode: "permanent" },
      maxAttempts: 5,
    });
    const permanentlyFailed = await waitForStatus(store, permanent.job.id, ["failed"]);
    expect(permanentlyFailed.attemptCount).toBe(1);
    expect(permanentlyFailed.resultSummary.retryable).toBe(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 1_200));
    expect((await store.find(permanent.job.id))?.attemptCount).toBe(1);

    const manual = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId,
      payloadSummary: { failureMode: "retryable_once" },
      maxAttempts: 1,
    });
    await waitForStatus(store, manual.job.id, ["failed"]);
    const prepared = await store.prepareRetryOwned(ownerUserId, manual.job.id);
    expect(prepared?.changed).toBe(true);
    if (prepared === null) throw new Error("手动重试准备失败");
    await queues.retry(prepared.job);
    await waitForStartedEvents(store, ownerUserId, manual.job.id, 2);
    await waitForStatus(store, manual.job.id, ["failed"]);

    const cancellable = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId,
      payloadSummary: { durationMs: 10_000 },
    });
    await waitForStatus(store, cancellable.job.id, ["running"]);
    const cancelled = await store.cancelOwned(ownerUserId, cancellable.job.id);
    expect(cancelled?.changed).toBe(true);
    if (cancelled === null) throw new Error("任务取消失败");
    const queueCancellation = await queues.cancel(cancelled.job);
    if (queueCancellation === "active") {
      for (const worker of workers)
        worker.cancelJob(cancellable.job.id, "integration cancellation");
    }
    expect((await store.find(cancellable.job.id))?.status).toBe("cancelled");
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    const cancelledEvents = await store.eventsOwned(ownerUserId, cancellable.job.id);
    expect(cancelledEvents?.some((event) => event.eventType === "cancelled")).toBe(true);
    expect(cancelledEvents?.some((event) => event.eventType === "completed")).toBe(false);

    await Promise.allSettled(workers.map((worker) => worker.close()));
    await queues.close();
    await redis.restart();

    const persisted = await store.find(successful.job.id);
    expect(persisted).toMatchObject({ id: successful.job.id, status: "success" });
    expect((await store.eventsOwned(ownerUserId, successful.job.id))?.length).toBe(
      completedEvents?.length,
    );

    queues = new JobQueueRegistry(redisUrl);
    coordinator = new JobCoordinator(store, queues);
    const afterRedisRestart = await coordinator.enqueue({
      queueName: "maintenance",
      jobType: "maintenance.probe",
      ownerUserId,
      idempotencyKey: "integration-success",
      payloadSummary: { durationMs: 0 },
    });
    expect(afterRedisRestart.created).toBe(false);
    expect(afterRedisRestart.job.id).toBe(successful.job.id);
  });
});
