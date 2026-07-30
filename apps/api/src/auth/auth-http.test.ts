import { type INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { createUuidV7 } from "@wechat-layout/database";
import supertest from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import { configureApplication } from "../configure-application.js";
import {
  AUTH_OPTIONS,
  AUTH_REPOSITORY,
  LOGIN_RATE_LIMITER,
  PASSWORD_HASHER,
} from "./auth.constants.js";
import { AuthController } from "./auth.controller.js";
import { Argon2PasswordHasher, CsrfTokenService, SessionTokenService } from "./auth.crypto.js";
import { AuthService } from "./auth.service.js";
import type {
  AuditEventInput,
  AuthenticatedSession,
  AuthRepository,
  AuthRuntimeOptions,
  AuthUserRecord,
  LoginRateLimiter,
  LoginRateLimitState,
  SessionCreationInput,
} from "./auth.types.js";
import { CsrfGuard } from "./csrf.guard.js";
import { SessionAuthenticationGuard } from "./session-authentication.guard.js";

const correctPassword = "correct-password-secret-marker";
const userId = createUuidV7();

const testOptions: AuthRuntimeOptions = {
  environment: "development",
  sessionSecret: "session-secret-for-auth-http-tests",
  csrfSecret: "csrf-secret-for-auth-http-tests",
  sessionTtlSeconds: 60 * 60,
  rememberedSessionTtlSeconds: 30 * 24 * 60 * 60,
  loginIdentifierMaxAttempts: 5,
  loginIpMaxAttempts: 25,
  loginRateLimitWindowSeconds: 15 * 60,
  loginLockoutSeconds: 15 * 60,
  sessionTouchIntervalSeconds: 5 * 60,
};

interface StoredSession extends Omit<AuthenticatedSession, "rawSessionToken"> {
  readonly userId: string;
  revoked: boolean;
}

class InMemoryAuthRepository implements AuthRepository {
  readonly auditEvents: AuditEventInput[] = [];
  readonly sessions = new Map<string, StoredSession>();
  readonly user: AuthUserRecord = {
    id: userId,
    email: "owner@example.com",
    username: "owner",
    displayName: "项目负责人",
    passwordHash:
      "$argon2id$v=19$m=19456,p=1,t=2$FM9dAIf0WYf24OZpTOxpyA$m+jg0HVeC0/KOKRMWP1WXLQCsiYztbr0pSBYtfRELKQ",
    role: "owner",
    status: "active",
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    avatarResourceId: null,
    lockedUntil: null,
  };

  #failedAttempts = 0;

  findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null> {
    const matches =
      identifier === this.user.email.toLowerCase() ||
      identifier === this.user.username?.toLowerCase();
    return Promise.resolve(matches ? this.user : null);
  }

  recordLoginFailure(
    _userId: string,
    maximumAttempts: number,
    lockoutSeconds: number,
  ): Promise<Date | null> {
    this.#failedAttempts += 1;
    return Promise.resolve(
      this.#failedAttempts >= maximumAttempts
        ? new Date(Date.now() + lockoutSeconds * 1_000)
        : null,
    );
  }

  recordLoginSuccess(): Promise<void> {
    this.#failedAttempts = 0;
    return Promise.resolve();
  }

  createSession(input: SessionCreationInput): Promise<void> {
    this.sessions.set(input.sessionTokenHash, {
      sessionId: input.id,
      sessionTokenHash: input.sessionTokenHash,
      expiresAt: input.expiresAt,
      userId: input.userId,
      user: {
        id: this.user.id,
        email: this.user.email,
        username: this.user.username,
        displayName: this.user.displayName,
        role: this.user.role,
        timezone: this.user.timezone,
        locale: this.user.locale,
        avatarResourceId: this.user.avatarResourceId,
      },
      revoked: false,
    });
    return Promise.resolve();
  }

  findActiveSessionByTokenHash(
    tokenHash: string,
  ): Promise<Omit<AuthenticatedSession, "rawSessionToken"> | null> {
    const session = this.sessions.get(tokenHash);
    if (
      session === undefined ||
      session.revoked ||
      session.expiresAt.getTime() <= Date.now() ||
      this.user.status !== "active"
    ) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      sessionId: session.sessionId,
      sessionTokenHash: session.sessionTokenHash,
      expiresAt: session.expiresAt,
      user: session.user,
    });
  }

  revokeSessionForUser(sessionId: string, requestedUserId: string): Promise<boolean> {
    const session = [...this.sessions.values()].find(
      (candidate) =>
        candidate.sessionId === sessionId &&
        candidate.userId === requestedUserId &&
        !candidate.revoked,
    );
    if (session === undefined) {
      return Promise.resolve(false);
    }

    session.revoked = true;
    return Promise.resolve(true);
  }

  revokeSessionByTokenHash(tokenHash: string): Promise<boolean> {
    const session = this.sessions.get(tokenHash);
    if (session === undefined || session.revoked) {
      return Promise.resolve(false);
    }

    session.revoked = true;
    return Promise.resolve(true);
  }

  recordAuditEvent(input: AuditEventInput): Promise<void> {
    this.auditEvents.push(input);
    return Promise.resolve();
  }

  provisionOwner(): Promise<{ created: boolean; userId: string }> {
    return Promise.resolve({ created: false, userId: this.user.id });
  }
}

