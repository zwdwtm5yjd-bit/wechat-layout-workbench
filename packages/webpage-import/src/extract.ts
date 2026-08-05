import { createHash } from "node:crypto";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type {
  ParsedWebpage,
  WebpageBlock,
  WebpageBlockRole,
  WebpageWarning,
  WebpageWarningCode,
} from "./types.js";

const parserVersion = "webpage-readability-1.0.0";
const securitySelector =
  "script,style,iframe,frame,object,embed,form,input,button,textarea,select,template,noscript,canvas";
const hiddenSelector = "[hidden],[aria-hidden='true']";
const advertisementPattern =
  /(^|[-_\s])(ad|ads|advert|advertisement|banner|cookie|modal|popup|promo|related|recommend|share|sidebar|sponsor)([-_\s]|$)/i;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedText(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll(/\u00a0/g, " ")
    .replaceAll(/[\t\f\v ]+/g, " ")
    .replaceAll(/\s*\n\s*/g, "\n")
    .trim();
}

function warning(
  values: Map<WebpageWarningCode, number>,
  code: WebpageWarningCode,
  amount = 1,
): void {
  values.set(code, (values.get(code) ?? 0) + amount);
}

function warningsFrom(values: ReadonlyMap<WebpageWarningCode, number>): readonly WebpageWarning[] {
  const messages: Record<WebpageWarningCode, string> = {
    SECURITY_CONTENT_REMOVED: "已移除脚本、表单或可执行嵌入内容",
    HIDDEN_CONTENT_REMOVED: "已移除隐藏内容或广告区域",
    UNSAFE_LINK_REMOVED: "已移除不安全链接",
    STYLE_CLEANED: "已清理网页样式和事件属性",
    UNSUPPORTED_STRUCTURE_FLATTENED: "部分网页结构已扁平化为可编辑内容",
    EXTERNAL_IMAGE_REFERENCE: "网页图片将下载到私有资源库",
    EMPTY_CONTENT_SKIPPED: "已跳过空内容",
  };
  return [...values.entries()].map(([code, count]) => ({
    code,
    severity: code === "STYLE_CLEANED" || code === "EMPTY_CONTENT_SKIPPED" ? "info" : "warning",
    message: messages[code],
    count,
  }));
}

function removeUnsafeContent(document: Document, values: Map<WebpageWarningCode, number>): void {
  const securityNodes = [...document.querySelectorAll(securitySelector)];
  securityNodes.forEach((node) => node.remove());
  if (securityNodes.length > 0) warning(values, "SECURITY_CONTENT_REMOVED", securityNodes.length);

  const hiddenNodes = [...document.querySelectorAll(hiddenSelector)];
  hiddenNodes.forEach((node) => node.remove());
  let advertisingNodes = 0;
  for (const element of [...document.querySelectorAll("*")]) {
    const marker = `${element.id} ${element.className}`;
    if (advertisementPattern.test(marker)) {
      element.remove();
      advertisingNodes += 1;
    }
  }
  if (hiddenNodes.length + advertisingNodes > 0) {
    warning(values, "HIDDEN_CONTENT_REMOVED", hiddenNodes.length + advertisingNodes);
  }

  let removedAttributes = 0;
  let unsafeLinks = 0;
  for (const element of [...document.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name === "style" || name.startsWith("on") || name === "srcdoc") {
        element.removeAttribute(attribute.name);
        removedAttributes += 1;
      }
    }
    if (element instanceof document.defaultView!.HTMLAnchorElement) {
      try {
        const url = new URL(element.href, document.URL);
        if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "mailto:") {
          element.removeAttribute("href");
          unsafeLinks += 1;
        }
      } catch {
        element.removeAttribute("href");
        unsafeLinks += 1;
      }
    }
  }
  if (removedAttributes > 0) warning(values, "STYLE_CLEANED", removedAttributes);
  if (unsafeLinks > 0) warning(values, "UNSAFE_LINK_REMOVED", unsafeLinks);
}

function blockRole(element: Element): WebpageBlockRole | null {
  const tag = element.tagName.toLowerCase();
  if (tag === "h1") return "heading_1";
  if (tag === "h2") return "heading_2";
  if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "heading_3";
  if (tag === "p" || tag === "pre") return "paragraph";
  if (tag === "blockquote") return "quote";
  return null;
}

