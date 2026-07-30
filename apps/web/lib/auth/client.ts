import type { components } from "../api/openapi.generated";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

interface ApiMeta {
  readonly requestId: string;
  readonly traceId: string;
  readonly timestamp: string;
}

interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: ApiMeta;
}

interface ApiFailure {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly retryable: boolean;
  };
  readonly meta: ApiMeta;
}

export type AuthUser = components["schemas"]["AuthUserDto"];
export type CurrentAuthSession = components["schemas"]["CurrentUserResultDto"];
type CsrfResult = components["schemas"]["CsrfResultDto"];
type LoginInput = components["schemas"]["LoginDto"];
type LoginResult = components["schemas"]["LoginResultDto"];

export class AuthClientError extends Error {
  override readonly name = "AuthClientError";

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === "object" && input !== null;
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
    const retryAfter =
      isRecord(failure?.error?.details) &&
      typeof failure.error.details.retryAfterSeconds === "number"
        ? failure.error.details.retryAfterSeconds
        : undefined;

    throw new AuthClientError(
      response.status,
      failure?.error?.code ?? "AUTH_REQUEST_FAILED",
      failure?.error?.message ?? "认证服务暂时不可用",
      retryAfter,
    );
  }

  return (payload as unknown as ApiSuccess<T>).data;
}

export async function getCsrfToken(): Promise<string> {
  const result = await request<CsrfResult>("/api/v1/auth/csrf");
  return result.csrfToken;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const csrfToken = await getCsrfToken();

  return request<LoginResult>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(input),
  });
}

export function getCurrentUser(): Promise<CurrentAuthSession> {
  return request<CurrentAuthSession>("/api/v1/auth/me");
}

export async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken();
  await request<{ readonly revoked: boolean }>("/api/v1/auth/logout", {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
}

export async function revokeSession(sessionId: string): Promise<void> {
  const csrfToken = await getCsrfToken();
  await request<{ readonly revoked: boolean }>(
    `/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
    },
  );
}
