export type WebpageBlockRole =
  | "title"
  | "subtitle"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "paragraph"
  | "quote"
  | "bullet_item"
  | "ordered_item"
  | "image_reference"
  | "excluded";

export type WebpageWarningCode =
  | "SECURITY_CONTENT_REMOVED"
  | "HIDDEN_CONTENT_REMOVED"
  | "UNSAFE_LINK_REMOVED"
  | "STYLE_CLEANED"
  | "UNSUPPORTED_STRUCTURE_FLATTENED"
  | "EXTERNAL_IMAGE_REFERENCE"
  | "EMPTY_CONTENT_SKIPPED";

export interface WebpageWarning {
  readonly code: WebpageWarningCode;
  readonly severity: "info" | "warning";
  readonly message: string;
  readonly count: number;
}

export interface WebpageBlock {
  readonly sourceBlockId: string;
  readonly sourceType: string;
  readonly role: WebpageBlockRole;
  readonly text: string;
  readonly textHash: string;
  readonly orderIndex: number;
  readonly styleMetadata: Readonly<Record<string, unknown>>;
  readonly relationMetadata: Readonly<Record<string, unknown>>;
}

export interface WebpageStatistics {
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

export interface ParsedWebpage {
  readonly schemaVersion: "1.0.0";
  readonly parserVersion: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly byline: string | null;
  readonly excerpt: string | null;
  readonly siteName: string | null;
  readonly language: string | null;
  readonly originalText: string;
  readonly originalTextHash: string;
  readonly sanitizedHtml: string;
  readonly sanitizedHtmlHash: string;
  readonly sourceBlocks: readonly WebpageBlock[];
  readonly warnings: readonly WebpageWarning[];
  readonly statistics: WebpageStatistics;
}

export interface SafeFetchResult {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string;
  readonly bytes: Uint8Array;
  readonly redirects: readonly string[];
}
