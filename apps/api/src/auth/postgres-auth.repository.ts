import { Inject, Injectable } from "@nestjs/common";
import {
  auditLogs,
  createUuidV7,
  type DatabaseConnection,
  userSessions,
  users,
} from "@wechat-layout/database";
import { and, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import type {
  AuditEventInput,
  AuthRepository,
  AuthUserRecord,
  AuthUserRole,
  AuthUserStatus,
  AuthenticatedSession,
  OwnerProvisioningInput,
  PublicAuthUser,
  SessionCreationInput,
} from "./auth.types.js";

const ownerProvisioningLockId = 1_047_001_003;

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Owner 邮箱格式无效");
  }
  return normalized;
}

function toPublicUser(row: {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  role: string;
  timezone: string;
  locale: string;
  avatarResourceId: string | null;
}): PublicAuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    role: row.role as AuthUserRole,
    timezone: row.timezone,
    locale: row.locale,
    avatarResourceId: row.avatarResourceId,
  };
}

@Injectable()
export class PostgresAuthRepository implements AuthRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null> {
    const normalized = identifier.trim().toLowerCase();
    const [row] = await this.connection.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
        role: users.role,
        status: users.status,
        timezone: users.timezone,
        locale: users.locale,
        avatarResourceId: users.avatarResourceId,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(
            eq(sql`lower(${users.email})`, normalized),
            eq(sql`lower(${users.username})`, normalized),
          ),
        ),
      )
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      ...row,
      role: row.role as AuthUserRole,
      status: row.status as AuthUserStatus,
    };
  }

  async recordLoginFailure(
    userId: string,
    maximumAttempts: number,
    lockoutSeconds: number,
  ): Promise<Date | null> {
    const [row] = await this.connection.db
      .update(users)
      .set({
        failedLoginCount: sql`${users.failedLoginCount} + 1`,
        lockedUntil: sql`case
          when ${users.failedLoginCount} + 1 >= ${maximumAttempts}
          then now() + (${lockoutSeconds} * interval '1 second')
          else ${users.lockedUntil}
        end`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        lockedUntil: users.lockedUntil,
      });

    return row?.lockedUntil ?? null;
  }

  async recordLoginSuccess(userId: string, occurredAt: Date): Promise<void> {
    await this.connection.db
      .update(users)
      .set({
        failedLoginCount: 0,
        lastLoginAt: occurredAt,
        lockedUntil: null,
        updatedAt: occurredAt,
      })
      .where(eq(users.id, userId));
  }

  async createSession(input: SessionCreationInput): Promise<void> {
    await this.connection.db.insert(userSessions).values(input);
  }

  async findActiveSessionByTokenHash(
    tokenHash: string,
    touchIntervalSeconds: number,
  ): Promise<Omit<AuthenticatedSession, "rawSessionToken"> | null> {
    const now = new Date();
    const [row] = await this.connection.db
      .select({
        sessionId: userSessions.id,
        sessionTokenHash: userSessions.sessionTokenHash,
        expiresAt: userSessions.expiresAt,
        userId: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        timezone: users.timezone,
        locale: users.locale,
        avatarResourceId: users.avatarResourceId,
      })
      .from(userSessions)
      .innerJoin(users, eq(users.id, userSessions.userId))
      .where(
        and(
          eq(userSessions.sessionTokenHash, tokenHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now),
          isNull(users.deletedAt),
          eq(users.status, "active"),
          or(isNull(users.lockedUntil), lte(users.lockedUntil, now)),
          or(isNull(users.passwordChangedAt), gte(userSessions.createdAt, users.passwordChangedAt)),
        ),
      )
      .limit(1);

    if (row === undefined) {
      return null;
    }

    await this.connection.db
      .update(userSessions)
      .set({
        lastSeenAt: now,
      })
      .where(
        and(
          eq(userSessions.id, row.sessionId),
          lte(
            userSessions.lastSeenAt,
            sql`now() - (${touchIntervalSeconds} * interval '1 second')`,
          ),
        ),
      );

    return {
      sessionId: row.sessionId,
      sessionTokenHash: row.sessionTokenHash,
      expiresAt: row.expiresAt,
      user: toPublicUser({
        ...row,
        id: row.userId,
      }),
    };
  }

  async revokeSessionForUser(
    sessionId: string,
    userId: string,
    reason: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const rows = await this.connection.db
      .update(userSessions)
      .set({
        revokedAt,
        revokeReason: reason,
      })
      .where(
        and(
          eq(userSessions.id, sessionId),
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
        ),
      )
      .returning({ id: userSessions.id });

    return rows.length > 0;
  }

  async revokeSessionByTokenHash(
    tokenHash: string,
    reason: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const rows = await this.connection.db
      .update(userSessions)
      .set({
        revokedAt,
        revokeReason: reason,
      })
      .where(and(eq(userSessions.sessionTokenHash, tokenHash), isNull(userSessions.revokedAt)))
      .returning({ id: userSessions.id });

    return rows.length > 0;
  }

  async recordAuditEvent(input: AuditEventInput): Promise<void> {
    await this.connection.db.insert(auditLogs).values({
      id: createUuidV7(),
      actorUserId: input.actorUserId,
      actorType: "user",
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      requestId: input.requestId,
      traceId: input.traceId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadataJson: input.metadata ?? {},
    });
  }

  async provisionOwner(
    input: OwnerProvisioningInput,
  ): Promise<{ created: boolean; userId: string }> {
    const email = normalizeEmail(input.email);

    return this.connection.db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(${ownerProvisioningLockId})`);

      const [existing] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.email})`, email), isNull(users.deletedAt)))
        .limit(1);
      const now = new Date();

      if (existing !== undefined) {
        await transaction
          .update(users)
          .set({
            passwordHash: input.passwordHash,
            displayName: input.displayName,
            timezone: input.timezone,
            role: "owner",
            status: "active",
            failedLoginCount: 0,
            lockedUntil: null,
            passwordChangedAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, existing.id));

        return {
          created: false,
          userId: existing.id,
        };
      }

      const userId = createUuidV7();
      await transaction.insert(users).values({
        id: userId,
        email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        role: "owner",
        status: "active",
        timezone: input.timezone,
        locale: "zh-CN",
        passwordChangedAt: now,
      });

      return {
        created: true,
        userId,
      };
    });
  }
}
