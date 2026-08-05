import { createHash } from "node:crypto";

import {
  DOCUMENT_SCHEMA_VERSION,
  type BulletListNode,
  type DocumentMark,
  type DocumentV1,
  type DocNode,
  type InlineNode,
  type ListItemNode,
  type OrderedListNode,
} from "@wechat-layout/document-schema";
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";

import type {
  BuildImportedDocumentInput,
  DetectedImportSource,
  ImportBlock,
  ImportBlockRole,
  ImportCleaningMode,
  ImportSourceHint,
  ImportStatistics,
  ImportWarning,
  ParsedPasteImport,
} from "./import.types.js";

type HtmlNode = DefaultTreeAdapterTypes.ChildNode;
type HtmlElement = DefaultTreeAdapterTypes.Element;
type HtmlParent = DefaultTreeAdapterTypes.ParentNode;

const securityTags = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed",
  "applet",
  "canvas",
  "svg",
  "form",
  "input",
  "button",
  "select",
  "textarea",
]);
const blockTags = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "img",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);
const containerTags = new Set([
  "article",
  "aside",
  "body",
  "div",
  "figure",
  "figcaption",
  "footer",
  "header",
  "main",
  "nav",
  "section",
]);

interface ScanCounts {
  security: number;
  hidden: number;
  styles: number;
  unsafeLinks: number;
  externalImages: number;
  tables: number;
  unsupported: number;
}

interface MutableBlock {
  role: ImportBlockRole;
  text: string;
  originalTag?: string;
  inlineContent?: readonly InlineNode[];
  listDepth?: number;
  listStart?: number;
  originalNumberText?: string;
  sourceUrl?: string | null;
  alt?: string;
  tableCells?: readonly string[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isElement(node: HtmlNode): node is HtmlElement {
  return "tagName" in node;
}

function isTextNode(node: HtmlNode): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text" && "value" in node;
}

function attribute(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name.toLowerCase() === name)?.value;
}

function isHidden(element: HtmlElement): boolean {
  if (attribute(element, "hidden") !== undefined || attribute(element, "aria-hidden") === "true") {
    return true;
  }
  const style = attribute(element, "style")?.toLowerCase().replaceAll(/\s+/g, "") ?? "";
  return (
    style.includes("display:none") ||
    style.includes("visibility:hidden") ||
    style.includes("mso-hide:all")
  );
}

function safeHref(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return /^(?:https?:\/\/|mailto:)[^\s]+$/i.test(trimmed) ? trimmed.slice(0, 2_048) : undefined;
}

function safeImageUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed) ? trimmed.slice(0, 2_048) : undefined;
}

function visibleText(node: HtmlNode | HtmlParent): string {
  if (node.nodeName === "#text" && "value" in node) {
    return node.value;
  }
  if (!("childNodes" in node)) {
    return "";
  }
  return node.childNodes
    .filter((child) => !isElement(child) || (!securityTags.has(child.tagName) && !isHidden(child)))
    .map(visibleText)
    .join("");
}

