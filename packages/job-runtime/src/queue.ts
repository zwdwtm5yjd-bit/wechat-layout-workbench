import { Job, Queue, type JobsOptions, Worker } from "bullmq";

import type { JobQueueName, JobRecord, QueueJobData } from "./contracts.js";
import { JOB_QUEUE_PREFIX, parseBullMqConnection } from "./connection.js";

export type QueueCancellationResult = "active" | "missing" | "removed" | "terminal";

export class JobQueueRegistry {
  readonly #connection;
  readonly #queues = new Map<JobQueueName, Queue<QueueJobData>>();

  constructor(redisUrl: string) {
    this.#connection = parseBullMqConnection(redisUrl);
  }

  async ensure(job: JobRecord): Promise<void> {
    if (!["queued", "retry_pending"].includes(job.status)) return;
    const queue = this.queue(job.queueName);
    if ((await queue.getJob(job.id)) !== undefined) return;
    await queue.add(job.jobType, { jobId: job.id }, this.options(job));
  }

  async cancel(job: JobRecord): Promise<QueueCancellationResult> {
    const queued = await this.queue(job.queueName).getJob(job.id);
    if (queued === undefined) return "missing";
    const state = await queued.getState();
    if (state === "active") return "active";
    if (state === "completed" || state === "failed") return "terminal";
    try {
      await queued.remove();
      return "removed";
    } catch {
      return (await queued.getState()) === "active" ? "active" : "terminal";
    }
  }

  async retry(job: JobRecord): Promise<void> {
    const queue = this.queue(job.queueName);
    const queued = await Job.fromId<QueueJobData>(queue, job.id);
    if (queued === undefined) {
      await queue.add(job.jobType, { jobId: job.id }, this.options(job));
      return;
    }
    const state = await queued.getState();
    if (state !== "failed") {
      throw new Error(`BullMQ 任务 ${job.id} 当前不可重试：${state}`);
    }
    await queued.retry("failed", {
      resetAttemptsMade: true,
      resetAttemptsStarted: true,
    });
  }

  createWorker(
    queueName: JobQueueName,
    processor: ConstructorParameters<typeof Worker<QueueJobData>>[1],
    options: Readonly<{ concurrency: number }>,
  ): Worker<QueueJobData> {
    return new Worker<QueueJobData>(queueName, processor, {
      connection: this.#connection,
      prefix: JOB_QUEUE_PREFIX,
      concurrency: options.concurrency,
      maxStalledCount: 1,
    });
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.#queues.values()].map((queue) => queue.close()));
    this.#queues.clear();
  }

  private queue(queueName: JobQueueName): Queue<QueueJobData> {
    const existing = this.#queues.get(queueName);
    if (existing !== undefined) return existing;
    const queue = new Queue<QueueJobData>(queueName, {
      connection: this.#connection,
      prefix: JOB_QUEUE_PREFIX,
    });
    queue.on("error", () => undefined);
    this.#queues.set(queueName, queue);
    return queue;
  }

  private options(job: JobRecord): JobsOptions {
    const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());
    return {
      jobId: job.id,
      attempts: job.maxAttempts,
      backoff: {
        type: "exponential",
        delay: 1_000,
        jitter: 0.25,
      },
      removeOnComplete: false,
      removeOnFail: false,
      ...(delay === 0 ? {} : { delay }),
      ...(job.priority === 0 ? {} : { priority: job.priority }),
    };
  }
}
