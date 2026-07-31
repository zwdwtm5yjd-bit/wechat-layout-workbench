import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentSession } from "../auth/auth.decorators.js";
import type { AuthenticatedSession } from "../auth/auth.types.js";
import { contextFromRequest, type ContextualHttpRequest } from "../common/http/request-context.js";
import {
  CopyPayloadRequestDto,
  CopyPayloadResponseDto,
  CopyRecordResponseDto,
  CreateCopyRecordDto,
  CreateWechatRenderDto,
  RenderOutputResponseDto,
} from "./copy.dto.js";
import { CopyService } from "./copy.service.js";

function context(session: AuthenticatedSession, request: ContextualHttpRequest) {
  return {
    actorUserId: session.user.id,
    ...contextFromRequest(request),
  };
}

@ApiTags("wechat-copy")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("articles/:articleId")
export class CopyController {
  constructor(
    @Inject(CopyService)
    private readonly copies: CopyService,
  ) {}

  @Post("render-wechat")
  @ApiOperation({ summary: "从当前权威文档创建正式微信渲染输出与复制前快照" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => CreateWechatRenderDto })
  @ApiCreatedResponse({ type: RenderOutputResponseDto })
  @ApiConflictResponse({ description: "文档版本冲突或兼容检查阻止复制" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  createRender(
    @Param("articleId") articleId: string,
    @Body() body: CreateWechatRenderDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.copies.createRender(session.user.id, articleId, body, context(session, request));
  }

  @Get("render-outputs/:renderOutputId")
  @ApiOperation({ summary: "读取正式微信渲染结果和兼容报告" })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiParam({ format: "uuid", name: "renderOutputId", type: String })
  @ApiOkResponse({ type: RenderOutputResponseDto })
  @ApiNotFoundResponse({ description: "渲染输出不存在" })
  getRender(
    @Param("articleId") articleId: string,
    @Param("renderOutputId") renderOutputId: string,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.copies.getRender(session.user.id, articleId, renderOutputId);
  }

  @Post("copy-payload")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "获取通过兼容门禁的短时双 MIME 复制 Payload" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => CopyPayloadRequestDto })
  @ApiOkResponse({ type: CopyPayloadResponseDto })
  @ApiConflictResponse({ description: "兼容检查阻止正式复制" })
  @ApiGoneResponse({ description: "复制 Payload 已过期" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "渲染输出不存在" })
  payload(
    @Param("articleId") articleId: string,
    @Body() body: CopyPayloadRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.copies.payload(session.user.id, articleId, body.renderOutputId);
  }

  @Post("copy-records")
  @ApiOperation({ summary: "由浏览器回写剪贴板复制成功或失败记录" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => CreateCopyRecordDto })
  @ApiCreatedResponse({ type: CopyRecordResponseDto })
  @ApiConflictResponse({ description: "被阻止的输出不能记录成功" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "渲染输出不存在" })
  record(
    @Param("articleId") articleId: string,
    @Body() body: CreateCopyRecordDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.copies.record(session.user.id, articleId, body, context(session, request));
  }
}