function normalizedText(value: string): string {
  const withoutControlCharacters = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127 ||
      (code >= 0x200b && code <= 0x200d) ||
      code === 0xfeff
      ? ""
      : character;
  }).join("");
  return withoutControlCharacters
    .replaceAll(/\r\n?/g, "\n")
    .replaceAll(/[ \t\f\v]+/g, " ")
    .replaceAll(/ *\n */g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

function markKey(mark: DocumentMark): string {
  return JSON.stringify(mark);
}

function marksForElement(
  element: HtmlElement,
  inherited: readonly DocumentMark[],
  mode: ImportCleaningMode,
): readonly DocumentMark[] {
  if (mode === "plain_text") {
    return [];
  }
  const marks = [...inherited];
  const add = (mark: DocumentMark) => {
    if (!marks.some((entry) => markKey(entry) === markKey(mark))) {
      marks.push(mark);
    }
  };

  if (element.tagName === "strong" || element.tagName === "b") {
    add({ type: "bold" });
  } else if (element.tagName === "em" || element.tagName === "i") {
    add({ type: "italic" });
  } else if (element.tagName === "u") {
    add({ type: "underline" });
  } else if (element.tagName === "s" || element.tagName === "strike" || element.tagName === "del") {
    add({ type: "strike" });
  } else if (element.tagName === "a") {
    const href = safeHref(attribute(element, "href"));
    if (href !== undefined) {
      add({
        type: "link",
        attrs: {
          href,
          ...(attribute(element, "target") === "_blank" ? { openInNewTab: true } : {}),
        },
      });
    }
  }
  return marks;
}

function inlineContent(
  parent: HtmlParent | HtmlElement,
  mode: ImportCleaningMode,
  inherited: readonly DocumentMark[] = [],
): InlineNode[] {
  const result: InlineNode[] = [];
  for (const child of parent.childNodes) {
    if (isTextNode(child)) {
      const text = child.value.replaceAll(/\s+/g, " ");
      if (text !== "") {
        result.push({
          type: "text",
          text,
          ...(inherited.length === 0 ? {} : { marks: [...inherited] }),
        });
      }
      continue;
    }
    if (!isElement(child) || securityTags.has(child.tagName) || isHidden(child)) {
      continue;
    }
    if (child.tagName === "br") {
      result.push({ type: "hardBreak" });
      continue;
    }
    if (child.tagName === "img" || child.tagName === "ul" || child.tagName === "ol") {
      continue;
    }
    result.push(...inlineContent(child, mode, marksForElement(child, inherited, mode)));
  }

  while (result[0]?.type === "text") {
    const trimmed = result[0].text.trimStart();
    if (trimmed === "") {
      result.shift();
    } else {
      result[0] = { ...result[0], text: trimmed };
      break;
    }
  }
  while (result.at(-1)?.type === "text") {
    const index = result.length - 1;
    const tail = result[index];
    if (tail?.type !== "text") {
      break;
    }
    const trimmed = tail.text.trimEnd();
    if (trimmed === "") {
      result.pop();
    } else {
      result[index] = { ...tail, text: trimmed };
      break;
    }
  }
  return result;
}

function inlinePlainText(content: readonly InlineNode[]): string {
  return normalizedText(
    content.map((node) => (node.type === "hardBreak" ? "\n" : node.text)).join(""),
  );
}

function scanTree(parent: HtmlParent, counts: ScanCounts): void {
  for (const child of parent.childNodes) {
    if (!isElement(child)) {
      continue;
    }
    if (securityTags.has(child.tagName)) {
      counts.security += 1;
      continue;
    }
    if (isHidden(child)) {
      counts.hidden += 1;
      continue;
    }
    counts.styles += child.attrs.filter(({ name }) =>
      ["style", "class", "font", "face", "lang", "width", "height"].includes(name.toLowerCase()),
    ).length;
    if (child.tagName === "a") {
      const href = attribute(child, "href");
      if (href !== undefined && safeHref(href) === undefined) {
        counts.unsafeLinks += 1;
      }
    } else if (child.tagName === "img") {
      counts.externalImages += 1;
    } else if (child.tagName === "table") {
      counts.tables += 1;
    } else if (
      !blockTags.has(child.tagName) &&
      ![
        "a",
        "abbr",
        "b",
        "br",
        "code",
        "del",
        "em",
        "i",
        "mark",
        "small",
        "span",
        "s",
        "strike",
        "strong",
        "sub",
        "sup",
        "time",
        "u",
      ].includes(child.tagName)
    ) {
      counts.unsupported += 1;
    }
    scanTree(child, counts);
  }
}

function inferredRole(text: string, tagName: string, hasTitle: boolean): ImportBlockRole {
  if (tagName === "h1" && !hasTitle) {
    return "title";
  }
  if (/^h[1-6]$/.test(tagName)) {
    const level = Math.min(3, Math.max(1, Number(tagName.slice(1)) - (hasTitle ? 1 : 0)));
    return `heading_${level}` as ImportBlockRole;
  }
  if (/^[一二三四五六七八九十百]+、/.test(text) && text.length <= 80) {
    return "heading_1";
  }
  if (/^[（(][一二三四五六七八九十百]+[）)]/.test(text) && text.length <= 80) {
    return "heading_2";
  }
  if (/^\d+[.、]\s*/.test(text) && text.length <= 60) {
    return "heading_3";
  }
  return "paragraph";
}

function inferredElementRole(
  element: HtmlElement,
  text: string,
  hasTitle: boolean,
): ImportBlockRole {
  const className = attribute(element, "class")?.toLowerCase() ?? "";
  if (!hasTitle && /(?:^|\s)(?:mso|wps)?title(?:\s|$)/.test(className)) {
    return "title";
  }
  const headingClass = className.match(/(?:mso|wps)?heading\s*([1-6])/);
  if (headingClass?.[1] !== undefined) {
    return `heading_${Math.min(3, Number(headingClass[1]))}` as ImportBlockRole;
  }
  return inferredRole(text, element.tagName, hasTitle);
}

function titleFromBlocks(blocks: readonly MutableBlock[]): string {
  const explicit = blocks.find((block) => block.role === "title" && block.text !== "");
  const candidate = explicit ?? blocks.find((block) => block.text !== "");
  return candidate?.text.slice(0, 500) || "未命名导入文章";
}

function extractHtmlBlocks(
  fragment: DefaultTreeAdapterTypes.DocumentFragment,
  mode: ImportCleaningMode,
) {
  const blocks: MutableBlock[] = [];
  let hasTitle = false;

  const addTextBlock = (
    element: HtmlElement,
    role?: ImportBlockRole,
    relation: Partial<MutableBlock> = {},
  ) => {
    const content = inlineContent(element, mode);
    const text = inlinePlainText(content);
    if (text === "") {
      return;
    }
    const resolvedRole = role ?? inferredElementRole(element, text, hasTitle);
    hasTitle ||= resolvedRole === "title";
    blocks.push({
      role: resolvedRole,
      text,
      originalTag: element.tagName,
      inlineContent: content,
      ...relation,
    });
  };

  const addImages = (element: HtmlElement) => {
    const visit = (parent: HtmlParent) => {
      for (const child of parent.childNodes) {
        if (!isElement(child) || securityTags.has(child.tagName) || isHidden(child)) {
          continue;
        }
        if (child.tagName === "img") {
          const alt = normalizedText(attribute(child, "alt") ?? "");
          const sourceUrl = safeImageUrl(attribute(child, "src")) ?? null;
          blocks.push({
            role: "image_reference",
            text: alt === "" ? "[图片]" : `[图片] ${alt}`,
            originalTag: "img",
            sourceUrl,
            alt: alt.slice(0, 500),
          });
        } else {
          visit(child);
        }
      }
    };
    visit(element);
  };

  const visitList = (element: HtmlElement, depth = 0) => {
    const role = element.tagName === "ol" ? "ordered_item" : "bullet_item";
    const start = Number(attribute(element, "start") ?? "1");
    let itemIndex = 0;
    for (const child of element.childNodes) {
      if (!isElement(child) || child.tagName !== "li" || isHidden(child)) {
        continue;
      }
      const content = inlineContent(child, mode);
      const text = inlinePlainText(content);
      if (text !== "") {
        const originalNumberText =
          role === "ordered_item"
            ? `${Number.isFinite(start) ? start + itemIndex : 1}.`
            : undefined;
        blocks.push({
          role,
          text,
          originalTag: "li",
          inlineContent: content,
          listDepth: depth,
          listStart: Number.isFinite(start) ? start : 1,
          ...(originalNumberText === undefined ? {} : { originalNumberText }),
        });
        itemIndex += 1;
      }
      for (const nested of child.childNodes) {
        if (isElement(nested) && (nested.tagName === "ul" || nested.tagName === "ol")) {
          visitList(nested, depth + 1);
        }
      }
    }
  };

  const visitTable = (element: HtmlElement) => {
    const rows: HtmlElement[] = [];
    const collectRows = (parent: HtmlParent) => {
      for (const child of parent.childNodes) {
        if (!isElement(child) || isHidden(child)) {
          continue;
        }
        if (child.tagName === "tr") {
          rows.push(child);
        } else {
          collectRows(child);
        }
      }
    };
    collectRows(element);
    for (const row of rows) {
      const cells = row.childNodes
        .filter(
          (child): child is HtmlElement =>
            isElement(child) && (child.tagName === "td" || child.tagName === "th"),
        )
        .map((cell) => normalizedText(visibleText(cell)))
        .filter((text) => text !== "");
      if (cells.length > 0) {
        blocks.push({
          role: "paragraph",
          text: cells.join(" ｜ "),
          originalTag: "table",
          tableCells: cells,
        });
      }
    }
  };

  const visit = (parent: HtmlParent) => {
    for (const child of parent.childNodes) {
      if (isTextNode(child)) {
        const text = normalizedText(child.value);
        if (text !== "") {
          const role = inferredRole(text, "text", hasTitle);
          hasTitle ||= role === "title";
          blocks.push({ role, text, originalTag: "text" });
        }
        continue;
      }
      if (!isElement(child) || securityTags.has(child.tagName) || isHidden(child)) {
        continue;
      }
      if (/^h[1-6]$/.test(child.tagName) || child.tagName === "p" || child.tagName === "pre") {
        addTextBlock(child);
        addImages(child);
      } else if (child.tagName === "blockquote") {
        addTextBlock(child, "quote");
      } else if (child.tagName === "ul" || child.tagName === "ol") {
        visitList(child);
      } else if (child.tagName === "table") {
        visitTable(child);
      } else if (child.tagName === "img") {
        const alt = normalizedText(attribute(child, "alt") ?? "");
        blocks.push({
          role: "image_reference",
          text: alt === "" ? "[图片]" : `[图片] ${alt}`,
          originalTag: "img",
          sourceUrl: safeImageUrl(attribute(child, "src")) ?? null,
          alt: alt.slice(0, 500),
        });
      } else if (child.tagName === "hr") {
        blocks.push({ role: "excluded", text: "[分隔线]", originalTag: "hr" });
      } else if (containerTags.has(child.tagName)) {
        const hasBlockChildren = child.childNodes.some(
          (entry) => isElement(entry) && blockTags.has(entry.tagName),
        );
        if (hasBlockChildren) {
          visit(child);
        } else {
          addTextBlock(child);
          addImages(child);
        }
      } else {
        const text = normalizedText(visibleText(child));
        if (text !== "") {
          addTextBlock(child);
        }
      }
    }
  };

  visit(fragment);
  return blocks;
}

function plainTextBlocks(value: string): MutableBlock[] {
  const paragraphs = normalizedText(value)
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  let hasTitle = false;
  return paragraphs.map((text, index) => {
    const role =
      index === 0 && text.length <= 80
        ? "title"
        : inferredRole(text, "text", hasTitle || index > 0);
    hasTitle ||= role === "title";
    return {
      role,
      text,
      originalTag: "text",
      inlineContent: [{ type: "text", text }],
    };
  });
}

function detectSource(
  html: string,
  hasHtml: boolean,
  hint: ImportSourceHint,
): DetectedImportSource {
  if (hint !== "auto") {
    return hint;
  }
  const lower = html.toLowerCase();
  if (/mso-|schemas-microsoft-com|class=(?:"|')?mso/.test(lower)) {
    return "word";
  }
  if (/wps|kingsoft|ksosoft/.test(lower)) {
    return "wps";
  }
  if (/wechat|weixin|rich_media_content|js_content/.test(lower)) {
    return "wechat";
  }
  if (/chatgpt|openai/.test(lower)) {
    return "chatgpt";
  }
  if (/claude|anthropic/.test(lower)) {
    return "claude";
  }
  return hasHtml ? "web" : "plain_text";
}

function warningsFromCounts(counts: ScanCounts, emptySkipped: number): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  const add = (
    code: ImportWarning["code"],
    severity: ImportWarning["severity"],
    message: string,
    count: number,
  ) => {
    if (count > 0) {
      warnings.push({ code, severity, message, count });
    }
  };
  add(
    "SECURITY_CONTENT_REMOVED",
    "warning",
    "已删除脚本、嵌入对象或表单等不可执行内容。",
    counts.security,
  );
  add("HIDDEN_CONTENT_REMOVED", "warning", "已删除不可见内容。", counts.hidden);
  add("UNSAFE_LINK_REMOVED", "warning", "已移除非 HTTP(S)/邮件协议链接。", counts.unsafeLinks);
  add("STYLE_CLEANED", "info", "已清理 Office、WPS 或网页样式属性。", counts.styles);
  add(
    "UNSUPPORTED_STRUCTURE_FLATTENED",
    "warning",
    "不支持的标签或表格已转为可追踪的纯文本区块。",
    counts.unsupported + counts.tables,
  );
  add(
    "EXTERNAL_IMAGE_REFERENCE",
    "warning",
    "图片仅保留安全外部引用，需在资源服务中上传后才能正式排版。",
    counts.externalImages,
  );
  add("EMPTY_CONTENT_SKIPPED", "info", "已跳过空白区块。", emptySkipped);
  return warnings;
}

function finalizeBlocks(blocks: readonly MutableBlock[]): ImportBlock[] {
  return blocks.map((block, orderIndex) => {
    const text = normalizedText(block.text);
    const textHash = sha256(text);
    return {
      sourceBlockId: `source_${String(orderIndex + 1).padStart(4, "0")}_${textHash.slice(0, 12)}`,
      role: block.role,
      text,
      textHash,
      orderIndex,
      styleMetadata: {
        ...(block.originalTag === undefined ? {} : { originalTag: block.originalTag }),
        ...(block.inlineContent === undefined ? {} : { inlineContent: block.inlineContent }),
      },
      relationMetadata: {
        ...(block.listDepth === undefined ? {} : { listDepth: block.listDepth }),
        ...(block.listStart === undefined ? {} : { listStart: block.listStart }),
        ...(block.originalNumberText === undefined
          ? {}
          : { originalNumberText: block.originalNumberText }),
        ...(block.sourceUrl === undefined ? {} : { sourceUrl: block.sourceUrl }),
        ...(block.alt === undefined ? {} : { alt: block.alt }),
        ...(block.tableCells === undefined ? {} : { tableCells: block.tableCells }),
      },
    };
  });
}

function statisticsForImport(
  blocks: readonly ImportBlock[],
  counts: ScanCounts,
  originalText: string,
): ImportStatistics {
  const wordTokens = originalText.match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) ?? [];
  return {
    wordCount: wordTokens.length,
    characterCount: [...originalText].length,
    blockCount: blocks.length,
    headingCount: blocks.filter((block) =>
      ["title", "heading_1", "heading_2", "heading_3"].includes(block.role),
    ).length,
    imageCount: blocks.filter((block) => block.role === "image_reference").length,
    tableCount: counts.tables,
    removedStyleCount: counts.styles,
    removedSecurityNodeCount: counts.security,
    removedHiddenNodeCount: counts.hidden,
    removedUnsafeLinkCount: counts.unsafeLinks,
  };
}

