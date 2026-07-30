import { parseDocument, type DocNode, type DocumentV1 } from "@wechat-layout/document-schema";
import type { JSONContent } from "@tiptap/core";

import { createBlockId } from "./extensions.js";

function stripNullishValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNullishValues);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== null && entry !== undefined)
      .map(([key, entry]) => [key, stripNullishValues(entry)]),
  );
}

export function documentToEditorContent(input: unknown): JSONContent {
  const document = parseDocument(input);
  const content = structuredClone(document.content) as JSONContent;

  if (content.content?.length === 0) {
    content.content = [
      {
        type: "paragraph",
        attrs: {
          blockId: createBlockId(),
          locked: false,
        },
      },
    ];
  }

  return content;
}

export function editorContentToDocument(
  baseDocument: DocumentV1,
  editorContent: JSONContent,
  updatedAt = new Date(),
): DocumentV1 {
  const normalizedContent = stripNullishValues(editorContent) as DocNode;
  return parseDocument({
    ...structuredClone(baseDocument),
    content: normalizedContent,
    meta: {
      ...baseDocument.meta,
      updatedAt: updatedAt.toISOString(),
    },
  });
}

export function normalizeDocument(input: unknown): DocumentV1 {
  return structuredClone(parseDocument(input));
}
