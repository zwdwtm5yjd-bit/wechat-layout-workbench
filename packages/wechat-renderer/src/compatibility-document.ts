import { builtInVisualAssetPublicUrl } from "@wechat-layout/component-registry";
import { validateDocument } from "@wechat-layout/document-schema";

import { createCompatibilityIssue } from "./compatibility-rules.js";
import type { CompatibilityIssue } from "./compatibility-types.js";
import type { WechatOutputMode, WechatResourceMap } from "./types.js";
import { sanitizeWechatUrl } from "./url-sanitizer.js";

interface JsonRecord {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function resourceUrl(resources: WechatResourceMap, resourceId: string): string | undefined {
  const reference = resources[resourceId];
  return typeof reference === "string"
    ? reference
    : (reference?.url ?? builtInVisualAssetPublicUrl(resourceId));
}

function scanInlineLinks(
  content: unknown,
  blockId: string | undefined,
  path: string,
  issues: CompatibilityIssue[],
): void {
  if (!Array.isArray(content)) {
    return;
  }
  content.forEach((inline, inlineIndex) => {
    if (!isRecord(inline) || !Array.isArray(inline.marks)) {
      return;
    }
    inline.marks.forEach((mark, markIndex) => {
      if (!isRecord(mark) || mark.type !== "link" || !isRecord(mark.attrs)) {
        return;
      }
      const href = mark.attrs.href;
      const result = sanitizeWechatUrl(href, "link");
      if (!result.success) {
        issues.push(
          createCompatibilityIssue({
            ...(blockId === undefined ? {} : { blockId }),
            code: "LINK_URL_INVALID",
            details: {
              reason: result.reason,
              value: typeof href === "string" ? href : "",
            },
            message: `链接已被安全策略阻止：${result.reason}`,
            path: `${path}/${String(inlineIndex)}/marks/${String(markIndex)}/attrs/href`,
            source: "document",
          }),
        );
      }
    });
  });
}

function scanImage(
  attrs: JsonRecord,
  blockId: string | undefined,
  path: string,
  resources: WechatResourceMap,
  issues: CompatibilityIssue[],
): void {
  const resourceId = stringValue(attrs.resourceId);
  if (resourceId === undefined || resourceId.length === 0) {
    issues.push(
      createCompatibilityIssue({
        ...(blockId === undefined ? {} : { blockId }),
        code: "IMAGE_SOURCE_MISSING",
        message: "图片节点没有资源 ID。",
        path: `${path}/attrs/resourceId`,
        source: "document",
      }),
    );
  } else {
    const url = resourceUrl(resources, resourceId);
    if (url === undefined || url.length === 0) {
      issues.push(
        createCompatibilityIssue({
          ...(blockId === undefined ? {} : { blockId }),
          code: "IMAGE_SOURCE_MISSING",
          details: { resourceId },
          message: `图片资源 “${resourceId}” 没有可发布地址。`,
          path: `${path}/attrs/resourceId`,
          source: "document",
        }),
      );
    } else {
      const result = sanitizeWechatUrl(url, "image");
      if (!result.success) {
        issues.push(
          createCompatibilityIssue({
            ...(blockId === undefined ? {} : { blockId }),
            code: "IMAGE_URL_INVALID",
            details: { reason: result.reason, resourceId, url },
            message: `图片资源 “${resourceId}” 地址被阻止：${result.reason}`,
            path: `${path}/attrs/resourceId`,
            source: "document",
          }),
        );
      }
    }
  }

  const widthPercent = attrs.widthPercent;
  if (typeof widthPercent === "number" && Number.isFinite(widthPercent) && widthPercent > 100) {
    issues.push(
      createCompatibilityIssue({
        ...(blockId === undefined ? {} : { blockId }),
        code: "IMAGE_WIDTH_OVERFLOW",
        details: { widthPercent },
        message: `图片宽度 ${String(widthPercent)}% 超过正文容器。`,
        path: `${path}/attrs/widthPercent`,
        source: "document",
      }),
    );
  }

  if (typeof attrs.alt !== "string" || attrs.alt.trim().length === 0) {
    issues.push(
      createCompatibilityIssue({
        ...(blockId === undefined ? {} : { blockId }),
        code: "IMAGE_ALT_MISSING",
        path: `${path}/attrs/alt`,
        source: "document",
      }),
    );
  }
}

function scanSvg(
  attrs: JsonRecord,
  blockId: string | undefined,
  path: string,
  resources: WechatResourceMap,
  issues: CompatibilityIssue[],
): void {
  const fallbackResourceId = stringValue(attrs.fallbackResourceId);
  const fallbackUrl =
    fallbackResourceId === undefined ? undefined : resourceUrl(resources, fallbackResourceId);
  if (fallbackResourceId === undefined || fallbackUrl === undefined) {
    issues.push(
      createCompatibilityIssue({
        ...(blockId === undefined ? {} : { blockId }),
        code: "SVG_FALLBACK_MISSING",
        ...(fallbackResourceId === undefined ? {} : { details: { fallbackResourceId } }),
        message:
          fallbackResourceId === undefined
            ? "互动节点没有静态备用图资源 ID。"
            : `静态备用图 “${fallbackResourceId}” 没有可发布地址。`,
        path: `${path}/attrs/fallbackResourceId`,
        source: "document",
      }),
    );
    return;
  }
  const result = sanitizeWechatUrl(fallbackUrl, "image");
  if (!result.success) {
    issues.push(
      createCompatibilityIssue({
        ...(blockId === undefined ? {} : { blockId }),
        code: "SVG_FALLBACK_MISSING",
        details: {
          fallbackResourceId,
          reason: result.reason,
        },
        message: `静态备用图 “${fallbackResourceId}” 地址不可发布：${result.reason}`,
        path: `${path}/attrs/fallbackResourceId`,
        source: "document",
      }),
    );
  }
}

function scanBlock(
  node: unknown,
  path: string,
  depth: number,
  mode: WechatOutputMode,
  resources: WechatResourceMap,
  issues: CompatibilityIssue[],
): void {
  if (!isRecord(node)) {
    return;
  }
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  const blockId = stringValue(attrs.blockId);
  const maximumDepth = mode === "standard" ? 8 : 3;
  if (depth > maximumDepth) {
    issues.push(
      createCompatibilityIssue({
        ...(blockId === undefined ? {} : { blockId }),
        code: "NESTING_EXCESSIVE",
        details: { depth, maximumDepth },
        message: `区块嵌套深度 ${String(depth)} 超过当前模式上限 ${String(maximumDepth)}。`,
        path,
        source: "document",
      }),
    );
  }

  if (node.type === "paragraph" || node.type === "heading") {
    scanInlineLinks(node.content, blockId, `${path}/content`, issues);
  } else if (node.type === "imageBlock") {
    scanImage(attrs, blockId, path, resources, issues);
  } else if (node.type === "svgInteraction") {
    scanSvg(attrs, blockId, path, resources, issues);
  }

  if (Array.isArray(node.content)) {
    node.content.forEach((child, index) => {
      if (isRecord(child) && child.type !== "text" && child.type !== "hardBreak") {
        scanBlock(child, `${path}/content/${String(index)}`, depth + 1, mode, resources, issues);
      }
    });
  }
}

export function inspectDocumentCompatibility(
  document: unknown,
  resources: WechatResourceMap,
  mode: WechatOutputMode,
): readonly CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const validation = validateDocument(document);
  if (!validation.success) {
    validation.errors.forEach((error) => {
      issues.push(
        createCompatibilityIssue({
          code: "DOCUMENT_INVALID",
          details: { validationCode: error.code },
          message: error.message,
          path: error.path,
          source: "document",
        }),
      );
    });
  }

