import type { RequestContext } from "../common/http/request-context.js";
import type {
  RESOURCE_ACCESS_PURPOSES,
  RESOURCE_ACCESS_VARIANTS,
  RESOURCE_IMAGE_MIME_TYPES,
} from "./resource.constants.js";

export type ResourceImageMimeType = (typeof RESOURCE_IMAGE_MIME_TYPES)[number];
export type ResourceAccessPurpose = (typeof RESOURCE_ACCESS_PURPOSES)[number];
export type ResourceAccessVariant = (typeof RESOURCE_ACCESS_VARIANTS)[number];

export interface ResourceRuntimeOptions {
  readonly maximumImageBytes: number;
}

export interface ResourceThumbnailMetadata {
  readonly storageKey: string;
  readonly mimeType: "image/webp";
  readonly fileSize: number;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface ResourceMetadata {
  readonly thumbnail?: ResourceThumbnailMetadata;
  readonly pages?: number;
}

export interface ResourceRecord {
  readonly id: string;
  readonly ownerUserId: string;
  readonly accountId: string | null;
  readonly resourceType: string;
  readonly sourceType: string;
  readonly originalFilename: string | null;
  readonly storageProvider: string;
  readonly storageBucket: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly fileExtension: string | null;
  readonly fileSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly sha256: string;
  readonly status: string;
  readonly isPrivate: boolean;
  readonly metadata: ResourceMetadata;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly purgeAfter: Date | null;
}

export interface UploadSession {
  readonly id: string;
  readonly ownerUserId: string;
  readonly accountId: string | null;
  readonly filename: string;
  readonly mimeType: ResourceImageMimeType;
  readonly fileSize: number;
  readonly sha256: string;
  readonly objectKey: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface UploadSessionStore {
  save(session: UploadSession, ttlSeconds: number): Promise<void>;
  find(uploadId: string): Promise<UploadSession | null>;
  delete(uploadId: string): Promise<void>;
}

export interface CreateValidatedResourceInput {
  readonly ownerUserId: string;
  readonly accountId: string | null;
  readonly filename: string;
  readonly storageProvider: string;
  readonly storageBucket: string;
  readonly storageKey: string;
  readonly mimeType: ResourceImageMimeType;
  readonly fileExtension: string;
  readonly fileSize: number;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly metadata: ResourceMetadata;
  readonly context: RequestContext & { readonly actorUserId: string };
}

export interface ResourceReference {
  readonly kind: "article" | "source_document" | "avatar" | "derived_resource";
  readonly id: string;
  readonly label: string;
  readonly usageType: string | null;
  readonly blockId: string | null;
}

export type TrashResourceResult =
  | { readonly kind: "trashed"; readonly resource: ResourceRecord }
  | { readonly kind: "in_use"; readonly references: readonly ResourceReference[] }
  | { readonly kind: "not_found" };

export interface ResourceRepository {
  findActiveByOwnerHash(ownerUserId: string, sha256: string): Promise<ResourceRecord | null>;
  findOwnedById(ownerUserId: string, resourceId: string): Promise<ResourceRecord | null>;
  createValidated(input: CreateValidatedResourceInput): Promise<ResourceRecord>;
  listReferences(
    ownerUserId: string,
    resourceId: string,
  ): Promise<readonly ResourceReference[] | null>;
  trashIfUnreferenced(
    ownerUserId: string,
    resourceId: string,
    context: RequestContext & { readonly actorUserId: string },
  ): Promise<TrashResourceResult>;
}

export interface InspectedImage {
  readonly mimeType: ResourceImageMimeType;
  readonly extension: string;
  readonly width: number;
  readonly height: number;
  readonly pages: number | undefined;
  readonly thumbnail: Readonly<{
    bytes: Uint8Array;
    width: number;
    height: number;
    sha256: string;
  }>;
}
