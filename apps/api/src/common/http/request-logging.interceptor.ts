import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { performance } from "node:perf_hooks";
import { tap, type Observable } from "rxjs";

import { describeApiException } from "./api-error-mapping.js";
import { contextFromRequest, type ContextualHttpRequest } from "./request-context.js";
import { StructuredLoggerService } from "./structured-logger.service.js";

interface StatusHttpResponse {
  readonly statusCode: number;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(StructuredLoggerService)
    private readonly logger: StructuredLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = performance.now();
    const http = context.switchToHttp();
    const request = http.getRequest<ContextualHttpRequest>();
    const response = http.getResponse<StatusHttpResponse>();
    const requestContext = contextFromRequest(request);
    const path = (request.originalUrl ?? request.url).split("?", 1)[0] ?? "/";

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.logHttpRequest({
            context: requestContext,
            durationMs: performance.now() - startedAt,
            method: request.method,
            path,
            statusCode: response.statusCode,
          });
        },
        error: (error: unknown) => {
          const describedError = describeApiException(error);

          this.logger.logHttpRequest({
            context: requestContext,
            durationMs: performance.now() - startedAt,
            errorCode: describedError.error.code,
            method: request.method,
            path,
            statusCode: describedError.statusCode,
          });
        },
      }),
    );
  }
}
