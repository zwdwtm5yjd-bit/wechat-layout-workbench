import { and, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "./client.js";
import { createUuidV7 } from "./id.js";
import { officialAccounts, users } from "./schema/index.js";

const seedLockId = 1_047_001_002;
const disabledPasswordHash = "!disabled:provision-with-S1-AUTH-001";

export interface SeedBaseDataOptions {
  readonly environment: "development" | "test";
  readonly ownerDisplayName?: string;
  readonly ownerEmail?: string;
  readonly ownerTimezone?: string;
}

export interface SeedBaseDataResult {
  readonly accountIds: readonly string[];
  readonly accountsCreated: number;
  readonly created: boolean;
  readonly ownerId: string;
}

const accountSeeds = [
  {
    contentTypes: ["inspection", "government"],
    description: "巡察监督与整改工作内容空间",
    isDefault: true,
    name: "清风巡察",
    shortName: "清风",
    slug: "qingfeng-inspection",
  },
  {
    contentTypes: ["government", "policy"],
    description: "政务公开与政策解读内容空间",
    isDefault: false,
    name: "政务发布",
    shortName: "政务",
    slug: "government-release",
  },
  {
    contentTypes: ["culture", "story"],
    description: "组织文化与人物故事内容空间",
    isDefault: false,
    name: "人文纪事",
    shortName: "纪事",
    slug: "humanity-stories",
  },
] as const;

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
    const ownerId = existingOwner?.id ?? createUuidV7();
    if (existingOwner === undefined) {
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
    }

    const existingAccounts = await transaction
      .select({ id: officialAccounts.id, slug: officialAccounts.slug })
      .from(officialAccounts)
      .where(and(eq(officialAccounts.ownerUserId, ownerId), isNull(officialAccounts.deletedAt)));
    const accountsBySlug = new Map(existingAccounts.map((account) => [account.slug, account.id]));
    let accountsCreated = 0;
    for (const account of accountSeeds) {
      if (accountsBySlug.has(account.slug)) continue;
      const id = createUuidV7();
      await transaction.insert(officialAccounts).values({
        id,
        ownerUserId: ownerId,
        name: account.name,
        shortName: account.shortName,
        slug: account.slug,
        description: account.description,
        contentTypes: account.contentTypes,
        status: "active",
        isDefault: existingAccounts.length === 0 && accountsCreated === 0 && account.isDefault,
      });
      accountsBySlug.set(account.slug, id);
      accountsCreated += 1;
    }

    return {
      accountIds: accountSeeds.flatMap((account) => {
        const id = accountsBySlug.get(account.slug);
        return id === undefined ? [] : [id];
      }),
      accountsCreated,
      created: existingOwner === undefined,
      ownerId,
    };
  });
}
