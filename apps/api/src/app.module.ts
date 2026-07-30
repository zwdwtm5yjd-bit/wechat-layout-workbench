import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";

import { ApiExceptionFilter } from "./common/http/api-exception.filter.js";
import { ApiValidationPipe } from "./common/http/api-validation.pipe.js";
import { RequestContextMiddleware } from "./common/http/request-context.middleware.js";
import { RequestContextService } from "./common/http/request-context.js";
import { RequestLoggingInterceptor } from "./common/http/request-logging.interceptor.js";
import { ResponseEnvelopeInterceptor } from "./common/http/response-envelope.interceptor.js";
import { StructuredLoggerService } from "./common/http/structured-logger.service.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [HealthModule],
  providers: [
    RequestContextService,
    RequestContextMiddleware,
    StructuredLoggerService,
    {
      provide: APP_PIPE,
      useClass: ApiValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({
      path: "{*splat}",
      method: RequestMethod.ALL,
    });
  }
}
