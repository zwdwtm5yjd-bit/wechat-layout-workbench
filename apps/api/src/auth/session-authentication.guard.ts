import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PUBLIC_ROUTE_METADATA, SESSION_COOKIE_NAME } from "./auth.constants.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedHttpRequest } from "./auth.types.js";
import { parseCookieHeader } from "./cookies.js";

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class SessionAuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AuthService)
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    const cookies = parseCookieHeader(firstHeader(request.headers.cookie));
    const rawSessionToken = cookies.get(SESSION_COOKIE_NAME) ?? "";

    request.auth = await this.auth.authenticateSession(rawSessionToken);
    return true;
  }
}
