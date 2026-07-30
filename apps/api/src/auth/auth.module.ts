import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";

import { DatabaseModule } from "../database/database.module.js";
import { RedisModule } from "../redis/redis.module.js";
import {
  AUTH_OPTIONS,
  AUTH_REPOSITORY,
  AUTH_SECURITY_DEFAULTS,
  LOGIN_RATE_LIMITER,
  PASSWORD_HASHER,
} from "./auth.constants.js";
import { Argon2PasswordHasher, CsrfTokenService, SessionTokenService } from "./auth.crypto.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import type { AuthRuntimeOptions } from "./auth.types.js";
import { CsrfGuard } from "./csrf.guard.js";
import { PostgresAuthRepository } from "./postgres-auth.repository.js";
import { RedisLoginRateLimiter } from "./redis-login-rate-limiter.js";
import { SessionAuthenticationGuard } from "./session-authentication.guard.js";

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_OPTIONS,
      useFactory: (): AuthRuntimeOptions => {
        const configuration = loadServerEnvironment();

        return Object.freeze({
          ...AUTH_SECURITY_DEFAULTS,
          environment: configuration.application.environment,
          sessionSecret: revealSecret(configuration.security.sessionSecret),
          csrfSecret: revealSecret(configuration.security.csrfSecret),
        });
      },
    },
    {
      provide: AUTH_REPOSITORY,
      useClass: PostgresAuthRepository,
    },
    {
      provide: LOGIN_RATE_LIMITER,
      useClass: RedisLoginRateLimiter,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    AuthService,
    SessionTokenService,
    CsrfTokenService,
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
export class AuthModule {}
