import type { components } from "../api/openapi.generated";
import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export type Resource = Readonly<components["schemas"]["ResourceDto"]>;
export type ResourceReferences = Readonly<components["schemas"]["ResourceReferencesDto"]>;

export interface ResourceListResult {
  readonly items: readonly Resource[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
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
  };
}

export class ResourceClientError extends Error {
  override readonly name = "ResourceClientError";

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
    throw new ResourceClientError(
      response.status,
      failure.error?.code ?? "RESOURCE_REQUEST_FAILED",
      failure.error?.message ?? "素材服务暂时不可用",
      failure.error?.details,
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

async function write<T>(path: string, method: "DELETE" | "POST", body?: unknown): Promise<T> {
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

export function listResources(
  input: {
    readonly resourceType?: "document" | "image";
    readonly status?: "active" | "trash";
    readonly page?: number;
    readonly pageSize?: number;
  } = {},
): Promise<ResourceListResult> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 48),
    status: input.status ?? "active",
  });
  if (input.resourceType !== undefined) query.set("resourceType", input.resourceType);
  return request<ResourceListResult>(`/api/v1/resources?${query.toString()}`);
}

function mimeTypeForFile(file: File): Resource["mimeType"] {
  const extension = file.name.toLocaleLowerCase().split(".").pop() ?? "";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  const inferred = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  } as const;
  const supported = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
  if (supported.some((mimeType) => mimeType === file.type)) {
    return file.type as (typeof supported)[number];
  }
  if (extension in inferred) return inferred[extension as keyof typeof inferred];
  throw new ResourceClientError(
    400,
    "UNSUPPORTED_FILE",
    "仅支持 PNG、JPEG、WebP、GIF 和 DOCX 文件",
  );
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function uploadResource(file: File): Promise<Resource> {
  const session = await write<components["schemas"]["ResourceUploadResultDto"]>(
    "/api/v1/resources/uploads",
    "POST",
    {
      filename: file.name,
      mimeType: mimeTypeForFile(file),
      fileSize: file.size,
      sha256: await sha256(file),
    },
  );
  if (session.status === "deduplicated" && session.resource !== null) return session.resource;
  if (session.uploadId === null || session.uploadUrl === null) {
    throw new ResourceClientError(500, "UPLOAD_SESSION_INVALID", "上传会话不完整，请重试");
  }
  const upload = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: session.headers,
    body: file,
  });
  if (!upload.ok) {
    throw new ResourceClientError(upload.status, "OBJECT_UPLOAD_FAILED", "文件直传失败，请重试");
  }
  const etag = upload.headers.get("etag");
  if (etag === null || etag.trim() === "") {
    throw new ResourceClientError(502, "UPLOAD_ETAG_MISSING", "存储服务未返回文件校验标识");
  }
  return write<Resource>(
    `/api/v1/resources/uploads/${encodeURIComponent(session.uploadId)}/complete`,
    "POST",
    { etag },
  );
}

export function createResourceAccessUrl(resourceId: string, variant: "original" | "thumbnail") {
  return write<components["schemas"]["ResourceAccessUrlDto"]>(
    `/api/v1/resources/${encodeURIComponent(resourceId)}/access-url`,
    "POST",
    { expiresInSeconds: 300, purpose: "editor_preview", variant },
  );
}

export function getResourceReferences(resourceId: string): Promise<ResourceReferences> {
  return request<ResourceReferences>(
    `/api/v1/resources/${encodeURIComponent(resourceId)}/references`,
  );
}

export function trashResource(resourceId: string): Promise<Resource> {
  return write<Resource>(`/api/v1/resources/${encodeURIComponent(resourceId)}`, "DELETE");
}
