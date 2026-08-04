import type { ImportCleaningMode, ImportMutationContext } from "./import.types.js";

export interface CreatePendingWebpageImportInput {
  readonly ownerUserId: string;
  readonly url: string;
  readonly accountId: string | null;
  readonly contentType: string;
  readonly layoutStrength: "light" | "standard" | "strong";
  readonly cleaningMode: ImportCleaningMode;
  readonly context: ImportMutationContext;
}

export interface PendingWebpageImport {
  readonly articleId: string;
  readonly sourceDocumentId: string;
}

export interface WebpageImportRepository {
  createPending(input: CreatePendingWebpageImportInput): Promise<PendingWebpageImport>;
  attachJob(sourceDocumentId: string, jobId: string): Promise<void>;
  markEnqueueFailed(articleId: string, context: ImportMutationContext): Promise<void>;
}
