export const AUTH_OPTIONS = Symbol("AUTH_OPTIONS");
export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");
export const LOGIN_RATE_LIMITER = Symbol("LOGIN_RATE_LIMITER");
export const PASSWORD_HASHER = Symbol("PASSWORD_HASHER");

export const SESSION_COOKIE_NAME = "session_id";
export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_BINDING_COOKIE_NAME = "csrf_binding";
export const CSRF_HEADER_NAME = "x-csrf-token";

export const PUBLIC_ROUTE_METADATA = Symbol("PUBLIC_ROUTE_METADATA");

export const AUTH_SECURITY_DEFAULTS = Object.freeze({
  sessionTtlSeconds: 12 * 60 * 60,
  rememberedSessionTtlSeconds: 30 * 24 * 60 * 60,
  loginIdentifierMaxAttempts: 5,
  loginIpMaxAttempts: 25,
  loginRateLimitWindowSeconds: 15 * 60,
  loginLockoutSeconds: 15 * 60,
  sessionTouchIntervalSeconds: 5 * 60,
});
