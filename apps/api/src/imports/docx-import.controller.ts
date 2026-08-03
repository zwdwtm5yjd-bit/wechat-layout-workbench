import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentSession } from "../auth/auth.decorators.js";
import type { AuthenticatedSession } from "../auth/auth.types.js";
import { contextFromRequest, type ContextualHttpRequest } from "../common/http/request-context.js";
import { DocxImportService } from "./docx-import.service.js";
import { DocxImportDto, DocxImportJobResponseDto } from "./import.dto.js";

@ApiTags("imports")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("imports")
export class DocxImportController {
  constructor(
    @Inject(DocxImportService)
    private readonly imports: DocxImportService,
  ) {}

  @Post("docx")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "使用已上传的 DOCX 原文件创建异步导入任务" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => DocxImportDto })
  @ApiCreatedResponse({ type: DocxImportJobResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "DOCX 资源不存在" })
  @ApiConflictResponse({ description: "资源不是可导入的活动 DOCX" })
  create(
    @Body() body: DocxImportDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.imports.create(session.user.id, body, {
      actorUserId: session.user.id,
      ...contextFromRequest(request),
    });
  }
}
