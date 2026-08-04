import type { components } from "../api/openapi.generated";
import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type Job = Readonly<components["schemas"]["JobResultDto"]>;
export type JobStatus = Job["status"];
export type JobListResult = Readonly<components["schemas"]["JobListResultDto"]>;

interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

interface ApiFailure {
  readonly error?: { readonly code?: string; readonly message?: string };
}

export class JobClientError extends Error {
  override readonly name = "JobClientError";

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json", ...init.headers },
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok || !isRecord(payload) || payload.success !== true || !("data" in payload)) {
    const failure = payload as ApiFailure;
    throw new JobClientError(
      response.status,
      failure.error?.code ?? "JOB_REQUEST_FAILED",
      failure.error?.message ?? "任务服务暂时不可用",
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

export function listJobs(
  input: {
    readonly status?: JobStatus;
    readonly page?: number;
    readonly pageSize?: number;
  } = {},
): Promise<JobListResult> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 30),
  });
  if (input.status !== undefined) query.set("status", input.status);
  return request<JobListResult>(`/api/v1/jobs?${query.toString()}`);
}

export function getJob(jobId: string): Promise<Job> {
  return request<Job>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
}

async function mutateJob(jobId: string, action: "cancel" | "retry"): Promise<Job> {
  const csrfToken = await getCsrfToken();
  return request<Job>(`/api/v1/jobs/${encodeURIComponent(jobId)}/${action}`, {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });
}

export function cancelJob(jobId: string): Promise<Job> {
  return mutateJob(jobId, "cancel");
}

export function retryJob(jobId: string): Promise<Job> {
  return mutateJob(jobId, "retry");
}
