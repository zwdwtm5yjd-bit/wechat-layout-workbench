import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
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
  ConfirmImportResponseDto,
  ConfirmImportStructureDto,
  ImportStructureResponseDto,
  PasteImportDto,
} from "./import.dto.js";
import { ImportService } from "./import.service.js";
import type { ImportMutationContext } from "./import.types.js";

function mutationContext(
  session: AuthenticatedSession,
  request: ContextualHttpRequest,
): ImportMutationContext {
  return {
    actorUserId: session.user.id,
    ...contextFromRequest(request),
  };
}

@ApiTags("imports")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("imports")
export class ImportController {
  constructor(
    @Inject(ImportService)
    private readonly imports: ImportService,
  ) {}

  @Post("paste")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "清洗 HTML/纯文本并创建待结构确认的粘贴导入" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => PasteImportDto })
  @ApiCreatedResponse({ type: ImportStructureResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  createPaste(
    @Body() body: PasteImportDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.imports.createPaste(session.user.id, body, mutationContext(session, request));
  }

  @Get(":articleId/structure")
  @ApiOperation({ summary: "获取可刷新恢复的原文与结构识别结果" })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiOkResponse({ type: ImportStructureResponseDto })
  @ApiNotFoundResponse({ description: "导入文章或原文不存在" })
  getStructure(
    @Param("articleId") articleId: string,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.imports.getStructure(session.user.id, articleId);
  }

  @Put(":articleId/structure")
  @ApiOperation({ summary: "使用乐观锁确认结构并创建导入后不可变快照" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => ConfirmImportStructureDto })
  @ApiOkResponse({ type: ConfirmImportResponseDto })
  @ApiConflictResponse({ description: "文档版本冲突、结构已确认或区块集合不一致" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiNotFoundResponse({ description: "导入文章或原文不存在" })
  confirm(
    @Param("articleId") articleId: string,
    @Body() body: ConfirmImportStructureDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.imports.confirm(
      session.user.id,
      articleId,
      body,
      mutationContext(session, request),
    );
  }
}
