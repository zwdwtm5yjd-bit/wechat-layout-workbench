import { and, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "./client.js";
import { createUuidV7 } from "./id.js";
import { users } from "./schema/index.js";

const seedLockId = 1_047_001_002;
const disabledPasswordHash = "!disabled:provision-with-S1-AUTH-001";

export interface SeedBaseDataOptions {
  readonly environment: "development" | "test";
  readonly ownerDisplayName?: string;
  readonly ownerEmail?: string;
  readonly ownerTimezone?: string;
}

export interface SeedBaseDataResult {
  readonly created: boolean;
  readonly ownerId: string;
}

function normalizeOwnerEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("SEED_OWNER_EMAIL 不是有效的邮箱地址");
  }

  return normalized;
}

export async function seedBaseData(
  db: Database,
  options: SeedBaseDataOptions,
): Promise<SeedBaseDataResult> {
  const email = normalizeOwnerEmail(options.ownerEmail ?? "owner@example.invalid");
  const displayName = options.ownerDisplayName?.trim() || "Owner";
  const timezone = options.ownerTimezone?.trim() || "Asia/Shanghai";

  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(${seedLockId})`);

    const existing = await transaction
      .select({ id: users.id })
      .from(users)
      .where(and(eq(sql`lower(${users.email})`, email), isNull(users.deletedAt)))
      .limit(1);

    const existingOwner = existing[0];
    if (existingOwner) {
      return {
        created: false,
        ownerId: existingOwner.id,
      };
    }

    const ownerId = createUuidV7();
    await transaction.insert(users).values({
      id: ownerId,
      email,
      displayName,
      passwordHash: disabledPasswordHash,
      role: "owner",
      status: "disabled",
      timezone,
      locale: "zh-CN",
    });

    return {
      created: true,
      ownerId,
    };
  });
}
