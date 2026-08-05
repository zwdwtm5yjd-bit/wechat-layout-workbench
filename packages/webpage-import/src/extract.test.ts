import { describe, expect, it } from "vitest";

import { parseWebpage, webpageNeedsBrowserFallback } from "./extract.js";

describe("webpage extraction", () => {
  it("uses Readability and removes scripts, ads, handlers, and unsafe links", () => {
    const paragraphs = Array.from(
      { length: 5 },
      (_, index) =>
        `<p onclick="steal()">这是第 ${String(index + 1)} 段正文，用于验证普通资讯文章可以被稳定提取和清洗。</p>`,
    ).join("");
    const parsed = parseWebpage({
      requestedUrl: "https://news.example/story",
      finalUrl: "https://news.example/story",
      html: `<!doctype html><html><head><title>测试资讯</title><script>alert(1)</script></head><body><nav>导航</nav><article><h1>测试资讯</h1>${paragraphs}<div class="advertisement">广告</div><a href="javascript:alert(1)">危险</a><img src="/cover.png" alt="封面"></article></body></html>`,
    });
    expect(parsed.title).toContain("测试资讯");
    expect(parsed.originalText).toContain("这是第 1 段正文");
    expect(parsed.originalText).not.toContain("广告");
    expect(parsed.sanitizedHtml).not.toMatch(/script|onclick|javascript:/i);
    expect(parsed.sourceBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "image_reference",
          relationMetadata: expect.objectContaining({
            sourceUrl: "https://news.example/cover.png",
          }),
        }),
      ]),
    );
    expect(parsed.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "SECURITY_CONTENT_REMOVED" })]),
    );
    expect(webpageNeedsBrowserFallback(parsed)).toBe(false);
  });

  it("marks an empty JavaScript shell for browser fallback", () => {
    const parsed = parseWebpage({
      requestedUrl: "https://app.example/story",
      finalUrl: "https://app.example/story",
      html: "<html><head><title>Loading</title></head><body><div id='app'></div></body></html>",
    });
    expect(webpageNeedsBrowserFallback(parsed)).toBe(true);
  });
});
