import { type INestApplication, RequestMethod } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import type { AppEnvironment } from "@wechat-layout/config";

import {
  ApiErrorOpenApiModel,
  ApiErrorResponseOpenApiModel,
  ApiMetaOpenApiModel,
  ApiSuccessResponseOpenApiModel,
} from "./common/http/openapi-models.js";

export function configureApplication(
  application: INestApplication,
  environment: AppEnvironment,
  publicWebUrl?: string,
): OpenAPIObject {
  if (publicWebUrl !== undefined) {
    application.enableCors({
      origin: publicWebUrl,
      credentials: true,
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-ID", "X-Trace-ID"],
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });
  }

  application.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });

  const openApiConfiguration = new DocumentBuilder()
    .setTitle("公众号智能视觉排版工具 API")
    .setDescription("面向定稿文章视觉排版工作台的服务端接口")
    .setVersion("0.1.0")
    .addCookieAuth("session_id")
    .build();
  const openApiDocument = SwaggerModule.createDocument(application, openApiConfiguration, {
    extraModels: [
      ApiMetaOpenApiModel,
      ApiErrorOpenApiModel,
      ApiErrorResponseOpenApiModel,
      ApiSuccessResponseOpenApiModel,
    ],
  });

  SwaggerModule.setup("api/docs", application, openApiDocument, {
    jsonDocumentUrl: "api/openapi.json",
    raw: ["json"],
    ui: environment !== "production",
  });
  return openApiDocument;
}
