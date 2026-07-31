import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

import {
  htmlElement,
  serializeSafeHtml,
  WECHAT_HTML_TAGS,
  type SafeHtmlNode,
  type WechatHtmlTag,
} from "./html.js";
import { createCompatibilityIssue } from "./compatibility-rules.js";
import type { CompatibilityIssue } from "./compatibility-types.js";
import { serializeInlineStyles, type WechatStyleMap } from "./style-serializer.js";
import type { WechatOutputMode } from "./types.js";
import { sanitizeWechatUrl } from "./url-sanitizer.js";

type HtmlNode = DefaultTreeAdapterTypes.ChildNode;
type HtmlElement = DefaultTreeAdapterTypes.Element;
type HtmlParent = DefaultTreeAdapterTypes.ParentNode;

interface StyleDeclaration {
  readonly path: string;
  readonly property: string;
  readonly value: string;
}

interface ParsedInlineStyle {
  readonly declarations: readonly StyleDeclaration[];
  readonly malformedPaths: readonly string[];
  readonly style: WechatStyleMap;
}

const ALLOWED_TAGS = new Set<string>(WECHAT_HTML_TAGS);
const DANGEROUS_TAGS = new Set([
  "applet",
  "audio",
  "base",
  "button",
  "canvas",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "meta",
  "noscript",
  "object",
  "script",
  "select",
  "style",
  "template",
  "textarea",
  "video",
]);
const GLOBAL_ATTRIBUTES = new Set(["style", "title"]);
const TAG_ATTRIBUTES = new Map<string, ReadonlySet<string>>([
  ["a", new Set(["href"])],
  ["img", new Set(["alt", "src"])],
  ["ol", new Set(["start"])],
]);
const URL_BEARING_ATTRIBUTES = new Set([
  "action",
  "background",
  "cite",
  "formaction",
  "ping",
  "poster",
  "srcset",
  "xlink:href",
]);
const MAXIMUM_WECHAT_CONTENT_WIDTH_PX = 677;

function isElement(node: HtmlNode): node is HtmlElement {
  return "tagName" in node;
}

function isTextNode(node: HtmlNode): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text" && "value" in node;
}

function attribute(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name.toLowerCase() === name)?.value;
}

function parseInlineStyle(value: string, path: string): ParsedInlineStyle {
  const style: Record<string, string> = {};
  const declarations: StyleDeclaration[] = [];
  const malformedPaths: string[] = [];
  value.split(";").forEach((part, index) => {
    const trimmed = part.trim();
    if (trimmed === "") {
      return;
    }
    const separator = trimmed.indexOf(":");
    const declarationPath = `${path}/${String(index)}`;
    if (separator <= 0) {
      malformedPaths.push(declarationPath);
      return;
    }
    const property = trimmed.slice(0, separator).trim().toLowerCase();
    const propertyValue = trimmed.slice(separator + 1).trim();
    if (property === "" || propertyValue === "") {
      malformedPaths.push(declarationPath);
      return;
    }
    style[property] = propertyValue;
    declarations.push({
      path: declarationPath,
      property,
      value: propertyValue,
    });
  });
  return {
    declarations,
    malformedPaths,
    style: style as WechatStyleMap,
  };
}

function widthOverflow(value: string | undefined, allowAuto = false): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (allowAuto && normalized === "auto") {
    return false;
  }
  const match = /^(\d+(?:\.\d+)?)(%|px)?$/.exec(normalized);
  if (match === null) {
    return true;
  }
  const numeric = Number(match[1]);
  const unit = match[2] ?? "px";
  return numeric <= 0 || (unit === "%" ? numeric > 100 : numeric > MAXIMUM_WECHAT_CONTENT_WIDTH_PX);
}

function allowedAttribute(tag: string, name: string): boolean {
  return GLOBAL_ATTRIBUTES.has(name) || (TAG_ATTRIBUTES.get(tag)?.has(name) ?? false);
}

