import { ArgumentsHost, Catch, type ExceptionFilter } from "@nestjs/common";

import type { ApiErrorResponse } from "./api-contract.js";
import { describeApiException } from "./api-error-mapping.js";
import { contextFromRequest, type ContextualHttpRequest } from "./request-context.js";

interface JsonHttpResponse {
  json(body: ApiErrorResponse): void;
  status(statusCode: number): JsonHttpResponse;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ContextualHttpRequest>();
    const response = http.getResponse<JsonHttpResponse>();
    const { statusCode, error } = describeApiException(exception);
    const requestContext = contextFromRequest(request);

    response.status(statusCode).json({
      success: false,
      error,
      meta: {
        ...requestContext,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
