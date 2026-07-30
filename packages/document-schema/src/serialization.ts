import type { DocumentV1 } from "./document.js";
import {
  DocumentValidationException,
  parseDocument,
  type DocumentValidationError,
} from "./validation.js";

export function serializeDocument(document: DocumentV1): string {
  return JSON.stringify(parseDocument(document));
}

export function deserializeDocument(serialized: string): DocumentV1 {
  let input: unknown;

  try {
    input = JSON.parse(serialized) as unknown;
  } catch {
    const error: DocumentValidationError = {
      code: "INVALID_JSON",
      path: "/",
      message: "文档不是有效的 JSON",
    };
    throw new DocumentValidationException([error]);
  }

  return parseDocument(input);
}
