import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentSession } from "../auth/auth.decorators.js";
import type { AuthenticatedSession } from "../auth/auth.types.js";
import {
  AiLayoutStatusDto,
  GenerateAiLayoutDto,
  GenerateAiLayoutResponseDto,
} from "./ai-layout.dto.js";
import { AiLayoutService } from "./ai-layout.service.js";

@ApiTags("ai-layout")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller()
export class AiLayoutController {
  constructor(@Inject(AiLayoutService) private readonly aiLayout: AiLayoutService) {}

  @Get("ai-layout/status")
  @ApiOperation({ summary: "检查真实 AI 排版模型是否已连接" })
  @ApiOkResponse({ type: AiLayoutStatusDto })
  status() {
    return this.aiLayout.status();
  }

  @Post("articles/:articleId/ai-layout/plan")
  @ApiOperation({ summary: "由服务端大模型为当前文章生成专属排版决策" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "articleId", type: String })
  @ApiBody({ type: () => GenerateAiLayoutDto })
  @ApiOkResponse({ type: GenerateAiLayoutResponseDto })
  @ApiConflictResponse({ description: "文章版本已变化" })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  generate(
    @Param("articleId") articleId: string,
    @Body() body: GenerateAiLayoutDto,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.aiLayout.generate(session.user.id, articleId, body);
  }
}
