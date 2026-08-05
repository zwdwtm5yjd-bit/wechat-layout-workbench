import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { createUuidV7 } from "@wechat-layout/database";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import type { AuthenticatedHttpRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/http/api.exception.js";
import { configureApplication } from "../configure-application.js";
import { ACCOUNT_REPOSITORY } from "./account.constants.js";
import { AccountController } from "./account.controller.js";
import { AccountService } from "./account.service.js";
import type {
  AccountDeleteImpact,
  AccountListQuery,
  AccountListResult,
  AccountRecord,
  AccountRepository,
  AccountTransition,
  CreateAccountInput,
  UpdateAccountInput,
} from "./account.types.js";

const ownerUserId = createUuidV7();
const otherUserId = createUuidV7();

type MutableAccount = { -readonly [Key in keyof AccountRecord]: AccountRecord[Key] };

@Injectable()
class AccountHttpTestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      AuthenticatedHttpRequest & {
        readonly method: string;
        readonly headers: Readonly<Record<string, string | string[] | undefined>>;
      }
    >();
    if (request.headers["x-test-user"] === "missing") {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: "AUTH_REQUIRED",
        message: "需要登录后继续",
        retryable: false,
      });
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers["x-csrf-token"] !== "test-csrf-token"
    ) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: "CSRF_INVALID",
        message: "CSRF 校验失败",
        retryable: false,
      });
    }
    request.auth = {
      sessionId: createUuidV7(),
      sessionTokenHash: "a".repeat(64),
      rawSessionToken: "test-session-token",
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: request.headers["x-test-user"] === "other" ? otherUserId : ownerUserId,
        email: "owner@example.com",
        username: "owner",
        displayName: "Owner",
        role: "owner",
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
        avatarResourceId: null,
      },
    };
    return true;
  }
}

@Injectable()
class InMemoryAccountRepository implements AccountRepository {
  readonly accounts = new Map<string, MutableAccount>();
  readonly articleCounts = new Map<string, number>();

  list(ownerId: string, query: AccountListQuery): Promise<AccountListResult> {
    const items = [...this.accounts.values()]
      .filter((account) => account.ownerUserId === ownerId)
      .filter((account) => query.status === undefined || account.status === query.status)
      .filter((account) =>
        query.contentType === undefined ? true : account.contentTypes.includes(query.contentType),
      )
      .filter((account) =>
        query.search === undefined
          ? true
          : `${account.name} ${account.shortName ?? ""} ${account.description ?? ""}`.includes(
              query.search,
            ),
      )
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
    return Promise.resolve({
      items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: items.length,
    });
  }

  find(ownerId: string, accountId: string): Promise<AccountRecord | null> {
    const account = this.accounts.get(accountId);
    return Promise.resolve(account?.ownerUserId === ownerId ? { ...account } : null);
  }