class InMemoryLoginRateLimiter implements LoginRateLimiter {
  readonly #identifierFailures = new Map<string, number>();
  readonly #ipFailures = new Map<string, number>();

  check(identifier: string, ipAddress: string | null): Promise<LoginRateLimitState> {
    return Promise.resolve(this.state(identifier, ipAddress));
  }

  recordFailure(identifier: string, ipAddress: string | null): Promise<LoginRateLimitState> {
    this.#identifierFailures.set(identifier, (this.#identifierFailures.get(identifier) ?? 0) + 1);
    if (ipAddress !== null) {
      this.#ipFailures.set(ipAddress, (this.#ipFailures.get(ipAddress) ?? 0) + 1);
    }
    return Promise.resolve(this.state(identifier, ipAddress));
  }

  resetIdentifier(identifier: string): Promise<void> {
    this.#identifierFailures.delete(identifier);
    return Promise.resolve();
  }

  private state(identifier: string, ipAddress: string | null): LoginRateLimitState {
    const identifierFailures = this.#identifierFailures.get(identifier) ?? 0;
    const ipFailures = ipAddress === null ? 0 : (this.#ipFailures.get(ipAddress) ?? 0);
    const allowed =
      identifierFailures < testOptions.loginIdentifierMaxAttempts &&
      ipFailures < testOptions.loginIpMaxAttempts;
    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : testOptions.loginRateLimitWindowSeconds,
    };
  }
}