export function parsePasteImport(input: {
  readonly html?: string;
  readonly plainText?: string;
  readonly cleaningMode: ImportCleaningMode;
  readonly detectedSourceHint: ImportSourceHint;
}): ParsedPasteImport {
  const html = input.html?.trim() ?? "";
  const suppliedPlainText = normalizedText(input.plainText ?? "");
  const hasHtml = html !== "" && input.cleaningMode !== "plain_text";
  const counts: ScanCounts = {
    security: 0,
    hidden: 0,
    styles: 0,
    unsafeLinks: 0,
    externalImages: 0,
    tables: 0,
    unsupported: 0,
  };
  let mutableBlocks: MutableBlock[];
  let derivedVisibleText = "";
  const fragment = html === "" ? null : parseFragment(html);

  if (hasHtml) {
    if (fragment === null) {
      throw new Error("HTML 解析状态不一致");
    }
    scanTree(fragment, counts);
    mutableBlocks = extractHtmlBlocks(fragment, input.cleaningMode);
    derivedVisibleText = normalizedText(
      mutableBlocks
        .map((block) => block.text)
        .filter((text) => text !== "")
        .join("\n"),
    );
  } else {
    if (fragment !== null) {
      scanTree(fragment, counts);
    }
    const plain =
      suppliedPlainText || normalizedText(fragment === null ? "" : visibleText(fragment));
    mutableBlocks = plainTextBlocks(plain);
    derivedVisibleText = plain;
  }

  const beforeEmptyFilter = mutableBlocks.length;
  mutableBlocks = mutableBlocks.filter((block) => normalizedText(block.text) !== "");
  const blocks = finalizeBlocks(mutableBlocks);
  const originalText = suppliedPlainText || derivedVisibleText;
  const originalTextHash = sha256(originalText);

  return {
    detectedSource: detectSource(html, hasHtml, input.detectedSourceHint),
    cleaningMode: input.cleaningMode,
    documentSourceType: hasHtml ? "html" : "plainText",
    title: titleFromBlocks(mutableBlocks),
    originalText,
    originalTextHash,
    blocks,
    warnings: warningsFromCounts(counts, beforeEmptyFilter - mutableBlocks.length),
    statistics: statisticsForImport(blocks, counts, originalText),
  };
}

