import type { components } from "../api/openapi.generated";
import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type DocumentJson = Readonly<Record<string, unknown>>;
export type DocumentSchemaVersion =
  components["schemas"]["SaveArticleDocumentDto"]["schemaVersion"];

export type ArticleDocumentSourceBlock = components["schemas"]["ArticleDocumentSourceBlockDto"];

export interface ArticleDocument {
  readonly documentId: string;
  readonly articleId: string;
  readonly schemaVersion: DocumentSchemaVersion;
  readonly documentVersion: number;
  readonly document: DocumentJson;
  readonly textLocked: boolean;
  readonly originalTextHash: string | null;
  readonly currentTextHash: string | null;
  readonly lastTransactionId: string | null;
  readonly lastSavedBy: string;
  readonly lastSavedAt: string;
  readonly sourceBlocks: readonly ArticleDocumentSourceBlock[];
}

export interface SaveArticleDocumentInput {
  readonly articleId: string;
  readonly baseVersion: number;
  readonly schemaVersion: DocumentSchemaVersion;
  readonly document: DocumentJson;
  readonly lastTransactionId: string;
  readonly transactionOrigin: string;
  readonly appearance?: {
    readonly paletteId: string;
    readonly themeId: string;
    readonly themeVersion: string;
  };
}

export interface SaveArticleDocumentResult {
  readonly documentVersion: number;
  readonly lastTransactionId: string;
  readonly lastSavedAt: string;
  readonly replayed: boolean;
}

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

export class DocumentClientError extends Error {
  override readonly name = "DocumentClientError";

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
    throw new DocumentClientError(
      response.status,
      failure.error?.code ?? "DOCUMENT_REQUEST_FAILED",
      failure.error?.message ?? "文档服务暂时不可用",
      failure.error?.details,
      failure.error?.retryable ?? response.status >= 500,
    );
  }

  return (payload as unknown as ApiSuccess<T>).data;
}

export function getArticleDocument(articleId: string): Promise<ArticleDocument> {
  return request<ArticleDocument>(`/api/v1/articles/${encodeURIComponent(articleId)}/document`);
}

export async function saveArticleDocument(
  input: SaveArticleDocumentInput,
): Promise<SaveArticleDocumentResult> {
  const csrfToken = await getCsrfToken();
  return request<SaveArticleDocumentResult>(
    `/api/v1/articles/${encodeURIComponent(input.articleId)}/document`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        baseVersion: input.baseVersion,
        schemaVersion: input.schemaVersion,
        document: input.document,
        lastTransactionId: input.lastTransactionId,
        transactionOrigin: input.transactionOrigin,
        ...(input.appearance === undefined ? {} : { appearance: input.appearance }),
      } satisfies components["schemas"]["SaveArticleDocumentDto"]),
    },
  );
}
