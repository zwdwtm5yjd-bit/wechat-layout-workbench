import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentSession } from "../auth/auth.decorators.js";
import type { AuthenticatedSession } from "../auth/auth.types.js";
import { contextFromRequest, type ContextualHttpRequest } from "../common/http/request-context.js";
import {
  ArticleListQueryDto,
  ArticleListResponseDto,
  ArticleResponseDto,
  ArticleStatusHistoryResponseDto,
  CreateArticleDto,
  DuplicateArticleDto,
  UpdateArticleDto,
} from "./article.dto.js";
import { ArticleService } from "./article.service.js";
import type { ArticleMutationContext } from "./article.types.js";

function mutationContext(
  session: AuthenticatedSession,
  request: ContextualHttpRequest,
): ArticleMutationContext {
  return {
    actorUserId: session.user.id,
    ...contextFromRequest(request),
  };
}

@ApiTags("articles")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("articles")
export class ArticleController {
  constructor(
    @Inject(ArticleService)
    private readonly articles: ArticleService,
  ) {}

  @Get()
  @ApiOperation({ summary: "列出当前用户的文章" })
  @ApiQuery({ format: "uuid", name: "accountId", required: false, type: String })
  @ApiQuery({
    enum: [
      "pending_import",
      "pending_recognition",
      "pending_layout",
      "layout_editing",
      "pending_check",
      "copied",
      "synced",
      "published",
      "archived",
      "import_failed",
      "recognition_failed",
      "save_failed",
      "compatibility_failed",
      "copy_failed",
      "sync_failed",
      "trash",
    ],
    name: "status",
    required: false,
    type: String,
  })
  @ApiQuery({ name: "contentType", required: false, type: String })
  @ApiQuery({ format: "uuid", name: "themeId", required: false, type: String })
  @ApiQuery({ name: "hasSvg", required: false, type: Boolean })
  @ApiQuery({
    enum: ["excellent", "usable", "risk"],
    name: "compatibilityStatus",
    required: false,
    type: String,
  })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({
    enum: ["updated_desc", "updated_asc", "created_desc", "title_asc"],
    name: "sort",
    required: false,
    type: String,
  })
  @ApiQuery({ minimum: 1, name: "page", required: false, type: Number })
  @ApiQuery({ maximum: 100, minimum: 1, name: "pageSize", required: false, type: Number })
  @ApiOkResponse({ type: ArticleListResponseDto })
  list(@Query() query: ArticleListQueryDto, @CurrentSession() session: AuthenticatedSession) {
    return this.articles.list(session.user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "新建空白文章和独立 Document Schema 文档" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => CreateArticleDto })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  create(
    @Body() body: CreateArticleDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.articles.create(session.user.id, body, mutationContext(session, request));
  }

  @Get(":articleId")
  @ApiOperation({ summary: "获取文章详情" })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiNotFoundResponse({ description: "文章不存在" })
  get(@Param("articleId") articleId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.articles.get(session.user.id, articleId);
  }

  @Patch(":articleId")
  @ApiOperation({ summary: "更新文章元数据或用户可控状态" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => UpdateArticleDto })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiConflictResponse({ description: "文章状态不允许当前操作" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  update(
    @Param("articleId") articleId: string,
    @Body() body: UpdateArticleDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.articles.update(
      session.user.id,
      articleId,
      body,
      mutationContext(session, request),
    );
  }

  @Post(":articleId/duplicate")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "复制文章并创建独立文档" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => DuplicateArticleDto })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  @ApiConflictResponse({ description: "回收站文章不能复制" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  duplicate(
    @Param("articleId") articleId: string,
    @Body() body: DuplicateArticleDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.articles.duplicate(
      session.user.id,
      articleId,
      body,
      mutationContext(session, request),
    );
  }

  @Post(":articleId/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "归档文章" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiConflictResponse({ description: "文章状态不允许当前操作" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  archive(
    @Param("articleId") articleId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.articles.archive(session.user.id, articleId, mutationContext(session, request));
  }

  @Post(":articleId/unarchive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "恢复归档文章原状态" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiConflictResponse({ description: "文章未归档" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  unarchive(
    @Param("articleId") articleId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.articles.unarchive(session.user.id, articleId, mutationContext(session, request));
  }

  @Delete(":articleId")
  @ApiOperation({ summary: "将文章移入保留 30 天的回收站" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiConflictResponse({ description: "文章已在回收站" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  trash(
    @Param("articleId") articleId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.articles.trash(session.user.id, articleId, mutationContext(session, request));
  }

  @Post(":articleId/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "从回收站恢复文章" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiConflictResponse({ description: "文章不在回收站" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章不存在" })
  restore(
    @Param("articleId") articleId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.articles.restore(session.user.id, articleId, mutationContext(session, request));
  }

  @Get(":articleId/status-history")
  @ApiOperation({ summary: "获取文章状态历史" })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ArticleStatusHistoryResponseDto })
  @ApiNotFoundResponse({ description: "文章不存在" })
  history(@Param("articleId") articleId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.articles.history(session.user.id, articleId);
  }
}
