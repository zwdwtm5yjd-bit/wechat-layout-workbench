export type AuthUserRole = "owner" | "editor" | "publisher" | "viewer";
export type AuthUserStatus = "active" | "disabled" | "locked";

export interface AuthRuntimeOptions {
  readonly environment: "development" | "test" | "production";
  readonly sessionSecret: string;
  readonly csrfSecret: string;
  readonly sessionTtlSeconds: number;
  readonly rememberedSessionTtlSeconds: number;
  readonly loginIdentifierMaxAttempts: number;
  readonly loginIpMaxAttempts: number;
  readonly loginRateLimitWindowSeconds: number;
  readonly loginLockoutSeconds: number;
  readonly sessionTouchIntervalSeconds: number;
}

export interface AuthUserRecord {
  readonly id: string;
  readonly email: string;
  readonly username: string | null;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly timezone: string;
  readonly locale: string;
  readonly avatarResourceId: string | null;
  readonly lockedUntil: Date | null;
}

export interface PublicAuthUser {
  readonly id: string;
  readonly email: string;
  readonly username: string | null;
  readonly displayName: string;
  readonly role: AuthUserRole;
  readonly timezone: string;
  readonly locale: string;
  readonly avatarResourceId: string | null;
}

export interface AuthenticatedSession {
  readonly sessionId: string;
  readonly sessionTokenHash: string;
  readonly rawSessionToken: string;
  readonly expiresAt: Date;
  readonly user: PublicAuthUser;
}

export interface SessionCreationInput {
  readonly id: string;
  readonly userId: string;
  readonly sessionTokenHash: string;
  readonly deviceId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
}

export interface AuditEventInput {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly requestId: string;
  readonly traceId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface OwnerProvisioningInput {
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly timezone: string;
}

export interface AuthRepository {
  findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null>;
  recordLoginFailure(
    userId: string,
    maximumAttempts: number,
    lockoutSeconds: number,
  ): Promise<Date | null>;
  recordLoginSuccess(userId: string, occurredAt: Date): Promise<void>;
  createSession(input: SessionCreationInput): Promise<void>;
  findActiveSessionByTokenHash(
    tokenHash: string,
    touchIntervalSeconds: number,
  ): Promise<Omit<AuthenticatedSession, "rawSessionToken"> | null>;
  revokeSessionForUser(
    sessionId: string,
    userId: string,
    reason: string,
    revokedAt: Date,
  ): Promise<boolean>;
  revokeSessionByTokenHash(tokenHash: string, reason: string, revokedAt: Date): Promise<boolean>;
  recordAuditEvent(input: AuditEventInput): Promise<void>;
  provisionOwner(input: OwnerProvisioningInput): Promise<{ created: boolean; userId: string }>;
}

export interface PasswordHasher {
  hashPassword(password: string): Promise<string>;
  verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean>;
}

export interface LoginRateLimitState {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface LoginRateLimiter {
  check(identifier: string, ipAddress: string | null): Promise<LoginRateLimitState>;
  recordFailure(identifier: string, ipAddress: string | null): Promise<LoginRateLimitState>;
  resetIdentifier(identifier: string): Promise<void>;
}

export interface LoginRequestContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string;
  readonly traceId: string;
}

export interface LoginResult {
  readonly rawSessionToken: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
  readonly persistent: boolean;
  readonly user: PublicAuthUser;
}

export interface AuthenticatedHttpRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly ip?: string;
  readonly socket?: Readonly<{ remoteAddress?: string }>;
  auth?: AuthenticatedSession;
}
