import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentSession } from "../auth/auth.decorators.js";
import type { AuthenticatedSession } from "../auth/auth.types.js";
import { contextFromRequest, type ContextualHttpRequest } from "../common/http/request-context.js";
import { WebpageImportDto, WebpageImportJobResponseDto } from "./import.dto.js";
import { WebpageImportService } from "./webpage-import.service.js";

@ApiTags("imports")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("imports")
export class WebpageImportController {
  constructor(
    @Inject(WebpageImportService)
    private readonly imports: WebpageImportService,
  ) {}

  @Post("webpage")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "创建带 SSRF 防护的异步网页导入任务" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => WebpageImportDto })
  @ApiCreatedResponse({ type: WebpageImportJobResponseDto })
  @ApiBadRequestResponse({ description: "URL 无效或指向本机/私网" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  create(
    @Body() body: WebpageImportDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.imports.create(session.user.id, body, {
      actorUserId: session.user.id,
      ...contextFromRequest(request),
    });
  }
}
