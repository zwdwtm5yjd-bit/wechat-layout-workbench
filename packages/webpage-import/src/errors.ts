export class WebpageImportError extends Error {
  override readonly name = "WebpageImportError";

  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export function isWebpageImportError(error: unknown): error is WebpageImportError {
  return error instanceof WebpageImportError;
}
