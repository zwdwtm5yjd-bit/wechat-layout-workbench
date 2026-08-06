import type { DocumentV1, InlineNode } from "@wechat-layout/document-schema";

import type {
  IMPORT_BLOCK_ROLES,
  IMPORT_CLEANING_MODES,
  IMPORT_SOURCE_HINTS,
  IMPORT_WARNING_CODES,
} from "./import.constants.js";

export type ImportCleaningMode = (typeof IMPORT_CLEANING_MODES)[number];
export type ImportSourceHint = (typeof IMPORT_SOURCE_HINTS)[number];
export type DetectedImportSource = Exclude<ImportSourceHint, "auto">;
export type ImportBlockRole = (typeof IMPORT_BLOCK_ROLES)[number];
export type ImportWarningCode = (typeof IMPORT_WARNING_CODES)[number];

export interface ImportWarning {
  readonly code: ImportWarningCode;
  readonly severity: "info" | "warning";
  readonly message: string;
  readonly count: number;
}

export interface ImportStatistics {
  readonly wordCount: number;
  readonly characterCount: number;
  readonly blockCount: number;
  readonly headingCount: number;
  readonly imageCount: number;
  readonly tableCount: number;
  readonly removedStyleCount: number;
  readonly removedSecurityNodeCount: number;
  readonly removedHiddenNodeCount: number;
  readonly removedUnsafeLinkCount: number;
}

export interface ImportBlock {
  readonly sourceBlockId: string;
  readonly role: ImportBlockRole;
  readonly text: string;
  readonly textHash: string;
  readonly orderIndex: number;
  readonly styleMetadata: Readonly<{
    readonly originalTag?: string;
    readonly inlineContent?: readonly InlineNode[];
  }>;
  readonly relationMetadata: Readonly<{
    readonly listDepth?: number;
    readonly listStart?: number;
    readonly originalNumberText?: string;
    readonly sourceUrl?: string | null;
    readonly alt?: string;
    readonly caption?: string;
    readonly tableCells?: readonly string[];
    readonly resourceId?: string;
  }>;
}

export interface ParsedPasteImport {
  readonly detectedSource: DetectedImportSource;
  readonly cleaningMode: ImportCleaningMode;
  readonly documentSourceType: "html" | "plainText";
  readonly title: string;
  readonly originalText: string;
  readonly originalTextHash: string;
  readonly blocks: readonly ImportBlock[];
  readonly warnings: readonly ImportWarning[];
  readonly statistics: ImportStatistics;
}

export interface ImportMutationContext {
  readonly actorUserId: string;
  readonly requestId: string;
  readonly traceId: string;
}

export interface CreatePasteImportInput {
  readonly ownerUserId: string;
  readonly accountId: string | null;
  readonly contentType: string;
  readonly layoutStrength: "light" | "standard" | "strong";
  readonly parsed: ParsedPasteImport;
  readonly context: ImportMutationContext;
}

export interface ImportStructureRecord {
  readonly articleId: string;
  readonly sourceDocumentId: string;
  readonly title: string;
  readonly accountId: string | null;
  readonly status: string;
  readonly documentId: string;
  readonly documentVersion: number;
  readonly lastTransactionId: string | null;
  readonly lastSavedAt: Date;
  readonly detectedSource: DetectedImportSource;
  readonly cleaningMode: ImportCleaningMode;
  readonly originalText: string;
  readonly blocks: readonly ImportBlock[];
  readonly warnings: readonly ImportWarning[];
  readonly statistics: ImportStatistics;
}

export interface ConfirmImportBlockInput {
  readonly sourceBlockId: string;
  readonly role: ImportBlockRole;
}

export interface ConfirmImportInput {
  readonly ownerUserId: string;
  readonly articleId: string;
  readonly title: string | null;
  readonly baseVersion: number;
  readonly lastTransactionId: string;
  readonly blocks: readonly ConfirmImportBlockInput[];
  readonly context: ImportMutationContext;
}

export type ConfirmImportResult =
  | {
      readonly kind: "confirmed";
      readonly record: ImportStructureRecord;
      readonly snapshotId: string;
      readonly snapshotNumber: number;
    }
  | {
      readonly kind: "conflict";
      readonly currentVersion: number;
      readonly lastTransactionId: string | null;
      readonly lastSavedAt: Date;
    }
  | { readonly kind: "invalid_state" }
  | { readonly kind: "not_found" };

export interface ImportRepository {
  createPaste(input: CreatePasteImportInput): Promise<ImportStructureRecord>;
  findStructure(ownerUserId: string, articleId: string): Promise<ImportStructureRecord | null>;
  confirm(input: ConfirmImportInput): Promise<ConfirmImportResult>;
}

export interface BuildImportedDocumentInput {
  readonly documentId: string;
  readonly articleId: string;
  readonly accountId: string | null;
  readonly documentSourceType: "html" | "plainText";
  readonly originalTextHash: string;
  readonly blocks: readonly ImportBlock[];
  readonly now: Date;
}

export type ImportedDocument = DocumentV1;
