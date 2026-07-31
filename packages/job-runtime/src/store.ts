import { createHash } from "node:crypto";

import { createUuidV7, jobEvents, jobs, type DatabaseConnection } from "@wechat-layout/database";
import { and, asc, count, desc, eq, gt, inArray, or, type SQL } from "drizzle-orm";

import type {
  EnqueueJobInput,
  JobEventRecord,
  JobEventType,
  JobJson,
  JobListQuery,
  JobListResult,
  JobRecord,
  JobStatus,
} from "./contracts.js";
import { isJobQueueName, isJobStatus } from "./contracts.js";

type JobRow = typeof jobs.$inferSelect;
type JobEventRow = typeof jobEvents.$inferSelect;

function asMutableJson(value: JobJson | undefined): Record<string, unknown> {
  return { ...(value ?? {}) };
}

function jobRecord(row: JobRow): JobRecord {
  if (!isJobQueueName(row.queueName) || !isJobStatus(row.status)) {
    throw new Error(`数据库任务状态或队列无效：${row.id}`);
  }
  return {
    ...row,
    queueName: row.queueName,
    status: row.status,
    payloadSummary: row.payloadSummary,
    resultSummary: row.resultSummary,
  };
}

function eventRecord(row: JobEventRow): JobEventRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    eventType: row.eventType as JobEventType,
    progress: row.progress,
    message: row.message,
    metadata: row.metadataJson,
    createdAt: row.createdAt,
  };
}

function scopedIdempotencyKey(ownerUserId: string, key: string | undefined): string | null {
  const normalized = key?.trim();
  if (!normalized) {
    return null;
  }
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `owner:${ownerUserId}:${digest}`;
}

export class JobStore {
  constructor(private readonly connection: DatabaseConnection) {}

  async create(
    input: EnqueueJobInput,
  ): Promise<{ readonly created: boolean; readonly job: JobRecord }> {
    const idempotencyKey = scopedIdempotencyKey(input.ownerUserId, input.idempotencyKey);
    const id = createUuidV7();
    const created = await this.connection.db.transaction(async (transaction) => {
      const [row] = await transaction
        .insert(jobs)
        .values({
          id,
          queueName: input.queueName,
          jobType: input.jobType,
          ownerUserId: input.ownerUserId,
          articleId: input.articleId ?? null,
          accountId: input.accountId ?? null,
          priority: input.priority ?? 0,
          idempotencyKey,
          payloadRef: input.payloadRef ?? null,
          payloadSummary: asMutableJson(input.payloadSummary),
          maxAttempts: input.maxAttempts ?? 3,
          scheduledAt: input.scheduledAt ?? new Date(),
          traceId: input.traceId ?? null,
        })
        .onConflictDoNothing()
        .returning();
      if (row === undefined) {
        return null;
      }
      await transaction.insert(jobEvents).values({
        id: createUuidV7(),
        jobId: row.id,
        eventType: "queued",
        progress: 0,
        message: "任务已进入队列",
      });
      return row;
    });

    if (created !== null) {
      return { created: true, job: jobRecord(created) };
    }
    if (idempotencyKey === null) {
      throw new Error("任务主键冲突");
    }
    const existing = await this.findByIdempotencyKey(input.ownerUserId, idempotencyKey);
    if (existing === null) {
      throw new Error("幂等任务冲突但无法读取原任务");
    }
    if (existing.queueName !== input.queueName || existing.jobType !== input.jobType) {
      throw new Error("同一幂等键不能用于不同任务");
    }
    return { created: false, job: existing };
  }

  async find(jobId: string): Promise<JobRecord | null> {
    const [row] = await this.connection.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    return row === undefined ? null : jobRecord(row);
  }

