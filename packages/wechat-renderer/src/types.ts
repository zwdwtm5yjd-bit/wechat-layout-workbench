import type {
  BrandTokenPlaceholder,
  ThemeTokenDocument,
  TokenValidationIssue,
} from "@wechat-layout/design-tokens";
import type { DocumentValidationError } from "@wechat-layout/document-schema";

import type { WECHAT_COMPATIBILITY_RULE_VERSION } from "./compatibility-version.js";

export const WECHAT_RENDERER_VERSION = "1.0.0" as const;
export const WECHAT_OUTPUT_MODES = ["standard", "wechat_safe", "static"] as const;

export type WechatOutputMode = (typeof WECHAT_OUTPUT_MODES)[number];

export interface WechatResourceReference {
  readonly alt?: string;
  readonly url: string;
}

export type WechatResourceMap = Readonly<Record<string, WechatResourceReference | string>>;

export interface WechatRenderInput {
  readonly brand?: BrandTokenPlaceholder;
  readonly document: unknown;
  readonly expectedSourceTextHash?: string;
  readonly mode?: WechatOutputMode;
  readonly resources?: WechatResourceMap;
  readonly theme?: ThemeTokenDocument;
}

export type WechatRenderWarningCode =
  | "COMPONENT_MISSING"
  | "COMPONENT_RENDERER_MISSING"
  | "HTML_POLICY_DROPPED"
  | "NESTING_FLATTENED"
  | "RESOURCE_MISSING"
  | "SVG_STATIC_FALLBACK"
  | "TOKEN_REFERENCE_MISSING"
  | "URL_BLOCKED";

export interface WechatRenderWarning {
  readonly code: WechatRenderWarningCode;
  readonly message: string;
  readonly path: string;
  readonly severity: "info" | "warning";
}

export interface WechatRenderManifest {
  readonly componentVersions: readonly string[];
  readonly compatibilityRuleVersion: typeof WECHAT_COMPATIBILITY_RULE_VERSION;
  readonly documentSchemaVersion: string;
  readonly rendererVersion: typeof WECHAT_RENDERER_VERSION;
  readonly resourceIds: readonly string[];
}

export interface WechatTextIntegrity {
  readonly renderedTextHash: string;
  readonly sourceTextHash: string;
  readonly unchanged: true;
}

export interface WechatRenderResult {
  readonly html: string;
  readonly manifest: WechatRenderManifest;
  readonly mode: WechatOutputMode;
  readonly outputHash: string;
  readonly plainText: string;
  readonly rendererVersion: typeof WECHAT_RENDERER_VERSION;
  readonly textIntegrity: WechatTextIntegrity;
  readonly warnings: readonly WechatRenderWarning[];
}

export type WechatRenderIssueCode =
  | "HTML_POLICY_VIOLATION"
  | "INVALID_DOCUMENT"
  | "INVALID_INPUT"
  | "TEXT_HASH_MISMATCH"
  | "TEXT_INTEGRITY_VIOLATION"
  | "TOKEN_INVALID";

export interface WechatRenderIssue {
  readonly code: WechatRenderIssueCode;
  readonly message: string;
  readonly path: string;
}

export type WechatRenderAttempt =
  | {
      readonly data: WechatRenderResult;
      readonly success: true;
    }
  | {
      readonly issues: readonly WechatRenderIssue[];
      readonly success: false;
    };

export class WechatRenderError extends Error {
  readonly issues: readonly WechatRenderIssue[];

  constructor(issues: readonly WechatRenderIssue[]) {
    super(issues.map((entry) => `${entry.path}: ${entry.message}`).join("; "));
    this.name = "WechatRenderError";
    this.issues = issues;
  }
}

export function documentIssues(
  errors: readonly DocumentValidationError[],
): readonly WechatRenderIssue[] {
  return errors.map((error) => ({
    code: "INVALID_DOCUMENT",
    message: error.message,
    path: error.path,
  }));
}

export function tokenIssues(issues: readonly TokenValidationIssue[]): readonly WechatRenderIssue[] {
  return issues.map((issue) => ({
    code: "TOKEN_INVALID",
    message: issue.message,
    path: issue.path,
  }));
}
