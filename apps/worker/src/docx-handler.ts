import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import {
  articleDocuments,
  articleResources,
  articles,
  articleStatusHistory,
  auditLogs,
  createUuidV7,
  resources,
  sourceBlocks,
  sourceDocuments,
  type DatabaseConnection,
} from "@wechat-layout/database";
import {
  collectDocumentEntries,
  DOCUMENT_SCHEMA_VERSION,
  documentPlainText,
  type DocumentMark,
  type DocumentV1,
  type DocNode,
  type InlineNode,
  type ListItemNode,
  validateDocument,
} from "@wechat-layout/document-schema";
import {
  type JobHandler,
  type JobHandlerContext,
  PermanentJobError,
  RetryableJobError,
} from "@wechat-layout/job-runtime";
import { ObjectStorageError, type ObjectStorage } from "@wechat-layout/storage-adapter";
import { and, eq, isNull } from "drizzle-orm";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_PARSER_OUTPUT_BYTES = 64 * 1024 * 1024;
const PARSER_TIMEOUT_MS = 2 * 60 * 1000;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const IMPORT_BLOCK_ROLES = new Set([
  "title",
  "subtitle",
  "heading_1",
  "heading_2",
  "heading_3",
  "paragraph",
  "quote",
  "bullet_item",
  "ordered_item",
  "image_reference",
  "excluded",
]);

type JsonObject = Record<string, unknown>;
type Transaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

export interface IntermediateBlock {
  readonly sourceBlockId: string;
  readonly sourceType: string;
  readonly role: string;
  readonly text: string;
  readonly textHash: string;
  readonly orderIndex: number;
  readonly styleMetadata: JsonObject;
  readonly relationMetadata: JsonObject;
}

export interface IntermediateResource {
  readonly resourceKey: string;
  readonly archivePath: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly fileExtension: string | null;
  readonly byteLength: number;
  readonly sha256: string;
  readonly firstOrderIndex: number;
  readonly occurrenceCount: number;
  readonly extractedPath: string;
}

export interface DocxIntermediate {
  readonly raw: JsonObject;
  readonly schemaVersion: "1.0.0";
  readonly parserVersion: string;
  readonly detectedSource: "word" | "wps";
  readonly title: string;
  readonly originalText: string;
  readonly originalTextHash: string;
  readonly sourceBlocks: readonly IntermediateBlock[];
  readonly resources: readonly IntermediateResource[];
  readonly tables: readonly JsonObject[];
  readonly warnings: readonly JsonObject[];
  readonly statistics: Readonly<{
    wordCount: number;
    imageCount: number;
    blockCount: number;
    tableCount: number;
  }>;
}

export interface DocxHandlerOptions {
  readonly database: DatabaseConnection;
  readonly storage: ObjectStorage;
  readonly maximumDocxBytes: number;
  readonly pythonExecutable?: string;
  readonly pythonPath?: string;
}

interface DocxJobPayload {
  readonly resourceId: string;
  readonly sourceDocumentId: string;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "") {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", `DOCX 中间结构缺少 ${field}`);
  }
  return value;
}

function jobPayload(context: JobHandlerContext): DocxJobPayload {
  return {
    resourceId: requiredString(context.job.payloadSummary.resourceId, "resourceId"),
    sourceDocumentId: requiredString(
      context.job.payloadSummary.sourceDocumentId,
      "sourceDocumentId",
    ),
  };
}

function parseBlock(value: unknown, expectedOrder: number): IntermediateBlock {
  if (!isObject(value)) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "Source Block 不是对象");
  }
  const orderIndex = value.orderIndex;
  const styleMetadata = value.styleMetadata;
  const relationMetadata = value.relationMetadata;
  if (orderIndex !== expectedOrder || !isObject(styleMetadata) || !isObject(relationMetadata)) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "Source Block 顺序或元数据无效");
  }
  const textHash = requiredString(value.textHash, "sourceBlocks[].textHash");
  if (!/^[a-f0-9]{64}$/.test(textHash)) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "Source Block 文本摘要无效");
  }
  const sourceBlockId = requiredString(value.sourceBlockId, "sourceBlocks[].sourceBlockId");
  const role = requiredString(value.role, "sourceBlocks[].role");
  const text = typeof value.text === "string" ? value.text : "";
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(sourceBlockId) ||
    !IMPORT_BLOCK_ROLES.has(role) ||
    sha256(text) !== textHash
  ) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "Source Block 字段映射无效");
  }
  return {
    sourceBlockId,
    sourceType: requiredString(value.sourceType, "sourceBlocks[].sourceType"),
    role,
    text,
    textHash,
    orderIndex,
    styleMetadata,
    relationMetadata,
  };
}

