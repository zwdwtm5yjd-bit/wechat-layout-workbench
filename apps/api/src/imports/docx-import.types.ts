import type { ImportCleaningMode, ImportMutationContext } from "./import.types.js";

export interface CreatePendingDocxImportInput {
  readonly ownerUserId: string;
  readonly resourceId: string;
  readonly accountId: string | null;
  readonly contentType: string;
  readonly layoutStrength: "light" | "standard" | "strong";
  readonly cleaningMode: ImportCleaningMode;
  readonly context: ImportMutationContext;
}

export type CreatePendingDocxImportResult =
  | {
      readonly kind: "created";
      readonly articleId: string;
      readonly sourceDocumentId: string;
      readonly resourceSha256: string;
    }
  | { readonly kind: "resource_not_found" }
  | { readonly kind: "resource_invalid" };

export interface DocxImportRepository {
  createPending(input: CreatePendingDocxImportInput): Promise<CreatePendingDocxImportResult>;
  attachJob(sourceDocumentId: string, jobId: string): Promise<void>;
  markEnqueueFailed(articleId: string, context: ImportMutationContext): Promise<void>;
}