function inspectStyle(
  parsed: ParsedInlineStyle,
  mode: WechatOutputMode,
  path: string,
  issues: CompatibilityIssue[],
): void {
  parsed.malformedPaths.forEach((declarationPath) => {
    issues.push(
      createCompatibilityIssue({
        code: "CSS_VALUE_UNSAFE",
        message: "内联样式声明格式不完整。",
        path: declarationPath,
        source: "output",
      }),
    );
  });
  parsed.declarations.forEach((declaration) => {
    const result = serializeInlineStyles(
      {
        [declaration.property]: declaration.value,
      } as WechatStyleMap,
      mode,
    );
    const warning = result.warnings[0];
    if (warning === undefined) {
      return;
    }
    const positionUnsafe =
      declaration.property === "position" &&
      (declaration.value.trim().toLowerCase() === "fixed" ||
        declaration.value.trim().toLowerCase() === "sticky" ||
        mode !== "standard");
    const unsafeValue = warning.message.includes("值不安全");
    issues.push(
      createCompatibilityIssue({
        code: positionUnsafe
          ? "CSS_POSITION_UNSAFE"
          : unsafeValue
            ? "CSS_VALUE_UNSAFE"
            : "CSS_PROPERTY_FORBIDDEN",
        details: {
          property: declaration.property,
          value: declaration.value,
        },
        message: `${declaration.property}: ${warning.message}`,
        path: `${path}/${declaration.property}`,
        source: "output",
      }),
    );
  });
}

function inspectImage(
  element: HtmlElement,
  parsedStyle: ParsedInlineStyle,
  path: string,
  issues: CompatibilityIssue[],
): void {
  const src = attribute(element, "src");
  if (src === undefined || src.trim() === "") {
    issues.push(
      createCompatibilityIssue({
        code: "IMAGE_SOURCE_MISSING",
        message: "输出图片没有 src 地址。",
        path: `${path}/attributes/src`,
        source: "output",
      }),
    );
  } else {
    const result = sanitizeWechatUrl(src, "image");
    if (!result.success) {
      issues.push(
        createCompatibilityIssue({
          code: "IMAGE_URL_INVALID",
          details: { reason: result.reason, url: src },
          message: `输出图片地址被阻止：${result.reason}`,
          path: `${path}/attributes/src`,
          source: "output",
        }),
      );
    }
  }
  const alt = attribute(element, "alt");
  if (alt === undefined || alt.trim() === "") {
    issues.push(
      createCompatibilityIssue({
        code: "IMAGE_ALT_MISSING",
        path: `${path}/attributes/alt`,
        source: "output",
      }),
    );
  }

  const width =
    parsedStyle.style.width === undefined
      ? attribute(element, "width")
      : String(parsedStyle.style.width);
  const maxWidth =
    parsedStyle.style["max-width"] === undefined
      ? undefined
      : String(parsedStyle.style["max-width"]);
  if (widthOverflow(width, true) || widthOverflow(maxWidth)) {
    issues.push(
      createCompatibilityIssue({
        code: "IMAGE_WIDTH_OVERFLOW",
        details: {
          ...(maxWidth === undefined ? {} : { maxWidth }),
          ...(width === undefined ? {} : { width }),
        },
        path: `${path}/style/width`,
        source: "output",
      }),
    );
  }
  if (maxWidth === undefined) {
    issues.push(
      createCompatibilityIssue({
        code: "IMAGE_MAX_WIDTH_MISSING",
        path: `${path}/style/max-width`,
        source: "output",
      }),
    );
  }
}

function inspectElement(
  element: HtmlElement,
  path: string,
  mode: WechatOutputMode,
  issues: CompatibilityIssue[],
): void {
  const tag = element.tagName.toLowerCase();
  if (DANGEROUS_TAGS.has(tag)) {
    issues.push(
      createCompatibilityIssue({
        code: "HTML_DANGEROUS_TAG",
        details: { tag },
        message: `危险标签 <${tag}> 不允许进入微信正文。`,
        path,
        source: "output",
      }),
    );
  } else if (!ALLOWED_TAGS.has(tag)) {
    issues.push(
      createCompatibilityIssue({
        code: "HTML_UNSUPPORTED_TAG",
        details: { tag },
        message: `标签 <${tag}> 尚未进入当前微信白名单。`,
        path,
        source: "output",
      }),
    );
  }

  element.attrs.forEach((entry, index) => {
    const name = entry.name.toLowerCase();
    const attributePath = `${path}/attributes/${String(index)}`;
    if (name.startsWith("on")) {
      issues.push(
        createCompatibilityIssue({
          code: "HTML_EVENT_ATTRIBUTE",
          details: { attribute: name, tag },
          message: `事件属性 “${name}” 不允许进入微信正文。`,
          path: attributePath,
          source: "output",
        }),
      );
    } else if (URL_BEARING_ATTRIBUTES.has(name) && !allowedAttribute(tag, name)) {
      issues.push(
        createCompatibilityIssue({
          code: "HTML_URL_ATTRIBUTE_UNSAFE",
          details: { attribute: name, tag },
          message: `URL 属性 “${name}” 不在 <${tag}> 的白名单中。`,
          path: attributePath,
          source: "output",
        }),
      );
    } else if (!allowedAttribute(tag, name)) {
      issues.push(
        createCompatibilityIssue({
          code: "HTML_UNSUPPORTED_ATTRIBUTE",
          details: { attribute: name, tag },
          message: `属性 “${name}” 不在 <${tag}> 的白名单中。`,
          path: attributePath,
          source: "output",
        }),
      );
    }
  });

  const style = attribute(element, "style");
  const parsedStyle =
    style === undefined
      ? { declarations: [], malformedPaths: [], style: {} }
      : parseInlineStyle(style, `${path}/style`);
  inspectStyle(parsedStyle, mode, `${path}/style`, issues);

  if (tag === "a") {
    const href = attribute(element, "href");
    if (href !== undefined) {
      const result = sanitizeWechatUrl(href, "link");
      if (!result.success) {
        issues.push(
          createCompatibilityIssue({
            code: "LINK_URL_INVALID",
            details: { reason: result.reason, url: href },
            message: `输出链接被安全策略阻止：${result.reason}`,
            path: `${path}/attributes/href`,
            source: "output",
          }),
        );
      }
    }
  } else if (tag === "img") {
    inspectImage(element, parsedStyle, path, issues);
  }

  element.childNodes.forEach((child, index) => {
    if (isElement(child)) {
      inspectElement(child, `${path}/children/${String(index)}`, mode, issues);
    }
  });
}

