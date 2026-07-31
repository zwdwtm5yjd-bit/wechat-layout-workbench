import type { EnqueueJobInput, JobRecord } from "./contracts.js";
import { JobQueueRegistry } from "./queue.js";
import { JobStore } from "./store.js";

export class JobCoordinator {
  constructor(
    private readonly store: JobStore,
    private readonly queues: JobQueueRegistry,
  ) {}

  async enqueue(
    input: EnqueueJobInput,
  ): Promise<{ readonly created: boolean; readonly job: JobRecord }> {
    const result = await this.store.create(input);
    try {
      await this.queues.ensure(result.job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "队列连接失败";
      await this.store.fail(result.job.id, {
        attempt: result.job.attemptCount,
        code: "QUEUE_ENQUEUE_FAILED",
        message,
        retryable: true,
        retryPending: false,
      });
      throw error;
    }
    return result;
  }
}
