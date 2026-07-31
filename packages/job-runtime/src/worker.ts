import { UnrecoverableError, type Job, type Worker } from "bullmq";

import {
  CancelledJobError,
  type JobHandler,
  type JobJson,
  type JobQueueName,
  PermanentJobError,
  type QueueJobData,
  RetryableJobError,
} from "./contracts.js";
import { JobQueueRegistry } from "./queue.js";
import { JobStore } from "./store.js";

export interface JobWorkerRegistration {
  readonly queueName: JobQueueName;
  readonly handlers: Readonly<Record<string, JobHandler>>;
}

function classifiedJobError(
  error: unknown,
): Readonly<{ code: string; message: string; retryable: boolean }> | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string" &&
    "retryable" in error &&
    typeof error.retryable === "boolean"
  ) {
    return error as Readonly<{ code: string; message: string; retryable: boolean }>;
  }
  return undefined;
}

export async function executeJob(
  queued: Job<QueueJobData>,
  signal: AbortSignal | undefined,
  store: JobStore,
  handlers: Readonly<Record<string, JobHandler>>,
): Promise<JobJson> {
  const record = await store.find(queued.data.jobId);
  if (record === null) throw new UnrecoverableError("JOB_RECORD_NOT_FOUND");
  if (record.status === "cancelled") throw new UnrecoverableError("JOB_CANCELLED");
  const attempt = queued.attemptsMade + 1;
  const started = await store.markStarted(record.id, attempt);
  if (started === null) throw new UnrecoverableError("JOB_STATE_CONFLICT");
  const handler = handlers[started.jobType];

  const assertNotCancelled = async () => {
    if (signal?.aborted === true || (await store.isCancelled(started.id))) {
      throw new CancelledJobError();
    }
  };

  try {
    if (handler === undefined) {
      throw new PermanentJobError("JOB_TYPE_UNSUPPORTED", `未注册任务处理器：${started.jobType}`);
    }
    await assertNotCancelled();
    const result =
      (await handler({
        attempt,
        job: started,
        signal,
        assertNotCancelled,
        progress: async (value, message, metadata = {}) => {
          await assertNotCancelled();
          await queued.updateProgress(value);
          await store.recordProgress(started.id, value, message, metadata);
        },
      })) ?? {};
    await assertNotCancelled();
    if (!(await store.complete(started.id, result))) {
      throw new CancelledJobError();
    }
    return result;
  } catch (error) {
    const classified = classifiedJobError(error);
    if (
      error instanceof CancelledJobError ||
      classified?.code === "JOB_CANCELLED" ||
      (await store.isCancelled(started.id))
    ) {
      throw new UnrecoverableError("JOB_CANCELLED");
    }
    const permanent = classified?.retryable === false || error instanceof PermanentJobError;
    const retryable = classified?.retryable ?? !permanent;
    const retryPending = retryable && attempt < started.maxAttempts;
    const code =
      classified?.code ??
      (error instanceof PermanentJobError || error instanceof RetryableJobError
        ? error.code
        : "JOB_EXECUTION_FAILED");
    const message = error instanceof Error ? error.message : "未知任务错误";
    await store.fail(started.id, { attempt, code, message, retryable, retryPending });
    if (permanent) throw new UnrecoverableError(`${code}:${message}`);
    throw error instanceof Error ? error : new Error(message);
  }
}

export function createRegisteredWorkers(input: {
  readonly concurrency: number;
  readonly queues: JobQueueRegistry;
  readonly registrations: readonly JobWorkerRegistration[];
  readonly store: JobStore;
}): readonly Worker<QueueJobData>[] {
  return input.registrations.map((registration) => {
    const worker = input.queues.createWorker(
      registration.queueName,
      (job, _token, signal) => executeJob(job, signal, input.store, registration.handlers),
      { concurrency: input.concurrency },
    );
    worker.on("error", () => undefined);
    return worker;
  });
}
