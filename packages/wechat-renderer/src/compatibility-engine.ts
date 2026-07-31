import { createHash } from "node:crypto";

import {
  inspectDocumentCompatibility,
  previewDocumentCompatibilityFixes,
} from "./compatibility-document.js";
import { inspectHtmlCompatibility, sanitizeCompatibilityHtml } from "./compatibility-html.js";
import { compatibilityRule, createCompatibilityIssue } from "./compatibility-rules.js";
import type {
  CompatibilityCheckResult,
  CompatibilityFixPreview,
  CompatibilityHtmlCheckOptions,
  CompatibilityHtmlFixPreview,
  CompatibilityIssue,
  CompatibilityReport,
  CompatibilityStatus,
  CompatibilitySummary,
} from "./compatibility-types.js";
import { WECHAT_COMPATIBILITY_RULE_VERSION } from "./compatibility-version.js";
import { WechatHtmlRenderer, type WechatHtmlRendererOptions } from "./renderer.js";
import {
  WECHAT_OUTPUT_MODES,
  WECHAT_RENDERER_VERSION,
  type WechatOutputMode,
  type WechatRenderInput,
  type WechatRenderResult,
  type WechatRenderWarning,
} from "./types.js";

export interface CompatibilityEngineOptions extends WechatHtmlRendererOptions {
  readonly now?: () => Date;
}

