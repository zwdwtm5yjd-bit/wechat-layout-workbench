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
import { ApplicationMetrics } from "../../observability/application-metrics.service.js";

interface StatusHttpResponse {
  readonly statusCode: number;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(StructuredLoggerService)
    private readonly logger: StructuredLoggerService,
    @Inject(ApplicationMetrics)
    private readonly metrics: ApplicationMetrics,
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
          const record = {
            context: requestContext,
            durationMs: performance.now() - startedAt,
            method: request.method,
            path,
            statusCode: response.statusCode,
          };
          this.metrics.observeHttp(record);
          this.logger.logHttpRequest(record);
        },
        error: (error: unknown) => {
          const describedError = describeApiException(error);

          const record = {
            context: requestContext,
            durationMs: performance.now() - startedAt,
            errorCode: describedError.error.code,
            method: request.method,
            path,
            statusCode: describedError.statusCode,
          };
          this.metrics.observeHttp(record);
          this.logger.logHttpRequest(record);
        },
      }),
    );
  }
}
