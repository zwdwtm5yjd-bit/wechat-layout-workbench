import type { DocumentV1 } from "@wechat-layout/document-schema";

import type { DocumentResourceReference } from "../documents/document-resource-references.js";
import type { AUTOMATIC_SNAPSHOT_REASONS, SNAPSHOT_REASONS } from "./snapshot.constants.js";

export type SnapshotReason = (typeof SNAPSHOT_REASONS)[number];
export type AutomaticSnapshotReason = (typeof AUTOMATIC_SNAPSHOT_REASONS)[number];

export interface SnapshotResourceManifestEntry {
  readonly resourceId: string;
  readonly references: readonly {
    readonly blockId: string;
    readonly usageType: string;
  }[];
}

export interface SnapshotPackageManifestEntry {
  readonly kind: "theme" | "brand" | "component" | "brand_footer" | "svg";
  readonly packageId: string;
  readonly version: string | null;
}

export interface ArticleSnapshotRecord {
  readonly id: string;
  readonly articleId: string;
  readonly snapshotNumber: number;
  readonly reason: SnapshotReason;
  readonly documentSchemaVersion: string;
  readonly document: DocumentV1;
  readonly themeId: string | null;
  readonly themeVersion: string | null;
  readonly brandVersionId: string | null;
  readonly compatibilityRuleVersion: string | null;
  readonly rendererVersion: string | null;
  readonly resourceManifest: readonly SnapshotResourceManifestEntry[];
  readonly packageManifest: readonly SnapshotPackageManifestEntry[];
  readonly textHash: string | null;
  readonly compatibilityScore: number | null;
  readonly htmlHash: string | null;
  readonly note: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly isCurrent: boolean;
}

export interface SnapshotMutationContext {
  readonly actorUserId: string;
  readonly requestId: string;
  readonly traceId: string;
}

export interface SnapshotListResult {
  readonly items: readonly ArticleSnapshotRecord[];
  readonly total: number;
}

export interface CreateSnapshotInput {
  readonly ownerUserId: string;
  readonly articleId: string;
  readonly reason: SnapshotReason;
  readonly note: string | null;
  readonly context: SnapshotMutationContext;
}

export interface RestoreSnapshotInput {
  readonly ownerUserId: string;
  readonly articleId: string;
  readonly snapshotId: string;
  readonly baseVersion: number;
  readonly lastTransactionId: string;
  readonly context: SnapshotMutationContext;
}

export type CreateSnapshotResult =
  | { readonly kind: "created"; readonly snapshot: ArticleSnapshotRecord }
  | {
      readonly kind: "invalid_resources";
      readonly invalidReferences: readonly DocumentResourceReference[];
    }
  | { readonly kind: "not_found" };

export type RestoreSnapshotResult =
  | {
      readonly kind: "restored";
      readonly documentVersion: number;
      readonly lastTransactionId: string;
      readonly lastSavedAt: Date;
      readonly safetySnapshot: ArticleSnapshotRecord;
      readonly restoredSnapshot: ArticleSnapshotRecord;
    }
  | {
      readonly kind: "conflict";
      readonly currentVersion: number;
      readonly lastTransactionId: string | null;
      readonly lastSavedAt: Date;
    }
  | {
      readonly kind: "invalid_resources";
      readonly invalidReferences: readonly DocumentResourceReference[];
    }
  | { readonly kind: "not_found" };

export interface SnapshotRepository {
  list(
    ownerUserId: string,
    articleId: string,
    page: number,
    pageSize: number,
  ): Promise<SnapshotListResult | null>;
  find(
    ownerUserId: string,
    articleId: string,
    snapshotId: string,
  ): Promise<ArticleSnapshotRecord | null>;
  create(input: CreateSnapshotInput): Promise<CreateSnapshotResult>;
  restore(input: RestoreSnapshotInput): Promise<RestoreSnapshotResult>;
}
