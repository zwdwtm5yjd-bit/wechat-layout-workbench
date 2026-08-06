import { serializeInlineStyles, type WechatStyleMap } from "./style-serializer.js";
import type { WechatOutputMode } from "./types.js";
import { sanitizeWechatUrl } from "./url-sanitizer.js";

export const WECHAT_HTML_TAGS = [
  "a",
  "blockquote",
  "br",
  "img",
  "li",
  "ol",
  "p",
  "section",
  "span",
  "ul",
] as const;

export type WechatHtmlTag = (typeof WECHAT_HTML_TAGS)[number];

export interface SafeHtmlAttributes {
  readonly alt?: string;
  readonly draggable?: false;
  readonly href?: string;
  readonly leaf?: true;
  readonly src?: string;
  readonly start?: number;
  readonly title?: string;
}

export interface SafeHtmlElement {
  readonly attributes?: SafeHtmlAttributes;
  readonly children?: readonly SafeHtmlNode[];
  readonly style?: WechatStyleMap;
  readonly tag: WechatHtmlTag;
}

export type SafeHtmlNode = SafeHtmlElement | string;

export interface HtmlPolicyWarning {
  readonly message: string;
  readonly path: string;
}

export interface SafeHtmlSerializationResult {
  readonly html: string;
  readonly warnings: readonly HtmlPolicyWarning[];
}

const ALLOWED_TAGS = new Set<string>(WECHAT_HTML_TAGS);
const VOID_TAGS = new Set<WechatHtmlTag>(["br", "img"]);

export function htmlElement(
  tag: WechatHtmlTag,
  options: Omit<SafeHtmlElement, "tag"> = {},
): SafeHtmlElement {
  return {
    tag,
    ...(options.attributes === undefined ? {} : { attributes: options.attributes }),
    ...(options.children === undefined ? {} : { children: options.children }),
    ...(options.style === undefined ? {} : { style: options.style }),
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeAttributes(
  element: SafeHtmlElement,
  mode: WechatOutputMode,
  path: string,
  warnings: HtmlPolicyWarning[],
  forceLeaf = false,
): string {
  const attributes: Record<string, string> = {};
  const source = element.attributes ?? {};

  if (typeof source.alt === "string") {
    attributes.alt = source.alt;
  }
  if (typeof source.title === "string") {
    attributes.title = source.title;
  }
  if (element.tag === "span" && (source.leaf === true || forceLeaf)) {
    attributes.leaf = "";
  }
  if (element.tag === "ol" && Number.isInteger(source.start) && Number(source.start) >= 1) {
    attributes.start = String(source.start);
  }
  if (element.tag === "a" && source.href !== undefined) {
    const result = sanitizeWechatUrl(source.href, "link");
    if (result.success) {
      attributes.href = result.normalized;
    } else {
      warnings.push({ message: result.reason, path: `${path}/attributes/href` });
    }
  }
  if (element.tag === "img" && source.src !== undefined) {
    const result = sanitizeWechatUrl(source.src, "image");
    if (result.success) {
      attributes.src = result.normalized;
    } else {
      warnings.push({ message: result.reason, path: `${path}/attributes/src` });
    }
  }
  if (element.tag === "img") {
    attributes.draggable = "false";
  }
  if (element.tag !== "br") {
    const requiredStyle: WechatStyleMap = {
      ...(element.style ?? {}),
      "box-sizing": "border-box",
      "max-width": "100% !important",
      ...(element.tag === "span"
        ? { "overflow-wrap": "anywhere", "word-break": "break-word" }
        : {}),
    };
    const result = serializeInlineStyles(requiredStyle, mode);
    if (result.css !== "") {
      attributes.style = result.css;
    }
    result.warnings.forEach((warning) => {
      warnings.push({
        message: `${warning.property}: ${warning.message}`,
        path: `${path}/style/${warning.property}`,
      });
    });
  }

  return Object.entries(attributes)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join("");
}

function serializeNode(
  node: SafeHtmlNode,
  mode: WechatOutputMode,
  path: string,
  warnings: HtmlPolicyWarning[],
  insideLeaf = false,
): string {
  if (typeof node === "string") {
    const escaped = escapeHtml(node);
    return insideLeaf || node.trim() === "" ? escaped : `<span leaf="">${escaped}</span>`;
  }
  if (!ALLOWED_TAGS.has(node.tag)) {
    warnings.push({ message: `HTML 标签 “${String(node.tag)}” 不在白名单中`, path });
    return (node.children ?? [])
      .map((child, index) =>
        serializeNode(child, mode, `${path}/children/${String(index)}`, warnings),
      )
      .join("");
  }

  const forceLeaf =
    node.tag === "span" &&
    (node.children?.length ?? 0) > 0 &&
    node.children?.every((child) => typeof child === "string") === true;
  const attributes = serializeAttributes(node, mode, path, warnings, forceLeaf);
  if (VOID_TAGS.has(node.tag)) {
    return `<${node.tag}${attributes}>`;
  }
  const children = (node.children ?? [])
    .map((child, index) =>
      serializeNode(
        child,
        mode,
        `${path}/children/${String(index)}`,
        warnings,
        insideLeaf || forceLeaf || node.attributes?.leaf === true,
      ),
    )
    .join("");
  return `<${node.tag}${attributes}>${children}</${node.tag}>`;
}

export function serializeSafeHtml(
  nodes: SafeHtmlNode | readonly SafeHtmlNode[],
  mode: WechatOutputMode,
): SafeHtmlSerializationResult {
  const warnings: HtmlPolicyWarning[] = [];
  const list = Array.isArray(nodes) ? nodes : [nodes];
  return {
    html: list
      .map((node, index) => serializeNode(node, mode, `/${String(index)}`, warnings))
      .join(""),
    warnings,
  };
}
