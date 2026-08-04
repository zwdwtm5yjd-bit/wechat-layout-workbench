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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentSession } from "../auth/auth.decorators.js";
import type { AuthenticatedSession } from "../auth/auth.types.js";
import { contextFromRequest, type ContextualHttpRequest } from "../common/http/request-context.js";
import {
  AccountDeleteImpactResponseDto,
  AccountDeleteResponseDto,
  AccountListQueryDto,
  AccountListResponseDto,
  AccountResponseDto,
  CreateAccountDto,
  DeleteAccountDto,
  UpdateAccountDto,
} from "./account.dto.js";
import { AccountService } from "./account.service.js";
import type { AccountMutationContext, AccountTransition } from "./account.types.js";

function mutationContext(
  session: AuthenticatedSession,
  request: ContextualHttpRequest,
): AccountMutationContext {
  return { actorUserId: session.user.id, ...contextFromRequest(request) };
}

@ApiTags("accounts")
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
@Controller("accounts")
export class AccountController {
  constructor(
    @Inject(AccountService)
    private readonly accounts: AccountService,
  ) {}

  @Get()
  @ApiOperation({ summary: "列出当前用户的公众号" })
  @ApiOkResponse({ type: AccountListResponseDto })
  list(@Query() query: AccountListQueryDto, @CurrentSession() session: AuthenticatedSession) {
    return this.accounts.list(session.user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "创建公众号" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => CreateAccountDto })
  @ApiCreatedResponse({ type: AccountResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  create(
    @Body() body: CreateAccountDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.accounts.create(session.user.id, body, mutationContext(session, request));
  }

  @Get(":accountId")
  @ApiOperation({ summary: "获取公众号详情" })
  @ApiParam({ format: "uuid", name: "accountId", type: String })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: "公众号不存在" })
  get(@Param("accountId") accountId: string, @CurrentSession() session: AuthenticatedSession) {
    return this.accounts.get(session.user.id, accountId);
  }

  @Patch(":accountId")
  @ApiOperation({ summary: "更新公众号基础信息" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => UpdateAccountDto })
  @ApiOkResponse({ type: AccountResponseDto })
  update(
    @Param("accountId") accountId: string,
    @Body() body: UpdateAccountDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.accounts.update(
      session.user.id,
      accountId,
      body,
      mutationContext(session, request),
    );
  }

  @Post(":accountId/default")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "设为唯一默认公众号" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiConflictResponse({ description: "归档或停用公众号不能设为默认" })
  setDefault(
    @Param("accountId") accountId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.accounts.setDefault(session.user.id, accountId, mutationContext(session, request));
  }

  @Post(":accountId/disable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "停用公众号" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOkResponse({ type: AccountResponseDto })
  disable(
    @Param("accountId") accountId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.transition(accountId, "disable", session, request);
  }

  @Post(":accountId/enable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "启用公众号" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOkResponse({ type: AccountResponseDto })
  enable(
    @Param("accountId") accountId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.transition(accountId, "enable", session, request);
  }

  @Post(":accountId/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "归档公众号并移出默认选择" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOkResponse({ type: AccountResponseDto })
  archive(
    @Param("accountId") accountId: string,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.transition(accountId, "archive", session, request);
  }

  @Get(":accountId/delete-impact")
  @ApiOperation({ summary: "预检永久删除影响" })
  @ApiOkResponse({ type: AccountDeleteImpactResponseDto })
  deleteImpact(
    @Param("accountId") accountId: string,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.accounts.deleteImpact(session.user.id, accountId);
  }

  @Delete(":accountId")
  @ApiOperation({ summary: "永久删除无文章关联的公众号" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiBody({ type: () => DeleteAccountDto })
  @ApiConflictResponse({ description: "公众号仍有关联文章" })
  @ApiOkResponse({ description: "公众号已永久删除", type: AccountDeleteResponseDto })
  permanentlyDelete(
    @Param("accountId") accountId: string,
    @Body() _body: DeleteAccountDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: ContextualHttpRequest,
  ) {
    return this.accounts.permanentlyDelete(
      session.user.id,
      accountId,
      mutationContext(session, request),
    );
  }

  private transition(
    accountId: string,
    transition: AccountTransition,
    session: AuthenticatedSession,
    request: ContextualHttpRequest,
  ) {
    return this.accounts.transition(
      session.user.id,
      accountId,
      transition,
      mutationContext(session, request),
    );
  }
}
