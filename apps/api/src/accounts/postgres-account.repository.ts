import { Inject, Injectable } from "@nestjs/common";
import {
  articles,
  auditLogs,
  createUuidV7,
  officialAccounts,
  type DatabaseConnection,
} from "@wechat-layout/database";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import type {
  AccountDeleteImpact,
  AccountListQuery,
  AccountListResult,
  AccountMutationContext,
  AccountRecord,
  AccountRepository,
  AccountStatus,
  AccountTransition,
  AccountType,
  AccountVerificationStatus,
  CreateAccountInput,
  UpdateAccountInput,
} from "./account.types.js";

type JsonObject = Record<string, unknown>;

const articleCountSql = sql<number>`(
  select count(*)::integer
  from ${articles}
  where ${articles.accountId} = ${officialAccounts.id}
    and ${articles.deletedAt} is null
)`;

function escapeSearch(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function accountRecord(
  row: typeof officialAccounts.$inferSelect & { readonly articleCount: number },
): AccountRecord {
  return {
    ...row,
    accountType: row.accountType as AccountType,
    articleCount: Number(row.articleCount),
    contentTypes: [...row.contentTypes],
    status: row.status as AccountStatus,
    verificationStatus: row.verificationStatus as AccountVerificationStatus,
  };
}

function accountSummary(account: {
  readonly contentTypes: readonly string[];
  readonly isDefault: boolean;
  readonly name: string;
  readonly status: string;
}): JsonObject {
  return {
    contentTypes: [...account.contentTypes],
    isDefault: account.isDefault,
    name: account.name,
    status: account.status,
  };
}

function auditValues(
  account: { readonly id: string },
  context: AccountMutationContext,
  action: string,
  beforeSummary: JsonObject | null,
  afterSummary: JsonObject | null,
): typeof auditLogs.$inferInsert {
  return {
    id: createUuidV7(),
    actorUserId: context.actorUserId,
    actorType: "user",
    action,
    targetType: "official_account",
    targetId: account.id,
    accountId: account.id,
    requestId: context.requestId,
    traceId: context.traceId,
    beforeSummary,
    afterSummary,
    metadataJson: {},
  };
}

function slugFor(name: string, id: string): string {
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "account"}-${id.replaceAll("-", "").slice(-12)}`;
}

@Injectable()
export class PostgresAccountRepository implements AccountRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async list(ownerUserId: string, query: AccountListQuery): Promise<AccountListResult> {
    const conditions: SQL[] = [
      eq(officialAccounts.ownerUserId, ownerUserId),
      isNull(officialAccounts.deletedAt),
    ];
    if (query.status !== undefined) conditions.push(eq(officialAccounts.status, query.status));
    if (query.contentType !== undefined) {
      conditions.push(
        sql`${officialAccounts.contentTypes} @> ${JSON.stringify([query.contentType])}::jsonb`,
      );
    }
    if (query.search !== undefined) {
      const pattern = `%${escapeSearch(query.search.trim())}%`;
      conditions.push(
        or(
          ilike(officialAccounts.name, pattern),
          ilike(officialAccounts.shortName, pattern),
          ilike(officialAccounts.description, pattern),
        ) as SQL,
      );
    }
    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      this.connection.db
        .select({ ...getTableColumns(officialAccounts), articleCount: articleCountSql })
        .from(officialAccounts)
        .where(where)
        .orderBy(desc(officialAccounts.isDefault), desc(officialAccounts.updatedAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.connection.db.select({ total: count() }).from(officialAccounts).where(where),
    ]);
    return {
      items: rows.map(accountRecord),
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async find(ownerUserId: string, accountId: string): Promise<AccountRecord | null> {
    const [row] = await this.connection.db
      .select({ ...getTableColumns(officialAccounts), articleCount: articleCountSql })
      .from(officialAccounts)
      .where(
        and(
          eq(officialAccounts.id, accountId),
          eq(officialAccounts.ownerUserId, ownerUserId),
          isNull(officialAccounts.deletedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : accountRecord(row);
  }

  async create(input: CreateAccountInput): Promise<AccountRecord> {
    const id = createUuidV7();
    const now = new Date();
    await this.connection.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${input.ownerUserId}, 42101))`,
      );
      const [existingDefault] = await transaction
        .select({ id: officialAccounts.id })
        .from(officialAccounts)
        .where(
          and(
            eq(officialAccounts.ownerUserId, input.ownerUserId),
            eq(officialAccounts.isDefault, true),
            ne(officialAccounts.status, "archived"),
            isNull(officialAccounts.deletedAt),
          ),
        )
        .limit(1);
      if (input.isDefault && existingDefault !== undefined) {
        await transaction
          .update(officialAccounts)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(officialAccounts.ownerUserId, input.ownerUserId),
              eq(officialAccounts.isDefault, true),
              isNull(officialAccounts.deletedAt),
            ),
          );
      }
      const [created] = await transaction
        .insert(officialAccounts)
        .values({
          id,
          ownerUserId: input.ownerUserId,
          name: input.name,
          shortName: input.shortName,
          slug: slugFor(input.name, id),
          description: input.description,
          contentTypes: input.contentTypes,
          accountType: input.accountType,
          verificationStatus: input.verificationStatus,
          status: "active",
          defaultThemeId: input.defaultThemeId,
          isDefault: input.isDefault || existingDefault === undefined,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (created === undefined) throw new Error("公众号创建失败");
      await transaction
        .insert(auditLogs)
        .values(
          auditValues(created, input.context, "account.create", null, accountSummary(created)),
        );
    });
    const created = await this.find(input.ownerUserId, id);
    if (created === null) throw new Error("已创建的公众号无法读取");
    return created;
  }

  async update(
    ownerUserId: string,
    accountId: string,
    patch: UpdateAccountInput,
    context: AccountMutationContext,
  ): Promise<AccountRecord | null> {
    const changed = await this.connection.db.transaction(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(officialAccounts)
        .where(
          and(
            eq(officialAccounts.id, accountId),
            eq(officialAccounts.ownerUserId, ownerUserId),
            isNull(officialAccounts.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (before === undefined) return false;
      const [after] = await transaction
        .update(officialAccounts)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(officialAccounts.id, accountId))
        .returning();
      if (after === undefined) return false;
      await transaction
        .insert(auditLogs)
        .values(
          auditValues(
            after,
            context,
            "account.update",
            accountSummary(before),
            accountSummary(after),
          ),
        );
      return true;
    });
    return changed ? this.find(ownerUserId, accountId) : null;
  }

  async setDefault(
    ownerUserId: string,
    accountId: string,
    context: AccountMutationContext,
  ): Promise<"updated" | "not_found" | "not_active"> {
    return this.connection.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${ownerUserId}, 42101))`,
      );
      const [target] = await transaction
        .select()
        .from(officialAccounts)
        .where(
          and(
            eq(officialAccounts.id, accountId),
            eq(officialAccounts.ownerUserId, ownerUserId),
            isNull(officialAccounts.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (target === undefined) return "not_found";
      if (target.status !== "active") return "not_active";
      await transaction
        .update(officialAccounts)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(officialAccounts.ownerUserId, ownerUserId),
            eq(officialAccounts.isDefault, true),
            isNull(officialAccounts.deletedAt),
          ),
        );
      const [after] = await transaction
        .update(officialAccounts)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(officialAccounts.id, accountId))
        .returning();
      if (after === undefined) return "not_found";
      await transaction
        .insert(auditLogs)
        .values(
          auditValues(
            after,
            context,
            "account.default.set",
            accountSummary(target),
            accountSummary(after),
          ),
        );
      return "updated";
    });
  }

  async transition(
    ownerUserId: string,
    accountId: string,
    transition: AccountTransition,
    context: AccountMutationContext,
  ): Promise<"updated" | "not_found" | "invalid_state"> {
    return this.connection.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${ownerUserId}, 42101))`,
      );
      const [before] = await transaction
        .select()
        .from(officialAccounts)
        .where(
          and(
            eq(officialAccounts.id, accountId),
            eq(officialAccounts.ownerUserId, ownerUserId),
            isNull(officialAccounts.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (before === undefined) return "not_found";
      const targetStatus: AccountStatus =
        transition === "disable" ? "disabled" : transition === "enable" ? "active" : "archived";
      const valid =
        (transition === "disable" && ["active", "draft"].includes(before.status)) ||
        (transition === "enable" && before.status === "disabled") ||
        (transition === "archive" && before.status !== "archived");
      if (!valid) return "invalid_state";
      const now = new Date();
      const [after] = await transaction
        .update(officialAccounts)
        .set({
          status: targetStatus,
          archivedAt: targetStatus === "archived" ? now : null,
          isDefault: targetStatus === "active" ? before.isDefault : false,
          updatedAt: now,
        })
        .where(eq(officialAccounts.id, accountId))
        .returning();
      if (after === undefined) return "not_found";

      if (before.isDefault && targetStatus !== "active") {
        const [replacement] = await transaction
          .select({ id: officialAccounts.id })
          .from(officialAccounts)
          .where(
            and(
              eq(officialAccounts.ownerUserId, ownerUserId),
              eq(officialAccounts.status, "active"),
              ne(officialAccounts.id, accountId),
              isNull(officialAccounts.deletedAt),
            ),
          )
          .orderBy(desc(officialAccounts.updatedAt), asc(officialAccounts.id))
          .limit(1)
          .for("update");
        if (replacement !== undefined) {
          await transaction
            .update(officialAccounts)
            .set({ isDefault: true, updatedAt: now })
            .where(eq(officialAccounts.id, replacement.id));
        }
      } else if (targetStatus === "active") {
        const [currentDefault] = await transaction
          .select({ id: officialAccounts.id })
          .from(officialAccounts)
          .where(
            and(
              eq(officialAccounts.ownerUserId, ownerUserId),
              eq(officialAccounts.isDefault, true),
              isNull(officialAccounts.deletedAt),
            ),
          )
          .limit(1);
        if (currentDefault === undefined) {
          await transaction
            .update(officialAccounts)
            .set({ isDefault: true, updatedAt: now })
            .where(eq(officialAccounts.id, accountId));
          after.isDefault = true;
        }
      }
      await transaction
        .insert(auditLogs)
        .values(
          auditValues(
            after,
            context,
            `account.${transition}`,
            accountSummary(before),
            accountSummary(after),
          ),
        );
      return "updated";
    });
  }

  async deleteImpact(ownerUserId: string, accountId: string): Promise<AccountDeleteImpact | null> {
    const account = await this.find(ownerUserId, accountId);
    if (account === null) return null;
    const [counts] = await this.connection.db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${articles.deletedAt} is null)::integer`,
      })
      .from(articles)
      .where(eq(articles.accountId, accountId));
    const articleCount = Number(counts?.total ?? 0);
    const activeArticleCount = Number(counts?.active ?? 0);
    return {
      account,
      articleCount,
      activeArticleCount,
      canPermanentlyDelete: articleCount === 0,
      blockingReasons:
        articleCount === 0 ? [] : [`仍有 ${String(articleCount)} 篇文章关联该公众号`],
    };
  }

  async permanentlyDelete(
    ownerUserId: string,
    accountId: string,
    context: AccountMutationContext,
  ): Promise<"deleted" | "not_found" | "blocked"> {
    return this.connection.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${ownerUserId}, 42101))`,
      );
      const [before] = await transaction
        .select()
        .from(officialAccounts)
        .where(
          and(
            eq(officialAccounts.id, accountId),
            eq(officialAccounts.ownerUserId, ownerUserId),
            isNull(officialAccounts.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (before === undefined) return "not_found";
      const [related] = await transaction
        .select({ total: count() })
        .from(articles)
        .where(eq(articles.accountId, accountId));
      if (Number(related?.total ?? 0) > 0) return "blocked";
      const now = new Date();
      let replacementId: string | undefined;
      if (before.isDefault) {
        const [replacement] = await transaction
          .select({ id: officialAccounts.id })
          .from(officialAccounts)
          .where(
            and(
              eq(officialAccounts.ownerUserId, ownerUserId),
              eq(officialAccounts.status, "active"),
              ne(officialAccounts.id, accountId),
              isNull(officialAccounts.deletedAt),
            ),
          )
          .orderBy(desc(officialAccounts.updatedAt))
          .limit(1)
          .for("update");
        replacementId = replacement?.id;
      }
      await transaction
        .insert(auditLogs)
        .values(auditValues(before, context, "account.delete", accountSummary(before), null));
      await transaction.delete(officialAccounts).where(eq(officialAccounts.id, accountId));
      if (replacementId !== undefined) {
        await transaction
          .update(officialAccounts)
          .set({ isDefault: true, updatedAt: now })
          .where(eq(officialAccounts.id, replacementId));
      }
      return "deleted";
    });
  }
}
