import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import type { DocumentV1 } from "./document.js";
import { documentSchemaV1JsonSchema } from "./schema.js";
import { collectDocumentEntries } from "./traversal.js";

export type DocumentValidationErrorCode =
  "SCHEMA_INVALID" | "DUPLICATE_BLOCK_ID" | "DUPLICATE_MARK" | "INVALID_JSON";

export interface DocumentValidationError {
  code: DocumentValidationErrorCode;
  path: string;
  message: string;
  keyword?: string;
}

export type DocumentValidationResult =
  | {
      success: true;
      data: DocumentV1;
    }
  | {
      success: false;
      errors: DocumentValidationError[];
    };

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});

const validateAgainstJsonSchema: ValidateFunction<DocumentV1> = ajv.compile<DocumentV1>(
  documentSchemaV1JsonSchema,
);

function mapJsonSchemaError(error: ErrorObject): DocumentValidationError {
  return {
    code: "SCHEMA_INVALID",
    path: error.instancePath || "/",
    message: error.message ?? "文档不符合 Schema",
    keyword: error.keyword,
  };
}

function validateSemanticConstraints(document: DocumentV1): DocumentValidationError[] {
  const errors: DocumentValidationError[] = [];
  const blockPaths = new Map<string, string>();
  const { blocks, texts } = collectDocumentEntries(document.content);

  for (const { node, path } of blocks) {
    const existingPath = blockPaths.get(node.attrs.blockId);

    if (existingPath !== undefined) {
      errors.push({
        code: "DUPLICATE_BLOCK_ID",
        path: `${path}/attrs/blockId`,
        message: `Block ID “${node.attrs.blockId}” 已在 ${existingPath} 使用`,
      });
      continue;
    }

    blockPaths.set(node.attrs.blockId, `${path}/attrs/blockId`);
  }

  for (const { node, path } of texts) {
    const markTypes = new Set<string>();

    node.marks?.forEach((mark, index) => {
      if (markTypes.has(mark.type)) {
        errors.push({
          code: "DUPLICATE_MARK",
          path: `${path}/marks/${index}`,
          message: `同一文本节点不能重复使用 ${mark.type} Mark`,
        });
      }

      markTypes.add(mark.type);
    });
  }

  return errors;
}

export function validateDocument(input: unknown): DocumentValidationResult {
  if (!validateAgainstJsonSchema(input)) {
    return {
      success: false,
      errors: (validateAgainstJsonSchema.errors ?? []).map(mapJsonSchemaError),
    };
  }

  const semanticErrors = validateSemanticConstraints(input);

  if (semanticErrors.length > 0) {
    return {
      success: false,
      errors: semanticErrors,
    };
  }

  return {
    success: true,
    data: input,
  };
}

export class DocumentValidationException extends Error {
  override readonly name = "DocumentValidationException";

  constructor(readonly errors: DocumentValidationError[]) {
    super(errors.map((error) => `${error.path}: ${error.message}`).join("; "));
  }
}

export function parseDocument(input: unknown): DocumentV1 {
  const result = validateDocument(input);

  if (!result.success) {
    throw new DocumentValidationException(result.errors);
  }

  return result.data;
}
