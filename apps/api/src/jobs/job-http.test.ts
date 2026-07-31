import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { createUuidV7 } from "@wechat-layout/database";
import { of } from "rxjs";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import type { AuthenticatedHttpRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/http/api.exception.js";
import { configureApplication } from "../configure-application.js";
import { JobController } from "./job.controller.js";
import type { JobResultDto } from "./job.dto.js";
import { JobService } from "./job.service.js";

const ownerUserId = createUuidV7();
const jobId = createUuidV7();
const eventId = createUuidV7();
const result: JobResultDto = {
  id: jobId,
  queueName: "maintenance",
  jobType: "maintenance.probe",
  status: "running",
  progress: 25,
  attemptCount: 1,
  maxAttempts: 3,
  articleId: null,
  accountId: null,
  resultRef: null,
  resultSummary: {},
  errorCode: null,
  errorMessage: null,
  latestMessage: "执行中",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:01.000Z",
  completedAt: null,
};

@Injectable()
class TestAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    request.auth = {
      sessionId: createUuidV7(),
      sessionTokenHash: "a".repeat(64),
      rawSessionToken: "test-session",
      expiresAt: new Date("2026-08-30T00:00:00.000Z"),
      user: {
        id: ownerUserId,
        email: "owner@example.com",
        username: null,
        displayName: "Owner",
        role: "owner",
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
        avatarResourceId: null,
      },
    };
    return true;
  }
}

@Injectable()
class TestCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest & { readonly method: string }>();
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers["x-csrf-token"] !== "test-csrf-token"
    ) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: "CSRF_INVALID",
        message: "CSRF 校验失败",
        retryable: false,
      });
    }
    return true;
  }
}

const jobs = {
  list: vi.fn().mockResolvedValue({ items: [result], page: 1, pageSize: 20, total: 1 }),
  get: vi.fn().mockResolvedValue(result),
  cancel: vi.fn().mockResolvedValue({ ...result, status: "cancelled" }),
  retry: vi.fn().mockResolvedValue({ ...result, status: "retry_pending" }),
  events: vi.fn().mockReturnValue(
    of({
      id: eventId,
      type: "progress",
      retry: 1_000,
      data: {
        id: eventId,
        jobId,
        eventType: "progress",
        progress: 25,
        message: "执行中",
        metadata: {},
        createdAt: "2026-08-01T00:00:01.000Z",
      },
    }),
  ),
};

@Module({
  imports: [AppModule],
  controllers: [JobController],
  providers: [
    { provide: JobService, useValue: jobs },
    { provide: APP_GUARD, useClass: TestAuthenticationGuard },
    { provide: APP_GUARD, useClass: TestCsrfGuard },
  ],
})
class JobTestModule {}

describe("job HTTP contracts", () => {
  let application: INestApplication;

  beforeAll(async () => {
    application = await NestFactory.create(JobTestModule, { logger: false });
    configureApplication(application, "test", "http://localhost:3000");
    await application.init();
  });

  afterAll(async () => {
    await application.close();
  });

  it("publishes list, detail, cancellation, retry and event stream operations", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    const paths = specification.body.paths;
    expect(paths?.["/api/v1/jobs"]?.get).toBeDefined();
    expect(paths?.["/api/v1/jobs/{jobId}"]?.get).toBeDefined();
    expect(paths?.["/api/v1/jobs/{jobId}/cancel"]?.post).toBeDefined();
    expect(paths?.["/api/v1/jobs/{jobId}/retry"]?.post).toBeDefined();
    expect(paths?.["/api/v1/jobs/{jobId}/events"]?.get).toBeDefined();
  });

  it("returns the current user's jobs and protects task mutations with CSRF", async () => {
    const list = await supertest(application.getHttpServer()).get("/api/v1/jobs").expect(200);
    expect(list.body.data.items[0]).toMatchObject({ id: jobId, status: "running" });
    expect(jobs.list).toHaveBeenCalledWith(ownerUserId, expect.objectContaining({ page: 1 }));

    const rejected = await supertest(application.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/cancel`)
      .expect(403);
    expect(rejected.body.error.code).toBe("CSRF_INVALID");

    const cancelled = await supertest(application.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/cancel`)
      .set("x-csrf-token", "test-csrf-token")
      .expect(200);
    expect(cancelled.body.data.status).toBe("cancelled");
  });

  it("passes Last-Event-ID to the SSE replay source", async () => {
    const response = await supertest(application.getHttpServer())
      .get(`/api/v1/jobs/${jobId}/events`)
      .set("Last-Event-ID", eventId)
      .expect(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toContain(`id: ${eventId}`);
    expect(jobs.events).toHaveBeenCalledWith(ownerUserId, jobId, eventId);
  });
});
