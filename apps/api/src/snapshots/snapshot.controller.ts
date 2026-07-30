import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
  CreateSnapshotDto,
  RestoreSnapshotDto,
  RestoreSnapshotResponseDto,
  SnapshotListQueryDto,
  SnapshotListResponseDto,
  SnapshotResponseDto,
} from "./snapshot.dto.js";
import { SnapshotService } from "./snapshot.service.js";

@ApiTags("snapshots")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("articles/:articleId/snapshots")
export class SnapshotController {
  constructor(
    @Inject(SnapshotService)
    private readonly snapshots: SnapshotService,
  ) {}

  @Get()
  @ApiOperation({ summary: "按时间倒序列出文章的不可变快照" })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: SnapshotListResponseDto })
  @ApiNotFoundResponse({ description: "文章不存在" })
  list(
    @Param("articleId") articleId: string,
    @Query() query: SnapshotListQueryDto,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.snapshots.list(session.user.id, articleId, query);
  }

  @Post()
  @ApiOperation({ summary: "为当前权威文档创建手动快照" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => CreateSnapshotDto })
  @ApiCreatedResponse({ type: SnapshotResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  create(
    @Param("articleId") articleId: string,
    @Body() body: CreateSnapshotDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.snapshots.createManual(session.user.id, articleId, body.note?.trim() || null, {
      actorUserId: session.user.id,
      ...contextFromRequest(request),
    });
  }

  @Get(":snapshotId")
  @ApiOperation({ summary: "获取不可变快照详情" })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiParam({ format: "uuid", name: "snapshotId", type: String })
  @ApiOkResponse({ type: SnapshotResponseDto })
  @ApiNotFoundResponse({ description: "文章或快照不存在" })
  get(
    @Param("articleId") articleId: string,
    @Param("snapshotId") snapshotId: string,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.snapshots.get(session.user.id, articleId, snapshotId);
  }

  @Post(":snapshotId/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "读取快照的只读预览数据" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiParam({ format: "uuid", name: "snapshotId", type: String })
  @ApiOkResponse({ type: SnapshotResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章或快照不存在" })
  preview(
    @Param("articleId") articleId: string,
    @Param("snapshotId") snapshotId: string,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.snapshots.preview(session.user.id, articleId, snapshotId);
  }

  @Post(":snapshotId/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "创建安全快照后恢复目标版本" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiParam({ format: "uuid", name: "snapshotId", type: String })
  @ApiBody({ type: () => RestoreSnapshotDto })
  @ApiOkResponse({ type: RestoreSnapshotResponseDto })
  @ApiConflictResponse({ description: "文档版本冲突或快照无效" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章或快照不存在" })
  restore(
    @Param("articleId") articleId: string,
    @Param("snapshotId") snapshotId: string,
    @Body() body: RestoreSnapshotDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.snapshots.restore(
      session.user.id,
      articleId,
      snapshotId,
      body.baseVersion,
      body.lastTransactionId,
      {
        actorUserId: session.user.id,
        ...contextFromRequest(request),
      },
    );
  }
}