const SEVERITY_ORDER = new Map([
  ["critical", 0],
  ["warning", 1],
  ["suggestion", 2],
]);
const SOURCE_ORDER = new Map([
  ["document", 0],
  ["renderer", 1],
  ["output", 2],
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
  );
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function documentHash(document: unknown): string {
  try {
    return sha256(JSON.stringify(canonicalize(document)));
  } catch {
    return sha256("[unserializable-document]");
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach((entry) => deepFreeze(entry));
  return value;
}

function issueSort(left: CompatibilityIssue, right: CompatibilityIssue): number {
  return (
    (SEVERITY_ORDER.get(left.severity) ?? 9) - (SEVERITY_ORDER.get(right.severity) ?? 9) ||
    (SOURCE_ORDER.get(left.source) ?? 9) - (SOURCE_ORDER.get(right.source) ?? 9) ||
    (left.blockId ?? "").localeCompare(right.blockId ?? "") ||
    left.path.localeCompare(right.path) ||
    left.code.localeCompare(right.code) ||
    left.issueId.localeCompare(right.issueId)
  );
}

function uniqueIssues(input: readonly CompatibilityIssue[]): readonly CompatibilityIssue[] {
  const seen = new Set<string>();
  return input
    .filter((issue) => {
      const key = [issue.code, issue.blockId ?? "", issue.path].join("\u0000");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort(issueSort);
}

function summary(issues: readonly CompatibilityIssue[]): CompatibilitySummary {
  return {
    autoFixable: issues.filter((issue) => issue.autoFixable).length,
    critical: issues.filter((issue) => issue.severity === "critical").length,
    suggestion: issues.filter((issue) => issue.severity === "suggestion").length,
    total: issues.length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
  };
}

function scoreFor(issues: readonly CompatibilityIssue[]): number {
  const penalty = issues.reduce((total, issue) => total + compatibilityRule(issue.code).penalty, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function statusFor(summaryValue: CompatibilitySummary): CompatibilityStatus {
  if (summaryValue.critical > 0) {
    return "failed";
  }
  return summaryValue.warning > 0 || summaryValue.suggestion > 0 ? "warning" : "passed";
}

function report(input: {
  readonly checkedAt: string;
  readonly document: unknown;
  readonly issues: readonly CompatibilityIssue[];
  readonly mode: WechatOutputMode;
  readonly outputHash: string | null;
  readonly rendererVersion: string;
}): CompatibilityReport {
  const issues = uniqueIssues(input.issues);
  const reportSummary = summary(issues);
  return deepFreeze({
    canCopy: reportSummary.critical === 0,
    checkedAt: input.checkedAt,
    documentHash: documentHash(input.document),
    issues,
    mode: input.mode,
    outputHash: input.outputHash,
    rendererVersion: input.rendererVersion,
    ruleVersion: WECHAT_COMPATIBILITY_RULE_VERSION,
    score: scoreFor(issues),
    status: statusFor(reportSummary),
    summary: reportSummary,
  }) as CompatibilityReport;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function blockIdAtPath(document: unknown, path: string): string | undefined {
  if (path.startsWith("/styles/")) {
    const blockId = path.slice("/styles/".length);
    return blockId.length === 0 ? undefined : blockId;
  }
  const segments = path.split("/").filter(Boolean);
  const documentSegments = segments[0] === "document" ? segments.slice(1) : segments;
  let current: unknown = document;
  for (const segment of documentSegments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      current = current[index];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  if (!isRecord(current) || !isRecord(current.attrs)) {
    return undefined;
  }
  return typeof current.attrs.blockId === "string" ? current.attrs.blockId : undefined;
}

function warningIssue(warning: WechatRenderWarning, document: unknown): CompatibilityIssue | null {
  const blockId = blockIdAtPath(document, warning.path);
  const input = {
    ...(blockId === undefined ? {} : { blockId }),
    message: warning.message,
    path: warning.path,
    source: "renderer" as const,
  };
  switch (warning.code) {
    case "COMPONENT_MISSING":
    case "COMPONENT_RENDERER_MISSING":
      return createCompatibilityIssue({
        ...input,
        code: "COMPONENT_UNAVAILABLE",
      });
    case "HTML_POLICY_DROPPED":
      return createCompatibilityIssue({
        ...input,
        code: "RENDERER_POLICY_DROPPED",
      });
    case "NESTING_FLATTENED":
      return createCompatibilityIssue({
        ...input,
        code: "NESTING_EXCESSIVE",
      });
    case "SVG_STATIC_FALLBACK":
      return createCompatibilityIssue({
        ...input,
        code: "SVG_STATIC_FALLBACK",
      });
    case "TOKEN_REFERENCE_MISSING":
      return createCompatibilityIssue({
        ...input,
        code: "TOKEN_REFERENCE_MISSING",
      });
    case "RESOURCE_MISSING":
    case "URL_BLOCKED":
      return null;
  }
}

function validMode(value: unknown): value is WechatOutputMode {
  return typeof value === "string" && WECHAT_OUTPUT_MODES.includes(value as WechatOutputMode);
}

export class WechatCompatibilityEngine {
  readonly #now: () => Date;
  readonly #renderer: WechatHtmlRenderer;

  constructor(options: CompatibilityEngineOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#renderer = new WechatHtmlRenderer(options);
  }

  check(input: WechatRenderInput): CompatibilityCheckResult {
    return this.#checkAt(input, this.#now().toISOString());
  }

  checkHtml(html: string, options: CompatibilityHtmlCheckOptions = {}): CompatibilityReport {
    const mode = options.mode ?? "standard";
    const issues = inspectHtmlCompatibility(html, mode);
    return report({
      checkedAt: options.checkedAt ?? this.#now().toISOString(),
      document: null,
      issues,
      mode,
      outputHash: sha256(html),
      rendererVersion: options.rendererVersion ?? WECHAT_RENDERER_VERSION,
    });
  }

  previewFixes(input: WechatRenderInput): CompatibilityFixPreview {
    const checkedAt = this.#now().toISOString();
    const before = this.#checkAt(input, checkedAt);
    const preview = previewDocumentCompatibilityFixes(input.document);
    const fixedInput: WechatRenderInput = {
      ...input,
      document: preview.document,
    };
    const after = this.#checkAt(fixedInput, checkedAt);
    const appliedIssueIds = before.report.issues
      .filter((issue) => issue.autoFixable && preview.appliedPaths.has(issue.path))
      .map((issue) => issue.issueId)
      .sort();
    return deepFreeze({
      after: after.report,
      appliedIssueIds,
      before: before.report,
      changed: appliedIssueIds.length > 0,
      fixedDocument: preview.document,
      fixedHtml: after.renderResult?.html ?? null,
    }) as CompatibilityFixPreview;
  }

  previewHtmlFixes(
    html: string,
    options: CompatibilityHtmlCheckOptions = {},
  ): CompatibilityHtmlFixPreview {
    const checkedAt = options.checkedAt ?? this.#now().toISOString();
    const mode = options.mode ?? "standard";
    const before = this.checkHtml(html, {
      ...options,
      checkedAt,
      mode,
    });
    const appliedIssueIds = before.issues
      .filter((issue) => issue.autoFixable)
      .map((issue) => issue.issueId)
      .sort();
    const fixedHtml = appliedIssueIds.length === 0 ? html : sanitizeCompatibilityHtml(html, mode);
    const after = this.checkHtml(fixedHtml, {
      ...options,
      checkedAt,
      mode,
    });
    return deepFreeze({
      after,
      appliedIssueIds,
      before,
      changed: appliedIssueIds.length > 0,
      fixedHtml,
    }) as CompatibilityHtmlFixPreview;
  }

  #checkAt(input: WechatRenderInput, checkedAt: string): CompatibilityCheckResult {
    const mode = validMode(input.mode) ? input.mode : "standard";
    const issues = [...inspectDocumentCompatibility(input.document, input.resources ?? {}, mode)];
    const attempt = this.#renderer.tryRender(input);
    let renderResult: WechatRenderResult | null = null;
    if (attempt.success) {
      renderResult = attempt.data;
      issues.push(...inspectHtmlCompatibility(attempt.data.html, mode));
      attempt.data.warnings.forEach((warning) => {
        const mapped = warningIssue(warning, input.document);
        if (mapped !== null) {
          issues.push(mapped);
        }
      });
    } else if (!attempt.issues.every((issue) => issue.code === "INVALID_DOCUMENT")) {
      issues.push(
        createCompatibilityIssue({
          code: "RENDER_FAILED",
          details: {
            issueCount: attempt.issues.length,
          },
          message: attempt.issues.map((issue) => issue.message).join("；"),
          path: attempt.issues[0]?.path ?? "/renderer",
          source: "renderer",
        }),
      );
    }

    const compatibilityReport = report({
      checkedAt,
      document: input.document,
      issues,
      mode,
      outputHash: renderResult?.outputHash ?? null,
      rendererVersion: renderResult?.rendererVersion ?? WECHAT_RENDERER_VERSION,
    });
    return deepFreeze({
      renderResult,
      report: compatibilityReport,
    }) as CompatibilityCheckResult;
  }
}

export function checkWechatCompatibility(
  input: WechatRenderInput,
  options: CompatibilityEngineOptions = {},
): CompatibilityCheckResult {
  return new WechatCompatibilityEngine(options).check(input);
}