export function inspectHtmlCompatibility(
  html: string,
  mode: WechatOutputMode,
): readonly CompatibilityIssue[] {
  const fragment = parseFragment(html);
  const issues: CompatibilityIssue[] = [];
  fragment.childNodes.forEach((node, index) => {
    if (isElement(node)) {
      inspectElement(node, `/output/${String(index)}`, mode, issues);
    }
  });
  return issues;
}

function safeAttributes(
  element: HtmlElement,
  tag: WechatHtmlTag,
): {
  readonly alt?: string;
  readonly href?: string;
  readonly src?: string;
  readonly start?: number;
  readonly title?: string;
} {
  const title = attribute(element, "title");
  if (tag === "a") {
    const href = attribute(element, "href");
    return {
      ...(href === undefined ? {} : { href }),
      ...(title === undefined ? {} : { title }),
    };
  }
  if (tag === "img") {
    const alt = attribute(element, "alt");
    const src = attribute(element, "src");
    return {
      ...(alt === undefined ? {} : { alt }),
      ...(src === undefined ? {} : { src }),
      ...(title === undefined ? {} : { title }),
    };
  }
  if (tag === "ol") {
    const startValue = Number(attribute(element, "start"));
    return {
      ...(Number.isInteger(startValue) && startValue >= 1 ? { start: startValue } : {}),
      ...(title === undefined ? {} : { title }),
    };
  }
  return title === undefined ? {} : { title };
}

function safeStyle(element: HtmlElement, tag: WechatHtmlTag): WechatStyleMap {
  const source = attribute(element, "style");
  const style = source === undefined ? {} : { ...parseInlineStyle(source, "").style };
  if (tag === "img") {
    const width = style.width === undefined ? attribute(element, "width") : String(style.width);
    const maxWidth = style["max-width"] === undefined ? undefined : String(style["max-width"]);
    if (widthOverflow(width, true) || width === undefined) {
      style.width = "100%";
    }
    if (widthOverflow(maxWidth) || maxWidth === undefined) {
      style["max-width"] = "100%";
    }
    style.height = "auto";
    style.display = "block";
  }
  return style;
}

function safeChildren(
  parent: HtmlParent | HtmlElement,
  mode: WechatOutputMode,
): readonly SafeHtmlNode[] {
  return parent.childNodes.flatMap((child) => safeNode(child, mode));
}

function safeNode(node: HtmlNode, mode: WechatOutputMode): readonly SafeHtmlNode[] {
  if (isTextNode(node)) {
    return [node.value];
  }
  if (!isElement(node)) {
    return [];
  }
  const tagName = node.tagName.toLowerCase();
  if (DANGEROUS_TAGS.has(tagName)) {
    return [];
  }
  if (!ALLOWED_TAGS.has(tagName)) {
    return safeChildren(node, mode);
  }
  const tag = tagName as WechatHtmlTag;
  return [
    htmlElement(tag, {
      attributes: safeAttributes(node, tag),
      children: safeChildren(node, mode),
      style: safeStyle(node, tag),
    }),
  ];
}

export function sanitizeCompatibilityHtml(html: string, mode: WechatOutputMode): string {
  const fragment = parseFragment(html);
  return serializeSafeHtml(safeChildren(fragment, mode), mode).html;
}