function parseResource(value: unknown): IntermediateResource {
  if (!isObject(value)) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片资源不是对象");
  }
  const byteLength = value.byteLength;
  const fileExtension = value.fileExtension;
  const firstOrderIndex = value.firstOrderIndex;
  const occurrenceCount = value.occurrenceCount;
  if (
    typeof byteLength !== "number" ||
    !Number.isSafeInteger(byteLength) ||
    byteLength <= 0 ||
    typeof firstOrderIndex !== "number" ||
    !Number.isSafeInteger(firstOrderIndex) ||
    firstOrderIndex < 0 ||
    typeof occurrenceCount !== "number" ||
    !Number.isSafeInteger(occurrenceCount) ||
    occurrenceCount <= 0 ||
    !(fileExtension === null || typeof fileExtension === "string")
  ) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片资源元数据无效");
  }
  const mimeType = requiredString(value.mimeType, "resources[].mimeType");
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片类型不在允许列表");
  }
  const digest = requiredString(value.sha256, "resources[].sha256");
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片摘要无效");
  }
  const resourceKey = requiredString(value.resourceKey, "resources[].resourceKey");
  if (!/^image_[0-9]{4}$/.test(resourceKey)) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片 resourceKey 无效");
  }
  return {
    resourceKey,
    archivePath: requiredString(value.archivePath, "resources[].archivePath"),
    originalFilename: requiredString(value.originalFilename, "resources[].originalFilename"),
    mimeType,
    fileExtension,
    byteLength,
    sha256: digest,
    firstOrderIndex,
    occurrenceCount,
    extractedPath: requiredString(value.extractedPath, "resources[].extractedPath"),
  };
}

function parseTables(value: readonly unknown[]): JsonObject[] {
  return value.map((entry) => {
    if (!isObject(entry)) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX tables 包含无效项");
    }
    const rows = entry.rows;
    if (
      !/^table_[0-9]{4}$/.test(requiredString(entry.tableId, "tables[].tableId")) ||
      !/^src_[0-9]{6}_[a-f0-9]{12}$/.test(
        requiredString(entry.sourceBlockId, "tables[].sourceBlockId"),
      ) ||
      !Array.isArray(rows) ||
      !rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string")) ||
      !Number.isSafeInteger(entry.rowCount) ||
      entry.rowCount !== rows.length ||
      !Number.isSafeInteger(entry.columnCount) ||
      typeof entry.columnCount !== "number" ||
      entry.columnCount < 0 ||
      entry.columnCount !== Math.max(0, ...rows.map((row) => row.length)) ||
      typeof entry.hasMergedCells !== "boolean"
    ) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 表格中间结构无效");
    }
    return entry;
  });
}

function parseWarnings(value: readonly unknown[]): JsonObject[] {
  return value.map((entry) => {
    if (
      !isObject(entry) ||
      typeof entry.code !== "string" ||
      !["info", "warning"].includes(String(entry.severity)) ||
      typeof entry.message !== "string" ||
      !Number.isSafeInteger(entry.count) ||
      typeof entry.count !== "number" ||
      entry.count < 1
    ) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX warnings 包含无效项");
    }
    return entry;
  });
}

function parseIntermediate(value: unknown): DocxIntermediate {
  if (!isObject(value) || value.schemaVersion !== "1.0.0") {
    throw new PermanentJobError(
      "DOCX_INTERMEDIATE_VERSION_UNSUPPORTED",
      "DOCX 中间结构版本不受支持",
    );
  }
  if (!Array.isArray(value.sourceBlocks) || value.sourceBlocks.length === 0) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 中间结构没有 Source Blocks");
  }
  if (
    !Array.isArray(value.resources) ||
    !Array.isArray(value.tables) ||
    !Array.isArray(value.warnings) ||
    !isObject(value.statistics)
  ) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 中间结构字段无效");
  }
  const statistics = value.statistics;
  const detectedSource = value.detectedSource;
  if (detectedSource !== "word" && detectedSource !== "wps") {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 来源识别结果无效");
  }
  const numberField = (field: string): number => {
    const candidate = statistics[field];
    if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", `DOCX 统计字段 ${field} 无效`);
    }
    return candidate;
  };
  const originalTextHash = requiredString(value.originalTextHash, "originalTextHash");
  const originalText = typeof value.originalText === "string" ? value.originalText : "";
  if (sha256(originalText) !== originalTextHash) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 标准化原文摘要不一致");
  }
  const blocks = value.sourceBlocks.map(parseBlock);
  if (new Set(blocks.map((block) => block.sourceBlockId)).size !== blocks.length) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "Source Block ID 不唯一");
  }
  const parsedStatistics = {
    wordCount: numberField("wordCount"),
    imageCount: numberField("imageCount"),
    blockCount: numberField("blockCount"),
    tableCount: numberField("tableCount"),
  };
  if (
    parsedStatistics.blockCount !== blocks.length ||
    parsedStatistics.imageCount !==
      blocks.filter((block) => block.role === "image_reference").length ||
    parsedStatistics.tableCount !== value.tables.length
  ) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 统计与中间结构不一致");
  }
  const parsedResources = value.resources.map(parseResource);
  if (
    parsedResources.length > 100 ||
    new Set(parsedResources.map((resource) => resource.resourceKey)).size !== parsedResources.length
  ) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片资源计数或 ID 无效");
  }
  const resourceOccurrences = new Map<string, number>();
  for (const block of blocks) {
    const resourceKey = block.relationMetadata.resourceKey;
    if (typeof resourceKey === "string") {
      resourceOccurrences.set(resourceKey, (resourceOccurrences.get(resourceKey) ?? 0) + 1);
    }
  }
  for (const resource of parsedResources) {
    if (resourceOccurrences.get(resource.resourceKey) !== resource.occurrenceCount) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片出现次数不一致");
    }
  }
  if (
    [...resourceOccurrences.keys()].some(
      (resourceKey) => !parsedResources.some((resource) => resource.resourceKey === resourceKey),
    )
  ) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX Source Block 引用了缺失图片");
  }
  const parsedTables = parseTables(value.tables);
  const parsedWarnings = parseWarnings(value.warnings);
  if (
    new Set(parsedTables.map((table) => table.tableId)).size !== parsedTables.length ||
    parsedTables.some(
      (table) =>
        !blocks.some(
          (block) =>
            block.sourceBlockId === table.sourceBlockId &&
            block.sourceType === "table" &&
            block.relationMetadata.tableId === table.tableId,
        ),
    )
  ) {
    throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 表格与 Source Block 映射不一致");
  }
  return {
    raw: value,
    schemaVersion: "1.0.0",
    parserVersion: requiredString(value.parserVersion, "parserVersion"),
    detectedSource,
    title: requiredString(value.title, "title"),
    originalText,
    originalTextHash,
    sourceBlocks: blocks,
    resources: parsedResources,
    tables: parsedTables,
    warnings: parsedWarnings,
    statistics: parsedStatistics,
  };
}

