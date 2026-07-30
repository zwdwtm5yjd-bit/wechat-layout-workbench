import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  readonly requestId: string;
  readonly traceId: string;
}

export const requestContextKey: unique symbol = Symbol("requestContext");

export interface ContextualHttpRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly method: string;
  readonly originalUrl?: string;
  readonly url: string;
  [requestContextKey]?: RequestContext;
}

const safeIncomingIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function readSafeHeaderId(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate !== undefined && safeIncomingIdPattern.test(candidate) ? candidate : undefined;
}

export function createRequestContext(headers: ContextualHttpRequest["headers"]): RequestContext {
  return Object.freeze({
    requestId:
      readSafeHeaderId(headers["x-request-id"]) ?? `req_${randomUUID().replaceAll("-", "")}`,
    traceId: readSafeHeaderId(headers["x-trace-id"]) ?? `trace_${randomUUID().replaceAll("-", "")}`,
  });
}

export function contextFromRequest(request: ContextualHttpRequest): RequestContext {
  return request[requestContextKey] ?? createRequestContext(request.headers);
}

@Injectable()
export class RequestContextService {
  readonly #storage = new AsyncLocalStorage<RequestContext>();

  run(context: RequestContext, next: () => void): void {
    this.#storage.run(context, next);
  }

  current(): RequestContext | undefined {
    return this.#storage.getStore();
  }
}