@Module({
  imports: [AppModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionTokenService,
    CsrfTokenService,
    InMemoryAuthRepository,
    InMemoryLoginRateLimiter,
    {
      provide: AUTH_OPTIONS,
      useValue: testOptions,
    },
    {
      provide: AUTH_REPOSITORY,
      useExisting: InMemoryAuthRepository,
    },
    {
      provide: LOGIN_RATE_LIMITER,
      useExisting: InMemoryLoginRateLimiter,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    {
      provide: APP_GUARD,
      useClass: SessionAuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
class AuthHttpTestModule {}

type TestAgent = ReturnType<typeof supertest.agent>;

async function getCsrfToken(agent: TestAgent): Promise<string> {
  const response = await agent.get("/api/v1/auth/csrf").expect(200);
  return response.body.data.csrfToken as string;
}

async function login(agent: TestAgent, password = correctPassword) {
  const csrfToken = await getCsrfToken(agent);
  return agent
    .post("/api/v1/auth/login")
    .set("x-csrf-token", csrfToken)
    .send({
      identifier: "OWNER@EXAMPLE.COM",
      password,
      rememberDevice: false,
    })
    .expect(200);
}

describe("authentication HTTP flow", () => {
  let application: INestApplication;
  let structuredLogOutput = "";

  beforeEach(async () => {
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      structuredLogOutput += String(chunk);
      return true;
    });
    application = await NestFactory.create(AuthHttpTestModule, {
      abortOnError: false,
      logger: false,
    });
    configureApplication(application, "development", "http://localhost:3000");
    await application.init();
  });

  afterEach(async () => {
    await application.close();
    vi.restoreAllMocks();
  });

  it("rejects unsafe writes without CSRF before checking credentials", async () => {
    const response = await supertest(application.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        identifier: "owner@example.com",
        password: correctPassword,
      })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "CSRF_INVALID",
      retryable: false,
    });
  });

  it("publishes wrapped authentication response schemas in OpenAPI", async () => {
    const response = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    const loginSchema =
      response.body.paths?.["/api/v1/auth/login"]?.post?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema;
    const loginRequestSchema =
      response.body.paths?.["/api/v1/auth/login"]?.post?.requestBody?.content?.["application/json"]
        ?.schema;
    const revokeParameters =
      response.body.paths?.["/api/v1/auth/sessions/{sessionId}"]?.delete?.parameters;

    expect(loginSchema).toEqual({
      $ref: "#/components/schemas/LoginResponseDto",
    });
    expect(loginRequestSchema).toEqual({
      $ref: "#/components/schemas/LoginDto",
    });
    expect(revokeParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "path",
          name: "sessionId",
          required: true,
        }),
      ]),
    );
    expect(response.body.components.schemas.LoginResponseDto).toBeDefined();
  });

  it("logs in with the correct password, uses an HttpOnly cookie and returns the user", async () => {
    const agent = supertest.agent(application.getHttpServer());
    const response = await login(agent);
    const setCookies = response.headers["set-cookie"] as string[] | undefined;
    const sessionCookie = setCookies?.find((cookie) => cookie.startsWith("session_id="));
    const currentUser = await agent.get("/api/v1/auth/me").expect(200);

    expect(response.body.data).toMatchObject({
      sessionId: expect.stringMatching(/^[a-f0-9-]{36}$/),
      user: {
        email: "owner@example.com",
        username: "owner",
        role: "owner",
      },
    });
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(currentUser.body.data.user.email).toBe("owner@example.com");
    expect(JSON.stringify(response.body)).not.toContain(correctPassword);
    expect(structuredLogOutput).not.toContain(correctPassword);
  });

  it("rate-limits repeated wrong passwords with a stable non-enumerating error", async () => {
    const agent = supertest.agent(application.getHttpServer());
    const csrfToken = await getCsrfToken(agent);

    for (let attempt = 1; attempt < testOptions.loginIdentifierMaxAttempts; attempt += 1) {
      const response = await agent
        .post("/api/v1/auth/login")
        .set("x-csrf-token", csrfToken)
        .send({
          identifier: "owner@example.com",
          password: "wrong-password",
        })
        .expect(401);
      expect(response.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
    }

    const limited = await agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .send({
        identifier: "owner@example.com",
        password: "wrong-password",
      })
      .expect(429);

    expect(limited.body.error).toMatchObject({
      code: "AUTH_LOGIN_RATE_LIMITED",
      details: {
        retryAfterSeconds: testOptions.loginRateLimitWindowSeconds,
      },
      retryable: true,
    });
  });

  it("requires CSRF for logout and invalidates the session after a valid logout", async () => {
    const agent = supertest.agent(application.getHttpServer());
    await login(agent);

    await agent.post("/api/v1/auth/logout").expect(403);
    await agent.get("/api/v1/auth/me").expect(200);

    const csrfToken = await getCsrfToken(agent);
    const logoutResponse = await agent
      .post("/api/v1/auth/logout")
      .set("x-csrf-token", csrfToken)
      .expect(200);

    expect(logoutResponse.body.data.revoked).toBe(true);
    await agent.get("/api/v1/auth/me").expect(401);
  });

  it("rejects a stale cookie immediately after the current session is revoked", async () => {
    const agent = supertest.agent(application.getHttpServer());
    const loginResponse = await login(agent);
    const setCookies = loginResponse.headers["set-cookie"] as string[] | undefined;
    const sessionCookie = setCookies
      ?.find((cookie) => cookie.startsWith("session_id="))
      ?.split(";")[0];
    const sessionId = loginResponse.body.data.sessionId as string;
    const csrfToken = loginResponse.body.data.csrfToken as string;

    expect(sessionCookie).toBeDefined();
    await agent
      .delete(`/api/v1/auth/sessions/${sessionId}`)
      .set("x-csrf-token", csrfToken)
      .expect(200);

    await supertest(application.getHttpServer())
      .get("/api/v1/auth/me")
      .set("cookie", sessionCookie ?? "")
      .expect(401);
  });
});
