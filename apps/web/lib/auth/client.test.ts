// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthClientError, getCurrentUser, login, logout, revokeSession } from "./client";

function successResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        requestId: "req_test",
        traceId: "trace_test",
        timestamp: new Date(0).toISOString(),
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authentication browser client", () => {
  it("obtains CSRF before login and sends credentials without browser token storage", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successResponse({ csrfToken: "csrf-for-login" }))
      .mockResolvedValueOnce(
        successResponse({
          user: {
            id: "01900000-0000-7000-8000-000000000001",
            email: "owner@example.com",
            username: "owner",
            displayName: "项目负责人",
            role: "owner",
            timezone: "Asia/Shanghai",
            locale: "zh-CN",
            avatarResourceId: null,
          },
          sessionId: "01900000-0000-7000-8000-000000000002",
          expiresAt: "2026-07-31T00:00:00.000Z",
          csrfToken: "rotated-csrf",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");

    const result = await login({
      identifier: "owner@example.com",
      password: "correct-password",
      rememberDevice: true,
    });

    expect(result.user.role).toBe("owner");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3001/api/v1/auth/csrf",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3001/api/v1/auth/login",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-for-login",
        }),
      }),
    );
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        identifier: "owner@example.com",
        password: "correct-password",
        rememberDevice: true,
      }),
    );
    expect(localStorageSpy).not.toHaveBeenCalled();
  });

  it("normalizes rate-limit responses for the login form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "AUTH_LOGIN_RATE_LIMITED",
              message: "登录尝试过于频繁，请稍后再试",
              details: {
                retryAfterSeconds: 900,
              },
              retryable: true,
            },
            meta: {
              requestId: "req_test",
              traceId: "trace_test",
              timestamp: new Date(0).toISOString(),
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(getCurrentUser()).rejects.toEqual(
      new AuthClientError(429, "AUTH_LOGIN_RATE_LIMITED", "登录尝试过于频繁，请稍后再试", 900),
    );
  });

  it("preflights logout and session revocation with fresh CSRF tokens", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successResponse({ csrfToken: "csrf-logout" }))
      .mockResolvedValueOnce(successResponse({ revoked: true }))
      .mockResolvedValueOnce(successResponse({ csrfToken: "csrf-revoke" }))
      .mockResolvedValueOnce(successResponse({ revoked: true }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();
    await revokeSession("session/id");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3001/api/v1/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-logout",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:3001/api/v1/auth/sessions/session%2Fid",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-revoke",
        }),
      }),
    );
  });
});
