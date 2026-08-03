import { Inject, Injectable } from "@nestjs/common";
import {
  articleDocuments,
  articleSnapshots,
  articles,
  articleStatusHistory,
  auditLogs,
  createUuidV7,
  sourceBlocks,
  sourceDocuments,
  type DatabaseConnection,
} from "@wechat-layout/database";
import { DOCUMENT_SCHEMA_VERSION, validateDocument } from "@wechat-layout/document-schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import {
  freezeSnapshotDocumentResources,
  replaceActiveDocumentResources,
  validateDocumentResources,
} from "../documents/postgres-document-resources.js";
import { statisticsForDocument } from "../documents/document-statistics.js";
import { buildSnapshotManifests } from "../snapshots/snapshot-manifest.js";
import { buildImportedDocument } from "./paste-parser.js";
import type {
  ConfirmImportInput,
  ConfirmImportResult,
  CreatePasteImportInput,
  DetectedImportSource,
  ImportBlock,
  ImportBlockRole,
  ImportCleaningMode,
  ImportRepository,
  ImportStatistics,
  ImportStructureRecord,
  ImportWarning,
} from "./import.types.js";

type JsonObject = Record<string, unknown>;
type JsonValue = JsonObject | readonly unknown[];
type Transaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];
type Executor = DatabaseConnection["db"] | Transaction;

type ArticleRow = {
  readonly id: string;
  readonly accountId: string | null;
  readonly title: string;
  readonly sourceType: string;
  readonly status: string;
  readonly themeId: string | null;
  readonly themeVersion: string | null;
  readonly brandVersionId: string | null;
  readonly compatibilityScore: number | null;
};

type DocumentRow = {
  readonly id: string;
  readonly documentVersion: number;
  readonly lastTransactionId: string | null;
  readonly lastSavedAt: Date;
};

type SourceDocumentRow = {
  readonly id: string;
  readonly originalText: string | null;
  readonly originalTextHash: string | null;
  readonly sourceMetadata: JsonObject;
};

type SourceBlockRow = {
  readonly id: string;
  readonly sourceBlockId: string;
  readonly blockType: string;
  readonly textContent: string | null;
  readonly textHash: string | null;
  readonly orderIndex: number;
  readonly styleMetadata: JsonObject;
  readonly relationMetadata: JsonObject;
};

const articleSelection = {
  id: articles.id,
  accountId: articles.accountId,
  title: articles.title,
  sourceType: articles.sourceType,
  status: articles.status,
  themeId: articles.themeId,
  themeVersion: articles.themeVersion,
  brandVersionId: articles.brandVersionId,
  compatibilityScore: articles.compatibilityScore,
};

const documentSelection = {
  id: articleDocuments.id,
  documentVersion: articleDocuments.documentVersion,
  lastTransactionId: articleDocuments.lastTransactionId,
  lastSavedAt: articleDocuments.lastSavedAt,
};

const sourceDocumentSelection = {
  id: sourceDocuments.id,
  originalText: sourceDocuments.originalText,
  originalTextHash: sourceDocuments.originalTextHash,
  sourceMetadata: sourceDocuments.sourceMetadata,
};

const sourceBlockSelection = {
  id: sourceBlocks.id,
  sourceBlockId: sourceBlocks.sourceBlockId,
  blockType: sourceBlocks.blockType,
  textContent: sourceBlocks.textContent,
  textHash: sourceBlocks.textHash,
  orderIndex: sourceBlocks.orderIndex,
  styleMetadata: sourceBlocks.styleMetadata,
  relationMetadata: sourceBlocks.relationMetadata,
};

function metadata<T>(value: JsonObject, key: string, fallback: T): T {
  return (value[key] as T | undefined) ?? fallback;
}

function emptyStatistics(blockCount: number): ImportStatistics {
  return {
    wordCount: 0,
    characterCount: 0,
    blockCount,
    headingCount: 0,
    imageCount: 0,
    tableCount: 0,
    removedStyleCount: 0,
    removedSecurityNodeCount: 0,
    removedHiddenNodeCount: 0,
    removedUnsafeLinkCount: 0,
  };
}

function toBlock(row: SourceBlockRow): ImportBlock {
  return {
    sourceBlockId: row.sourceBlockId,
    role: row.blockType as ImportBlockRole,
    text: row.textContent ?? "",
    textHash: row.textHash ?? "",
    orderIndex: row.orderIndex,
    styleMetadata: row.styleMetadata as ImportBlock["styleMetadata"],
    relationMetadata: row.relationMetadata as ImportBlock["relationMetadata"],
  };
}