function createCollector(baseUrl: string, values: Map<WebpageWarningCode, number>) {
  const blocks: WebpageBlock[] = [];
  let tableCount = 0;

  const add = (
    role: WebpageBlockRole,
    text: string,
    sourceType: string,
    relationMetadata: Record<string, unknown> = {},
  ) => {
    const normalized = normalizedText(text);
    if (role !== "image_reference" && normalized === "") {
      warning(values, "EMPTY_CONTENT_SKIPPED");
      return;
    }
    const orderIndex = blocks.length;
    blocks.push({
      sourceBlockId: `web_${String(orderIndex + 1).padStart(4, "0")}`,
      sourceType,
      role,
      text: normalized,
      textHash: sha256(normalized),
      orderIndex,
      styleMetadata: { originalTag: sourceType },
      relationMetadata,
    });
  };

  const walk = (element: Element, listDepth = 0): void => {
    const tag = element.tagName.toLowerCase();
    if (tag === "img") {
      const source = element.getAttribute("src") ?? element.getAttribute("data-src");
      if (!source) return;
      try {
        const imageUrl = new URL(source, baseUrl);
        if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
          warning(values, "UNSAFE_LINK_REMOVED");
          return;
        }
        add("image_reference", element.getAttribute("alt") ?? "", tag, {
          sourceUrl: imageUrl.href,
          alt: normalizedText(element.getAttribute("alt")),
        });
        warning(values, "EXTERNAL_IMAGE_REFERENCE");
      } catch {
        warning(values, "UNSAFE_LINK_REMOVED");
      }
      return;
    }
    if (tag === "ul" || tag === "ol") {
      const children = [...element.children].filter(
        (child) => child.tagName.toLowerCase() === "li",
      );
      const start =
        tag === "ol" ? Math.max(1, Number(element.getAttribute("start") ?? "1") || 1) : undefined;
      children.forEach((child, index) => {
        const clone = child.cloneNode(true) as Element;
        clone.querySelectorAll("ul,ol,img").forEach((nested) => nested.remove());
        add(tag === "ol" ? "ordered_item" : "bullet_item", clone.textContent ?? "", "li", {
          listDepth,
          ...(start === undefined
            ? {}
            : { listStart: start, originalNumberText: `${String(start + index)}.` }),
        });
        child.querySelectorAll(":scope > img").forEach((image) => walk(image, listDepth));
        child
          .querySelectorAll(":scope > ul, :scope > ol")
          .forEach((nested) => walk(nested, listDepth + 1));
      });
      return;
    }
    if (tag === "table") {
      tableCount += 1;
      warning(values, "UNSUPPORTED_STRUCTURE_FLATTENED");
      for (const row of [...element.querySelectorAll("tr")]) {
        const cells = [...row.querySelectorAll(":scope > th, :scope > td")]
          .map((cell) => normalizedText(cell.textContent))
          .filter(Boolean);
        if (cells.length > 0)
          add("paragraph", cells.join(" | "), "table_row", { tableCells: cells });
      }
      return;
    }
    const role = blockRole(element);
    if (role !== null) {
      const clone = element.cloneNode(true) as Element;
      clone.querySelectorAll("img,ul,ol,table").forEach((nested) => nested.remove());
      add(role, clone.textContent ?? "", tag);
      element
        .querySelectorAll(":scope > img, :scope > ul, :scope > ol, :scope > table")
        .forEach((nested) => walk(nested, listDepth));
      return;
    }
    for (const child of [...element.children]) walk(child, listDepth);
  };

  return { blocks, walk, tableCount: () => tableCount };
}

export function parseWebpage(input: {
  readonly html: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
}): ParsedWebpage {
  const warnings = new Map<WebpageWarningCode, number>();
  const sourceDom = new JSDOM(input.html, { url: input.finalUrl });
  removeUnsafeContent(sourceDom.window.document, warnings);
  const article = new Readability(sourceDom.window.document.cloneNode(true) as Document, {
    charThreshold: 140,
    keepClasses: false,
  }).parse();
  const content = article?.content?.trim() || sourceDom.window.document.body.innerHTML;
  if (!article?.content) warning(warnings, "UNSUPPORTED_STRUCTURE_FLATTENED");
  const cleanDom = new JSDOM(`<main>${content}</main>`, { url: input.finalUrl });
  removeUnsafeContent(cleanDom.window.document, warnings);
  const main = cleanDom.window.document.querySelector("main");
  if (main === null) throw new Error("网页正文容器创建失败");
  const collector = createCollector(input.finalUrl, warnings);
  collector.walk(main);
  const blocks = collector.blocks;
  const textBlocks = blocks.filter(
    (block) => block.role !== "image_reference" && block.role !== "excluded",
  );
  const originalText = normalizedText(textBlocks.map((block) => block.text).join("\n\n"));
  const title = normalizedText(
    article?.title || sourceDom.window.document.title || new URL(input.finalUrl).hostname,
  ).slice(0, 500);
  const sanitizedHtml = main.innerHTML;
  const wordTokens = originalText.match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) ?? [];
  return {
    schemaVersion: "1.0.0",
    parserVersion,
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    title: title || "未命名网页导入",
    byline: normalizedText(article?.byline) || null,
    excerpt: normalizedText(article?.excerpt) || null,
    siteName: normalizedText(article?.siteName) || null,
    language:
      normalizedText(article?.lang || sourceDom.window.document.documentElement.lang) || null,
    originalText,
    originalTextHash: sha256(originalText),
    sanitizedHtml,
    sanitizedHtmlHash: sha256(sanitizedHtml),
    sourceBlocks: blocks,
    warnings: warningsFrom(warnings),
    statistics: {
      wordCount: wordTokens.length,
      characterCount: [...originalText].length,
      blockCount: blocks.length,
      headingCount: blocks.filter((block) => block.role.startsWith("heading_")).length,
      imageCount: blocks.filter((block) => block.role === "image_reference").length,
      tableCount: collector.tableCount(),
      removedStyleCount: warnings.get("STYLE_CLEANED") ?? 0,
      removedSecurityNodeCount: warnings.get("SECURITY_CONTENT_REMOVED") ?? 0,
      removedHiddenNodeCount: warnings.get("HIDDEN_CONTENT_REMOVED") ?? 0,
      removedUnsafeLinkCount: warnings.get("UNSAFE_LINK_REMOVED") ?? 0,
    },
  };
}

export function webpageNeedsBrowserFallback(parsed: ParsedWebpage): boolean {
  const meaningfulBlocks = parsed.sourceBlocks.filter(
    (block) => block.role !== "image_reference" && block.role !== "excluded",
  );
  return parsed.originalText.length < 140 || meaningfulBlocks.length < 2;
}
