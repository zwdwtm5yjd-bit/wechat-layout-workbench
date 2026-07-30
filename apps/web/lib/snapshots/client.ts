import type { components } from "../api/openapi.generated";
import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type SnapshotSummary = components["schemas"]["SnapshotSummaryDto"];
export type SnapshotDetail = components["schemas"]["SnapshotDetailDto"];
export type SnapshotListResult = components["schemas"]["SnapshotListResultDto"];
export type RestoreSnapshotResult = components["schemas"]["RestoreSnapshotResultDto"];

interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

interface ApiFailure {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly retryable?: boolean;
  };
}

export class SnapshotClientError extends Error {
  override readonly name = "SnapshotClientError";

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> | undefined,
    readonly retryable: boolean,
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
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok || !isRecord(payload) || payload.success !== true || !("data" in payload)) {
    const failure = payload as ApiFailure;
    throw new SnapshotClientError(
      response.status,
      failure.error?.code ?? "SNAPSHOT_REQUEST_FAILED",
      failure.error?.message ?? "版本服务暂时不可用",
      failure.error?.details,
      failure.error?.retryable ?? response.status >= 500,
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

function snapshotPath(articleId: string): string {
  return `/api/v1/articles/${encodeURIComponent(articleId)}/snapshots`;
}

export function listSnapshots(articleId: string, page = 1): Promise<SnapshotListResult> {
  return request<SnapshotListResult>(`${snapshotPath(articleId)}?page=${page}&pageSize=50`);
}

export function getSnapshot(articleId: string, snapshotId: string): Promise<SnapshotDetail> {
  return request<SnapshotDetail>(`${snapshotPath(articleId)}/${encodeURIComponent(snapshotId)}`);
}

export async function previewSnapshot(
  articleId: string,
  snapshotId: string,
): Promise<SnapshotDetail> {
  const csrfToken = await getCsrfToken();
  return request<SnapshotDetail>(
    `${snapshotPath(articleId)}/${encodeURIComponent(snapshotId)}/preview`,
    {
      method: "POST",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
    },
  );
}

export async function createManualSnapshot(
  articleId: string,
  note: string | null,
): Promise<SnapshotDetail> {
  const csrfToken = await getCsrfToken();
  const body = {
    reason: "manual",
    note,
  } satisfies components["schemas"]["CreateSnapshotDto"];
  return request<SnapshotDetail>(snapshotPath(articleId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function restoreSnapshot(input: {
  readonly articleId: string;
  readonly snapshotId: string;
  readonly baseVersion: number;
  readonly lastTransactionId: string;
}): Promise<RestoreSnapshotResult> {
  const csrfToken = await getCsrfToken();
  const body = {
    mode: "replace_current",
    baseVersion: input.baseVersion,
    lastTransactionId: input.lastTransactionId,
  } satisfies components["schemas"]["RestoreSnapshotDto"];
  return request<RestoreSnapshotResult>(
    `${snapshotPath(input.articleId)}/${encodeURIComponent(input.snapshotId)}/restore`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(body),
    },
  );
}
