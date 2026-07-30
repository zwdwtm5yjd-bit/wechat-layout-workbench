import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { decideRouteAccess, sessionCookieName } from "./lib/auth/route-policy";

export function proxy(request: NextRequest): NextResponse {
  // 这里只做无数据访问的乐观预检；安全会话校验由 S1-AUTH-001 的数据访问层实现。
  const sessionHint = request.cookies.get(sessionCookieName)?.value;
  const decision = decideRouteAccess(request.nextUrl.pathname, Boolean(sessionHint));

  if (decision.allowed || decision.redirectPath === undefined) {
    return NextResponse.next();
  }

  const redirectUrl = new URL(decision.redirectPath, request.url);
  redirectUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/workspace/:path*"],
};
