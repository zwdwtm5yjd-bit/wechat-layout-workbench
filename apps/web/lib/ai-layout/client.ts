import type {
  AiLayoutStatus,
  GenerateAiLayoutInput,
  GenerateAiLayoutResult,
} from "@wechat-layout/api-contracts";

import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

interface ApiFailure {
  readonly success: false;
  readonly error?: Readonly<{
    code?: string;
    message?: string;
  }>;
}

export class AiLayoutClientError extends Error {
  override readonly name = "AiLayoutClientError";

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
    throw new AiLayoutClientError(
      response.status,
      failure.error?.code ?? "AI_LAYOUT_REQUEST_FAILED",
      failure.error?.message ?? "AI 排版服务暂时不可用",
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

export function getAiLayoutStatus(): Promise<AiLayoutStatus> {
  return request<AiLayoutStatus>("/api/v1/ai-layout/status");
}

export async function generateAiLayout(
  articleId: string,
  input: GenerateAiLayoutInput,
): Promise<GenerateAiLayoutResult> {
  const csrfToken = await getCsrfToken();
  return request<GenerateAiLayoutResult>(
    `/api/v1/articles/${encodeURIComponent(articleId)}/ai-layout/plan`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(input),
    },
  );
}
