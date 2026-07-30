import { createHash } from "node:crypto";

import { collectDocumentEntries, type DocumentV1 } from "@wechat-layout/document-schema";

import type { DocumentStatistics } from "./document.types.js";

export function statisticsForDocument(document: DocumentV1): DocumentStatistics {
  const entries = collectDocumentEntries(document.content);
  const plainText = entries.texts.map(({ node }) => node.text).join("\n");
  const wordTokens = plainText.match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) ?? [];

  return {
    currentTextHash: createHash("sha256").update(plainText).digest("hex"),
    wordCount: wordTokens.length,
    imageCount: entries.blocks.filter(({ node }) => node.type === "imageBlock").length,
    svgCount: entries.blocks.filter(({ node }) => node.type === "svgInteraction").length,
  };
}
