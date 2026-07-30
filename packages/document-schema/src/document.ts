import type { DocNode } from "./nodes/index.js";
import { DOCUMENT_SCHEMA_VERSION, type DocumentSchemaVersion } from "./version.js";

export const DOCUMENT_SOURCE_TYPES = ["manual", "plainText", "html", "docx", "api"] as const;

export type DocumentSourceType = (typeof DOCUMENT_SOURCE_TYPES)[number];

export interface DocumentMetadata {
  sourceType: DocumentSourceType;
  originalFileId?: string;
  originalTextHash?: string;
  textLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentV1 {
  schemaVersion: DocumentSchemaVersion;
  documentId: string;
  articleId: string;
  accountId?: string | null;
  themeId?: string;
  themeVersion?: string;
  brandVersion?: string;
  content: DocNode;
  meta: DocumentMetadata;
}

export function isCurrentDocumentVersion(version: string): version is DocumentSchemaVersion {
  return version === DOCUMENT_SCHEMA_VERSION;
}
