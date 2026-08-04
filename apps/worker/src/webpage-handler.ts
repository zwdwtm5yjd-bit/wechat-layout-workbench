import { createHash } from "node:crypto";

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
import {
  isWebpageImportError,
  parseWebpage,
  safeFetch,
  WebpageImportError,
  webpageNeedsBrowserFallback,
  type ParsedWebpage,
  type SafeFetchResult,
  type WebpageBlock,
  type WebpageWarning,
} from "@wechat-layout/webpage-import";
import { and, eq, isNull } from "drizzle-orm";

type JsonObject = Record<string, unknown>;
type Transaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

interface WebpageJobPayload {
  readonly sourceDocumentId: string;
  readonly requestedUrl: string;
}

interface BrowserRenderResult {
  readonly finalUrl: string;
  readonly html: string;
}

export interface WebpageHandlerOptions {
  readonly database: DatabaseConnection;
  readonly storage: ObjectStorage;
  readonly browserEndpoint: string;
  readonly maximumHtmlBytes: number;
  readonly maximumImageBytes: number;
  readonly fetchTimeoutMs: number;
  readonly browserTimeoutMs: number;
  readonly maximumRedirects: number;
  readonly fetch?: typeof safeFetch;
  readonly render?: (url: string, signal: AbortSignal | undefined) => Promise<BrowserRenderResult>;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "") {
    throw new PermanentJobError("WEBPAGE_JOB_PAYLOAD_INVALID", `网页任务缺少 ${field}`);
  }
  return value;
}

function payload(context: JobHandlerContext): WebpageJobPayload {
  return {
    sourceDocumentId: requiredString(
      context.job.payloadSummary.sourceDocumentId,
      "sourceDocumentId",
    ),
    requestedUrl: requiredString(context.job.payloadSummary.requestedUrl, "requestedUrl"),
  };
}

