import { createUuidV7 } from "@wechat-layout/database";
import {
  WebpageImportError,
  type ParsedWebpage,
  type SafeFetchResult,
} from "@wechat-layout/webpage-import";
import { describe, expect, it, vi } from "vitest";

import {
  buildWebpageDocument,
  detectRasterImage,
  fetchAndParseWebpage,
} from "./webpage-handler.js";

const articleHtml = `<!doctype html><html><head><title>正文标题</title></head><body><article><h1>正文标题</h1>${Array.from(
  { length: 6 },
  (_, index) =>
    `<p>这是第 ${String(index + 1)} 段资讯正文，用于验证网页导入正常提取完整文章结构。</p>`,
).join("")}<img src="https://cdn.example/cover.png" alt="封面"></article></body></html>`;

function response(html: string): SafeFetchResult {
  return {
    requestedUrl: "https://news.example/story",
    finalUrl: "https://news.example/story",
    status: 200,
    contentType: "text/html",
    bytes: new TextEncoder().encode(html),
    redirects: [],
  };
}

describe("webpage worker pipeline", () => {
  it("keeps an ordinary article on the pinned HTTP path", async () => {
    const renderer = vi.fn();
    const result = await fetchAndParseWebpage({
      requestedUrl: "https://news.example/story",
      maximumHtmlBytes: 1024 * 1024,
      fetchTimeoutMs: 1000,
      maximumRedirects: 5,
      signal: undefined,
      fetcher: vi.fn(async () => response(articleHtml)),
      renderer,
    });
    expect(result.strategy).toBe("http");
    expect(result.parsed.originalText).toContain("第 1 段资讯正文");
    expect(renderer).not.toHaveBeenCalled();
  });

  it("falls back to the isolated browser for a JavaScript shell", async () => {
    const renderer = vi.fn(async () => ({
      finalUrl: "https://app.example/story",
      html: articleHtml,
    }));
    const result = await fetchAndParseWebpage({
      requestedUrl: "https://app.example/story",
      maximumHtmlBytes: 1024 * 1024,
      fetchTimeoutMs: 1000,
      maximumRedirects: 5,
      signal: undefined,
      fetcher: vi.fn(async () => response("<html><body><div id='app'></div></body></html>")),
      renderer,
    });
    expect(result.strategy).toBe("browser");
    expect(result.httpFailureCode).toBe("WEBPAGE_HTTP_CONTENT_INSUFFICIENT");
    expect(renderer).toHaveBeenCalledOnce();
  });

  it("never bypasses an SSRF rejection through browser fallback", async () => {
    const renderer = vi.fn();
    await expect(
      fetchAndParseWebpage({
        requestedUrl: "http://127.0.0.1/admin",
        maximumHtmlBytes: 1024,
        fetchTimeoutMs: 1000,
        maximumRedirects: 5,
        signal: undefined,
        fetcher: vi.fn(async () => {
          throw new WebpageImportError("WEBPAGE_URL_BLOCKED", "blocked", false);
        }),
        renderer,
      }),
    ).rejects.toMatchObject({ code: "WEBPAGE_URL_BLOCKED" });
    expect(renderer).not.toHaveBeenCalled();
  });

  it("accepts only raster image signatures", () => {
    expect(detectRasterImage(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toEqual({
      mimeType: "image/png",
      extension: "png",
    });
    expect(detectRasterImage(new TextEncoder().encode("<svg><script/></svg>"))).toBeNull();
  });

  it("builds downloaded images into a valid locked Document V1", () => {
    const sourceBlockId = "web_0001";
    const textHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const intermediate: ParsedWebpage = {
      schemaVersion: "1.0.0",
      parserVersion: "test",
      requestedUrl: "https://news.example/story",
      finalUrl: "https://news.example/story",
      title: "正文标题",
      byline: null,
      excerpt: null,
      siteName: null,
      language: "zh-CN",
      originalText: "",
      originalTextHash: textHash,
      sanitizedHtml: "<img src='https://cdn.example/cover.png'>",
      sanitizedHtmlHash: "a".repeat(64),
      sourceBlocks: [
        {
          sourceBlockId,
          sourceType: "img",
          role: "image_reference",
          text: "",
          textHash,
          orderIndex: 0,
          styleMetadata: { originalTag: "img" },
          relationMetadata: {
            sourceUrl: "https://cdn.example/cover.png",
            resourceId: createUuidV7(),
          },
        },
      ],
      warnings: [],
      statistics: {
        wordCount: 0,
        characterCount: 0,
        blockCount: 1,
        headingCount: 0,
        imageCount: 1,
        tableCount: 0,
        removedStyleCount: 0,
        removedSecurityNodeCount: 0,
        removedHiddenNodeCount: 0,
        removedUnsafeLinkCount: 0,
      },
    };
    const document = buildWebpageDocument({
      articleId: createUuidV7(),
      accountId: null,
      documentId: createUuidV7(),
      parsed: intermediate,
      now: new Date("2026-08-04T00:00:00.000Z"),
    });
    expect(document.content.content[0]).toMatchObject({ type: "imageBlock" });
  });
});
