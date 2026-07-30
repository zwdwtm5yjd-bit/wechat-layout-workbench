import { Body, Controller, Get, Inject, Param, Put, Req } from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
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
import { ApiErrorResponseOpenApiModel } from "../common/http/openapi-models.js";
import { contextFromRequest, type ContextualHttpRequest } from "../common/http/request-context.js";
import {
  ArticleDocumentResponseDto,
  SaveArticleDocumentDto,
  SaveArticleDocumentResponseDto,
} from "./document.dto.js";
import { DocumentService } from "./document.service.js";

@ApiTags("documents")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("articles/:articleId/document")
export class DocumentController {
  constructor(
    @Inject(DocumentService)
    private readonly documents: DocumentService,
  ) {}

  @Get()
  @ApiOperation({ summary: "获取文章的当前权威文档" })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ArticleDocumentResponseDto })
  @ApiNotFoundResponse({ description: "文章不存在" })
  get(@Param("articleId") articleId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.documents.get(session.user.id, articleId);
  }

  @Put()
  @ApiOperation({ summary: "使用 documentVersion 乐观锁保存文章文档" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => SaveArticleDocumentDto })
  @ApiOkResponse({ type: SaveArticleDocumentResponseDto })
  @ApiConflictResponse({
    description: "baseVersion 已过期，不会覆盖远端文档",
    type: ApiErrorResponseOpenApiModel,
  })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  save(
    @Param("articleId") articleId: string,
    @Body() body: SaveArticleDocumentDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.documents.save(session.user.id, articleId, body, {
      actorUserId: session.user.id,
      ...contextFromRequest(request),
    });
  }
}
