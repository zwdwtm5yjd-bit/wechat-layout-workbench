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
  ApplyThemeRequestDto,
  ApplyThemeResponseDto,
  ThemeListQueryDto,
  ThemeListResponseDto,
  ThemePreviewRequestDto,
  ThemePreviewResponseDto,
  ThemeResponseDto,
  ThemeVersionsResponseDto,
} from "./theme.dto.js";
import { ThemeService } from "./theme.service.js";

@ApiTags("themes")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller()
export class ThemeController {
  constructor(
    @Inject(ThemeService)
    private readonly themes: ThemeService,
  ) {}

  @Get("themes")
  @ApiOperation({ summary: "列出已安装的官方主题" })
  @ApiOkResponse({ type: ThemeListResponseDto })
  list(@Query() query: ThemeListQueryDto) {
    return this.themes.list(query);
  }

  @Get("themes/:themeId")
  @ApiOperation({ summary: "获取官方主题详情" })
  @ApiParam({ format: "uuid", name: "themeId", type: String })
  @ApiOkResponse({ type: ThemeResponseDto })
  @ApiNotFoundResponse({ description: "主题不存在" })
  get(@Param("themeId") themeId: string) {
    return this.themes.get(themeId);
  }

  @Get("themes/:themeId/versions")
  @ApiOperation({ summary: "列出主题的不可变版本" })
  @ApiParam({ format: "uuid", name: "themeId", type: String })
  @ApiOkResponse({ type: ThemeVersionsResponseDto })
  versions(@Param("themeId") themeId: string) {
    return this.themes.versions(themeId);
  }

  @Get("themes/:themeId/versions/:version")
  @ApiOperation({ summary: "获取指定主题版本" })
  @ApiParam({ format: "uuid", name: "themeId", type: String })
  @ApiParam({ name: "version", type: String })
  @ApiOkResponse({ type: ThemeResponseDto })
  getVersion(@Param("themeId") themeId: string, @Param("version") version: string) {
    return this.themes.get(themeId, version);
  }

  @Post("articles/:articleId/themes/:themeId/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "试穿主题并返回微信安全预览，不修改文章" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiParam({ format: "uuid", name: "themeId", type: String })
  @ApiBody({ type: () => ThemePreviewRequestDto })
  @ApiOkResponse({ type: ThemePreviewResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章或主题不存在" })
  preview(
    @Param("articleId") articleId: string,
    @Param("themeId") themeId: string,
    @Body() body: ThemePreviewRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.themes.preview(session.user.id, articleId, themeId, body);
  }

  @Post("articles/:articleId/themes/:themeId/apply")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "创建安全快照后应用主题，不修改原文" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiParam({ format: "uuid", name: "themeId", type: String })
  @ApiBody({ type: () => ApplyThemeRequestDto })
  @ApiOkResponse({ type: ApplyThemeResponseDto })
  @ApiConflictResponse({ description: "文章版本冲突或主题预览失败" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "文章或主题不存在" })
  apply(
    @Param("articleId") articleId: string,
    @Param("themeId") themeId: string,
    @Body() body: ApplyThemeRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.themes.apply(session.user.id, articleId, themeId, body, {
      actorUserId: session.user.id,
      ...contextFromRequest(request),
    });
  }
}
