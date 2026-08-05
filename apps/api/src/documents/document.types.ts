import type { DocumentV1 } from "@wechat-layout/document-schema";

import type { DocumentResourceReference } from "./document-resource-references.js";

export interface ArticleDocumentSourceBlock {
  readonly blockType: string;
  readonly orderIndex: number;
  readonly sourceBlockId: string;
  readonly text: string;
  readonly textHash: string | null;
}

export interface ArticleDocumentRecord {
  readonly id: string;
  readonly articleId: string;
  readonly accountId: string | null;
  readonly schemaVersion: string;
  readonly document: DocumentV1;
  readonly documentVersion: number;
  readonly textLocked: boolean;
  readonly originalTextHash: string | null;
  readonly currentTextHash: string | null;
  readonly lastTransactionId: string | null;
  readonly lastSavedBy: string;
  readonly lastSavedAt: Date;
  readonly sourceBlocks: readonly ArticleDocumentSourceBlock[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DocumentMutationContext {
  readonly actorUserId: string;
  readonly requestId: string;
  readonly traceId: string;
}

export interface DocumentStatistics {
  readonly currentTextHash: string;
  readonly wordCount: number;
  readonly imageCount: number;
  readonly svgCount: number;
}

export interface SaveArticleDocumentInput {
  readonly ownerUserId: string;
  readonly articleId: string;
  readonly baseVersion: number;
  readonly schemaVersion: string;
  readonly document: DocumentV1;
  readonly lastTransactionId: string;
  readonly transactionOrigin: string;
  readonly statistics: DocumentStatistics;
  readonly context: DocumentMutationContext;
}

export type SaveArticleDocumentResult =
  | {
      readonly kind: "saved" | "replayed";
      readonly record: ArticleDocumentRecord;
    }
  | {
      readonly kind: "conflict";
      readonly currentVersion: number;
      readonly lastTransactionId: string | null;
      readonly lastSavedAt: Date;
    }
  | {
      readonly kind: "not_found";
    }
  | {
      readonly kind: "invalid_resources";
      readonly invalidReferences: readonly DocumentResourceReference[];
    };

export interface ArticleDocumentRepository {
  findCurrent(ownerUserId: string, articleId: string): Promise<ArticleDocumentRecord | null>;
  save(input: SaveArticleDocumentInput): Promise<SaveArticleDocumentResult>;
}
