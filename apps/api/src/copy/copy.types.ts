import type { DocumentV1 } from "@wechat-layout/document-schema";
import type {
  CompatibilityReport,
  WechatOutputMode,
  WechatRenderResult,
} from "@wechat-layout/wechat-renderer";

import type { RequestContext } from "../common/http/request-context.js";
import type { DocumentResourceReference } from "../documents/document-resource-references.js";

export type CopyMutationContext = RequestContext & { readonly actorUserId: string };
export type CopyRecordStatus = "failed" | "success";
export type RenderOutputStatus = "blocked" | "failed" | "ready";

export interface CopyResourceSource {
  readonly id: string;
  readonly mimeType: string;
  readonly storageKey: string;
}

export interface CopyRenderSource {
  readonly accountId: string | null;
  readonly articleId: string;
  readonly brandVersionId: string | null;
  readonly currentTextHash: string | null;
  readonly document: DocumentV1;
  readonly documentSchemaVersion: string;
  readonly documentVersion: number;
  readonly resources: readonly CopyResourceSource[];
  readonly themeId: string | null;
  readonly themeVersion: string | null;
}

export interface PersistRenderOutputInput {
  readonly context: CopyMutationContext;
  readonly expiresAt: Date;
  readonly generatedAt: Date;
  readonly mode: WechatOutputMode;
  readonly ownerUserId: string;
  readonly report: CompatibilityReport;
  readonly renderResult: WechatRenderResult | null;
  readonly source: CopyRenderSource;
}

export interface RenderOutputRecord {
  readonly articleId: string;
  readonly compatibilityReport: CompatibilityReport;
  readonly expiresAt: Date;
  readonly generatedAt: Date;
  readonly html: string | null;
  readonly id: string;
  readonly mode: WechatOutputMode;
  readonly outputHash: string | null;
  readonly plainText: string | null;
  readonly rendererVersion: string;
  readonly ruleVersion: string;
  readonly snapshotId: string;
  readonly status: RenderOutputStatus;
}

export type PersistRenderOutputResult =
  | { readonly kind: "created"; readonly output: RenderOutputRecord }
  | { readonly kind: "not_found" }
  | {
      readonly kind: "invalid_resources";
      readonly invalidReferences: readonly DocumentResourceReference[];
    }
  | {
      readonly kind: "version_conflict";
      readonly currentVersion: number;
    };

export interface CreateCopyRecordInput {
  readonly articleId: string;
  readonly browserInfo: Readonly<Record<string, string>>;
  readonly context: CopyMutationContext;
  readonly failureReason: string | null;
  readonly ownerUserId: string;
  readonly renderOutputId: string;
  readonly status: CopyRecordStatus;
}

export interface CopyRecord {
  readonly copiedAt: Date;
  readonly id: string;
  readonly renderOutputId: string;
  readonly status: CopyRecordStatus;
}

export type CreateCopyRecordResult =
  | { readonly kind: "created"; readonly record: CopyRecord }
  | { readonly kind: "not_found" }
  | { readonly kind: "output_blocked" };

export interface CopyRepository {
  createRecord(input: CreateCopyRecordInput): Promise<CreateCopyRecordResult>;
  findOutput(
    ownerUserId: string,
    articleId: string,
    outputId: string,
  ): Promise<RenderOutputRecord | null>;
  findRenderSource(ownerUserId: string, articleId: string): Promise<CopyRenderSource | null>;
  persistRenderOutput(input: PersistRenderOutputInput): Promise<PersistRenderOutputResult>;
}
