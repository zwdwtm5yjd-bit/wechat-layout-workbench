export const sessionCookieName = "session_id";

export interface RouteAccessDecision {
  readonly allowed: boolean;
  readonly redirectPath?: string;
}

export function decideRouteAccess(pathname: string, hasSessionHint: boolean): RouteAccessDecision {
  const isProtectedRoute = pathname === "/workspace" || pathname.startsWith("/workspace/");

  if (!isProtectedRoute || hasSessionHint) {
    return { allowed: true };
  }

  return {
    allowed: false,
    redirectPath: "/login",
  };
}
