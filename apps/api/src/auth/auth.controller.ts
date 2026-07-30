import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { contextFromRequest, type ContextualHttpRequest } from "../common/http/request-context.js";
import { AUTH_OPTIONS, CSRF_BINDING_COOKIE_NAME, SESSION_COOKIE_NAME } from "./auth.constants.js";
import { CsrfTokenService } from "./auth.crypto.js";
import { CurrentSession, PublicRoute } from "./auth.decorators.js";
import {
  CsrfResultDto,
  CsrfResponseDto,
  CurrentUserResponseDto,
  CurrentUserResultDto,
  LoginDto,
  LoginResponseDto,
  LoginResultDto,
  LogoutResponseDto,
  LogoutResultDto,
  SessionRevocationResponseDto,
  SessionRevocationResultDto,
} from "./auth.dto.js";
import { AuthService } from "./auth.service.js";
import type {
  AuthenticatedHttpRequest,
  AuthenticatedSession,
  AuthRuntimeOptions,
  LoginRequestContext,
} from "./auth.types.js";
import {
  buildCsrfBindingCookie,
  buildCsrfCookie,
  buildSessionCookie,
  clearAuthCookies,
  clearCsrfBindingCookie,
  parseCookieHeader,
} from "./cookies.js";

interface HeaderResponse {
  setHeader(name: string, value: string | readonly string[]): void;
}

type AuthControllerRequest = AuthenticatedHttpRequest & ContextualHttpRequest;

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function extractIpAddress(request: AuthenticatedHttpRequest): string | null {
  const value = request.ip ?? request.socket?.remoteAddress;
  if (value === undefined || value === "") {
    return null;
  }
  return value.startsWith("::ffff:") ? value.slice(7) : value;
}

function requestContext(request: AuthControllerRequest): LoginRequestContext {
  const context = contextFromRequest(request);
  const userAgent = firstHeader(request.headers["user-agent"]);

  return {
    ...context,
    ipAddress: extractIpAddress(request),
    userAgent: userAgent?.slice(0, 1_024) ?? null,
  };
}

function setNoStore(response: HeaderResponse): void {
  response.setHeader("Cache-Control", "no-store");
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService,
    @Inject(CsrfTokenService)
    private readonly csrfTokens: CsrfTokenService,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthRuntimeOptions,
  ) {}

  @Get("csrf")
  @PublicRoute()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "获取与当前会话绑定的 CSRF Token" })
  @ApiOkResponse({ type: CsrfResponseDto })
  csrf(
    @Req() request: AuthControllerRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): CsrfResultDto {
    const cookies = parseCookieHeader(firstHeader(request.headers.cookie));
    const sessionBinding = cookies.get(SESSION_COOKIE_NAME);
    const existingAnonymousBinding = cookies.get(CSRF_BINDING_COOKIE_NAME);
    const binding = sessionBinding ?? existingAnonymousBinding ?? this.csrfTokens.createBinding();
    const token = this.csrfTokens.issue(binding);
    const responseCookies = [buildCsrfCookie(token, this.options)];

    if (sessionBinding === undefined && existingAnonymousBinding === undefined) {
      responseCookies.push(buildCsrfBindingCookie(binding, this.options));
    }

    response.setHeader("Set-Cookie", responseCookies);
    return {
      csrfToken: token,
    };
  }

  @Post("login")
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "使用用户名或邮箱登录" })
  @ApiBody({ type: () => LoginDto })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  @ApiTooManyRequestsResponse({ description: "登录失败次数过多" })
  async login(
    @Body() body: LoginDto,
    @Req() request: AuthControllerRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<LoginResultDto> {
    const result = await this.auth.login(
      body.identifier,
      body.password,
      body.rememberDevice ?? false,
      requestContext(request),
    );
    const csrfToken = this.csrfTokens.issue(result.rawSessionToken);

    setNoStore(response);
    response.setHeader("Set-Cookie", [
      buildSessionCookie(result.rawSessionToken, this.options, result.persistent),
      buildCsrfCookie(csrfToken, this.options),
      clearCsrfBindingCookie(this.options),
    ]);

    return {
      user: result.user,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt.toISOString(),
      csrfToken,
    };
  }

  @Get("me")
  @ApiCookieAuth()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "获取当前用户与会话" })
  @ApiOkResponse({ type: CurrentUserResponseDto })
  @ApiUnauthorizedResponse({ description: "会话不存在、已到期或已撤销" })
  me(@CurrentSession() session: AuthenticatedSession): CurrentUserResultDto {
    return {
      user: session.user,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: "退出当前会话" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  async logout(
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuthControllerRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<LogoutResultDto> {
    const revoked = await this.auth.logout(session, requestContext(request));

    setNoStore(response);
    response.setHeader("Set-Cookie", clearAuthCookies(this.options));
    return {
      revoked,
    };
  }

  @Delete("sessions/:sessionId")
  @ApiCookieAuth()
  @ApiOperation({ summary: "撤销自己的指定会话" })
  @ApiHeader({ name: "X-CSRF-Token", required: true })
  @ApiParam({ format: "uuid", name: "sessionId", type: String })
  @ApiOkResponse({ type: SessionRevocationResponseDto })
  @ApiForbiddenResponse({ description: "CSRF 校验失败" })
  async revokeSession(
    @Param("sessionId") sessionId: string,
    @CurrentSession() actor: AuthenticatedSession,
    @Req() request: AuthControllerRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<SessionRevocationResultDto> {
    const revokedCurrentSession = await this.auth.revokeSession(
      sessionId,
      actor,
      requestContext(request),
    );

    setNoStore(response);
    if (revokedCurrentSession) {
      response.setHeader("Set-Cookie", clearAuthCookies(this.options));
    }

    return {
      sessionId,
      revoked: true,
    };
  }
}
