import type { RequestContext } from "../common/http/request-context.js";

export const ACCOUNT_STATUSES = ["draft", "active", "disabled", "archived"] as const;
export const ACCOUNT_TYPES = ["service", "subscription", "unknown"] as const;
export const ACCOUNT_VERIFICATION_STATUSES = ["unknown", "unverified", "verified"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type AccountVerificationStatus = (typeof ACCOUNT_VERIFICATION_STATUSES)[number];
export type AccountMutationContext = RequestContext & { readonly actorUserId: string };

export interface AccountRecord {
  readonly id: string;
  readonly ownerUserId: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly slug: string;
  readonly description: string | null;
  readonly contentTypes: readonly string[];
  readonly accountType: AccountType;
  readonly verificationStatus: AccountVerificationStatus;
  readonly status: AccountStatus;
  readonly defaultThemeId: string | null;
  readonly defaultPaletteId: string | null;
  readonly currentBrandVersionId: string | null;
  readonly isDefault: boolean;
  readonly articleCount: number;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AccountListQuery {
  readonly status?: AccountStatus;
  readonly contentType?: string;
  readonly search?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface AccountListResult {
  readonly items: readonly AccountRecord[];
  readonly total: number;
}

export interface CreateAccountInput {
  readonly ownerUserId: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly description: string | null;
  readonly contentTypes: readonly string[];
  readonly accountType: AccountType;
  readonly verificationStatus: AccountVerificationStatus;
  readonly defaultThemeId: string | null;
  readonly isDefault: boolean;
  readonly context: AccountMutationContext;
}

export interface UpdateAccountInput {
  readonly name?: string;
  readonly shortName?: string | null;
  readonly description?: string | null;
  readonly contentTypes?: readonly string[];
  readonly accountType?: AccountType;
  readonly verificationStatus?: AccountVerificationStatus;
  readonly defaultThemeId?: string | null;
}

export interface AccountDeleteImpact {
  readonly account: AccountRecord;
  readonly articleCount: number;
  readonly activeArticleCount: number;
  readonly canPermanentlyDelete: boolean;
  readonly blockingReasons: readonly string[];
}

export type AccountTransition = "disable" | "enable" | "archive";

export interface AccountRepository {
  list(ownerUserId: string, query: AccountListQuery): Promise<AccountListResult>;
  find(ownerUserId: string, accountId: string): Promise<AccountRecord | null>;
  create(input: CreateAccountInput): Promise<AccountRecord>;
  update(
    ownerUserId: string,
    accountId: string,
    patch: UpdateAccountInput,
    context: AccountMutationContext,
  ): Promise<AccountRecord | null>;
  setDefault(
    ownerUserId: string,
    accountId: string,
    context: AccountMutationContext,
  ): Promise<"updated" | "not_found" | "not_active">;
  transition(
    ownerUserId: string,
    accountId: string,
    transition: AccountTransition,
    context: AccountMutationContext,
  ): Promise<"updated" | "not_found" | "invalid_state">;
  deleteImpact(ownerUserId: string, accountId: string): Promise<AccountDeleteImpact | null>;
  permanentlyDelete(
    ownerUserId: string,
    accountId: string,
    context: AccountMutationContext,
  ): Promise<"deleted" | "not_found" | "blocked">;
}
