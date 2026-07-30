import {
  CSRF_BINDING_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "./auth.constants.js";
import type { AuthRuntimeOptions } from "./auth.types.js";

interface CookieOptions {
  readonly expires?: Date;
  readonly httpOnly: boolean;
  readonly maxAgeSeconds?: number;
  readonly sameSite: "Lax" | "Strict";
  readonly secure: boolean;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", `SameSite=${options.sameSite}`];

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  if (options.expires !== undefined) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  return parts.join("; ");
}

function cookieSecurity(options: AuthRuntimeOptions): Pick<CookieOptions, "sameSite" | "secure"> {
  return {
    sameSite: "Lax",
    secure: options.environment === "production",
  };
}

export function parseCookieHeader(header: string | undefined): ReadonlyMap<string, string> {
  const cookies = new Map<string, string>();

  for (const pair of header?.split(";") ?? []) {
    const separator = pair.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();

    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, value);
    }
  }

  return cookies;
}

export function buildSessionCookie(
  token: string,
  options: AuthRuntimeOptions,
  persistent: boolean,
): string {
  return serializeCookie(SESSION_COOKIE_NAME, token, {
    ...cookieSecurity(options),
    httpOnly: true,
    ...(persistent ? { maxAgeSeconds: options.rememberedSessionTtlSeconds } : {}),
  });
}

export function buildCsrfCookie(token: string, options: AuthRuntimeOptions): string {
  return serializeCookie(CSRF_COOKIE_NAME, token, {
    ...cookieSecurity(options),
    httpOnly: false,
  });
}

export function buildCsrfBindingCookie(binding: string, options: AuthRuntimeOptions): string {
  return serializeCookie(CSRF_BINDING_COOKIE_NAME, binding, {
    ...cookieSecurity(options),
    httpOnly: true,
  });
}

export function clearAuthCookies(options: AuthRuntimeOptions): string[] {
  const expired = new Date(0);
  const security = cookieSecurity(options);

  return [
    serializeCookie(SESSION_COOKIE_NAME, "", {
      ...security,
      expires: expired,
      httpOnly: true,
      maxAgeSeconds: 0,
    }),
    serializeCookie(CSRF_COOKIE_NAME, "", {
      ...security,
      expires: expired,
      httpOnly: false,
      maxAgeSeconds: 0,
    }),
    serializeCookie(CSRF_BINDING_COOKIE_NAME, "", {
      ...security,
      expires: expired,
      httpOnly: true,
      maxAgeSeconds: 0,
    }),
  ];
}

export function clearCsrfBindingCookie(options: AuthRuntimeOptions): string {
  return serializeCookie(CSRF_BINDING_COOKIE_NAME, "", {
    ...cookieSecurity(options),
    expires: new Date(0),
    httpOnly: true,
    maxAgeSeconds: 0,
  });
}
