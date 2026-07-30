import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createUuidV7, isUuidV7 } from "@wechat-layout/database";

import { ApiException } from "../common/http/api.exception.js";
import {
  AUTH_OPTIONS,
  AUTH_REPOSITORY,
  LOGIN_RATE_LIMITER,
  PASSWORD_HASHER,
} from "./auth.constants.js";
import { SessionTokenService } from "./auth.crypto.js";
import type {
  AuthenticatedSession,
  AuthRepository,
  AuthRuntimeOptions,
  AuthUserRecord,
  LoginRateLimiter,
  LoginRequestContext,
  LoginResult,
  PasswordHasher,
  PublicAuthUser,
} from "./auth.types.js";

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function toPublicUser(user: AuthUserRecord): PublicAuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    timezone: user.timezone,
    locale: user.locale,
    avatarResourceId: user.avatarResourceId,
  };
}

function invalidCredentials(): ApiException {
  return new ApiException(HttpStatus.UNAUTHORIZED, {
    code: "AUTH_INVALID_CREDENTIALS",
    message: "账号或密码不正确",
    retryable: false,
  });
}

function rateLimited(retryAfterSeconds: number): ApiException {
  return new ApiException(HttpStatus.TOO_MANY_REQUESTS, {
    code: "AUTH_LOGIN_RATE_LIMITED",
    message: "登录尝试过于频繁，请稍后再试",
    details: {
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
    },
    retryable: true,
  });
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly repository: AuthRepository,
    @Inject(LOGIN_RATE_LIMITER)
    private readonly rateLimiter: LoginRateLimiter,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(AUTH_OPTIONS)
    private readonly options: AuthRuntimeOptions,
    @Inject(SessionTokenService)
    private readonly sessionTokens: SessionTokenService,
  ) {}

  async login(
    identifierInput: string,
    password: string,
    rememberDevice: boolean,
    context: LoginRequestContext,
  ): Promise<LoginResult> {
    const identifier = normalizeIdentifier(identifierInput);
    const initialLimit = await this.rateLimiter.check(identifier, context.ipAddress);

    if (!initialLimit.allowed) {
      throw rateLimited(initialLimit.retryAfterSeconds);
    }

    const user = await this.repository.findUserByIdentifier(identifier);
    const passwordMatches = await this.passwordHasher.verifyPassword(user?.passwordHash, password);
    const now = new Date();
    const lockRemainingSeconds =
      user?.lockedUntil === null || user?.lockedUntil === undefined
        ? 0
        : Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1_000);
    const canLogin =
      user !== null && passwordMatches && user.status === "active" && lockRemainingSeconds <= 0;

    if (!canLogin) {
      if (lockRemainingSeconds > 0) {
        throw rateLimited(lockRemainingSeconds);
      }

      const [failureLimit, databaseLock] = await Promise.all([
        this.rateLimiter.recordFailure(identifier, context.ipAddress),
        user?.status === "active"
          ? this.repository.recordLoginFailure(
              user.id,
              this.options.loginIdentifierMaxAttempts,
              this.options.loginLockoutSeconds,
            )
          : Promise.resolve(null),
      ]);

      if (user !== null) {
        await this.repository.recordAuditEvent({
          actorUserId: user.id,
          action: "auth.login.failed",
          targetType: "user",
          targetId: user.id,
          ...context,
          metadata: {
            rateLimited: !failureLimit.allowed,
          },
        });
      }

      if (!failureLimit.allowed) {
        throw rateLimited(failureLimit.retryAfterSeconds);
      }
      if (databaseLock !== null && databaseLock.getTime() > now.getTime()) {
        throw rateLimited((databaseLock.getTime() - now.getTime()) / 1_000);
      }

      throw invalidCredentials();
    }

    await this.rateLimiter.resetIdentifier(identifier);
    await this.repository.recordLoginSuccess(user.id, now);

    const persistent = rememberDevice;
    const ttlSeconds = persistent
      ? this.options.rememberedSessionTtlSeconds
      : this.options.sessionTtlSeconds;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000);
    const sessionId = createUuidV7();
    const deviceId = createUuidV7();
    const token = this.sessionTokens.create();

    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      sessionTokenHash: token.tokenHash,
      deviceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt,
    });

    try {
      await this.repository.recordAuditEvent({
        actorUserId: user.id,
        action: "auth.login.succeeded",
        targetType: "user_session",
        targetId: sessionId,
        ...context,
        metadata: {
          remembered: persistent,
        },
      });
    } catch (error) {
      await this.repository.revokeSessionByTokenHash(
        token.tokenHash,
        "audit_write_failed",
        new Date(),
      );
      throw error;
    }

    return {
      rawSessionToken: token.rawToken,
      sessionId,
      expiresAt,
      persistent,
      user: toPublicUser(user),
    };
  }

  async authenticateSession(rawSessionToken: string): Promise<AuthenticatedSession> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(rawSessionToken)) {
      throw this.authenticationRequired();
    }

    const sessionTokenHash = this.sessionTokens.hash(rawSessionToken);
    const session = await this.repository.findActiveSessionByTokenHash(
      sessionTokenHash,
      this.options.sessionTouchIntervalSeconds,
    );

    if (session === null) {
      throw this.authenticationRequired();
    }

    return {
      ...session,
      rawSessionToken,
    };
  }

  async logout(session: AuthenticatedSession, context: LoginRequestContext): Promise<boolean> {
    const revoked = await this.repository.revokeSessionByTokenHash(
      session.sessionTokenHash,
      "user_logout",
      new Date(),
    );

    if (revoked) {
      await this.repository.recordAuditEvent({
        actorUserId: session.user.id,
        action: "auth.logout",
        targetType: "user_session",
        targetId: session.sessionId,
        ...context,
      });
    }

    return revoked;
  }

  async revokeSession(
    sessionId: string,
    actor: AuthenticatedSession,
    context: LoginRequestContext,
  ): Promise<boolean> {
    if (!isUuidV7(sessionId)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: "VALIDATION_FAILED",
        message: "会话 ID 无效",
        retryable: false,
      });
    }

    const revoked = await this.repository.revokeSessionForUser(
      sessionId,
      actor.user.id,
      "user_revoked",
      new Date(),
    );

    if (!revoked) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: "AUTH_SESSION_NOT_FOUND",
        message: "会话不存在或已失效",
        retryable: false,
      });
    }

    await this.repository.recordAuditEvent({
      actorUserId: actor.user.id,
      action: "auth.session.revoked",
      targetType: "user_session",
      targetId: sessionId,
      ...context,
    });

    return sessionId === actor.sessionId;
  }

  private authenticationRequired(): ApiException {
    return new ApiException(HttpStatus.UNAUTHORIZED, {
      code: "AUTH_REQUIRED",
      message: "登录状态已失效，请重新登录",
      retryable: false,
    });
  }
}
