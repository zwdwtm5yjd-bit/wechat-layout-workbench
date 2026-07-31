import { getCsrfToken } from "../auth/client";
import type { components } from "../api/openapi.generated";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type Article = Readonly<components["schemas"]["ArticleDto"]>;
export type ArticleDetail = Readonly<components["schemas"]["ArticleDetailDto"]>;
export type ArticleListResult = Readonly<components["schemas"]["ArticleListResultDto"]>;
export type ArticleStatus = Article["status"];

export interface ArticleListInput {
  readonly search?: string;
  readonly status?: ArticleStatus | "trash";
  readonly page?: number;
  readonly pageSize?: number;
}

export type CreateArticleInput = Readonly<
  Pick<components["schemas"]["CreateArticleDto"], "contentType" | "layoutStrength" | "title">
>;

interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

interface ApiFailure {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

export class ArticleClientError extends Error {
  override readonly name = "ArticleClientError";

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
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok || !isRecord(payload) || payload.success !== true || !("data" in payload)) {
    const failure = payload as ApiFailure;
    throw new ArticleClientError(
      response.status,
      failure.error?.code ?? "ARTICLE_REQUEST_FAILED",
      failure.error?.message ?? "文章服务暂时不可用",
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

export function listArticles(input: ArticleListInput): Promise<ArticleListResult> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 20),
    sort: "updated_desc",
  });
  if (input.status !== undefined) {
    query.set("status", input.status);
  }
  if (input.search !== undefined && input.search !== "") {
    query.set("search", input.search);
  }
  return request<ArticleListResult>(`/api/v1/articles?${query.toString()}`);
}

export function getArticle(articleId: string): Promise<ArticleDetail> {
  return request<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(articleId)}`);
}

export function createArticle(input: CreateArticleInput): Promise<ArticleDetail> {
  return write<ArticleDetail>("/api/v1/articles", "POST", {
    ...input,
    sourceType: "blank",
  });
}

export function duplicateArticle(articleId: string): Promise<ArticleDetail> {
  return write<ArticleDetail>(
    `/api/v1/articles/${encodeURIComponent(articleId)}/duplicate`,
    "POST",
    {
      copyMode: "full",
      contentGroupMode: "same_group",
    },
  );
}

export function archiveArticle(articleId: string): Promise<ArticleDetail> {
  return write<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(articleId)}/archive`, "POST");
}

export function unarchiveArticle(articleId: string): Promise<ArticleDetail> {
  return write<ArticleDetail>(
    `/api/v1/articles/${encodeURIComponent(articleId)}/unarchive`,
    "POST",
  );
}

export function trashArticle(articleId: string): Promise<ArticleDetail> {
  return write<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(articleId)}`, "DELETE");
}

export function restoreArticle(articleId: string): Promise<ArticleDetail> {
  return write<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(articleId)}/restore`, "POST");
}
