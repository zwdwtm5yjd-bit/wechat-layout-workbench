import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, type Observable } from "rxjs";

import type { ApiSuccessResponse } from "./api-contract.js";
import { contextFromRequest, type ContextualHttpRequest } from "./request-context.js";
import { rawResponseMetadataKey } from "./raw-response.decorator.js";

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRawResponse = this.reflector.getAllAndOverride<boolean>(rawResponseMetadataKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRawResponse) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<ContextualHttpRequest>();
    const requestContext = contextFromRequest(request);

    return next.handle().pipe(
      map((data: unknown): ApiSuccessResponse<unknown> => ({
        success: true,
        data,
        meta: {
          ...requestContext,
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