function decodeHtml(bytes: Uint8Array): string {
  const ascii = Buffer.from(bytes).subarray(0, 8_192).toString("latin1");
  const declared =
    /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9._-]+)/i.exec(ascii)?.[1] ??
    /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([a-z0-9._-]+)/i.exec(ascii)?.[1];
  const normalized = declared?.toLowerCase();
  const label =
    normalized === "gbk" || normalized === "gb2312" || normalized === "gb_2312-80"
      ? "gb18030"
      : (normalized ?? "utf-8");
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function defaultBrowserRender(input: {
  readonly endpoint: string;
  readonly url: string;
  readonly timeoutMs: number;
  readonly maximumBytes: number;
  readonly signal: AbortSignal | undefined;
}): Promise<BrowserRenderResult> {
  const timeout = AbortSignal.timeout(input.timeoutMs);
  const signal = input.signal === undefined ? timeout : AbortSignal.any([input.signal, timeout]);
  let response: Response;
  try {
    response = await fetch(`${input.endpoint}/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: input.url }),
      signal,
    });
  } catch {
    throw new WebpageImportError("WEBPAGE_BROWSER_UNAVAILABLE", "网页浏览器回退服务不可用", true);
  }
  const raw = await response.text();
  if (Buffer.byteLength(raw) > input.maximumBytes + 64 * 1024) {
    throw new WebpageImportError("WEBPAGE_BROWSER_RESPONSE_TOO_LARGE", "浏览器回退结果过大", false);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WebpageImportError(
      "WEBPAGE_BROWSER_RESPONSE_INVALID",
      "浏览器回退返回无效结果",
      true,
    );
  }
  if (!response.ok) {
    const error = isObject(parsed) && isObject(parsed.error) ? parsed.error : {};
    throw new WebpageImportError(
      typeof error.code === "string" ? error.code : "WEBPAGE_BROWSER_FAILED",
      typeof error.message === "string" ? error.message : "浏览器回退抓取失败",
      error.retryable !== false,
    );
  }
  if (!isObject(parsed) || typeof parsed.finalUrl !== "string" || typeof parsed.html !== "string") {
    throw new WebpageImportError(
      "WEBPAGE_BROWSER_RESPONSE_INVALID",
      "浏览器回退返回无效结果",
      true,
    );
  }
  return { finalUrl: parsed.finalUrl, html: parsed.html };
}

export async function fetchAndParseWebpage(input: {
  readonly requestedUrl: string;
  readonly maximumHtmlBytes: number;
  readonly fetchTimeoutMs: number;
  readonly maximumRedirects: number;
  readonly signal: AbortSignal | undefined;
  readonly fetcher: typeof safeFetch;
  readonly renderer: (url: string, signal: AbortSignal | undefined) => Promise<BrowserRenderResult>;
}): Promise<{
  readonly parsed: ParsedWebpage;
  readonly strategy: "http" | "browser";
  readonly redirects: readonly string[];
  readonly httpFailureCode: string | null;
}> {
  let httpResult: SafeFetchResult | null = null;
  let httpParsed: ParsedWebpage | null = null;
  let httpFailureCode: string | null = null;
  try {
    httpResult = await input.fetcher({
      url: input.requestedUrl,
      maximumBytes: input.maximumHtmlBytes,
      timeoutMs: input.fetchTimeoutMs,
      maximumRedirects: input.maximumRedirects,
      acceptedContentTypes: ["text/html", "application/xhtml+xml"],
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    httpParsed = parseWebpage({
      html: decodeHtml(httpResult.bytes),
      requestedUrl: input.requestedUrl,
      finalUrl: httpResult.finalUrl,
    });
    if (!webpageNeedsBrowserFallback(httpParsed)) {
      return {
        parsed: httpParsed,
        strategy: "http",
        redirects: httpResult.redirects,
        httpFailureCode: null,
      };
    }
    httpFailureCode = "WEBPAGE_HTTP_CONTENT_INSUFFICIENT";
  } catch (error) {
    if (
      isWebpageImportError(error) &&
      (error.code === "WEBPAGE_URL_BLOCKED" || error.code === "WEBPAGE_URL_INVALID")
    ) {
      throw error;
    }
    httpFailureCode = isWebpageImportError(error) ? error.code : "WEBPAGE_HTTP_FETCH_FAILED";
  }
  const rendered = await input.renderer(input.requestedUrl, input.signal);
  const parsed = parseWebpage({
    html: rendered.html,
    requestedUrl: input.requestedUrl,
    finalUrl: rendered.finalUrl,
  });
  if (webpageNeedsBrowserFallback(parsed)) {
    throw new WebpageImportError("WEBPAGE_CONTENT_EMPTY", "网页未提取到足够的可见正文", false);
  }
  return {
    parsed,
    strategy: "browser",
    redirects: httpResult?.redirects ?? [],
    httpFailureCode,
  };
}

export function detectRasterImage(
  bytes: Uint8Array,
): { readonly mimeType: string; readonly extension: string } | null {
  const buffer = Buffer.from(bytes);
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  const header = buffer.subarray(0, 12).toString("ascii");
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
    return { mimeType: "image/gif", extension: "gif" };
  }
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

async function storeWebpageImage(input: {
  readonly database: DatabaseConnection;
  readonly storage: ObjectStorage;
  readonly ownerUserId: string;
  readonly jobId: string;
  readonly sourceUrl: string;
  readonly bytes: Uint8Array;
}): Promise<string> {
  const detected = detectRasterImage(input.bytes);
  if (detected === null) {
    throw new WebpageImportError(
      "WEBPAGE_IMAGE_TYPE_INVALID",
      "网页图片不是受支持的安全位图",
      false,
    );
  }
  const digest = sha256(input.bytes);
  const [existing] = await input.database.db
    .select({ id: resources.id, mimeType: resources.mimeType, status: resources.status })
    .from(resources)
    .where(
      and(
        eq(resources.ownerUserId, input.ownerUserId),
        eq(resources.sha256, digest),
        isNull(resources.deletedAt),
      ),
    )
    .limit(1);
  if (existing !== undefined) {
    if (existing.status !== "active" || existing.mimeType !== detected.mimeType) {
      throw new WebpageImportError(
        "WEBPAGE_IMAGE_RESOURCE_CONFLICT",
        "网页图片与已有资源冲突",
        false,
      );
    }
    return existing.id;
  }
  const storageKey = `resources/${input.ownerUserId}/${digest.slice(0, 2)}/${digest}/original.${detected.extension}`;
  await input.storage.putObject({
    key: storageKey,
    bytes: input.bytes,
    contentType: detected.mimeType,
    metadata: {
      owner: input.ownerUserId,
      sha256: digest,
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
      originalFilename: new URL(input.sourceUrl).pathname.split("/").pop()?.slice(0, 500) || null,
      storageProvider: "s3_compatible",
      storageBucket: input.storage.bucket,
      storageKey,
      mimeType: detected.mimeType,
      fileExtension: detected.extension,
      fileSize: input.bytes.byteLength,
      sha256: digest,
      status: "active",
      isPrivate: true,
      metadataJson: { importJobId: input.jobId, sourceUrl: input.sourceUrl },
    })
    .onConflictDoNothing()
    .returning({ id: resources.id });
  if (created !== undefined) return created.id;
  const [concurrent] = await input.database.db
    .select({ id: resources.id })
    .from(resources)
    .where(
      and(
        eq(resources.ownerUserId, input.ownerUserId),
        eq(resources.sha256, digest),
        isNull(resources.deletedAt),
      ),
    )
    .limit(1);
  if (concurrent === undefined) {
    throw new WebpageImportError(
      "WEBPAGE_IMAGE_RESOURCE_CREATE_FAILED",
      "网页图片资源入库失败",
      true,
    );
  }
  return concurrent.id;
}

async function privatizeImages(input: {
  readonly parsed: ParsedWebpage;
  readonly database: DatabaseConnection;
  readonly storage: ObjectStorage;
  readonly ownerUserId: string;
  readonly jobId: string;
  readonly maximumImageBytes: number;
  readonly fetchTimeoutMs: number;
  readonly maximumRedirects: number;
  readonly signal: AbortSignal | undefined;
  readonly fetcher: typeof safeFetch;
  readonly context: JobHandlerContext;
}): Promise<{ readonly parsed: ParsedWebpage; readonly failedImageCount: number }> {
  const resourceIds = new Map<string, string>();
  let failedImageCount = 0;
  const urls = [
    ...new Set(
      input.parsed.sourceBlocks
        .map((block) => block.relationMetadata.sourceUrl)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  for (const [index, sourceUrl] of urls.entries()) {
    await input.context.assertNotCancelled();
    try {
      const response = await input.fetcher({
        url: sourceUrl,
        maximumBytes: input.maximumImageBytes,
        timeoutMs: input.fetchTimeoutMs,
        maximumRedirects: input.maximumRedirects,
        acceptedContentTypes: ["image"],
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
      const resourceId = await storeWebpageImage({
        database: input.database,
        storage: input.storage,
        ownerUserId: input.ownerUserId,
        jobId: input.jobId,
        sourceUrl,
        bytes: response.bytes,
      });
      resourceIds.set(sourceUrl, resourceId);
    } catch (error) {
      if (error instanceof ObjectStorageError) throw error;
      await input.context.assertNotCancelled();
      failedImageCount += 1;
    }
    await input.context.progress(
      55 + Math.floor(((index + 1) / Math.max(1, urls.length)) * 20),
      "正在将网页图片私有化",
      { completed: index + 1, total: urls.length, failed: failedImageCount },
    );
  }
  const sourceBlocksWithResources = input.parsed.sourceBlocks.map((block) => {
    const sourceUrl = block.relationMetadata.sourceUrl;
    const resourceId = typeof sourceUrl === "string" ? resourceIds.get(sourceUrl) : undefined;
    return resourceId === undefined
      ? block
      : { ...block, relationMetadata: { ...block.relationMetadata, resourceId } };
  });
  const warnings: readonly WebpageWarning[] = input.parsed.warnings.map((warning) =>
    warning.code === "EXTERNAL_IMAGE_REFERENCE"
      ? {
          ...warning,
          message:
            failedImageCount === 0
              ? "网页图片已下载到私有资源库"
              : `已将 ${String(resourceIds.size)} 张网页图片私有化，${String(failedImageCount)} 张保留为未解析引用`,
          severity: failedImageCount === 0 ? "info" : "warning",
        }
      : warning,
  );
  return {
    parsed: {
      ...input.parsed,
      sourceBlocks: sourceBlocksWithResources,
      warnings,
      statistics: { ...input.parsed.statistics, imageCount: resourceIds.size },
    },
    failedImageCount,
  };
}

function commonAttrs(block: WebpageBlock) {
  return {
    blockId: `block_${block.sourceBlockId}`,
    sourceBlockId: block.sourceBlockId,
    locked: true,
    sourceTextHash: `sha256:${block.textHash}`,
  } as const;
}

function inline(block: WebpageBlock): InlineNode[] | undefined {
  return block.text === "" ? undefined : [{ type: "text", text: block.text }];
}

function listNode(
  role: "bullet_item" | "ordered_item",
  blocks: readonly WebpageBlock[],
  groupIndex: number,
): DocNode["content"][number] {
  const items: ListItemNode[] = blocks.map((block, index) => {
    const itemInline = inline(block);
    return {
      type: "listItem",
      attrs: {
        blockId: `block_list_${String(groupIndex)}_item_${String(index)}`,
        sourceBlockId: block.sourceBlockId,
        locked: true,
        sourceTextHash: `sha256:${block.textHash}`,
        ...(typeof block.relationMetadata.originalNumberText === "string"
          ? { originalNumberText: block.relationMetadata.originalNumberText }
          : {}),
      },
      content: [
        {
          type: "paragraph",
          attrs: commonAttrs(block),
          ...(itemInline === undefined ? {} : { content: itemInline }),
        },
      ],
    };
  });
  const shared = { blockId: `block_list_${String(groupIndex)}`, locked: true };
  return role === "bullet_item"
    ? { type: "bulletList", attrs: { ...shared, bulletStyle: "disc" }, content: items }
    : {
        type: "orderedList",
        attrs: {
          ...shared,
          start:
            typeof blocks[0]?.relationMetadata.listStart === "number"
              ? Math.max(1, blocks[0].relationMetadata.listStart)
              : 1,
          numberingStyle: "decimal",
          preserveOriginalNumbering: true,
        },
        content: items,
      };
}

export function buildWebpageDocument(input: {
  readonly articleId: string;
  readonly accountId: string | null;
  readonly documentId: string;
  readonly parsed: ParsedWebpage;
  readonly now: Date;
}): DocumentV1 {
  const content: DocNode["content"] = [];
  let index = 0;
  let listGroup = 0;
  while (index < input.parsed.sourceBlocks.length) {
    const block = input.parsed.sourceBlocks[index];
    if (block === undefined || block.role === "excluded") {
      index += 1;
      continue;
    }
    if (block.role === "bullet_item" || block.role === "ordered_item") {
      const group: WebpageBlock[] = [];
      const role = block.role;
      while (input.parsed.sourceBlocks[index]?.role === role) {
        const item = input.parsed.sourceBlocks[index];
        if (item !== undefined) group.push(item);
        index += 1;
      }
      content.push(listNode(role, group, listGroup));
      listGroup += 1;
      continue;
    }
    const attrs = commonAttrs(block);
    const text = inline(block);
    if (
      block.role === "heading_1" ||
      block.role === "heading_2" ||
      block.role === "heading_3" ||
      block.role === "title"
    ) {
      content.push({
        type: "heading",
        attrs: {
          ...attrs,
          level: block.role === "heading_3" ? 3 : block.role === "heading_2" ? 2 : 1,
          semanticRole: block.role === "title" ? "main_title" : "section_heading",
        },
        ...(text === undefined ? {} : { content: text }),
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
            ...(text === undefined ? {} : { content: text }),
          },
        ],
      });
    } else if (
      block.role === "image_reference" &&
      typeof block.relationMetadata.resourceId === "string"
    ) {
      content.push({
        type: "imageBlock",
        attrs: {
          ...attrs,
          resourceId: block.relationMetadata.resourceId,
          ...(typeof block.relationMetadata.alt === "string"
            ? { alt: block.relationMetadata.alt.slice(0, 500) }
            : {}),
          widthMode: "full",
          widthPercent: 100,
          objectFit: "contain",
        },
      });
    } else {
      content.push({
        type: "paragraph",
        attrs: {
          ...attrs,
          ...(block.role === "image_reference" ? { semanticRole: "unresolved_image" } : {}),
        },
        ...(text === undefined ? {} : { content: text }),
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
      sourceType: "html",
      originalTextHash: `sha256:${input.parsed.originalTextHash}`,
      textLocked: true,
      createdAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    },
  };
  const validation = validateDocument(document);
  if (!validation.success) {
    throw new PermanentJobError(
      "WEBPAGE_DOCUMENT_SCHEMA_INVALID",
      `网页生成的 Document V1 无效：${validation.errors[0]?.message ?? "未知错误"}`,
    );
  }
  return validation.data;
}

function documentStatistics(document: DocumentV1) {
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

function imageReferences(document: DocumentV1) {
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
  readonly payload: WebpageJobPayload;
  readonly parsed: ParsedWebpage;
  readonly strategy: "http" | "browser";
  readonly redirects: readonly string[];
  readonly httpFailureCode: string | null;
  readonly failedImageCount: number;
  readonly intermediateKey: string;
  readonly document: DocumentV1;
  readonly documentId: string;
}): Promise<void> {
  const [article] = await input.transaction
    .select({ id: articles.id, accountId: articles.accountId, status: articles.status })
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
  const [source] = await input.transaction
    .select({
      id: sourceDocuments.id,
      articleId: sourceDocuments.articleId,
      sourceType: sourceDocuments.sourceType,
      originalUrl: sourceDocuments.originalUrl,
      importJobId: sourceDocuments.importJobId,
      sourceMetadata: sourceDocuments.sourceMetadata,
    })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, input.payload.sourceDocumentId))
    .limit(1)
    .for("update");
  if (
    article === undefined ||
    source === undefined ||
    source.articleId !== article.id ||
    source.sourceType !== "web" ||
    source.originalUrl !== input.payload.requestedUrl
  ) {
    throw new PermanentJobError("WEBPAGE_IMPORT_SOURCE_CONFLICT", "网页原文记录与任务不一致");
  }
  if (article.status !== "pending_import") {
    throw new PermanentJobError(
      "WEBPAGE_IMPORT_STATE_CONFLICT",
      `网页导入文章状态无效：${article.status}`,
    );
  }
  if (source.importJobId !== null && source.importJobId !== input.context.job.id) {
    throw new PermanentJobError("WEBPAGE_IMPORT_JOB_CONFLICT", "网页原文已关联其他任务");
  }
  const now = new Date();
  const statistics = documentStatistics(input.document);
  await input.transaction.insert(articleDocuments).values({
    id: input.documentId,
    articleId: article.id,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    documentJson: input.document as unknown as JsonObject,
    documentVersion: 1,
    originalTextHash: input.parsed.originalTextHash,
    currentTextHash: statistics.currentTextHash,
    lastSavedBy: input.context.job.ownerUserId,
    lastSavedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await input.transaction
    .update(sourceDocuments)
    .set({
      originalText: input.parsed.originalText,
      originalTextHash: input.parsed.originalTextHash,
      importJobId: input.context.job.id,
      sourceMetadata: {
        ...source.sourceMetadata,
        requestedUrl: input.payload.requestedUrl,
        finalUrl: input.parsed.finalUrl,
        fetchStrategy: input.strategy,
        redirectChain: input.redirects,
        httpFailureCode: input.httpFailureCode,
        parserVersion: input.parsed.parserVersion,
        intermediateSchemaVersion: input.parsed.schemaVersion,
        intermediateStorageKey: input.intermediateKey,
        sanitizedHtmlHash: input.parsed.sanitizedHtmlHash,
        byline: input.parsed.byline,
        excerpt: input.parsed.excerpt,
        siteName: input.parsed.siteName,
        language: input.parsed.language,
        warnings: input.parsed.warnings,
        statistics: input.parsed.statistics,
        failedImageCount: input.failedImageCount,
      },
    })
    .where(eq(sourceDocuments.id, source.id));
  await input.transaction.insert(sourceBlocks).values(
    input.parsed.sourceBlocks.map((block) => ({
      id: createUuidV7(),
      sourceDocumentId: source.id,
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
    await input.transaction.insert(articleResources).values(
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
  await input.transaction
    .update(articles)
    .set({
      title: input.parsed.title.slice(0, 500),
      status: "pending_recognition",
      wordCount: statistics.wordCount,
      imageCount: statistics.imageCount,
      updatedAt: now,
    })
    .where(eq(articles.id, article.id));
  await input.transaction.insert(articleStatusHistory).values({
    id: createUuidV7(),
    articleId: article.id,
    fromStatus: "pending_import",
    toStatus: "pending_recognition",
    reason: "webpage_import_parsed",
    source: "import",
    createdBy: input.context.job.ownerUserId,
    createdAt: now,
  });
  await input.transaction.insert(auditLogs).values({
    id: createUuidV7(),
    actorUserId: null,
    actorType: "worker",
    action: "article.import.webpage.complete",
    targetType: "source_document",
    targetId: source.id,
    accountId: article.accountId,
    articleId: article.id,
    traceId: input.context.job.traceId,
    beforeSummary: { status: "pending_import", requestedUrl: input.payload.requestedUrl },
    afterSummary: {
      status: "pending_recognition",
      finalUrl: input.parsed.finalUrl,
      fetchStrategy: input.strategy,
      blockCount: input.parsed.statistics.blockCount,
      imageCount: statistics.imageCount,
      warningCount: input.parsed.warnings.length,
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
      action: "article.import.webpage.failed",
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

export function createWebpageImportHandler(options: WebpageHandlerOptions): JobHandler {
  const fetcher = options.fetch ?? safeFetch;
  const renderer =
    options.render ??
    ((url, signal) =>
      defaultBrowserRender({
        endpoint: options.browserEndpoint,
        url,
        timeoutMs: options.browserTimeoutMs,
        maximumBytes: options.maximumHtmlBytes,
        signal,
      }));
  return async (context) => {
    const jobPayload = payload(context);
    try {
      await context.progress(5, "正在校验网页导入任务");
      const [existing] = await options.database.db
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
            eq(sourceDocuments.id, jobPayload.sourceDocumentId),
            eq(sourceDocuments.articleId, context.job.articleId ?? ""),
            eq(articles.ownerUserId, context.job.ownerUserId),
          ),
        )
        .limit(1);
      if (
        existing?.status === "pending_recognition" &&
        existing.importJobId === context.job.id &&
        existing.documentId !== null
      ) {
        return {
          articleId: context.job.articleId,
          sourceDocumentId: jobPayload.sourceDocumentId,
          documentId: existing.documentId,
          intermediateRef:
            typeof existing.sourceMetadata.intermediateStorageKey === "string"
              ? existing.sourceMetadata.intermediateStorageKey
              : null,
          replayed: true,
        };
      }
      await context.progress(15, "正在安全抓取网页正文");
      const fetched = await fetchAndParseWebpage({
        requestedUrl: jobPayload.requestedUrl,
        maximumHtmlBytes: options.maximumHtmlBytes,
        fetchTimeoutMs: options.fetchTimeoutMs,
        maximumRedirects: options.maximumRedirects,
        signal: context.signal,
        fetcher,
        renderer,
      });
      await context.assertNotCancelled();
      await context.progress(
        50,
        fetched.strategy === "browser" ? "浏览器回退抓取完成" : "HTTP 正文提取完成",
        {
          strategy: fetched.strategy,
          blockCount: fetched.parsed.statistics.blockCount,
        },
      );
      const images = await privatizeImages({
        parsed: fetched.parsed,
        database: options.database,
        storage: options.storage,
        ownerUserId: context.job.ownerUserId,
        jobId: context.job.id,
        maximumImageBytes: options.maximumImageBytes,
        fetchTimeoutMs: options.fetchTimeoutMs,
        maximumRedirects: options.maximumRedirects,
        signal: context.signal,
        fetcher,
        context,
      });
      const intermediateKey = `imports/${context.job.ownerUserId}/${context.job.id}/webpage-intermediate-v1.json`;
      await options.storage.putObject({
        key: intermediateKey,
        bytes: new TextEncoder().encode(JSON.stringify(images.parsed)),
        contentType: "application/json",
        metadata: {
          owner: context.job.ownerUserId,
          "import-job-id": context.job.id,
          "schema-version": images.parsed.schemaVersion,
        },
      });
      const documentId = createUuidV7();
      const document = buildWebpageDocument({
        articleId: context.job.articleId ?? "",
        accountId: context.job.accountId,
        documentId,
        parsed: images.parsed,
        now: new Date(),
      });
      await context.progress(85, "正在提交网页中间结构");
      await options.database.db.transaction((transaction) =>
        persistImport({
          transaction,
          context,
          payload: jobPayload,
          parsed: images.parsed,
          strategy: fetched.strategy,
          redirects: fetched.redirects,
          httpFailureCode: fetched.httpFailureCode,
          failedImageCount: images.failedImageCount,
          intermediateKey,
          document,
          documentId,
        }),
      );
      await context.progress(95, "网页导入完成，等待结构确认", {
        blockCount: images.parsed.statistics.blockCount,
        imageCount: images.parsed.statistics.imageCount,
        warningCount: images.parsed.warnings.length,
      });
      return {
        articleId: context.job.articleId,
        sourceDocumentId: jobPayload.sourceDocumentId,
        documentId,
        intermediateRef: intermediateKey,
        finalUrl: images.parsed.finalUrl,
        fetchStrategy: fetched.strategy,
        blockCount: images.parsed.statistics.blockCount,
        imageCount: images.parsed.statistics.imageCount,
        warningCount: images.parsed.warnings.length,
      };
    } catch (error) {
      const retryable =
        error instanceof RetryableJobError ||
        error instanceof ObjectStorageError ||
        (isWebpageImportError(error)
          ? error.retryable
          : !(
              error instanceof PermanentJobError ||
              (isObject(error) && error.retryable === false)
            ));
      const code =
        error instanceof PermanentJobError || error instanceof RetryableJobError
          ? error.code
          : isWebpageImportError(error)
            ? error.code
            : error instanceof ObjectStorageError
              ? `OBJECT_STORAGE_${error.operation.toUpperCase()}_FAILED`
              : "WEBPAGE_IMPORT_FAILED";
      if (!retryable || context.attempt >= context.job.maxAttempts) {
        await markImportFailed(options.database, context, code);
      }
      if (error instanceof ObjectStorageError) {
        throw new RetryableJobError(code, "网页导入访问对象存储失败");
      }
      if (isWebpageImportError(error)) {
        throw error.retryable
          ? new RetryableJobError(error.code, error.message)
          : new PermanentJobError(error.code, error.message);
      }
      throw error;
    }
  };
}
