import { getCsrfToken } from "../auth/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

export interface ThemeManifest {
  readonly themeId: string;
  readonly familyId: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly categories: readonly string[];
  readonly recommendedContentTypes: readonly string[];
  readonly defaultPaletteId: string;
  readonly supportedPalettes: readonly string[];
  readonly compatibilityLevel: "compatible" | "conditional" | "safe";
  readonly isDefault: boolean;
  readonly status: "published";
}

export interface ThemePreviewAsset {
  readonly accentColors: readonly [string, string, string];
  readonly heading1: string;
  readonly heading2: string;
  readonly heading3: string;
  readonly body: string;
  readonly quote: string;
  readonly dataLabel: string;
  readonly dataValue: string;
  readonly footer: string;
  readonly mobileViewportWidth: number;
  readonly wechatContentWidth: number;
}

export interface OfficialTheme {
  readonly manifest: ThemeManifest;
  readonly preview: ThemePreviewAsset;
  readonly componentRefs: readonly string[];
  readonly installed: boolean;
}

export interface ThemeListResult {
  readonly items: readonly OfficialTheme[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface ApplyThemeResult {
  readonly articleId: string;
  readonly themeId: string;
  readonly themeVersion: string;
  readonly paletteId: string;
  readonly documentVersion: number;
  readonly lastTransactionId: string;
  readonly safetySnapshotId: string;
  readonly originalTextUnchanged: true;
  readonly appliedAt: string;
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

export class ThemeClientError extends Error {
  override readonly name = "ThemeClientError";

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
    throw new ThemeClientError(
      response.status,
      failure.error?.code ?? "THEME_REQUEST_FAILED",
      failure.error?.message ?? "主题服务暂时不可用",
      failure.error?.details,
    );
  }
  return (payload as unknown as ApiSuccess<T>).data;
}

export function listThemes(search?: string): Promise<ThemeListResult> {
  const query = new URLSearchParams({ page: "1", pageSize: "100" });
  if (search !== undefined && search.trim() !== "") {
    query.set("search", search.trim());
  }
  return request<ThemeListResult>(`/api/v1/themes?${query.toString()}`);
}

export async function applyTheme(input: {
  readonly articleId: string;
  readonly baseDocumentVersion: number;
  readonly theme: OfficialTheme;
}): Promise<ApplyThemeResult> {
  const csrfToken = await getCsrfToken();
  return request<ApplyThemeResult>(
    `/api/v1/articles/${encodeURIComponent(input.articleId)}/themes/${encodeURIComponent(input.theme.manifest.themeId)}/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({
        baseDocumentVersion: input.baseDocumentVersion,
        brandMode: "soft",
        paletteId: input.theme.manifest.defaultPaletteId,
        preserveLockedBlocks: true,
        scope: "full",
        themeVersion: input.theme.manifest.version,
      }),
    },
  );
}

export function themePreviewKey(theme: OfficialTheme): "editorial-minimal" | "modern-civic" {
  return theme.manifest.categories.includes("government") ? "modern-civic" : "editorial-minimal";
}
