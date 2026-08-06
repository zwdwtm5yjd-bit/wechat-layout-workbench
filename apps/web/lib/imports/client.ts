import type { components } from "../api/openapi.generated";
import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type ImportStructure = Readonly<components["schemas"]["ImportStructureDto"]>;
export type ImportStructureBlock = Readonly<components["schemas"]["ImportStructureBlockDto"]>;
export type ImportBlockRole = ImportStructureBlock["role"];
export type PasteImportInput = Readonly<components["schemas"]["PasteImportDto"]>;
export type ConfirmImportResult = Readonly<components["schemas"]["ConfirmImportResultDto"]>;
export type ImportJob = Readonly<components["schemas"]["DocxImportJobDto"]>;
export type DocxImportInput = Readonly<components["schemas"]["DocxImportDto"]>;
export type WebpageImportInput = Readonly<components["schemas"]["WebpageImportDto"]>;

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

export class ImportClientError extends Error {
  override readonly name = "ImportClientError";

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
    throw new ImportClientError(
      response.status,
      failure.error?.code ?? "IMPORT_REQUEST_FAILED",
      failure.error?.message ?? "导入服务暂时不可用",
      failure.error?.details,
      failure.error?.retryable ?? response.status >= 500,
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

function structurePath(articleId: string): string {
  return `/api/v1/imports/${encodeURIComponent(articleId)}/structure`;
}

export async function createPasteImport(input: PasteImportInput): Promise<ImportStructure> {
  const csrfToken = await getCsrfToken();
  const body = {
    ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
    ...(input.html === undefined ? {} : { html: input.html }),
    ...(input.plainText === undefined ? {} : { plainText: input.plainText }),
    ...(input.images === undefined ? {} : { images: input.images.map((image) => ({ ...image })) }),
    cleaningMode: input.cleaningMode ?? "preserve_structure",
    detectedSourceHint: input.detectedSourceHint ?? "auto",
    contentType: input.contentType ?? "general",
    layoutStrength: input.layoutStrength ?? "standard",
  } satisfies components["schemas"]["PasteImportDto"];
  return request<ImportStructure>("/api/v1/imports/paste", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function createDocxImport(input: DocxImportInput): Promise<ImportJob> {
  const csrfToken = await getCsrfToken();
  return request<ImportJob>("/api/v1/imports/docx", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(input),
  });
}

export async function createWebpageImport(input: WebpageImportInput): Promise<ImportJob> {
  const csrfToken = await getCsrfToken();
  return request<ImportJob>("/api/v1/imports/webpage", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(input),
  });
}

export function getImportStructure(articleId: string): Promise<ImportStructure> {
  return request<ImportStructure>(structurePath(articleId));
}

export async function confirmImportStructure(input: {
  readonly articleId: string;
  readonly title: string | null;
  readonly baseVersion: number;
  readonly lastTransactionId: string;
  readonly blocks: readonly {
    readonly sourceBlockId: string;
    readonly role: ImportBlockRole;
  }[];
}): Promise<ConfirmImportResult> {
  const csrfToken = await getCsrfToken();
  const body = {
    title: input.title,
    baseVersion: input.baseVersion,
    lastTransactionId: input.lastTransactionId,
    blocks: input.blocks.map((block) => ({ ...block })),
  } satisfies components["schemas"]["ConfirmImportStructureDto"];
  return request<ConfirmImportResult>(structurePath(input.articleId), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(body),
  });
}
