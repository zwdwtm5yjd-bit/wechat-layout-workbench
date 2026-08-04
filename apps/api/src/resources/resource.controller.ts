import {
  Body,
  Controller,
  Delete,
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
  CompleteResourceUploadDto,
  CreateResourceAccessUrlDto,
  CreateResourceUploadDto,
  ResourceAccessUrlResponseDto,
  ResourceListQueryDto,
  ResourceListResultDto,
  ResourceReferencesResponseDto,
  ResourceResponseDto,
  ResourceUploadResponseDto,
} from "./resource.dto.js";
import { ResourceService } from "./resource.service.js";

@ApiTags("resources")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("resources")
export class ResourceController {
  constructor(
    @Inject(ResourceService)
    private readonly resources: ResourceService,
  ) {}

  @Get()
  @ApiOperation({ summary: "分页列出当前用户的私有素材" })
  @ApiOkResponse({ type: ResourceListResultDto })
  list(@Query() query: ResourceListQueryDto, @CurrentSession() session: AuthenticatedSession) {
    return this.resources.list(session.user.id, query);
  }

  @Post("uploads")
  @ApiOperation({ summary: "创建私有图片或 DOCX 直传会话，或复用相同资源" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => CreateResourceUploadDto })
  @ApiCreatedResponse({ type: ResourceUploadResponseDto })
  @ApiConflictResponse({ description: "相同摘要对应的文件元数据冲突" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  createUpload(
    @Body() body: CreateResourceUploadDto,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.resources.createUpload(session.user.id, body);
  }

  @Post("uploads/:uploadId/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "校验直传对象并登记资源" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "uploadId", type: String })
  @ApiBody({ type: () => CompleteResourceUploadDto })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiConflictResponse({ description: "上传对象尚未就绪" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "上传会话不存在或已过期" })
  completeUpload(
    @Param("uploadId") uploadId: string,
    @Body() body: CompleteResourceUploadDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.resources.completeUpload(
      session.user.id,
      uploadId,
      body,
      contextFromRequest(request),
    );
  }

  @Get(":resourceId")
  @ApiOperation({ summary: "获取当前用户的资源元数据" })
  @ApiParam({ format: "uuid", name: "resourceId", type: String })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiNotFoundResponse({ description: "资源不存在" })
  get(@Param("resourceId") resourceId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.resources.get(session.user.id, resourceId);
  }

  @Post(":resourceId/access-url")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "签发短时私有资源访问地址" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "resourceId", type: String })
  @ApiBody({ type: () => CreateResourceAccessUrlDto })
  @ApiOkResponse({ type: ResourceAccessUrlResponseDto })
  @ApiConflictResponse({ description: "请求的资源变体不可用" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "资源不存在" })
  createAccessUrl(
    @Param("resourceId") resourceId: string,
    @Body() body: CreateResourceAccessUrlDto,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.resources.createAccessUrl(session.user.id, resourceId, body);
  }

  @Get(":resourceId/references")
  @ApiOperation({ summary: "列出阻止资源删除的引用" })
  @ApiParam({ format: "uuid", name: "resourceId", type: String })
  @ApiOkResponse({ type: ResourceReferencesResponseDto })
  @ApiNotFoundResponse({ description: "资源不存在" })
  references(
    @Param("resourceId") resourceId: string,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.resources.references(session.user.id, resourceId);
  }

  @Delete(":resourceId")
  @ApiOperation({ summary: "将未被引用的资源移入保留 30 天的回收站" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "resourceId", type: String })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiConflictResponse({ description: "资源仍被文章或其他实体引用" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "资源不存在" })
  trash(
    @Param("resourceId") resourceId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.resources.trash(session.user.id, resourceId, contextFromRequest(request));
  }
}
