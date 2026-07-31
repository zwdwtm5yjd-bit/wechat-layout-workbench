import { Inject, Injectable } from "@nestjs/common";
import {
  articleDocuments,
  articleResources,
  articleSnapshots,
  articles,
  articleStatusHistory,
  auditLogs,
  copyRecords,
  createUuidV7,
  renderOutputs,
  resources,
  type DatabaseConnection,
} from "@wechat-layout/database";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import type { CompatibilityReport, WechatOutputMode } from "@wechat-layout/wechat-renderer";
import { and, desc, eq, isNull } from "drizzle-orm";

import { DATABASE_CONNECTION } from "../database/database.module.js";
import { buildSnapshotManifests } from "../snapshots/snapshot-manifest.js";
import type {
  CopyRenderSource,
  CopyRepository,
  CreateCopyRecordInput,
  CreateCopyRecordResult,
  PersistRenderOutputInput,
  PersistRenderOutputResult,
  RenderOutputRecord,
  RenderOutputStatus,
} from "./copy.types.js";

type JsonObject = Record<string, unknown>;
type JsonValue = JsonObject | readonly unknown[];
type Transaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

const outputSelection = {
  id: renderOutputs.id,
  articleId: renderOutputs.articleId,
  snapshotId: renderOutputs.snapshotId,
  mode: renderOutputs.outputMode,
  rendererVersion: renderOutputs.rendererVersion,
  ruleVersion: renderOutputs.compatibilityRuleVersion,
  html: renderOutputs.htmlContent,
  plainText: renderOutputs.plainText,
  outputHash: renderOutputs.outputSha256,
  status: renderOutputs.status,
  compatibilityReport: renderOutputs.compatibilityReport,
  generatedAt: renderOutputs.generatedAt,
  expiresAt: renderOutputs.expiresAt,
};

function toOutput(row: {
  readonly articleId: string;
  readonly compatibilityReport: JsonObject;
  readonly expiresAt: Date;
  readonly generatedAt: Date;
  readonly html: string | null;
  readonly id: string;
  readonly mode: string;
  readonly outputHash: string | null;
  readonly plainText: string | null;
  readonly rendererVersion: string;
  readonly ruleVersion: string;
  readonly snapshotId: string;
  readonly status: string;
}): RenderOutputRecord {
  return {
    ...row,
    compatibilityReport: row.compatibilityReport as unknown as CompatibilityReport,
    mode: row.mode as WechatOutputMode,
    outputHash: row.outputHash === null ? null : `sha256:${row.outputHash}`,
    status: row.status as RenderOutputStatus,
  };
}

function compatibilityLabel(report: CompatibilityReport): "excellent" | "risk" | "usable" {
  if (!report.canCopy) {
    return "risk";
  }
  return report.score >= 90 ? "excellent" : "usable";
}

function bareHash(value: string | null): string | null {
  return value?.replace(/^sha256:/, "") ?? null;
}

async function nextSnapshotNumber(transaction: Transaction, articleId: string): Promise<number> {
  const [latest] = await transaction
    .select({ snapshotNumber: articleSnapshots.snapshotNumber })
    .from(articleSnapshots)
    .where(eq(articleSnapshots.articleId, articleId))
    .orderBy(desc(articleSnapshots.snapshotNumber))
    .limit(1);
  return (latest?.snapshotNumber ?? 0) + 1;
}

