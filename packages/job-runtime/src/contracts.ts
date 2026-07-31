export const JOB_QUEUE_NAMES = [
  "import-docx",
  "import-webpage",
  "image-process",
  "svg-render",
  "svg-fallback",
  "wechat-render",
  "compatibility-check",
  "preview-render",
  "material-install",
  "wechat-sync",
  "backup",
  "maintenance",
] as const;

export type JobQueueName = (typeof JOB_QUEUE_NAMES)[number];

export const JOB_STATUSES = [
  "queued",
  "running",
  "success",
  "failed",
  "cancelled",
  "retry_pending",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_EVENT_TYPES = [
  "queued",
  "started",
  "progress",
  "warning",
  "completed",
  "failed",
  "cancelled",
] as const;

export type JobEventType = (typeof JOB_EVENT_TYPES)[number];
export type JobJson = Readonly<Record<string, unknown>>;

export interface JobRecord {
  readonly id: string;
  readonly queueName: JobQueueName;
  readonly jobType: string;
  readonly ownerUserId: string;
  readonly articleId: string | null;
  readonly accountId: string | null;
  readonly status: JobStatus;
  readonly priority: number;
  readonly progress: number;
  readonly idempotencyKey: string | null;
  readonly payloadRef: string | null;
  readonly payloadSummary: JobJson;
  readonly resultRef: string | null;
  readonly resultSummary: JobJson;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly scheduledAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly failedAt: Date | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly traceId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface JobEventRecord {
  readonly id: string;
  readonly jobId: string;
  readonly eventType: JobEventType;
  readonly progress: number | null;
  readonly message: string | null;
  readonly metadata: JobJson;
  readonly createdAt: Date;
}

export interface EnqueueJobInput {
  readonly queueName: JobQueueName;
  readonly jobType: string;
  readonly ownerUserId: string;
  readonly articleId?: string;
  readonly accountId?: string;
  readonly priority?: number;
  readonly idempotencyKey?: string;
  readonly payloadRef?: string;
  readonly payloadSummary?: JobJson;
  readonly maxAttempts?: number;
  readonly scheduledAt?: Date;
  readonly traceId?: string;
}

export interface JobListQuery {
  readonly status?: JobStatus;
  readonly jobType?: string;
  readonly articleId?: string;
  readonly accountId?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface JobListResult {
  readonly items: readonly JobRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface QueueJobData {
  readonly jobId: string;
}

export interface JobHandlerContext {
  readonly attempt: number;
  readonly job: JobRecord;
  readonly signal: AbortSignal | undefined;
  assertNotCancelled(): Promise<void>;
  progress(value: number, message: string, metadata?: JobJson): Promise<void>;
}

export type JobHandler = (context: JobHandlerContext) => Promise<JobJson | void>;

export class RetryableJobError extends Error {
  override readonly name = "RetryableJobError";
  readonly retryable = true;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class PermanentJobError extends Error {
  override readonly name = "PermanentJobError";
  readonly retryable = false;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class CancelledJobError extends PermanentJobError {
  constructor(message = "任务已取消") {
    super("JOB_CANCELLED", message);
  }
}

export function isJobQueueName(value: string): value is JobQueueName {
  return JOB_QUEUE_NAMES.some((queueName) => queueName === value);
}

export function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUSES.some((status) => status === value);
}