  if (isRecord(document) && isRecord(document.content) && Array.isArray(document.content.content)) {
    document.content.content.forEach((node, index) => {
      scanBlock(node, `/document/content/content/${String(index)}`, 0, mode, resources, issues);
    });
  }
  return issues;
}

function mutableRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? (value as Record<string, unknown>) : null;
}

function fixInlineLinks(content: unknown, appliedPaths: Set<string>, path: string): void {
  if (!Array.isArray(content)) {
    return;
  }
  content.forEach((inline, inlineIndex) => {
    const inlineRecord = mutableRecord(inline);
    if (inlineRecord === null || !Array.isArray(inlineRecord.marks)) {
      return;
    }
    inlineRecord.marks = inlineRecord.marks.filter((mark, markIndex) => {
      const markRecord = mutableRecord(mark);
      const markAttrs = mutableRecord(markRecord?.attrs);
      if (markRecord?.type !== "link" || markAttrs === null) {
        return true;
      }
      const result = sanitizeWechatUrl(markAttrs.href, "link");
      if (result.success) {
        return true;
      }
      appliedPaths.add(`${path}/${String(inlineIndex)}/marks/${String(markIndex)}/attrs/href`);
      return false;
    });
  });
}

function fixBlock(node: unknown, path: string, appliedPaths: Set<string>): void {
  const record = mutableRecord(node);
  if (record === null) {
    return;
  }
  const attrs = mutableRecord(record.attrs);
  if (record.type === "paragraph" || record.type === "heading") {
    fixInlineLinks(record.content, appliedPaths, `${path}/content`);
  } else if (
    record.type === "imageBlock" &&
    attrs !== null &&
    typeof attrs.widthPercent === "number" &&
    attrs.widthPercent > 100
  ) {
    attrs.widthPercent = 100;
    appliedPaths.add(`${path}/attrs/widthPercent`);
  }
  if (Array.isArray(record.content)) {
    record.content.forEach((child, index) => {
      const childRecord = mutableRecord(child);
      if (childRecord !== null && childRecord.type !== "text" && childRecord.type !== "hardBreak") {
        fixBlock(child, `${path}/content/${String(index)}`, appliedPaths);
      }
    });
  }
}

export function previewDocumentCompatibilityFixes(document: unknown): {
  readonly appliedPaths: ReadonlySet<string>;
  readonly document: unknown;
} {
  const clone = structuredClone(document);
  const appliedPaths = new Set<string>();
  const root = mutableRecord(clone);
  const content = mutableRecord(root?.content)?.content;
  if (Array.isArray(content)) {
    content.forEach((node, index) => {
      fixBlock(node, `/document/content/content/${String(index)}`, appliedPaths);
    });
  }
  return { appliedPaths, document: clone };
}