  async findOwned(ownerUserId: string, jobId: string): Promise<JobRecord | null> {
    const [row] = await this.connection.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.ownerUserId, ownerUserId)))
      .limit(1);
    return row === undefined ? null : jobRecord(row);
  }

  async listOwned(ownerUserId: string, query: JobListQuery): Promise<JobListResult> {
    const filters: SQL[] = [eq(jobs.ownerUserId, ownerUserId)];
    if (query.status !== undefined) filters.push(eq(jobs.status, query.status));
    if (query.jobType !== undefined) filters.push(eq(jobs.jobType, query.jobType));
    if (query.articleId !== undefined) filters.push(eq(jobs.articleId, query.articleId));
    if (query.accountId !== undefined) filters.push(eq(jobs.accountId, query.accountId));
    const where = and(...filters);
    const [rows, totals] = await Promise.all([
      this.connection.db
        .select()
        .from(jobs)
        .where(where)
        .orderBy(desc(jobs.createdAt), desc(jobs.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.connection.db.select({ value: count() }).from(jobs).where(where),
    ]);
    return {
      items: rows.map(jobRecord),
      page: query.page,
      pageSize: query.pageSize,
      total: totals[0]?.value ?? 0,
    };
  }

  async eventsOwned(
    ownerUserId: string,
    jobId: string,
    afterEventId?: string,
    limit = 100,
  ): Promise<readonly JobEventRecord[] | null> {
    if ((await this.findOwned(ownerUserId, jobId)) === null) {
      return null;
    }
    const filters: SQL[] = [eq(jobEvents.jobId, jobId)];
    if (afterEventId !== undefined) {
      const [cursor] = await this.connection.db
        .select({ id: jobEvents.id })
        .from(jobEvents)
        .where(and(eq(jobEvents.jobId, jobId), eq(jobEvents.id, afterEventId)))
        .limit(1);
      if (cursor !== undefined) {
        const cursorCreatedAt = this.connection.db
          .select({ value: jobEvents.createdAt })
          .from(jobEvents)
          .where(and(eq(jobEvents.jobId, jobId), eq(jobEvents.id, afterEventId)))
          .limit(1);
        filters.push(
          or(
            gt(jobEvents.createdAt, cursorCreatedAt),
            and(eq(jobEvents.createdAt, cursorCreatedAt), gt(jobEvents.id, cursor.id)),
          )!,
        );
      }
    }
    const rows = await this.connection.db
      .select()
      .from(jobEvents)
      .where(and(...filters))
      .orderBy(asc(jobEvents.createdAt), asc(jobEvents.id))
      .limit(Math.min(Math.max(limit, 1), 500));
    return rows.map(eventRecord);
  }

  async latestEvent(jobId: string): Promise<JobEventRecord | null> {
    const [row] = await this.connection.db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, jobId))
      .orderBy(desc(jobEvents.createdAt), desc(jobEvents.id))
      .limit(1);
    return row === undefined ? null : eventRecord(row);
  }

  async markStarted(jobId: string, attempt: number): Promise<JobRecord | null> {
    return this.transition(
      jobId,
      ["queued", "retry_pending"],
      {
        status: "running",
        attemptCount: attempt,
        startedAt: new Date(),
        failedAt: null,
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      },
      "started",
      `开始执行（第 ${String(attempt)} 次）`,
      { attempt },
    );
  }

  async recordProgress(
    jobId: string,
    progress: number,
    message: string,
    metadata: JobJson = {},
  ): Promise<boolean> {
    const value = Math.min(Math.max(Math.round(progress), 0), 100);
    const result = await this.transition(
      jobId,
      ["running"],
      { progress: value, updatedAt: new Date() },
      "progress",
      message,
      metadata,
      value,
    );
    return result !== null;
  }

  async complete(jobId: string, resultSummary: JobJson = {}, resultRef?: string): Promise<boolean> {
    const result = await this.transition(
      jobId,
      ["running"],
      {
        status: "success",
        progress: 100,
        resultRef: resultRef ?? null,
        resultSummary: asMutableJson(resultSummary),
        completedAt: new Date(),
        failedAt: null,
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      },
      "completed",
      "任务执行完成",
      resultSummary,
      100,
    );
    return result !== null;
  }

  async fail(
    jobId: string,
    input: {
      readonly code: string;
      readonly message: string;
      readonly retryable: boolean;
      readonly retryPending: boolean;
      readonly attempt: number;
    },
  ): Promise<boolean> {
    const result = await this.transition(
      jobId,
      ["running", "queued", "retry_pending"],
      {
        status: input.retryPending ? "retry_pending" : "failed",
        errorCode: input.code,
        errorMessage: input.message.slice(0, 2_000),
        resultSummary: { retryable: input.retryable },
        failedAt: input.retryPending ? null : new Date(),
        updatedAt: new Date(),
      },
      input.retryPending ? "warning" : "failed",
      input.retryPending ? "任务失败，已进入自动重试" : "任务执行失败",
      {
        attempt: input.attempt,
        errorCode: input.code,
        retryable: input.retryable,
      },
    );
    return result !== null;
  }

  async cancelOwned(
    ownerUserId: string,
    jobId: string,
  ): Promise<{ readonly changed: boolean; readonly job: JobRecord } | null> {
    const owned = await this.findOwned(ownerUserId, jobId);
    if (owned === null) return null;
    if (!["queued", "running", "retry_pending"].includes(owned.status)) {
      return { changed: false, job: owned };
    }
    const changed = await this.transition(
      jobId,
      ["queued", "running", "retry_pending"],
      {
        status: "cancelled",
        completedAt: new Date(),
        errorCode: "JOB_CANCELLED",
        errorMessage: "用户取消任务",
        resultSummary: { retryable: false },
        updatedAt: new Date(),
      },
      "cancelled",
      "任务已取消",
      {},
    );
    return { changed: changed !== null, job: changed ?? owned };
  }

  async prepareRetryOwned(
    ownerUserId: string,
    jobId: string,
  ): Promise<{ readonly changed: boolean; readonly job: JobRecord } | null> {
    const owned = await this.findOwned(ownerUserId, jobId);
    if (owned === null) return null;
    if (owned.status !== "failed" || owned.resultSummary.retryable !== true) {
      return { changed: false, job: owned };
    }
    const changed = await this.transition(
      jobId,
      ["failed"],
      {
        status: "retry_pending",
        progress: 0,
        attemptCount: 0,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        errorCode: null,
        errorMessage: null,
        resultSummary: {},
        updatedAt: new Date(),
      },
      "queued",
      "任务已手动重试",
      { manualRetry: true },
      0,
    );
    return { changed: changed !== null, job: changed ?? owned };
  }

  async isCancelled(jobId: string): Promise<boolean> {
    const job = await this.find(jobId);
    return job?.status === "cancelled";
  }

  private async findByIdempotencyKey(
    ownerUserId: string,
    idempotencyKey: string,
  ): Promise<JobRecord | null> {
    const [row] = await this.connection.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.ownerUserId, ownerUserId), eq(jobs.idempotencyKey, idempotencyKey)))
      .limit(1);
    return row === undefined ? null : jobRecord(row);
  }

  private async transition(
    jobId: string,
    fromStatuses: readonly JobStatus[],
    values: Partial<typeof jobs.$inferInsert>,
    eventType: JobEventType,
    message: string,
    metadata: JobJson,
    progress?: number,
  ): Promise<JobRecord | null> {
    return this.connection.db.transaction(async (transaction) => {
      const [row] = await transaction
        .update(jobs)
        .set(values)
        .where(and(eq(jobs.id, jobId), inArray(jobs.status, [...fromStatuses])))
        .returning();
      if (row === undefined) return null;
      await transaction.insert(jobEvents).values({
        id: createUuidV7(),
        jobId,
        eventType,
        progress: progress ?? row.progress,
        message,
        metadataJson: asMutableJson(metadata),
      });
      return jobRecord(row);
    });
  }
}