function attrsFor(block: ImportBlock) {
  return {
    blockId: `block_${block.sourceBlockId}`,
    sourceBlockId: block.sourceBlockId,
    locked: true,
    sourceTextHash: `sha256:${block.textHash}`,
    compatibilityLevel: "safe" as const,
  };
}

function contentFor(block: ImportBlock): InlineNode[] {
  const stored = block.styleMetadata.inlineContent;
  return stored === undefined || stored.length === 0
    ? [{ type: "text", text: block.text }]
    : stored.map((node) =>
        node.type === "hardBreak"
          ? { type: "hardBreak" }
          : {
              type: "text",
              text: node.text,
              ...(node.marks === undefined
                ? {}
                : { marks: node.marks.map((mark) => ({ ...mark })) }),
            },
      );
}

function listNode(
  kind: "bulletList" | "orderedList",
  blocks: readonly ImportBlock[],
  groupIndex: number,
): BulletListNode | OrderedListNode {
  const items: ListItemNode[] = blocks.map((block) => ({
    type: "listItem",
    attrs: {
      ...attrsFor(block),
      ...(block.relationMetadata.originalNumberText === undefined
        ? {}
        : { originalNumberText: block.relationMetadata.originalNumberText }),
    },
    content: [
      {
        type: "paragraph",
        attrs: {
          blockId: `block_${block.sourceBlockId}_content`,
          locked: true,
          sourceTextHash: `sha256:${block.textHash}`,
        },
        content: contentFor(block),
      },
    ],
  }));
  const shared = {
    blockId: `block_${kind}_${groupIndex}`,
    locked: true,
    compatibilityLevel: "safe" as const,
  };
  return kind === "bulletList"
    ? {
        type: "bulletList",
        attrs: {
          ...shared,
          bulletStyle: "disc",
          indentLevel: Math.min(8, blocks[0]?.relationMetadata.listDepth ?? 0),
        },
        content: items,
      }
    : {
        type: "orderedList",
        attrs: {
          ...shared,
          start: blocks[0]?.relationMetadata.listStart ?? 1,
          numberingStyle: "decimal",
          indentLevel: Math.min(8, blocks[0]?.relationMetadata.listDepth ?? 0),
          preserveOriginalNumbering: true,
        },
        content: items,
      };
}