@Injectable()
export class PostgresCopyRepository implements CopyRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async findRenderSource(ownerUserId: string, articleId: string): Promise<CopyRenderSource | null> {
    const [row] = await this.connection.db
      .select({
        accountId: articles.accountId,
        articleId: articles.id,
        brandVersionId: articles.brandVersionId,
        currentTextHash: articleDocuments.currentTextHash,
        document: articleDocuments.documentJson,
        documentSchemaVersion: articleDocuments.schemaVersion,
        documentVersion: articleDocuments.documentVersion,
        themeId: articles.themeId,
        themeVersion: articles.themeVersion,
      })
      .from(articles)
      .innerJoin(articleDocuments, eq(articleDocuments.articleId, articles.id))
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.ownerUserId, ownerUserId),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);
    if (row === undefined) {
      return null;
    }

    const resourceRows = await this.connection.db
      .select({
        id: resources.id,
        mimeType: resources.mimeType,
        storageKey: resources.storageKey,
      })
      .from(articleResources)
      .innerJoin(resources, eq(resources.id, articleResources.resourceId))
      .where(
        and(
          eq(articleResources.articleId, articleId),
          eq(resources.ownerUserId, ownerUserId),
          eq(resources.status, "active"),
          isNull(articleResources.deletedAt),
          isNull(resources.deletedAt),
        ),
      );
    return {
      ...row,
      document: row.document as unknown as DocumentV1,
      resources: [...new Map(resourceRows.map((resource) => [resource.id, resource])).values()],
    };
  }

  async persistRenderOutput(input: PersistRenderOutputInput): Promise<PersistRenderOutputResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [article] = await transaction
        .select({
          accountId: articles.accountId,
          brandVersionId: articles.brandVersionId,
          currentStatus: articles.status,
          id: articles.id,
          themeId: articles.themeId,
          themeVersion: articles.themeVersion,
        })
        .from(articles)
        .where(
          and(
            eq(articles.id, input.source.articleId),
            eq(articles.ownerUserId, input.ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (article === undefined) {
        return { kind: "not_found" };
      }
      const [document] = await transaction
        .select({ documentVersion: articleDocuments.documentVersion })
        .from(articleDocuments)
        .where(eq(articleDocuments.articleId, article.id))
        .limit(1)
        .for("update");
      if (document === undefined) {
        return { kind: "not_found" };
      }
      if (document.documentVersion !== input.source.documentVersion) {
        return {
          kind: "version_conflict",
          currentVersion: document.documentVersion,
        };
      }

      const snapshotId = createUuidV7();
      const outputId = createUuidV7();
      const manifests = buildSnapshotManifests(input.source.document, article);
      const outputStatus: RenderOutputStatus =
        input.renderResult === null ? "failed" : input.report.canCopy ? "ready" : "blocked";
      const outputHash = bareHash(input.renderResult?.outputHash ?? input.report.outputHash);
      const html = input.renderResult?.html ?? null;
      const plainText = input.renderResult?.plainText ?? null;

      await transaction.insert(articleSnapshots).values({
        id: snapshotId,
        articleId: article.id,
        snapshotNumber: await nextSnapshotNumber(transaction, article.id),
        reason: "before_copy",
        documentSchemaVersion: input.source.documentSchemaVersion,
        documentJson: input.source.document as unknown as JsonObject,
        themeId: article.themeId,
        themeVersion: article.themeVersion,
        brandVersionId: article.brandVersionId,
        compatibilityRuleVersion: input.report.ruleVersion,
        rendererVersion: input.report.rendererVersion,
        resourceManifest: manifests.resourceManifest as unknown as JsonValue,
        packageManifest: manifests.packageManifest as unknown as JsonValue,
        textHash: input.source.currentTextHash,
        compatibilityScore: input.report.score,
        htmlHash: outputHash,
        note: outputStatus === "ready" ? "正式复制前自动快照" : "复制兼容检查未通过",
        createdBy: input.context.actorUserId,
        createdAt: input.generatedAt,
      });
      const [inserted] = await transaction
        .insert(renderOutputs)
        .values({
          id: outputId,
          articleId: article.id,
          snapshotId,
          outputType: "wechat_html",
          outputMode: input.mode,
          rendererVersion: input.report.rendererVersion,
          compatibilityRuleVersion: input.report.ruleVersion,
          themeVersion: article.themeVersion,
          brandVersionId: article.brandVersionId,
          htmlContent: html,
          plainText,
          outputSha256: outputHash,
          sizeBytes: html === null ? 0 : Buffer.byteLength(html, "utf8"),
          status: outputStatus,
          compatibilityReport: input.report as unknown as JsonObject,
          generatedBy: input.context.actorUserId,
          generatedAt: input.generatedAt,
          expiresAt: input.expiresAt,
          errorJson:
            input.renderResult === null
              ? ({
                  code: "RENDER_FAILED",
                  issueCount: input.report.summary.critical,
                } satisfies JsonObject)
              : null,
        })
        .returning(outputSelection);
      if (inserted === undefined) {
        throw new Error("正式微信输出保存失败");
      }

      const nextArticleStatus =
        outputStatus === "ready" ? article.currentStatus : "compatibility_failed";
      await transaction
        .update(articles)
        .set({
          compatibilityScore: input.report.score,
          compatibilityStatus: compatibilityLabel(input.report),
          currentSnapshotId: snapshotId,
          status: nextArticleStatus,
          updatedAt: input.generatedAt,
        })
        .where(eq(articles.id, article.id));
      if (nextArticleStatus !== article.currentStatus) {
        await transaction.insert(articleStatusHistory).values({
          id: createUuidV7(),
          articleId: article.id,
          fromStatus: article.currentStatus,
          toStatus: nextArticleStatus,
          reason: "正式复制前兼容检查未通过",
          source: "system",
          createdBy: input.context.actorUserId,
          createdAt: input.generatedAt,
        });
      }
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: "article.wechat_render.create",
        targetType: "render_output",
        targetId: outputId,
        accountId: article.accountId,
        articleId: article.id,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: null,
        afterSummary: {
          snapshotId,
          documentVersion: input.source.documentVersion,
          outputMode: input.mode,
          outputHash,
          status: outputStatus,
          compatibilityScore: input.report.score,
          canCopy: input.report.canCopy,
        },
        metadataJson: {
          rendererVersion: input.report.rendererVersion,
          compatibilityRuleVersion: input.report.ruleVersion,
        },
        createdAt: input.generatedAt,
      });
      return {
        kind: "created",
        output: toOutput(inserted),
      };
    });
  }

  async findOutput(
    ownerUserId: string,
    articleId: string,
    outputId: string,
  ): Promise<RenderOutputRecord | null> {
    const [row] = await this.connection.db
      .select(outputSelection)
      .from(renderOutputs)
      .innerJoin(articles, eq(articles.id, renderOutputs.articleId))
      .where(
        and(
          eq(renderOutputs.id, outputId),
          eq(renderOutputs.articleId, articleId),
          eq(articles.ownerUserId, ownerUserId),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);
    return row === undefined ? null : toOutput(row);
  }

  async createRecord(input: CreateCopyRecordInput): Promise<CreateCopyRecordResult> {
    return this.connection.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({
          accountId: articles.accountId,
          currentStatus: articles.status,
          output: outputSelection,
        })
        .from(renderOutputs)
        .innerJoin(articles, eq(articles.id, renderOutputs.articleId))
        .where(
          and(
            eq(renderOutputs.id, input.renderOutputId),
            eq(renderOutputs.articleId, input.articleId),
            eq(articles.ownerUserId, input.ownerUserId),
            isNull(articles.deletedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (row === undefined) {
        return { kind: "not_found" };
      }
      const output = toOutput(row.output);
      if (
        input.status === "success" &&
        (output.status !== "ready" || !output.compatibilityReport.canCopy)
      ) {
        return { kind: "output_blocked" };
      }

      const recordId = createUuidV7();
      const copiedAt = new Date();
      await transaction.insert(copyRecords).values({
        id: recordId,
        articleId: input.articleId,
        snapshotId: output.snapshotId,
        renderOutputId: output.id,
        accountId: row.accountId,
        status: input.status,
        copiedBy: input.context.actorUserId,
        copiedAt,
        browserInfo: input.browserInfo as JsonObject,
        failureReason: input.failureReason,
      });
      const nextStatus = input.status === "success" ? "copied" : "copy_failed";
      await transaction
        .update(articles)
        .set({
          status: nextStatus,
          ...(input.status === "success" ? { copiedAt } : {}),
          updatedAt: copiedAt,
        })
        .where(eq(articles.id, input.articleId));
      if (nextStatus !== row.currentStatus) {
        await transaction.insert(articleStatusHistory).values({
          id: createUuidV7(),
          articleId: input.articleId,
          fromStatus: row.currentStatus,
          toStatus: nextStatus,
          reason: input.status === "success" ? "内容已写入系统剪贴板" : "浏览器剪贴板写入失败",
          source: "copy",
          createdBy: input.context.actorUserId,
          createdAt: copiedAt,
        });
      }
      await transaction.insert(auditLogs).values({
        id: createUuidV7(),
        actorUserId: input.context.actorUserId,
        actorType: "user",
        action: `article.copy.${input.status}`,
        targetType: "copy_record",
        targetId: recordId,
        accountId: row.accountId,
        articleId: input.articleId,
        requestId: input.context.requestId,
        traceId: input.context.traceId,
        beforeSummary: {
          articleStatus: row.currentStatus,
        },
        afterSummary: {
          articleStatus: nextStatus,
          renderOutputId: output.id,
          snapshotId: output.snapshotId,
          status: input.status,
          failureReason: input.failureReason,
        },
        metadataJson: {
          browserInfo: input.browserInfo,
        },
        createdAt: copiedAt,
      });
      return {
        kind: "created",
        record: {
          id: recordId,
          renderOutputId: output.id,
          status: input.status,
          copiedAt,
        },
      };
    });
  }
}