function toStructureRecord(
  article: ArticleRow,
  document: DocumentRow,
  sourceDocument: SourceDocumentRow,
  blockRows: readonly SourceBlockRow[],
): ImportStructureRecord {
  const sourceMetadata = sourceDocument.sourceMetadata;
  return {
    articleId: article.id,
    sourceDocumentId: sourceDocument.id,
    title: article.title,
    accountId: article.accountId,
    status: article.status,
    documentId: document.id,
    documentVersion: document.documentVersion,
    lastTransactionId: document.lastTransactionId,
    lastSavedAt: document.lastSavedAt,
    detectedSource: metadata<DetectedImportSource>(sourceMetadata, "detectedSource", "plain_text"),
    cleaningMode: metadata<ImportCleaningMode>(
      sourceMetadata,
      "cleaningMode",
      "preserve_structure",
    ),
    originalText: sourceDocument.originalText ?? "",
    blocks: blockRows.map(toBlock),
    warnings: metadata<readonly ImportWarning[]>(sourceMetadata, "warnings", []),
    statistics: metadata<ImportStatistics>(
      sourceMetadata,
      "statistics",
      emptyStatistics(blockRows.length),
    ),
  };
}

function importSourceMetadata(input: CreatePasteImportInput): JsonObject {
  return {
    detectedSource: input.parsed.detectedSource,
    cleaningMode: input.parsed.cleaningMode,
    documentSourceType: input.parsed.documentSourceType,
    warnings: input.parsed.warnings,
    statistics: input.parsed.statistics,
  };
}

function importAuditSummary(record: ImportStructureRecord): JsonObject {
  return {
    articleId: record.articleId,
    sourceDocumentId: record.sourceDocumentId,
    detectedSource: record.detectedSource,
    cleaningMode: record.cleaningMode,
    documentVersion: record.documentVersion,
    blockCount: record.statistics.blockCount,
    wordCount: record.statistics.wordCount,
    imageCount: record.statistics.imageCount,
    warningCount: record.warnings.length,
  };
}

function rolesMatch(
  blockRows: readonly SourceBlockRow[],
  requested: ReadonlyMap<string, ImportBlockRole>,
): boolean {
  return (
    requested.size === blockRows.length &&
    blockRows.every((block) => requested.get(block.sourceBlockId) === block.blockType)
  );
}

function importedImageCount(blocks: readonly ImportBlock[]): number {
  return blocks.filter((block) => block.role === "image_reference").length;
}

