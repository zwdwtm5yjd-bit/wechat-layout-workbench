import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { isUuidV7 } from "@wechat-layout/database";
import { getOfficialTheme } from "@wechat-layout/design-tokens";

import { ApiException } from "../common/http/api.exception.js";
import { ACCOUNT_REPOSITORY } from "./account.constants.js";
import type {
  AccountDto,
  AccountListQueryDto,
  CreateAccountDto,
  UpdateAccountDto,
} from "./account.dto.js";
import type {
  AccountMutationContext,
  AccountRecord,
  AccountRepository,
  AccountTransition,
} from "./account.types.js";

function apiError(
  status: number,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ApiException {
  return new ApiException(status, {
    code,
    message,
    ...(details === undefined ? {} : { details }),
    retryable: false,
  });
}

function validateAccountId(accountId: string): void {
  if (!isUuidV7(accountId)) {
    throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "提交内容存在错误", {
      fields: [{ path: "accountId", message: "必须是 UUIDv7" }],
    });
  }
}

function requiredText(value: string, path: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "提交内容存在错误", {
      fields: [{ path, message: "不能为空" }],
    });
  }
  return normalized;
}

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

function validatedThemeId(themeId: string | null | undefined): string | null {
  if (themeId === null || themeId === undefined) return null;
  if (!isUuidV7(themeId)) {
    throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "提交内容存在错误", {
      fields: [{ path: "defaultThemeId", message: "必须是 UUIDv7" }],
    });
  }
  if (getOfficialTheme(themeId) === null) {
    throw apiError(HttpStatus.NOT_FOUND, "THEME_NOT_FOUND", "默认主题不存在");
  }
  return themeId;
}

function toDto(account: AccountRecord): AccountDto {
  return {
    id: account.id,
    name: account.name,
    shortName: account.shortName,
    slug: account.slug,
    description: account.description,
    contentTypes: [...account.contentTypes],
    accountType: account.accountType,
    verificationStatus: account.verificationStatus,
    status: account.status,
    defaultThemeId: account.defaultThemeId,
    defaultPaletteId: account.defaultPaletteId,
    currentBrandVersionId: account.currentBrandVersionId,
    isDefault: account.isDefault,
    articleCount: account.articleCount,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

@Injectable()
export class AccountService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepository,
  ) {}

  async list(ownerUserId: string, query: AccountListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.repository.list(ownerUserId, {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.contentType === undefined ? {} : { contentType: query.contentType }),
      ...(query.search === undefined ? {} : { search: query.search.trim() }),
      page,
      pageSize,
    });
    return {
      items: result.items.map(toDto),
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
      },
    };
  }

  async get(ownerUserId: string, accountId: string): Promise<AccountDto> {
    validateAccountId(accountId);
    return toDto(await this.require(ownerUserId, accountId));
  }

  async create(
    ownerUserId: string,
    body: CreateAccountDto,
    context: AccountMutationContext,
  ): Promise<AccountDto> {
    const account = await this.repository.create({
      ownerUserId,
      name: requiredText(body.name, "name"),
      shortName: optionalText(body.shortName) ?? null,
      description: optionalText(body.description) ?? null,
      contentTypes: body.contentTypes,
      accountType: body.accountType ?? "unknown",
      verificationStatus: body.verificationStatus ?? "unknown",
      defaultThemeId: validatedThemeId(body.defaultThemeId),
      isDefault: body.isDefault ?? false,
      context,
    });
    return toDto(account);
  }

  async update(
    ownerUserId: string,
    accountId: string,
    body: UpdateAccountDto,
    context: AccountMutationContext,
  ): Promise<AccountDto> {
    validateAccountId(accountId);
    const patch = {
      ...(body.name === undefined ? {} : { name: requiredText(body.name, "name") }),
      ...(body.shortName === undefined ? {} : { shortName: optionalText(body.shortName) ?? null }),
      ...(body.description === undefined
        ? {}
        : { description: optionalText(body.description) ?? null }),
      ...(body.contentTypes === undefined ? {} : { contentTypes: body.contentTypes }),
      ...(body.accountType === undefined ? {} : { accountType: body.accountType }),
      ...(body.verificationStatus === undefined
        ? {}
        : { verificationStatus: body.verificationStatus }),
      ...(body.defaultThemeId === undefined
        ? {}
        : { defaultThemeId: validatedThemeId(body.defaultThemeId) }),
    };
    if (Object.keys(patch).length === 0) {
      throw apiError(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "至少提交一个可更新字段");
    }
    const account = await this.repository.update(ownerUserId, accountId, patch, context);
    if (account === null) throw this.notFound();
    return toDto(account);
  }

  async setDefault(
    ownerUserId: string,
    accountId: string,
    context: AccountMutationContext,
  ): Promise<AccountDto> {
    validateAccountId(accountId);
    const result = await this.repository.setDefault(ownerUserId, accountId, context);
    if (result === "not_found") throw this.notFound();
    if (result === "not_active") {
      throw apiError(
        HttpStatus.CONFLICT,
        "ACCOUNT_STATE_CONFLICT",
        "只有启用中的公众号可以设为默认",
      );
    }
    return this.get(ownerUserId, accountId);
  }

  async transition(
    ownerUserId: string,
    accountId: string,
    transition: AccountTransition,
    context: AccountMutationContext,
  ): Promise<AccountDto> {
    validateAccountId(accountId);
    const result = await this.repository.transition(ownerUserId, accountId, transition, context);
    if (result === "not_found") throw this.notFound();
    if (result === "invalid_state") {
      throw apiError(HttpStatus.CONFLICT, "ACCOUNT_STATE_CONFLICT", "公众号当前状态不允许此操作");
    }
    return this.get(ownerUserId, accountId);
  }

  async deleteImpact(ownerUserId: string, accountId: string) {
    validateAccountId(accountId);
    const impact = await this.repository.deleteImpact(ownerUserId, accountId);
    if (impact === null) throw this.notFound();
    return {
      articleCount: impact.articleCount,
      activeArticleCount: impact.activeArticleCount,
      canPermanentlyDelete: impact.canPermanentlyDelete,
      blockingReasons: [...impact.blockingReasons],
    };
  }

  async permanentlyDelete(ownerUserId: string, accountId: string, context: AccountMutationContext) {
    validateAccountId(accountId);
    const result = await this.repository.permanentlyDelete(ownerUserId, accountId, context);
    if (result === "not_found") throw this.notFound();
    if (result === "blocked") {
      throw apiError(
        HttpStatus.CONFLICT,
        "ACCOUNT_DELETE_BLOCKED",
        "公众号仍有关联文章，不能永久删除",
      );
    }
    return { deleted: true as const, accountId };
  }

  private async require(ownerUserId: string, accountId: string): Promise<AccountRecord> {
    const account = await this.repository.find(ownerUserId, accountId);
    if (account === null) throw this.notFound();
    return account;
  }

  private notFound(): ApiException {
    return apiError(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "公众号不存在");
  }
}
