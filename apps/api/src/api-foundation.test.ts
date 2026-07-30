import { Body, Controller, Get, type INestApplication, Module, Post } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { IsNotEmpty, IsString } from "class-validator";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppModule } from "./app.module.js";
import { createZodDto } from "./common/http/api-validation.pipe.js";
import { configureApplication } from "./configure-application.js";
import { ReadinessRegistry } from "./health/readiness-registry.service.js";

class ClassValidationProbe {
  @IsString()
  @IsNotEmpty()
  title!: string;
}

const ZodValidationProbeBase = createZodDto(
  z.object({
    count: z.number().int().positive(),
  }),
);

class ZodValidationProbe extends ZodValidationProbeBase {}

@Controller("foundation-test")
class FoundationProbeController {
  @Post("dto")
  dto(@Body() body: ClassValidationProbe): ClassValidationProbe {
    return body;
  }

  @Post("zod")
  zod(@Body() body: ZodValidationProbe): ZodValidationProbe {
    return body;
  }

  @Get("failure")
  failure(): never {
    throw new Error("private-stack-marker");
  }
}

@Module({
  imports: [AppModule],
  controllers: [FoundationProbeController],
})
class FoundationTestModule {}

describe("API foundation", () => {
  let application: INestApplication;
  let structuredLogOutput = "";

  beforeAll(async () => {
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      structuredLogOutput += String(chunk);
      return true;
    });
    application = await NestFactory.create(FoundationTestModule, {
      logger: false,
    });
    configureApplication(application, "production");
    await application.init();
  });

  afterAll(async () => {
    await application.close();
    vi.restoreAllMocks();
  });

  it("serves liveness and readiness outside the API version prefix", async () => {
    const live = await supertest(application.getHttpServer())
      .get("/health/live")
      .set("x-request-id", "client_request-123")
      .set("x-trace-id", "client_trace-123")
      .expect(200);
    const ready = await supertest(application.getHttpServer()).get("/health/ready").expect(200);
    const readiness = application.get(ReadinessRegistry);
    const unregister = readiness.register({
      name: "database",
      check: async () => ({
        database: {
          status: "up",
        },
      }),
    });
    const extendedReady = await supertest(application.getHttpServer())
      .get("/health/ready")
      .expect(200);
    unregister();

    expect(live.body).toMatchObject({
      status: "ok",
      info: {
        api: {
          status: "up",
        },
      },
    });
    expect(live.headers["x-request-id"]).toBe("client_request-123");
    expect(live.headers["x-trace-id"]).toBe("client_trace-123");
    expect(ready.body).toMatchObject({
      status: "ok",
      info: {
        api: {
          status: "up",
          registeredDependencyChecks: 0,
        },
      },
    });
    expect(extendedReady.body.info.database).toEqual({
      status: "up",
    });
  });

  it("generates OpenAPI JSON while production Swagger UI stays disabled", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);

    expect(specification.body).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      components: {
        schemas: {
          ApiErrorResponseOpenApiModel: expect.any(Object),
          ApiSuccessResponseOpenApiModel: expect.any(Object),
        },
      },
      info: {
        title: "公众号智能视觉排版工具 API",
        version: "0.1.0",
      },
    });
    expect(Object.keys(specification.body.paths as Readonly<Record<string, unknown>>)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/health\/live$/),
        expect.stringMatching(/health\/ready$/),
      ]),
    );
    await supertest(application.getHttpServer()).get("/api/docs").expect(404);
  });

  it("wraps successful API data with request metadata", async () => {
    const response = await supertest(application.getHttpServer())
      .post("/api/v1/foundation-test/dto")
      .set("x-request-id", "req_from_client")
      .set("x-trace-id", "trace_from_client")
      .send({ title: "body-secret-marker" })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: { title: "body-secret-marker" },
      meta: {
        requestId: "req_from_client",
        traceId: "trace_from_client",
      },
    });
    expect(Date.parse(response.body.meta.timestamp as string)).not.toBeNaN();
  });

  it("normalizes class DTO and Zod DTO validation failures", async () => {
    const classValidation = await supertest(application.getHttpServer())
      .post("/api/v1/foundation-test/dto")
      .send({ title: "", unexpected: true })
      .expect(400);
    const zodValidation = await supertest(application.getHttpServer())
      .post("/api/v1/foundation-test/zod")
      .send({ count: 0 })
      .expect(400);

    for (const response of [classValidation, zodValidation]) {
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "提交内容存在错误",
          details: {
            fields: expect.any(Array),
          },
          retryable: false,
        },
        meta: {
          requestId: expect.stringMatching(/^req_/),
          traceId: expect.stringMatching(/^trace_/),
        },
      });
    }
    expect(zodValidation.body.error.details.fields as readonly unknown[]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "count",
        }),
      ]),
    );
  });

  it("returns stable 404 errors and hides internal failures", async () => {
    const missing = await supertest(application.getHttpServer()).get("/api/v1/missing").expect(404);
    const failure = await supertest(application.getHttpServer())
      .get("/api/v1/foundation-test/failure?session=query-secret-marker")
      .expect(500);

    expect(missing.body.error).toEqual({
      code: "RESOURCE_NOT_FOUND",
      message: "请求的资源不存在",
      retryable: false,
    });
    expect(failure.body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "服务器内部错误",
      retryable: false,
    });
    expect(JSON.stringify(failure.body)).not.toContain("private-stack-marker");
    expect(JSON.stringify(failure.body)).not.toContain("stack");
  });

  it("writes structured request logs without query, body or exception values", () => {
    const records = structuredLogOutput
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Readonly<Record<string, string | number>>);
    const failedRequest = records.find(
      (record) => record.path === "/api/v1/foundation-test/failure",
    );

    expect(failedRequest).toMatchObject({
      service: "api",
      event: "http.request.completed",
      method: "GET",
      statusCode: 500,
      errorCode: "INTERNAL_ERROR",
    });
    expect(structuredLogOutput).not.toContain("query-secret-marker");
    expect(structuredLogOutput).not.toContain("body-secret-marker");
    expect(structuredLogOutput).not.toContain("private-stack-marker");
  });
});
