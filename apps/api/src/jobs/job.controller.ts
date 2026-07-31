import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Sse,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentSession } from "../auth/auth.decorators.js";
import type { AuthenticatedSession } from "../auth/auth.types.js";
import { RawResponse } from "../common/http/raw-response.decorator.js";
import { JobEventResultDto, JobListQueryDto, JobListResultDto, JobResultDto } from "./job.dto.js";
import { JobService } from "./job.service.js";

@ApiTags("jobs")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("jobs")
export class JobController {
  constructor(
    @Inject(JobService)
    private readonly jobs: JobService,
  ) {}

  @Get()
  @ApiOperation({ summary: "按当前用户分页查询任务" })
  @ApiOkResponse({ type: JobListResultDto })
  list(@Query() query: JobListQueryDto, @CurrentSession() session: AuthenticatedSession) {
    return this.jobs.list(session.user.id, query);
  }

  @Get(":jobId")
  @ApiOperation({ summary: "读取任务状态、进度与结果摘要" })
  @ApiParam({ format: "uuid", name: "jobId", type: String })
  @ApiOkResponse({ type: JobResultDto })
  @ApiNotFoundResponse({ description: "任务不存在" })
  get(@Param("jobId") jobId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.jobs.get(session.user.id, jobId);
  }

  @Post(":jobId/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "取消排队中或执行中的任务" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "jobId", type: String })
  @ApiOkResponse({ type: JobResultDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "任务不存在" })
  cancel(@Param("jobId") jobId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.jobs.cancel(session.user.id, jobId);
  }

  @Post(":jobId/retry")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "重新入队一个允许重试的失败任务" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "jobId", type: String })
  @ApiOkResponse({ type: JobResultDto })
  @ApiConflictResponse({ description: "任务未失败或错误不可重试" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "任务不存在" })
  retry(@Param("jobId") jobId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.jobs.retry(session.user.id, jobId);
  }

  @Sse(":jobId/events")
  @RawResponse()
  @ApiOperation({ summary: "订阅任务事件；支持 Last-Event-ID 断线续传" })
  @ApiHeader({ name: "Last-Event-ID", required: false })
  @ApiParam({ format: "uuid", name: "jobId", type: String })
  @ApiProduces("text/event-stream")
  @ApiOkResponse({ type: JobEventResultDto })
  @ApiNotFoundResponse({ description: "任务不存在" })
  events(
    @Param("jobId") jobId: string,
    @Headers("last-event-id") lastEventId: string | undefined,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.jobs.events(session.user.id, jobId, lastEventId);
  }
}
