import type { WechatOutputMode, WechatRenderResult } from "./types.js";
import type { WECHAT_COMPATIBILITY_RULE_VERSION } from "./compatibility-version.js";

export const COMPATIBILITY_SEVERITIES = ["critical", "warning", "suggestion"] as const;
export const COMPATIBILITY_CATEGORIES = [
  "css",
  "document",
  "html",
  "image",
  "layout",
  "renderer",
  "svg",
  "url",
] as const;

export type CompatibilitySeverity = (typeof COMPATIBILITY_SEVERITIES)[number];
export type CompatibilityCategory = (typeof COMPATIBILITY_CATEGORIES)[number];
export type CompatibilityStatus = "failed" | "passed" | "warning";
export type CompatibilityIssueSource = "document" | "output" | "renderer";

export type CompatibilityFixAction =
  | "clamp_image_width"
  | "ensure_image_draggable"
  | "filter_inline_style"
  | "remove_dangerous_element"
  | "remove_unsafe_attribute"
  | "remove_unsafe_link"
  | "unwrap_unsupported_element"
  | "wrap_text_leaf";

export type CompatibilityIssueCode =
  | "COMPONENT_UNAVAILABLE"
  | "CSS_POSITION_UNSAFE"
  | "CSS_PROPERTY_FORBIDDEN"
  | "CSS_VALUE_UNSAFE"
  | "DOCUMENT_INVALID"
  | "HTML_DANGEROUS_TAG"
  | "HTML_EVENT_ATTRIBUTE"
  | "HTML_TEXT_LEAF_MISSING"
  | "HTML_UNSUPPORTED_ATTRIBUTE"
  | "HTML_UNSUPPORTED_TAG"
  | "HTML_URL_ATTRIBUTE_UNSAFE"
  | "IMAGE_ALT_MISSING"
  | "IMAGE_DRAGGABLE_MISSING"
  | "IMAGE_MAX_WIDTH_MISSING"
  | "IMAGE_SOURCE_MISSING"
  | "IMAGE_URL_INVALID"
  | "IMAGE_WIDTH_OVERFLOW"
  | "LINK_URL_INVALID"
  | "NESTING_EXCESSIVE"
  | "RENDER_FAILED"
  | "RENDERER_POLICY_DROPPED"
  | "SVG_FALLBACK_MISSING"
  | "SVG_STATIC_FALLBACK"
  | "TOKEN_REFERENCE_MISSING";

export interface CompatibilityRuleDefinition {
  readonly autoFixAction?: CompatibilityFixAction;
  readonly category: CompatibilityCategory;
  readonly code: CompatibilityIssueCode;
  readonly description: string;
  readonly penalty: number;
  readonly ruleId: string;
  readonly severity: CompatibilitySeverity;
  readonly title: string;
}

export interface CompatibilityIssue {
  readonly autoFixAction?: CompatibilityFixAction;
  readonly autoFixable: boolean;
  readonly blockId?: string;
  readonly category: CompatibilityCategory;
  readonly code: CompatibilityIssueCode;
  readonly details: Readonly<Record<string, boolean | number | string>>;
  readonly issueId: string;
  readonly message: string;
  readonly path: string;
  readonly ruleId: string;
  readonly severity: CompatibilitySeverity;
  readonly source: CompatibilityIssueSource;
  readonly title: string;
}

export interface CompatibilitySummary {
  readonly autoFixable: number;
  readonly critical: number;
  readonly suggestion: number;
  readonly total: number;
  readonly warning: number;
}

export interface CompatibilityReport {
  readonly canCopy: boolean;
  readonly checkedAt: string;
  readonly documentHash: string;
  readonly issues: readonly CompatibilityIssue[];
  readonly mode: WechatOutputMode;
  readonly outputHash: string | null;
  readonly rendererVersion: string;
  readonly ruleVersion: typeof WECHAT_COMPATIBILITY_RULE_VERSION;
  readonly score: number;
  readonly status: CompatibilityStatus;
  readonly summary: CompatibilitySummary;
}

export interface CompatibilityCheckResult {
  readonly renderResult: WechatRenderResult | null;
  readonly report: CompatibilityReport;
}

export interface CompatibilityHtmlCheckOptions {
  readonly checkedAt?: string;
  readonly mode?: WechatOutputMode;
  readonly rendererVersion?: string;
}

export interface CompatibilityFixPreview {
  readonly after: CompatibilityReport;
  readonly appliedIssueIds: readonly string[];
  readonly before: CompatibilityReport;
  readonly changed: boolean;
  readonly fixedDocument: unknown;
  readonly fixedHtml: string | null;
}

export interface CompatibilityHtmlFixPreview {
  readonly after: CompatibilityReport;
  readonly appliedIssueIds: readonly string[];
  readonly before: CompatibilityReport;
  readonly changed: boolean;
  readonly fixedHtml: string;
}
