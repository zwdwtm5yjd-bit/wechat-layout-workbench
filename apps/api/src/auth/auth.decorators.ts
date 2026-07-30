import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";

import { PUBLIC_ROUTE_METADATA } from "./auth.constants.js";
import type { AuthenticatedHttpRequest, AuthenticatedSession } from "./auth.types.js";

export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_METADATA, true);

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    if (request.auth === undefined) {
      throw new Error("认证上下文不存在");
    }

    return request.auth;
  },
);
