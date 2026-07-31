import { getCsrfToken } from "../auth/client";
import type { components } from "../api/openapi.generated";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type WechatOutputMode = components["schemas"]["CreateWechatRenderDto"]["outputMode"];

export interface CompatibilityIssue {
  readonly blockId?: string;
  readonly issueId: string;
  readonly message: string;
  readonly severity: "critical" | "suggestion" | "warning";
  readonly title: string;
}

export interface CompatibilityReport {
  readonly canCopy: boolean;
  readonly issues: readonly CompatibilityIssue[];
  readonly ruleVersion: string;
  readonly score: number;
  readonly status: "failed" | "passed" | "warning";
  readonly summary: {
    readonly critical: number;
    readonly suggestion: number;
    readonly total: number;
    readonly warning: number;
  };
}

export interface RenderOutput extends Omit<
  components["schemas"]["RenderOutputResponseDto"],
  "compatibilityReport"
> {
  readonly compatibilityReport: CompatibilityReport;
}

export type CopyPayload = components["schemas"]["CopyPayloadResponseDto"];

interface ApiSuccess<T> {
  readonly data: T;
  readonly success: true;
}

interface ApiFailure {
  readonly error?: {
    readonly code?: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly message?: string;
    readonly retryable?: boolean;
  };
}

export class CopyClientError extends Error {
  override readonly name = "CopyClientError";

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> | undefined,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

async function request<T>(path: string, body: Readonly<Record<string, unknown>>): Promise<T> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok || !isRecord(payload) || payload.success !== true || !("data" in payload)) {
    const failure = payload as ApiFailure;
    throw new CopyClientError(
      response.status,
      failure.error?.code ?? "COPY_REQUEST_FAILED",
      failure.error?.message ?? "复制服务暂时不可用",
      failure.error?.details,
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

function articlePath(articleId: string): string {
  return `/api/v1/articles/${encodeURIComponent(articleId)}`;
}

export function createWechatRender(input: {
  readonly articleId: string;
  readonly documentVersion: number;
  readonly outputMode: WechatOutputMode;
}): Promise<RenderOutput> {
  const body = {
    documentVersion: input.documentVersion,
    outputMode: input.outputMode,
  } satisfies components["schemas"]["CreateWechatRenderDto"];
  return request<RenderOutput>(`${articlePath(input.articleId)}/render-wechat`, body);
}

export function getCopyPayload(articleId: string, renderOutputId: string): Promise<CopyPayload> {
  const body = {
    renderOutputId,
  } satisfies components["schemas"]["CopyPayloadRequestDto"];
  return request<CopyPayload>(`${articlePath(articleId)}/copy-payload`, body);
}

export function createCopyRecord(input: {
  readonly articleId: string;
  readonly browserInfo: Readonly<Record<string, string>>;
  readonly failureReason?: string;
  readonly renderOutputId: string;
  readonly status: "failed" | "success";
}): Promise<components["schemas"]["CopyRecordResponseDto"]> {
  const body = {
    renderOutputId: input.renderOutputId,
    status: input.status,
    browserInfo: input.browserInfo,
    ...(input.failureReason === undefined ? {} : { failureReason: input.failureReason }),
  } satisfies components["schemas"]["CreateCopyRecordDto"];
  return request(`${articlePath(input.articleId)}/copy-records`, body);
}