function parsePythonError(stderr: string): PermanentJobError | RetryableJobError {
  try {
    const parsed: unknown = JSON.parse(stderr.trim());
    if (isObject(parsed) && parsed.success === false && isObject(parsed.error)) {
      return new PermanentJobError(
        typeof parsed.error.code === "string" ? parsed.error.code : "DOCX_PARSE_FAILED",
        typeof parsed.error.message === "string" ? parsed.error.message : "DOCX 解析失败",
      );
    }
  } catch {
    // A process-level failure may not have reached the JSON error boundary.
  }
  return new RetryableJobError("DOCX_WORKER_PROCESS_FAILED", "Python DOCX Worker 进程执行失败");
}

export async function runPythonParser(input: {
  readonly executable: string;
  readonly pythonPath: string;
  readonly sourcePath: string;
  readonly extractDirectory: string;
  readonly signal: AbortSignal | undefined;
}): Promise<DocxIntermediate> {
  const output = await new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(
      input.executable,
      ["-m", "docx_worker", input.sourcePath, "--extract-dir", input.extractDirectory],
      {
        env: { ...process.env, PYTHONPATH: input.pythonPath },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
      action();
    };
    const abort = () => {
      child.kill("SIGTERM");
      finish(() => rejectPromise(new PermanentJobError("JOB_CANCELLED", "DOCX 导入已取消")));
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() =>
        rejectPromise(new RetryableJobError("DOCX_WORKER_TIMEOUT", "Python DOCX Worker 执行超时")),
      );
    }, PARSER_TIMEOUT_MS);
    input.signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_PARSER_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(() =>
          rejectPromise(
            new PermanentJobError("DOCX_INTERMEDIATE_TOO_LARGE", "DOCX 中间 JSON 超过限制"),
          ),
        );
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", () => {
      finish(() =>
        rejectPromise(
          new RetryableJobError("DOCX_WORKER_UNAVAILABLE", "Python DOCX Worker 无法启动"),
        ),
      );
    });
    child.once("close", (code) => {
      finish(() => {
        if (code !== 0) {
          rejectPromise(parsePythonError(Buffer.concat(stderr).toString("utf8")));
          return;
        }
        resolvePromise(Buffer.concat(stdout).toString("utf8"));
      });
    });
  });
  try {
    const envelope: unknown = JSON.parse(output);
    if (!isObject(envelope) || envelope.success !== true) {
      throw new Error("invalid envelope");
    }
    return parseIntermediate(envelope.data);
  } catch (error) {
    if (error instanceof PermanentJobError) throw error;
    throw new PermanentJobError(
      "DOCX_INTERMEDIATE_INVALID",
      `Python DOCX Worker 输出不是有效 JSON：${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}

function safeMarks(value: unknown): DocumentMark[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const marks: DocumentMark[] = [];
  for (const candidate of value) {
    if (!isObject(candidate) || typeof candidate.type !== "string") continue;
    if (["bold", "italic", "underline", "strike"].includes(candidate.type)) {
      if (!marks.some((mark) => mark.type === candidate.type)) {
        marks.push({ type: candidate.type } as DocumentMark);
      }
      continue;
    }
    if (candidate.type === "link" && isObject(candidate.attrs)) {
      const href = candidate.attrs.href;
      if (
        typeof href === "string" &&
        /^(?:https?:\/\/|mailto:)[^\s]+$/i.test(href) &&
        !marks.some((mark) => mark.type === "link")
      ) {
        marks.push({ type: "link", attrs: { href } });
      }
    }
  }
  return marks.length === 0 ? undefined : marks;
}

function inlineContent(block: IntermediateBlock): InlineNode[] | undefined {
  const stored = block.styleMetadata.inlineContent;
  if (!Array.isArray(stored)) {
    return block.text === "" ? undefined : [{ type: "text", text: block.text }];
  }
  const content: InlineNode[] = [];
  for (const candidate of stored) {
    if (!isObject(candidate)) continue;
    if (candidate.type === "hardBreak") {
      content.push({ type: "hardBreak" });
    } else if (candidate.type === "text" && typeof candidate.text === "string") {
      const marks = safeMarks(candidate.marks);
      content.push({
        type: "text",
        text: candidate.text,
        ...(marks === undefined ? {} : { marks }),
      });
    }
  }
  return content.length === 0
    ? block.text === ""
      ? undefined
      : [{ type: "text", text: block.text }]
    : content;
}

function commonAttrs(block: IntermediateBlock) {
  return {
    blockId: `block_${block.sourceBlockId}`,
    sourceBlockId: block.sourceBlockId,
    locked: true,
    sourceTextHash: `sha256:${block.textHash}`,
    compatibilityLevel: "safe" as const,
  };
}

function listNode(
  role: "bullet_item" | "ordered_item",
  blocks: readonly IntermediateBlock[],
  groupIndex: number,
): Exclude<DocNode["content"][number], { type: "listItem" }> {
  const items: ListItemNode[] = blocks.map((block) => {
    const content = inlineContent(block);
    return {
      type: "listItem",
      attrs: {
        ...commonAttrs(block),
        ...(typeof block.relationMetadata.originalNumberText === "string"
          ? { originalNumberText: block.relationMetadata.originalNumberText.slice(0, 64) }
          : {}),
      },
      content: [
        {
          type: "paragraph",
          attrs: {
            blockId: `block_${block.sourceBlockId}_content`,
            locked: true,
            sourceTextHash: `sha256:${block.textHash}`,
          },
          ...(content === undefined ? {} : { content }),
        },
      ],
    };
  });
  const depth =
    typeof blocks[0]?.relationMetadata.listDepth === "number"
      ? Math.min(8, Math.max(0, blocks[0].relationMetadata.listDepth))
      : 0;
  const shared = {
    blockId: `block_${role}_${String(groupIndex)}`,
    locked: true,
    compatibilityLevel: "safe" as const,
  };
  return role === "bullet_item"
    ? {
        type: "bulletList",
        attrs: { ...shared, bulletStyle: "disc", indentLevel: depth },
        content: items,
      }
    : {
        type: "orderedList",
        attrs: {
          ...shared,
          start:
            typeof blocks[0]?.relationMetadata.listStart === "number"
              ? Math.max(1, blocks[0].relationMetadata.listStart)
              : 1,
          numberingStyle: "decimal",
          indentLevel: depth,
          preserveOriginalNumbering: true,
        },
        content: items,
      };
}

function buildDocument(input: {
  readonly articleId: string;
  readonly accountId: string | null;
  readonly documentId: string;
  readonly originalResourceId: string;
  readonly intermediate: DocxIntermediate;
  readonly imageResourceIds: ReadonlyMap<string, string>;
  readonly now: Date;
}): DocumentV1 {
  const content: DocNode["content"] = [];
  let index = 0;
  let listGroup = 0;
  while (index < input.intermediate.sourceBlocks.length) {
    const block = input.intermediate.sourceBlocks[index];
    if (block === undefined || block.role === "excluded") {
      index += 1;
      continue;
    }
    if (block.role === "bullet_item" || block.role === "ordered_item") {
      const group: IntermediateBlock[] = [];
      const role = block.role;
      while (input.intermediate.sourceBlocks[index]?.role === role) {
        const item = input.intermediate.sourceBlocks[index];
        if (item !== undefined) group.push(item);
        index += 1;
      }
      content.push(listNode(role, group, listGroup));
      listGroup += 1;
      continue;
    }
    const attrs = commonAttrs(block);
    const inline = inlineContent(block);
    if (["title", "heading_1", "heading_2", "heading_3"].includes(block.role)) {
      content.push({
        type: "heading",
        attrs: {
          ...attrs,
          level: block.role === "heading_3" ? 3 : block.role === "heading_2" ? 2 : 1,
          semanticRole: block.role === "title" ? "main_title" : "section_heading",
        },
        ...(inline === undefined ? {} : { content: inline }),
      });
    } else if (block.role === "quote") {
      content.push({
        type: "blockquote",
        attrs: { ...attrs, quoteType: "standard" },
        content: [
          {
            type: "paragraph",
            attrs: {
              blockId: `block_${block.sourceBlockId}_content`,
              locked: true,
              sourceTextHash: `sha256:${block.textHash}`,
            },
            ...(inline === undefined ? {} : { content: inline }),
          },
        ],
      });
    } else if (block.role === "image_reference") {
      const resourceKey = block.relationMetadata.resourceKey;
      const resourceId =
        typeof resourceKey === "string" ? input.imageResourceIds.get(resourceKey) : undefined;
      if (resourceId === undefined) {
        content.push({
          type: "paragraph",
          attrs: { ...attrs, semanticRole: "unresolved_image" },
          ...(inline === undefined ? {} : { content: inline }),
        });
      } else {
        content.push({
          type: "imageBlock",
          attrs: {
            ...attrs,
            resourceId,
            ...(typeof block.relationMetadata.alt === "string"
              ? { alt: block.relationMetadata.alt.slice(0, 500) }
              : {}),
            widthMode: "full",
            widthPercent: 100,
            objectFit: "contain",
          },
        });
      }
    } else {
      content.push({
        type: "paragraph",
        attrs: {
          ...attrs,
          ...(block.role === "subtitle" ? { semanticRole: "subtitle" } : {}),
          ...(block.sourceType === "table" ? { semanticRole: "source_table" } : {}),
        },
        ...(inline === undefined ? {} : { content: inline }),
      });
    }
    index += 1;
  }
  const document: DocumentV1 = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    documentId: input.documentId,
    articleId: input.articleId,
    accountId: input.accountId,
    content: { type: "doc", content },
    meta: {
      sourceType: "docx",
      originalFileId: input.originalResourceId,
      originalTextHash: `sha256:${input.intermediate.originalTextHash}`,
      textLocked: true,
      createdAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    },
  };
  const validation = validateDocument(document);
  if (!validation.success) {
    throw new PermanentJobError(
      "DOCX_DOCUMENT_SCHEMA_INVALID",
      `DOCX 生成的 Document V1 无效：${validation.errors[0]?.message ?? "未知错误"}`,
    );
  }
  return validation.data;
}

async function importedImageResources(input: {
  readonly database: DatabaseConnection;
  readonly storage: ObjectStorage;
  readonly ownerUserId: string;
  readonly originalResourceId: string;
  readonly jobId: string;
  readonly extractDirectory: string;
  readonly resources: readonly IntermediateResource[];
}): Promise<ReadonlyMap<string, string>> {
  const result = new Map<string, string>();
  const seenKeys = new Set<string>();
  for (const resource of input.resources) {
    if (!/^image_[0-9]{4}$/.test(resource.resourceKey) || seenKeys.has(resource.resourceKey)) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片 resourceKey 重复或无效");
    }
    seenKeys.add(resource.resourceKey);
    const extractedPath = resolve(resource.extractedPath);
    if (dirname(extractedPath) !== resolve(input.extractDirectory)) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片提取路径越界");
    }
    const expectedSuffix = resource.fileExtension === null ? "" : `.${resource.fileExtension}`;
    if (basename(extractedPath) !== `${resource.resourceKey}${expectedSuffix}`) {
      throw new PermanentJobError("DOCX_INTERMEDIATE_INVALID", "DOCX 图片提取文件名无效");
    }
    const bytes = await readFile(extractedPath);
    if (bytes.byteLength !== resource.byteLength || sha256(bytes) !== resource.sha256) {
      throw new PermanentJobError("DOCX_IMAGE_HASH_MISMATCH", "DOCX 提取图片摘要不一致");
    }
    const [existing] = await input.database.db
      .select({ id: resources.id, mimeType: resources.mimeType, status: resources.status })
      .from(resources)
      .where(
        and(
          eq(resources.ownerUserId, input.ownerUserId),
          eq(resources.sha256, resource.sha256),
          isNull(resources.deletedAt),
        ),
      )
      .limit(1);
    if (existing !== undefined) {
      if (existing.status !== "active" || existing.mimeType !== resource.mimeType) {
        throw new PermanentJobError("DOCX_IMAGE_RESOURCE_CONFLICT", "DOCX 图片与已有资源冲突");
      }
      result.set(resource.resourceKey, existing.id);
      continue;
    }

    const extension = resource.fileExtension ?? "bin";
    const storageKey = `resources/${input.ownerUserId}/${resource.sha256.slice(0, 2)}/${resource.sha256}/original.${extension}`;
    await input.storage.putObject({
      key: storageKey,
      bytes,
      contentType: resource.mimeType,
      metadata: {
        owner: input.ownerUserId,
        sha256: resource.sha256,
        "import-job-id": input.jobId,
      },
    });
    const resourceId = createUuidV7();
    const [created] = await input.database.db
      .insert(resources)
      .values({
        id: resourceId,
        ownerUserId: input.ownerUserId,
        resourceType: "image",
        sourceType: "import",
        originalFilename: resource.originalFilename,
        storageProvider: "s3_compatible",
        storageBucket: input.storage.bucket,
        storageKey,
        mimeType: resource.mimeType,
        fileExtension: resource.fileExtension,
        fileSize: resource.byteLength,
        width: null,
        height: null,
        sha256: resource.sha256,
        status: "active",
        isPrivate: true,
        metadataJson: { importJobId: input.jobId, resourceKey: resource.resourceKey },
        parentResourceId: input.originalResourceId,
      })
      .onConflictDoNothing()
      .returning({ id: resources.id });
    if (created !== undefined) {
      result.set(resource.resourceKey, created.id);
      continue;
    }
    const [concurrent] = await input.database.db
      .select({ id: resources.id })
      .from(resources)
      .where(
        and(
          eq(resources.ownerUserId, input.ownerUserId),
          eq(resources.sha256, resource.sha256),
          isNull(resources.deletedAt),
        ),
      )
      .limit(1);
    if (concurrent === undefined) {
      throw new RetryableJobError("DOCX_IMAGE_RESOURCE_CREATE_FAILED", "DOCX 图片资源入库失败");
    }
    result.set(resource.resourceKey, concurrent.id);
  }
  return result;
}

function documentStatistics(document: DocumentV1): {
  readonly currentTextHash: string;
  readonly wordCount: number;
  readonly imageCount: number;
} {
  const plainText = documentPlainText(document.content);
  const wordTokens = plainText.match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) ?? [];
  return {
    currentTextHash: sha256(plainText),
    wordCount: wordTokens.length,
    imageCount: collectDocumentEntries(document.content).blocks.filter(
      ({ node }) => node.type === "imageBlock",
    ).length,
  };
}

function imageReferences(document: DocumentV1): readonly {
  readonly blockId: string;
  readonly resourceId: string;
  readonly sortOrder: number;
}[] {
  const result: { blockId: string; resourceId: string; sortOrder: number }[] = [];
  for (const { node } of collectDocumentEntries(document.content).blocks) {
    if (node.type === "imageBlock") {
      result.push({
        blockId: node.attrs.blockId,
        resourceId: node.attrs.resourceId,
        sortOrder: result.length,
      });
    }
  }
  return result;
}

async function persistImport(input: {
  readonly transaction: Transaction;
  readonly context: JobHandlerContext;
  readonly payload: DocxJobPayload;
  readonly intermediate: DocxIntermediate;
  readonly intermediateKey: string;
  readonly document: DocumentV1;
  readonly documentId: string;
}): Promise<void> {
  const { transaction } = input;
  const [article] = await transaction
    .select({
      id: articles.id,
      accountId: articles.accountId,
      status: articles.status,
    })
    .from(articles)
    .where(
      and(
        eq(articles.id, input.context.job.articleId ?? ""),
        eq(articles.ownerUserId, input.context.job.ownerUserId),
        isNull(articles.deletedAt),
      ),
    )
    .limit(1)
    .for("update");
  if (article === undefined) {
    throw new PermanentJobError("DOCX_IMPORT_TARGET_NOT_FOUND", "DOCX 导入文章不存在");
  }
  const [sourceDocument] = await transaction
    .select({
      id: sourceDocuments.id,
      articleId: sourceDocuments.articleId,
      originalResourceId: sourceDocuments.originalResourceId,
      importJobId: sourceDocuments.importJobId,
      sourceMetadata: sourceDocuments.sourceMetadata,
    })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, input.payload.sourceDocumentId))
    .limit(1)
    .for("update");
  if (
    sourceDocument === undefined ||
    sourceDocument.articleId !== article.id ||
    sourceDocument.originalResourceId !== input.payload.resourceId
  ) {
    throw new PermanentJobError("DOCX_IMPORT_SOURCE_CONFLICT", "DOCX 原文记录与任务不一致");
  }
  if (article.status !== "pending_import") {
    throw new PermanentJobError(
      "DOCX_IMPORT_STATE_CONFLICT",
      `DOCX 导入文章状态无效：${article.status}`,
    );
  }
  if (sourceDocument.importJobId !== null && sourceDocument.importJobId !== input.context.job.id) {
    throw new PermanentJobError("DOCX_IMPORT_JOB_CONFLICT", "DOCX 原文已关联其他任务");
  }
  const now = new Date();
  const statistics = documentStatistics(input.document);
  await transaction.insert(articleDocuments).values({
    id: input.documentId,
    articleId: article.id,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    documentJson: input.document as unknown as JsonObject,
    documentVersion: 1,
    originalTextHash: input.intermediate.originalTextHash,
    currentTextHash: statistics.currentTextHash,
    lastSavedBy: input.context.job.ownerUserId,
    lastSavedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await transaction
    .update(sourceDocuments)
    .set({
      originalText: input.intermediate.originalText,
      originalTextHash: input.intermediate.originalTextHash,
      importJobId: input.context.job.id,
      sourceMetadata: {
        ...sourceDocument.sourceMetadata,
        detectedSource: input.intermediate.detectedSource,
        parserVersion: input.intermediate.parserVersion,
        intermediateSchemaVersion: input.intermediate.schemaVersion,
        intermediateStorageKey: input.intermediateKey,
        warnings: input.intermediate.warnings,
        statistics: input.intermediate.statistics,
        tables: input.intermediate.tables,
      },
    })
    .where(eq(sourceDocuments.id, sourceDocument.id));
  await transaction.insert(sourceBlocks).values(
    input.intermediate.sourceBlocks.map((block) => ({
      id: createUuidV7(),
      sourceDocumentId: sourceDocument.id,
      sourceBlockId: block.sourceBlockId,
      blockType: block.role,
      textContent: block.text,
      textHash: block.textHash,
      orderIndex: block.orderIndex,
      styleMetadata: block.styleMetadata,
      relationMetadata: block.relationMetadata,
      createdAt: now,
    })),
  );
  const references = imageReferences(input.document);
  if (references.length > 0) {
    await transaction.insert(articleResources).values(
      references.map((reference) => ({
        id: createUuidV7(),
        articleId: article.id,
        resourceId: reference.resourceId,
        blockId: reference.blockId,
        usageType: "image",
        sortOrder: reference.sortOrder,
        createdAt: now,
      })),
    );
  }
  await transaction
    .update(articles)
    .set({
      title: input.intermediate.title.slice(0, 500),
      status: "pending_recognition",
      wordCount: statistics.wordCount,
      imageCount: statistics.imageCount,
      updatedAt: now,
    })
    .where(eq(articles.id, article.id));
  await transaction.insert(articleStatusHistory).values({
    id: createUuidV7(),
    articleId: article.id,
    fromStatus: "pending_import",
    toStatus: "pending_recognition",
    reason: "docx_import_parsed",
    source: "import",
    createdBy: input.context.job.ownerUserId,
    createdAt: now,
  });
  await transaction.insert(auditLogs).values({
    id: createUuidV7(),
    actorUserId: null,
    actorType: "worker",
    action: "article.import.docx.complete",
    targetType: "source_document",
    targetId: sourceDocument.id,
    accountId: article.accountId,
    articleId: article.id,
    traceId: input.context.job.traceId,
    beforeSummary: { status: "pending_import" },
    afterSummary: {
      status: "pending_recognition",
      parserVersion: input.intermediate.parserVersion,
      blockCount: input.intermediate.statistics.blockCount,
      imageCount: statistics.imageCount,
      tableCount: input.intermediate.statistics.tableCount,
      warningCount: input.intermediate.warnings.length,
    },
    metadataJson: { jobId: input.context.job.id },
    createdAt: now,
  });
}

async function markImportFailed(
  database: DatabaseConnection,
  context: JobHandlerContext,
  code: string,
): Promise<void> {
  if (context.job.articleId === null) return;
  const now = new Date();
  await database.db.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(articles)
      .set({ status: "import_failed", updatedAt: now })
      .where(
        and(eq(articles.id, context.job.articleId ?? ""), eq(articles.status, "pending_import")),
      )
      .returning({ id: articles.id, accountId: articles.accountId });
    if (updated === undefined) return;
    await transaction.insert(articleStatusHistory).values({
      id: createUuidV7(),
      articleId: updated.id,
      fromStatus: "pending_import",
      toStatus: "import_failed",
      reason: code.slice(0, 100),
      source: "import",
      createdBy: context.job.ownerUserId,
      createdAt: now,
    });
    await transaction.insert(auditLogs).values({
      id: createUuidV7(),
      actorUserId: null,
      actorType: "worker",
      action: "article.import.docx.failed",
      targetType: "article",
      targetId: updated.id,
      accountId: updated.accountId,
      articleId: updated.id,
      traceId: context.job.traceId,
      beforeSummary: { status: "pending_import" },
      afterSummary: { status: "import_failed", errorCode: code },
      metadataJson: { jobId: context.job.id, attempt: context.attempt },
      createdAt: now,
    });
  });
}

export function createDocxImportHandler(options: DocxHandlerOptions): JobHandler {
  const pythonExecutable = options.pythonExecutable ?? process.env.DOCX_WORKER_PYTHON ?? "python3";
  const pythonPath =
    options.pythonPath ??
    process.env.DOCX_WORKER_PYTHONPATH ??
    resolve(process.cwd(), "../../services/docx-worker-python/src");

  return async (context) => {
    const payload = jobPayload(context);
    const temporary = await mkdtemp(join(tmpdir(), "wechat-layout-docx-"));
    const sourcePath = join(temporary, "source.docx");
    const extractDirectory = join(temporary, "images");
    try {
      await context.progress(5, "正在校验 DOCX 原文资源");
      const [existingImport] = await options.database.db
        .select({
          status: articles.status,
          importJobId: sourceDocuments.importJobId,
          sourceMetadata: sourceDocuments.sourceMetadata,
          documentId: articleDocuments.id,
        })
        .from(sourceDocuments)
        .innerJoin(articles, eq(articles.id, sourceDocuments.articleId))
        .leftJoin(articleDocuments, eq(articleDocuments.articleId, articles.id))
        .where(
          and(
            eq(sourceDocuments.id, payload.sourceDocumentId),
            eq(sourceDocuments.articleId, context.job.articleId ?? ""),
            eq(articles.ownerUserId, context.job.ownerUserId),
          ),
        )
        .limit(1);
      if (
        existingImport?.status === "pending_recognition" &&
        existingImport.importJobId === context.job.id &&
        existingImport.documentId !== null
      ) {
        return {
          articleId: context.job.articleId,
          sourceDocumentId: payload.sourceDocumentId,
          documentId: existingImport.documentId,
          intermediateRef:
            typeof existingImport.sourceMetadata.intermediateStorageKey === "string"
              ? existingImport.sourceMetadata.intermediateStorageKey
              : null,
          replayed: true,
        };
      }
      const [resource] = await options.database.db
        .select({
          id: resources.id,
          ownerUserId: resources.ownerUserId,
          storageKey: resources.storageKey,
          mimeType: resources.mimeType,
          fileSize: resources.fileSize,
          sha256: resources.sha256,
          status: resources.status,
        })
        .from(resources)
        .where(
          and(
            eq(resources.id, payload.resourceId),
            eq(resources.ownerUserId, context.job.ownerUserId),
            isNull(resources.deletedAt),
          ),
        )
        .limit(1);
      if (
        resource === undefined ||
        resource.mimeType !== DOCX_MIME ||
        resource.status !== "active" ||
        resource.fileSize > options.maximumDocxBytes
      ) {
        throw new PermanentJobError("DOCX_RESOURCE_INVALID", "DOCX 原文资源不可用");
      }
      const sourceBytes = await options.storage.getObject(
        resource.storageKey,
        options.maximumDocxBytes,
      );
      if (sourceBytes.byteLength !== resource.fileSize || sha256(sourceBytes) !== resource.sha256) {
        throw new PermanentJobError("DOCX_RESOURCE_HASH_MISMATCH", "DOCX 原文资源摘要不一致");
      }
      await writeFile(sourcePath, sourceBytes, { flag: "wx" });
      await context.progress(20, "正在解析 Word/WPS OOXML");
      const intermediate = await runPythonParser({
        executable: pythonExecutable,
        pythonPath,
        sourcePath,
        extractDirectory,
        signal: context.signal,
      });
      await context.assertNotCancelled();
      await context.progress(60, "正在登记 DOCX 内嵌图片", {
        imageCount: intermediate.resources.length,
      });
      const imageResourceIds = await importedImageResources({
        database: options.database,
        storage: options.storage,
        ownerUserId: context.job.ownerUserId,
        originalResourceId: resource.id,
        jobId: context.job.id,
        extractDirectory,
        resources: intermediate.resources,
      });
      const intermediateKey = `imports/${context.job.ownerUserId}/${context.job.id}/docx-intermediate-v1.json`;
      await options.storage.putObject({
        key: intermediateKey,
        bytes: new TextEncoder().encode(JSON.stringify(intermediate.raw)),
        contentType: "application/json",
        metadata: {
          owner: context.job.ownerUserId,
          "import-job-id": context.job.id,
          "schema-version": intermediate.schemaVersion,
        },
      });
      const documentId = createUuidV7();
      const document = buildDocument({
        articleId: context.job.articleId ?? "",
        accountId: context.job.accountId,
        documentId,
        originalResourceId: resource.id,
        intermediate,
        imageResourceIds,
        now: new Date(),
      });
      await context.progress(85, "正在提交 DOCX 中间结构");
      await options.database.db.transaction((transaction) =>
        persistImport({
          transaction,
          context,
          payload,
          intermediate,
          intermediateKey,
          document,
          documentId,
        }),
      );
      await context.progress(95, "DOCX 解析完成，等待结构确认", {
        blockCount: intermediate.statistics.blockCount,
        warningCount: intermediate.warnings.length,
      });
      return {
        articleId: context.job.articleId,
        sourceDocumentId: payload.sourceDocumentId,
        documentId,
        intermediateRef: intermediateKey,
        detectedSource: intermediate.detectedSource,
        blockCount: intermediate.statistics.blockCount,
        imageCount: intermediate.statistics.imageCount,
        tableCount: intermediate.statistics.tableCount,
        warningCount: intermediate.warnings.length,
      };
    } catch (error) {
      const retryable =
        error instanceof RetryableJobError ||
        error instanceof ObjectStorageError ||
        !(error instanceof PermanentJobError || (isObject(error) && error.retryable === false));
      if (!retryable || context.attempt >= context.job.maxAttempts) {
        const code =
          error instanceof PermanentJobError || error instanceof RetryableJobError
            ? error.code
            : error instanceof ObjectStorageError
              ? `OBJECT_STORAGE_${error.operation.toUpperCase()}_FAILED`
              : "DOCX_IMPORT_FAILED";
        await markImportFailed(options.database, context, code);
      }
      if (error instanceof ObjectStorageError) {
        throw new RetryableJobError(
          `OBJECT_STORAGE_${error.operation.toUpperCase()}_FAILED`,
          "DOCX 导入访问对象存储失败",
        );
      }
      throw error;
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  };
}
