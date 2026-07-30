import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";

import { ApiException } from "../common/http/api.exception.js";
import {
  CSRF_BINDING_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
} from "./auth.constants.js";
import { CsrfTokenService } from "./auth.crypto.js";
import type { AuthenticatedHttpRequest } from "./auth.types.js";
import { parseCookieHeader } from "./cookies.js";

interface MethodHttpRequest extends AuthenticatedHttpRequest {
  readonly method: string;
}

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(CsrfTokenService)
    private readonly csrfTokens: CsrfTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<MethodHttpRequest>();

    if (safeMethods.has(request.method.toUpperCase())) {
      return true;
    }

    const cookies = parseCookieHeader(firstHeader(request.headers.cookie));
    const headerToken = firstHeader(request.headers[CSRF_HEADER_NAME]);
    const cookieToken = cookies.get(CSRF_COOKIE_NAME);
    const binding = cookies.get(SESSION_COOKIE_NAME) ?? cookies.get(CSRF_BINDING_COOKIE_NAME);

    if (
      headerToken === undefined ||
      cookieToken === undefined ||
      binding === undefined ||
      !this.csrfTokens.verifySubmitted(headerToken, cookieToken, binding)
    ) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: "CSRF_INVALID",
        message: "CSRF 校验失败，请刷新页面后重试",
        retryable: false,
      });
    }

    return true;
  }
}
