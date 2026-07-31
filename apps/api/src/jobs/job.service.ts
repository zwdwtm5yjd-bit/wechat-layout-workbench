import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type MessageEvent,
  NotFoundException,
} from "@nestjs/common";
import { isUuidV7 } from "@wechat-layout/database";
import {
  JOB_CANCELLATION_CHANNEL,
  type EnqueueJobInput,
  type JobCoordinator,
  type JobEventRecord,
  type JobQueueRegistry,
  type JobRecord,
  type JobStore,
} from "@wechat-layout/job-runtime";
import { Observable } from "rxjs";

import { REDIS_CLIENT, type RedisClient } from "../redis/redis.module.js";
import { JOB_COORDINATOR, JOB_QUEUES, JOB_STORE } from "./job.constants.js";
import type {
  JobEventResultDto,
  JobListQueryDto,
  JobListResultDto,
  JobResultDto,
} from "./job.dto.js";

const TERMINAL_STATUSES = new Set(["success", "failed", "cancelled"]);

function assertJobId(value: string, field = "jobId"): void {
  if (!isUuidV7(value)) {
    throw new BadRequestException(`${field} 必须是 UUIDv7`);
  }
}

function eventResult(event: JobEventRecord): JobEventResultDto {
  return {
    id: event.id,
    jobId: event.jobId,
    eventType: event.eventType,
    progress: event.progress,
    message: event.message,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

function jobResult(job: JobRecord, latestMessage: string | null): JobResultDto {
  return {
    id: job.id,
    queueName: job.queueName,
    jobType: job.jobType,
    status: job.status,
    progress: job.progress,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    articleId: job.articleId,
    accountId: job.accountId,
    resultRef: job.resultRef,
    resultSummary: job.resultSummary,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    latestMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class JobService {
  constructor(
    @Inject(JOB_STORE)
    private readonly store: JobStore,
    @Inject(JOB_QUEUES)
    private readonly queues: JobQueueRegistry,
    @Inject(JOB_COORDINATOR)
    private readonly coordinator: JobCoordinator,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
  ) {}

  enqueue(input: EnqueueJobInput) {
    return this.coordinator.enqueue(input);
  }

  async get(ownerUserId: string, jobId: string): Promise<JobResultDto> {
    assertJobId(jobId);
    const job = await this.store.findOwned(ownerUserId, jobId);
    if (job === null) throw new NotFoundException("任务不存在");
    const latest = await this.store.latestEvent(job.id);
    return jobResult(job, latest?.message ?? null);
  }

  async list(ownerUserId: string, query: JobListQueryDto): Promise<JobListResultDto> {
    const result = await this.store.listOwned(ownerUserId, query);
    const items = await Promise.all(
      result.items.map(async (job) => {
        const latest = await this.store.latestEvent(job.id);
        return jobResult(job, latest?.message ?? null);
      }),
    );
    return { items, page: result.page, pageSize: result.pageSize, total: result.total };
  }

  async cancel(ownerUserId: string, jobId: string): Promise<JobResultDto> {
    assertJobId(jobId);
    const result = await this.store.cancelOwned(ownerUserId, jobId);
    if (result === null) throw new NotFoundException("任务不存在");

    if (result.changed) {
      try {
        const queueResult = await this.queues.cancel(result.job);
        if (queueResult === "active" || queueResult === "missing") {
          await this.redis.publish(
            JOB_CANCELLATION_CHANNEL,
            JSON.stringify({ jobId: result.job.id, reason: "用户取消任务" }),
          );
        }
      } catch {
        // PostgreSQL 已是取消权威状态；Worker 仍会在下一个阶段边界检查该状态。
      }
    }

    const current = (await this.store.findOwned(ownerUserId, jobId)) ?? result.job;
    const latest = await this.store.latestEvent(jobId);
    return jobResult(current, latest?.message ?? null);
  }

  async retry(ownerUserId: string, jobId: string): Promise<JobResultDto> {
    assertJobId(jobId);
    const result = await this.store.prepareRetryOwned(ownerUserId, jobId);
    if (result === null) throw new NotFoundException("任务不存在");
    if (!result.changed) {
      throw new ConflictException("只有允许重试的失败任务可以手动重试");
    }

    try {
      await this.queues.retry(result.job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "队列重试失败";
      await this.store.fail(jobId, {
        attempt: result.job.attemptCount,
        code: "QUEUE_RETRY_FAILED",
        message,
        retryable: true,
        retryPending: false,
      });
      throw error;
    }

    const current = (await this.store.findOwned(ownerUserId, jobId)) ?? result.job;
    const latest = await this.store.latestEvent(jobId);
    return jobResult(current, latest?.message ?? null);
  }

  async events(
    ownerUserId: string,
    jobId: string,
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    assertJobId(jobId);
    if (lastEventId !== undefined) assertJobId(lastEventId, "Last-Event-ID");
    if ((await this.store.findOwned(ownerUserId, jobId)) === null) {
      throw new NotFoundException("任务不存在");
    }

    return new Observable<MessageEvent>((subscriber) => {
      let cursor = lastEventId;
      let polling = false;
      let stopped = false;

      const poll = async (): Promise<void> => {
        if (polling || stopped) return;
        polling = true;
        try {
          const events = await this.store.eventsOwned(ownerUserId, jobId, cursor);
          if (events === null) {
            subscriber.error(new NotFoundException("任务不存在"));
            stopped = true;
            return;
          }
          for (const event of events) {
            cursor = event.id;
            subscriber.next({
              id: event.id,
              type: event.eventType,
              data: eventResult(event),
              retry: 1_000,
            });
          }
          const current = await this.store.findOwned(ownerUserId, jobId);
          if (current !== null && TERMINAL_STATUSES.has(current.status) && events.length === 0) {
            subscriber.complete();
            stopped = true;
          }
        } catch (error) {
          subscriber.error(error);
          stopped = true;
        } finally {
          polling = false;
        }
      };

      void poll();
      const timer = setInterval(() => void poll(), 750);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    });
  }
}
