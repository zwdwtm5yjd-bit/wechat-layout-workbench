export interface ApiMeta {
  readonly requestId: string;
  readonly traceId: string;
  readonly timestamp: string;
}

export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: ApiMeta;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly retryable: boolean;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiError;
  readonly meta: ApiMeta;
}

export interface ValidationFieldError {
  readonly path: string;
  readonly message: string;
}