export function buildImportedDocument(input: BuildImportedDocumentInput): DocumentV1 {
  const content: DocNode["content"] = [];
  let index = 0;
  let listGroup = 0;

  while (index < input.blocks.length) {
    const block = input.blocks[index];
    if (block === undefined || block.role === "excluded") {
      index += 1;
      continue;
    }
    if (block.role === "bullet_item" || block.role === "ordered_item") {
      const group: ImportBlock[] = [];
      const role = block.role;
      while (input.blocks[index]?.role === role) {
        const item = input.blocks[index];
        if (item !== undefined) {
          group.push(item);
        }
        index += 1;
      }
      content.push(
        listNode(role === "bullet_item" ? "bulletList" : "orderedList", group, listGroup),
      );
      listGroup += 1;
      continue;
    }

    const attrs = attrsFor(block);
    if (
      block.role === "title" ||
      block.role === "heading_1" ||
      block.role === "heading_2" ||
      block.role === "heading_3"
    ) {
      const level = block.role === "heading_3" ? 3 : block.role === "heading_2" ? 2 : 1;
      content.push({
        type: "heading",
        attrs: {
          ...attrs,
          level,
          semanticRole: block.role === "title" ? "main_title" : "section_heading",
        },
        content: contentFor(block),
      });
    } else if (block.role === "quote") {
      content.push({
        type: "blockquote",
        attrs: {
          ...attrs,
          quoteType: "standard",
        },
        content: [
          {
            type: "paragraph",
            attrs: {
              blockId: `block_${block.sourceBlockId}_content`,
              locked: true,
              sourceTextHash: `sha256:${block.textHash}`,
            },
            content: contentFor(block),
          },
        ],
      });
    } else if (
      block.role === "image_reference" &&
      typeof block.relationMetadata.resourceId === "string"
    ) {
      content.push({
        type: "imageBlock",
        attrs: {
          ...attrs,
          resourceId: block.relationMetadata.resourceId,
          ...(block.relationMetadata.alt === undefined
            ? {}
            : { alt: block.relationMetadata.alt.slice(0, 500) }),
          widthMode: "full",
          widthPercent: 100,
          objectFit: "contain",
        },
      });
    } else {
      content.push({
        type: "paragraph",
        attrs: {
          ...attrs,
          ...(block.role === "subtitle" ? { semanticRole: "subtitle" } : {}),
          ...(block.role === "image_reference" ? { semanticRole: "unresolved_image" } : {}),
        },
        content: contentFor(block),
      });
    }
    index += 1;
  }

  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    documentId: input.documentId,
    articleId: input.articleId,
    accountId: input.accountId,
    content: {
      type: "doc",
      content,
    },
    meta: {
      sourceType: input.documentSourceType,
      originalTextHash: `sha256:${input.originalTextHash}`,
      textLocked: true,
      createdAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    },
  };
}