@Injectable()
export class PostgresImportRepository implements ImportRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async createPaste(input: CreatePasteImportInput): Promise<ImportStructureRecord> {
    return this.connection.db.transaction(async (transaction) => {
      const now = new Date();
      const articleId = createUuidV7();
      const documentId = createUuidV7();
      const sourceDocumentId = createUuidV7();
      const document = buildImportedDocument({
        documentId,
        articleId,
        accountId: input.accountId,
        documentSourceType: input.parsed.documentSourceType,
        originalTextHash: input.parsed.originalTextHash,
        blocks: input.parsed.blocks,
        now,
      });
      const documentStatistics = statisticsForDocument(document);

      const [article] = await transaction
        .insert(articles)
        .values({
          id: articleId,
          ownerUserId: input.ownerUserId,
          accountId: input.accountId,
          title: input.parsed.title,
          contentType: input.contentType,
          sourceType: "paste",
          status: "pending_recognition",
          layoutStrength: input.layoutStrength,
          textLocked: true,
          wordCount: input.parsed.statistics.wordCount,
          imageCount: input.parsed.statistics.imageCount,
          svgCount: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning(articleSelection);
      if (article === undefined) {
        throw new Error("粘贴导入文章创建失败");
      }

      const [documentRow] = await transaction
        .insert(articleDocuments)
        .values({
          id: documentId,
          articleId,
          schemaVersion: DOCUMENT_SCHEMA_VERSION,
          documentJson: document as unknown as JsonObject,
          documentVersion: 1,
          originalTextHash: input.parsed.originalTextHash,
          currentTextHash: documentStatistics.currentTextHash,
          lastSavedBy: input.context.actorUserId,
          lastSavedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning(documentSelection);
      if (documentRow === undefined) {
        throw new Error("粘贴导入文档创建失败");
      }
      const initialResources = await validateDocumentResources(transaction, {
        document,
        ownerUserId: input.ownerUserId,
      });
      if (initialResources.kind === "invalid_resources") {
        throw new Error("粘贴导入生成了不可用的资源引用");
      }
      await replaceActiveDocumentResources(transaction, {
        articleId,
        resources: initialResources.value,
        replacedAt: now,
      });

      const [sourceDocument] = await transaction
        .insert(sourceDocuments)
        .values({
          id: sourceDocumentId,
          articleId,
          sourceType: "paste",
          originalText: input.parsed.originalText,
          originalTextHash: input.parsed.originalTextHash,
          sourceMetadata: importSourceMetadata(input),
          isPrimary: true,
          createdAt: now,
        })
        .returning(sourceDocumentSelection);
      if (sourceDocument === undefined) {
        throw new Error("粘贴导入原文创建失败");
      }

      const blockRows =
        input.parsed.blocks.length === 0
          ? []
          : await transaction
              .insert(sourceBlocks)
              .values(
                input.parsed.blocks.map((block) => ({
                  id: createUuidV7(),
                  sourceDocumentId,
                  sourceBlockId: block.sourceBlockId,
                  blockType: block.role,
                  textContent: block.text,
                  textHash: block.textHash,
                  orderIndex: block.orderIndex,
                  styleMetadata: block.styleMetadata as JsonObject,
                  relationMetadata: block.relationMetadata as JsonObject,
                  createdAt: now,
                })),
              )
              .returning(sourceBlockSelection);

      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId,
        fromStatus: null,
        toStatus: "pending_recognition",
        reason: "paste_import_created",
        source: "import",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      const record = toStructureRecord(article, documentRow, sourceDocument, blockRows);
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.import.paste.create",
        targetType: "source_document",
        targetId: sourceDocumentId,
        accountId: input.accountId,
        articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: null,
        afterSummary: importAuditSummary(record),
        metadataJson: {},
      });
      return record;
    });
  }

  async findStructure(
    ownerUserId: string,
    articleId: string,
  ): Promise<ImportStructureRecord | null> {
    const base = await this.loadBase(this.connection.db, ownerUserId, articleId, false);
    if (base === null) {
      return null;
    }
    const blockRows = await this.connection.db
      .select(sourceBlockSelection)
      .from(sourceBlocks)
      .where(eq(sourceBlocks.sourceDocumentId, base.sourceDocument.id))
      .orderBy(asc(sourceBlocks.orderIndex));
    return toStructureRecord(base.article, base.document, base.sourceDocument, blockRows);
  }

  async confirm(input: ConfirmImportInput): Promise<ConfirmImportResult> {
    return this.connection.db.transaction(async (transaction) => {
      const base = await this.loadBase(transaction, input.ownerUserId, input.articleId, true);
      if (base === null) {
        return { kind: "not_found" };
      }
      const blockRows = await transaction
        .select(sourceBlockSelection)
        .from(sourceBlocks)
        .where(eq(sourceBlocks.sourceDocumentId, base.sourceDocument.id))
        .orderBy(asc(sourceBlocks.orderIndex))
        .for("update");
      const requestedRoles = new Map(
        input.blocks.map((block) => [block.sourceBlockId, block.role] as const),
      );

      if (base.document.documentVersion !== input.baseVersion) {
        const replay =
          base.document.documentVersion === input.baseVersion + 1 &&
          base.document.lastTransactionId === input.lastTransactionId &&
          base.article.status === "pending_layout" &&
          rolesMatch(blockRows, requestedRoles) &&
          (input.title === null || base.article.title === input.title);
        if (replay) {
          const [snapshot] = await transaction
            .select({
              id: articleSnapshots.id,
              snapshotNumber: articleSnapshots.snapshotNumber,
            })
            .from(articleSnapshots)
            .where(
              and(
                eq(articleSnapshots.articleId, input.articleId),
                eq(articleSnapshots.reason, "after_import"),
              ),
            )
            .orderBy(desc(articleSnapshots.snapshotNumber))
            .limit(1);
          if (snapshot === undefined) {
            throw new Error("导入确认事务已提交但快照不存在");
          }
          return {
            kind: "confirmed",
            record: toStructureRecord(base.article, base.document, base.sourceDocument, blockRows),
            snapshotId: snapshot.id,
            snapshotNumber: snapshot.snapshotNumber,
          };
        }
        return {
          kind: "conflict",
          currentVersion: base.document.documentVersion,
          lastTransactionId: base.document.lastTransactionId,
          lastSavedAt: base.document.lastSavedAt,
        };
      }
      if (base.article.status !== "pending_recognition") {
        return { kind: "invalid_state" };
      }
      if (
        requestedRoles.size !== blockRows.length ||
        blockRows.some((block) => !requestedRoles.has(block.sourceBlockId))
      ) {
        return { kind: "invalid_state" };
      }

      const confirmedBlocks = blockRows.map((block) =>
        toBlock({
          ...block,
          blockType: requestedRoles.get(block.sourceBlockId) ?? block.blockType,
        }),
      );
      const sourceMetadata = base.sourceDocument.sourceMetadata;
      const documentSourceType = metadata<"html" | "plainText">(
        sourceMetadata,
        "documentSourceType",
        "plainText",
      );
      const now = new Date();
      const document = buildImportedDocument({
        documentId: base.document.id,
        articleId: input.articleId,
        accountId: base.article.accountId,
        documentSourceType,
        originalTextHash: base.sourceDocument.originalTextHash ?? "",
        blocks: confirmedBlocks,
        now,
      });
      const validation = validateDocument(document);
      if (!validation.success) {
        throw new Error("导入确认生成了无效 Document Schema V1 文档");
      }
      const documentStatistics = statisticsForDocument(validation.data);
      const validatedResources = await validateDocumentResources(transaction, {
        document: validation.data,
        ownerUserId: input.ownerUserId,
      });
      if (validatedResources.kind === "invalid_resources") {
        throw new Error("导入确认生成了不可用的资源引用");
      }
      const [updatedDocument] = await transaction
        .update(articleDocuments)
        .set({
          documentJson: validation.data as unknown as JsonObject,
          documentVersion: input.baseVersion + 1,
          currentTextHash: documentStatistics.currentTextHash,
          lastTransactionId: input.lastTransactionId,
          lastSavedBy: input.context.actorUserId,
          lastSavedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(articleDocuments.id, base.document.id),
            eq(articleDocuments.documentVersion, input.baseVersion),
          ),
        )
        .returning(documentSelection);
      if (updatedDocument === undefined) {
        throw new Error("导入确认乐观锁在持有文档行锁后异常失败");
      }
      await replaceActiveDocumentResources(transaction, {
        articleId: input.articleId,
        resources: validatedResources.value,
        replacedAt: now,
      });

      for (const block of blockRows) {
        const role = requestedRoles.get(block.sourceBlockId);
        if (role === undefined || role === block.blockType) {
          continue;
        }
        await transaction
          .update(sourceBlocks)
          .set({ blockType: role })
          .where(eq(sourceBlocks.id, block.id));
      }

      const [latestSnapshot] = await transaction
        .select({ snapshotNumber: articleSnapshots.snapshotNumber })
        .from(articleSnapshots)
        .where(eq(articleSnapshots.articleId, input.articleId))
        .orderBy(desc(articleSnapshots.snapshotNumber))
        .limit(1);
      const snapshotId = createUuidV7();
      const snapshotNumber = (latestSnapshot?.snapshotNumber ?? 0) + 1;
      const manifests = buildSnapshotManifests(validation.data, base.article);
      await transaction.insert(articleSnapshots).values({
        id: snapshotId,
        articleId: input.articleId,
        snapshotNumber,
        reason: "after_import",
        documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
        documentJson: validation.data as unknown as JsonObject,
        themeId: base.article.themeId,
        themeVersion: base.article.themeVersion,
        brandVersionId: base.article.brandVersionId,
        resourceManifest: manifests.resourceManifest as unknown as JsonValue,
        packageManifest: manifests.packageManifest as unknown as JsonValue,
        textHash: documentStatistics.currentTextHash,
        compatibilityScore: base.article.compatibilityScore,
        note: "粘贴导入与结构确认完成",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      await freezeSnapshotDocumentResources(transaction, {
        articleId: input.articleId,
        resources: validatedResources.value,
        snapshotId,
      });

      const title =
        input.title ??
        confirmedBlocks.find((block) => block.role === "title")?.text.slice(0, 500) ??
        base.article.title;
      const parsedStatistics = metadata<ImportStatistics>(
        sourceMetadata,
        "statistics",
        emptyStatistics(confirmedBlocks.length),
      );
      const [updatedArticle] = await transaction
        .update(articles)
        .set({
          title,
          status: "pending_layout",
          wordCount: parsedStatistics.wordCount,
          imageCount: importedImageCount(confirmedBlocks),
          svgCount: 0,
          currentSnapshotId: snapshotId,
          updatedAt: now,
        })
        .where(eq(articles.id, input.articleId))
        .returning(articleSelection);
      if (updatedArticle === undefined) {
        throw new Error("导入确认文章更新失败");
      }

      await transaction.insert(articleStatusHistory).values({
        id: createUuidV7(),
        articleId: input.articleId,
        fromStatus: "pending_recognition",
        toStatus: "pending_layout",
        reason: "paste_structure_confirmed",
        source: "import",
        createdBy: input.context.actorUserId,
        createdAt: now,
      });
      await transaction.insert(auditLogs).values([
        {
          id: createUuidV7(),
          actorUserId: input.context.actorUserId,
          actorType: "user",
          action: "article.import.structure.confirm",
          targetType: "source_document",
          targetId: base.sourceDocument.id,
          accountId: base.article.accountId,
          articleId: input.articleId,
          requestId: input.context.requestId,
          traceId: input.context.traceId,
          beforeSummary: {
            status: base.article.status,
            documentVersion: base.document.documentVersion,
          },
          afterSummary: {
            status: updatedArticle.status,
            documentVersion: updatedDocument.documentVersion,
            includedBlockCount: confirmedBlocks.filter((block) => block.role !== "excluded").length,
            excludedBlockCount: confirmedBlocks.filter((block) => block.role === "excluded").length,
          },
          metadataJson: {
            lastTransactionId: input.lastTransactionId,
          },
        },
        {
          id: createUuidV7(),
          actorUserId: input.context.actorUserId,
          actorType: "user",
          action: "article.snapshot.create",
          targetType: "article_snapshot",
          targetId: snapshotId,
          accountId: base.article.accountId,
          articleId: input.articleId,
          requestId: input.context.requestId,
          traceId: input.context.traceId,
          beforeSummary: null,
          afterSummary: {
            snapshotId,
            snapshotNumber,
            reason: "after_import",
            documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
            textHash: documentStatistics.currentTextHash,
          },
          metadataJson: {},
        },
      ]);

      return {
        kind: "confirmed",
        record: toStructureRecord(
          updatedArticle,
          updatedDocument,
          base.sourceDocument,
          confirmedBlocks.map((block, index) => ({
            id: blockRows[index]?.id ?? createUuidV7(),
            sourceBlockId: block.sourceBlockId,
            blockType: block.role,
            textContent: block.text,
            textHash: block.textHash,
            orderIndex: block.orderIndex,
            styleMetadata: block.styleMetadata as JsonObject,
            relationMetadata: block.relationMetadata as JsonObject,
          })),
        ),
        snapshotId,
        snapshotNumber,
      };
    });
  }

  private async loadBase(
    executor: Executor,
    ownerUserId: string,
    articleId: string,
    lock: boolean,
  ): Promise<{
    readonly article: ArticleRow;
    readonly document: DocumentRow;
    readonly sourceDocument: SourceDocumentRow;
  } | null> {
    const articleQuery = executor
      .select(articleSelection)
      .from(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.ownerUserId, ownerUserId),
          eq(articles.sourceType, "paste"),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);
    const [article] = lock ? await articleQuery.for("update") : await articleQuery;
    if (article === undefined) {
      return null;
    }

    const documentQuery = executor
      .select(documentSelection)
      .from(articleDocuments)
      .where(eq(articleDocuments.articleId, articleId))
      .limit(1);
    const [document] = lock ? await documentQuery.for("update") : await documentQuery;
    if (document === undefined) {
      return null;
    }

    const sourceQuery = executor
      .select(sourceDocumentSelection)
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.articleId, articleId),
          eq(sourceDocuments.sourceType, "paste"),
          eq(sourceDocuments.isPrimary, true),
        ),
      )
      .limit(1);
    const [sourceDocument] = lock ? await sourceQuery.for("update") : await sourceQuery;
    if (sourceDocument === undefined) {
      return null;
    }
    return { article, document, sourceDocument };
  }
}
