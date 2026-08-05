import {
  articleResources,
  createUuidV7,
  isUuidV7,
  resources,
  type DatabaseConnection,
} from "@wechat-layout/database";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import {
  collectDocumentResourceReferences,
  type DocumentResourceReference,
} from "./document-resource-references.js";

type Transaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

export interface ValidatedDocumentResources {
  readonly references: readonly DocumentResourceReference[];
}

export type ValidateDocumentResourcesResult =
  | { readonly kind: "validated"; readonly value: ValidatedDocumentResources }
  | {
      readonly kind: "invalid_resources";
      readonly invalidReferences: readonly DocumentResourceReference[];
    };

export type ValidateDocumentsResourcesResult =
  | { readonly kind: "validated"; readonly values: readonly ValidatedDocumentResources[] }
  | {
      readonly kind: "invalid_resources";
      readonly invalidReferences: readonly DocumentResourceReference[];
    };

function referenceKey(reference: {
  readonly blockId: string | null;
  readonly resourceId: string;
  readonly usageType: string;
}): string {
  return `${reference.resourceId}\u0000${reference.blockId ?? ""}\u0000${reference.usageType}`;
}

function uniqueReferences(
  references: readonly DocumentResourceReference[],
): DocumentResourceReference[] {
  return [...new Map(references.map((reference) => [referenceKey(reference), reference])).values()];
}

/** Locks every referenced resource so validation remains true until the caller commits. */
export async function validateDocumentResources(
  transaction: Transaction,
  input: {
    readonly document: DocumentV1;
    readonly ownerUserId: string;
  },
): Promise<ValidateDocumentResourcesResult> {
  const result = await validateDocumentsResources(transaction, {
    documents: [input.document],
    ownerUserId: input.ownerUserId,
  });
  if (result.kind === "invalid_resources") {
    return result;
  }
  return { kind: "validated", value: result.values[0] ?? { references: [] } };
}

/** Validates several documents with one deterministically ordered resource lock set. */
export async function validateDocumentsResources(
  transaction: Transaction,
  input: {
    readonly documents: readonly DocumentV1[];
    readonly ownerUserId: string;
  },
): Promise<ValidateDocumentsResourcesResult> {
  const values = input.documents.map((document) => ({
    references: uniqueReferences(collectDocumentResourceReferences(document)),
  }));
  const allReferences = uniqueReferences(values.flatMap(({ references }) => references));
  if (allReferences.length === 0) {
    return { kind: "validated", values };
  }

  const uniqueResourceIds = [...new Set(allReferences.map(({ resourceId }) => resourceId))];
  const syntacticallyInvalid = new Set(
    uniqueResourceIds.filter((resourceId) => !isUuidV7(resourceId)),
  );
  const validResourceIds = uniqueResourceIds.filter((resourceId) => isUuidV7(resourceId));
  const availableRows =
    validResourceIds.length === 0
      ? []
      : await transaction
          .select({ id: resources.id })
          .from(resources)
          .where(
            and(
              inArray(resources.id, validResourceIds),
              eq(resources.ownerUserId, input.ownerUserId),
              eq(resources.status, "active"),
              isNull(resources.deletedAt),
            ),
          )
          .orderBy(asc(resources.id))
          .for("update");
  const availableResourceIds = new Set(availableRows.map(({ id }) => id));
  const invalidResourceIds = new Set([
    ...syntacticallyInvalid,
    ...validResourceIds.filter((resourceId) => !availableResourceIds.has(resourceId)),
  ]);
  if (invalidResourceIds.size > 0) {
    return {
      kind: "invalid_resources",
      invalidReferences: allReferences.filter(({ resourceId }) =>
        invalidResourceIds.has(resourceId),
      ),
    };
  }

  return { kind: "validated", values };
}

/** Reconciles only the current document rows; snapshot-frozen rows remain immutable. */
export async function replaceActiveDocumentResources(
  transaction: Transaction,
  input: {
    readonly articleId: string;
    readonly resources: ValidatedDocumentResources;
    readonly replacedAt: Date;
  },
): Promise<void> {
  const existingRows = await transaction
    .select({
      id: articleResources.id,
      blockId: articleResources.blockId,
      resourceId: articleResources.resourceId,
      sortOrder: articleResources.sortOrder,
      usageType: articleResources.usageType,
    })
    .from(articleResources)
    .where(
      and(
        eq(articleResources.articleId, input.articleId),
        isNull(articleResources.frozenBySnapshotId),
        isNull(articleResources.deletedAt),
      ),
    )
    .for("update");
  const desiredByKey = new Map(
    input.resources.references.map((reference) => [referenceKey(reference), reference]),
  );
  const retainedKeys = new Set<string>();
  const staleIds: string[] = [];

  for (const existing of existingRows) {
    const key = referenceKey(existing);
    const desired = desiredByKey.get(key);
    if (desired === undefined || retainedKeys.has(key)) {
      staleIds.push(existing.id);
      continue;
    }
    retainedKeys.add(key);
    if (existing.sortOrder !== desired.sortOrder) {
      await transaction
        .update(articleResources)
        .set({ sortOrder: desired.sortOrder })
        .where(eq(articleResources.id, existing.id));
    }
  }

  if (staleIds.length > 0) {
    await transaction
      .update(articleResources)
      .set({ deletedAt: input.replacedAt })
      .where(inArray(articleResources.id, staleIds));
  }

  const missing = input.resources.references.filter(
    (reference) => !retainedKeys.has(referenceKey(reference)),
  );
  if (missing.length > 0) {
    await transaction.insert(articleResources).values(
      missing.map((reference) => ({
        id: createUuidV7(),
        articleId: input.articleId,
        resourceId: reference.resourceId,
        blockId: reference.blockId,
        usageType: reference.usageType,
        sortOrder: reference.sortOrder,
      })),
    );
  }
}

/** Adds immutable resource protection for one snapshot. */
export async function freezeSnapshotDocumentResources(
  transaction: Transaction,
  input: {
    readonly articleId: string;
    readonly resources: ValidatedDocumentResources;
    readonly snapshotId: string;
  },
): Promise<void> {
  if (input.resources.references.length === 0) {
    return;
  }
  const existingRows = await transaction
    .select({
      blockId: articleResources.blockId,
      resourceId: articleResources.resourceId,
      usageType: articleResources.usageType,
    })
    .from(articleResources)
    .where(
      and(
        eq(articleResources.articleId, input.articleId),
        eq(articleResources.frozenBySnapshotId, input.snapshotId),
        isNull(articleResources.deletedAt),
      ),
    );
  const existingKeys = new Set(existingRows.map(referenceKey));
  const missing = input.resources.references.filter(
    (reference) => !existingKeys.has(referenceKey(reference)),
  );
  if (missing.length === 0) {
    return;
  }

  await transaction.insert(articleResources).values(
    missing.map((reference) => ({
      id: createUuidV7(),
      articleId: input.articleId,
      resourceId: reference.resourceId,
      blockId: reference.blockId,
      usageType: reference.usageType,
      sortOrder: reference.sortOrder,
      frozenBySnapshotId: input.snapshotId,
    })),
  );
}
