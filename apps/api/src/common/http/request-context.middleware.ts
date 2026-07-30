import { Inject, Injectable } from "@nestjs/common";

import {
  createRequestContext,
  requestContextKey,
  RequestContextService,
  type ContextualHttpRequest,
} from "./request-context.js";

interface HeaderHttpResponse {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestContextMiddleware {
  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  use(request: ContextualHttpRequest, response: HeaderHttpResponse, next: () => void): void {
    const context = createRequestContext(request.headers);
    request[requestContextKey] = context;
    response.setHeader("x-request-id", context.requestId);
    response.setHeader("x-trace-id", context.traceId);
    this.requestContext.run(context, next);
  }
}