  create(input: CreateAccountInput): Promise<AccountRecord> {
    const now = new Date();
    const id = createUuidV7();
    const hasDefault = [...this.accounts.values()].some(
      (account) => account.ownerUserId === input.ownerUserId && account.isDefault,
    );
    if (input.isDefault) this.unsetDefaults(input.ownerUserId);
    const account: MutableAccount = {
      id,
      ownerUserId: input.ownerUserId,
      name: input.name,
      shortName: input.shortName,
      slug: `account-${id.slice(-12)}`,
      description: input.description,
      contentTypes: [...input.contentTypes],
      accountType: input.accountType,
      verificationStatus: input.verificationStatus,
      status: "active",
      defaultThemeId: input.defaultThemeId,
      defaultPaletteId: null,
      currentBrandVersionId: null,
      isDefault: input.isDefault || !hasDefault,
      articleCount: 0,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(id, account);
    return Promise.resolve({ ...account });
  }

  update(
    ownerId: string,
    accountId: string,
    patch: UpdateAccountInput,
  ): Promise<AccountRecord | null> {
    const account = this.owned(ownerId, accountId);
    if (account === null) return Promise.resolve(null);
    Object.assign(account, patch, { updatedAt: new Date() });
    return Promise.resolve({ ...account });
  }

  setDefault(ownerId: string, accountId: string): Promise<"updated" | "not_found" | "not_active"> {
    const account = this.owned(ownerId, accountId);
    if (account === null) return Promise.resolve("not_found");
    if (account.status !== "active") return Promise.resolve("not_active");
    this.unsetDefaults(ownerId);
    account.isDefault = true;
    return Promise.resolve("updated");
  }

  transition(
    ownerId: string,
    accountId: string,
    transition: AccountTransition,
  ): Promise<"updated" | "not_found" | "invalid_state"> {
    const account = this.owned(ownerId, accountId);
    if (account === null) return Promise.resolve("not_found");
    if (
      (transition === "disable" && !["active", "draft"].includes(account.status)) ||
      (transition === "enable" && account.status !== "disabled") ||
      (transition === "archive" && account.status === "archived")
    ) {
      return Promise.resolve("invalid_state");
    }
    const wasDefault = account.isDefault;
    account.status =
      transition === "disable" ? "disabled" : transition === "enable" ? "active" : "archived";
    account.archivedAt = transition === "archive" ? new Date() : null;
    account.isDefault = account.status === "active" && account.isDefault;
    if (wasDefault && account.status !== "active") {
      const replacement = [...this.accounts.values()].find(
        (candidate) =>
          candidate.ownerUserId === ownerId &&
          candidate.id !== accountId &&
          candidate.status === "active",
      );
      if (replacement !== undefined) replacement.isDefault = true;
    }
    return Promise.resolve("updated");
  }

  async deleteImpact(ownerId: string, accountId: string): Promise<AccountDeleteImpact | null> {
    const account = await this.find(ownerId, accountId);
    if (account === null) return null;
    const articleCount = this.articleCounts.get(accountId) ?? 0;
    return {
      account,
      articleCount,
      activeArticleCount: articleCount,
      canPermanentlyDelete: articleCount === 0,
      blockingReasons:
        articleCount === 0 ? [] : [`仍有 ${String(articleCount)} 篇文章关联该公众号`],
    };
  }

  permanentlyDelete(
    ownerId: string,
    accountId: string,
  ): Promise<"deleted" | "not_found" | "blocked"> {
    const account = this.owned(ownerId, accountId);
    if (account === null) return Promise.resolve("not_found");
    if ((this.articleCounts.get(accountId) ?? 0) > 0) return Promise.resolve("blocked");
    this.accounts.delete(accountId);
    return Promise.resolve("deleted");
  }

  private owned(ownerId: string, accountId: string): MutableAccount | null {
    const account = this.accounts.get(accountId);
    return account?.ownerUserId === ownerId ? account : null;
  }

  private unsetDefaults(ownerId: string): void {
    for (const account of this.accounts.values()) {
      if (account.ownerUserId === ownerId) account.isDefault = false;
    }
  }
}

@Module({
  imports: [AppModule],
  controllers: [AccountController],
  providers: [
    AccountService,
    InMemoryAccountRepository,
    { provide: ACCOUNT_REPOSITORY, useExisting: InMemoryAccountRepository },
    { provide: APP_GUARD, useClass: AccountHttpTestGuard },
  ],
})
class AccountHttpTestModule {}

describe("account HTTP API", () => {
  let application: INestApplication;
  let repository: InMemoryAccountRepository;

  beforeAll(async () => {
    application = await NestFactory.create(AccountHttpTestModule, { logger: false });
    configureApplication(application, "test");
    await application.init();
    repository = application.get(InMemoryAccountRepository);
  });

  afterAll(async () => {
    await application?.close();
  });

  it("creates three accounts and maintains the sole default through archive", async () => {
    const request = supertest(application.getHttpServer());
    const ids: string[] = [];
    for (const [index, name] of ["第一公众号", "第二公众号", "第三公众号"].entries()) {
      const response = await request
        .post("/api/v1/accounts")
        .set("X-CSRF-Token", "test-csrf-token")
        .send({
          name,
          contentTypes: [index === 0 ? "inspection" : "government"],
          isDefault: index === 2,
        })
        .expect(201);
      ids.push(response.body.data.id as string);
    }
    const list = await request.get("/api/v1/accounts").expect(200);
    expect(list.body.data.items).toHaveLength(3);
    expect(
      (list.body.data.items as AccountRecord[]).filter((account) => account.isDefault),
    ).toHaveLength(1);
    expect(list.body.data.items[0].id).toBe(ids[2]);

    await request
      .post(`/api/v1/accounts/${ids[1]}/default`)
      .set("X-CSRF-Token", "test-csrf-token")
      .expect(200);
    await request
      .post(`/api/v1/accounts/${ids[1]}/archive`)
      .set("X-CSRF-Token", "test-csrf-token")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({ isDefault: false, status: "archived" });
      });
    await request
      .post(`/api/v1/accounts/${ids[1]}/default`)
      .set("X-CSRF-Token", "test-csrf-token")
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ACCOUNT_STATE_CONFLICT");
      });
  });

  it("previews delete impact and blocks permanent deletion while articles exist", async () => {
    const request = supertest(application.getHttpServer());
    const account = await repository.create({
      ownerUserId,
      name: "有关联公众号",
      shortName: null,
      description: null,
      contentTypes: ["general"],
      accountType: "unknown",
      verificationStatus: "unknown",
      defaultThemeId: null,
      isDefault: false,
      context: {
        actorUserId: ownerUserId,
        requestId: "req_test",
        traceId: "trace_test",
      },
    });
    repository.articleCounts.set(account.id, 2);
    await request
      .get(`/api/v1/accounts/${account.id}/delete-impact`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({ articleCount: 2, canPermanentlyDelete: false });
      });
    await request
      .delete(`/api/v1/accounts/${account.id}`)
      .set("X-CSRF-Token", "test-csrf-token")
      .send({ confirmationText: "DELETE" })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ACCOUNT_DELETE_BLOCKED");
      });
  });

  it("enforces authentication, CSRF, ownership and UUIDv7 validation", async () => {
    const request = supertest(application.getHttpServer());
    const accountId = [...repository.accounts.keys()][0];
    expect(accountId).toBeDefined();
    await request.get("/api/v1/accounts").set("X-Test-User", "missing").expect(401);
    await request.patch(`/api/v1/accounts/${accountId}`).send({ name: "无 CSRF" }).expect(403);
    await request.get(`/api/v1/accounts/${accountId}`).set("X-Test-User", "other").expect(404);
    await request.get("/api/v1/accounts/not-a-uuid").expect(400);
    await request
      .post("/api/v1/accounts")
      .set("X-CSRF-Token", "test-csrf-token")
      .send({
        name: "错误主题版本",
        contentTypes: ["general"],
        defaultThemeId: "770e8400-e29b-41d4-a716-446655440000",
      })
      .expect(400);
    await request
      .post("/api/v1/accounts")
      .set("X-CSRF-Token", "test-csrf-token")
      .send({
        name: "不存在的主题",
        contentTypes: ["general"],
        defaultThemeId: createUuidV7(),
      })
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe("THEME_NOT_FOUND");
      });
  });

  it("publishes account endpoints in OpenAPI", async () => {
    const response = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    expect(response.body.paths).toHaveProperty("/api/v1/accounts");
    expect(response.body.paths).toHaveProperty("/api/v1/accounts/{accountId}/delete-impact");
    expect(response.body.components.schemas).toHaveProperty("AccountDto");
  });
});
