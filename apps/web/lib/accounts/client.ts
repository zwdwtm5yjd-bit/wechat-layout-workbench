import type { components } from "../api/openapi.generated";
import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type Account = Readonly<components["schemas"]["AccountDto"]>;
export type AccountListResult = Readonly<components["schemas"]["AccountListResultDto"]>;
export type AccountStatus = Account["status"];
export type AccountDeleteImpact = Readonly<components["schemas"]["AccountDeleteImpactDto"]>;
export type CreateAccountInput = Readonly<components["schemas"]["CreateAccountDto"]>;
export type UpdateAccountInput = Readonly<components["schemas"]["UpdateAccountDto"]>;

interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

interface ApiFailure {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

export class AccountClientError extends Error {
  override readonly name = "AccountClientError";

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
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
    throw new AccountClientError(
      response.status,
      failure.error?.code ?? "ACCOUNT_REQUEST_FAILED",
      failure.error?.message ?? "公众号服务暂时不可用",
      failure.error?.details,
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

async function write<T>(path: string, method: "DELETE" | "PATCH" | "POST", body?: unknown) {
  const csrfToken = await getCsrfToken();
  return request<T>(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      "X-CSRF-Token": csrfToken,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function listAccounts(input: {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly status?: AccountStatus;
}): Promise<AccountListResult> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 50),
  });
  if (input.search !== undefined && input.search.trim() !== "") {
    query.set("search", input.search.trim());
  }
  if (input.status !== undefined) query.set("status", input.status);
  return request<AccountListResult>(`/api/v1/accounts?${query.toString()}`);
}

export function getAccount(accountId: string): Promise<Account> {
  return request<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}`);
}

export function createAccount(input: CreateAccountInput): Promise<Account> {
  return write<Account>("/api/v1/accounts", "POST", input);
}

export function updateAccount(accountId: string, input: UpdateAccountInput): Promise<Account> {
  return write<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}`, "PATCH", input);
}

export function setDefaultAccount(accountId: string): Promise<Account> {
  return write<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}/default`, "POST");
}

export function disableAccount(accountId: string): Promise<Account> {
  return write<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}/disable`, "POST");
}

export function enableAccount(accountId: string): Promise<Account> {
  return write<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}/enable`, "POST");
}

export function archiveAccount(accountId: string): Promise<Account> {
  return write<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}/archive`, "POST");
}

export function getAccountDeleteImpact(accountId: string): Promise<AccountDeleteImpact> {
  return request<AccountDeleteImpact>(
    `/api/v1/accounts/${encodeURIComponent(accountId)}/delete-impact`,
  );
}

export function permanentlyDeleteAccount(
  accountId: string,
): Promise<{ readonly accountId: string; readonly deleted: true }> {
  return write(`/api/v1/accounts/${encodeURIComponent(accountId)}`, "DELETE", {
    confirmationText: "DELETE",
  });
}
