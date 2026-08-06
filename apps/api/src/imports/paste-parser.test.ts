import { validateDocument } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import { buildImportedDocument, parsePasteImport } from "./paste-parser.js";

describe("paste import parser", () => {
  it("imports Word HTML while removing scripts, hidden nodes and Office styles", () => {
    const parsed = parsePasteImport({
      cleaningMode: "preserve_structure",
      detectedSourceHint: "auto",
      plainText: "整改工作报告\n一、总体情况\n这是正文。",
      html: `
        <html xmlns:o="urn:schemas-microsoft-com:office:office">
          <script>alert("secret")</script>
          <p class="MsoTitle" style="font-family:宋体"><b>整改工作报告</b></p>
          <p style="mso-hide:all">隐藏批注</p>
          <h2 style="font-size:18pt">一、总体情况</h2>
          <p class="MsoNormal"><span style="color:red">这是正文。</span></p>
        </html>
      `,
    });

    expect(parsed.detectedSource).toBe("word");
    expect(parsed.originalText).toBe("整改工作报告\n一、总体情况\n这是正文。");
    expect(parsed.blocks.map((block) => block.text)).toEqual([
      "整改工作报告",
      "一、总体情况",
      "这是正文。",
    ]);
    expect(parsed.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SECURITY_CONTENT_REMOVED", count: 1 }),
        expect.objectContaining({ code: "HIDDEN_CONTENT_REMOVED", count: 1 }),
        expect.objectContaining({ code: "STYLE_CLEANED" }),
      ]),
    );
    expect(JSON.stringify(parsed)).not.toContain('alert("secret")');
    expect(JSON.stringify(parsed)).not.toContain("隐藏批注");
  });

  it("imports WPS lists and safe links without retaining unsafe protocols", () => {
    const parsed = parsePasteImport({
      cleaningMode: "preserve_structure",
      detectedSourceHint: "auto",
      html: `
        <div data-wps="true" class="wps-content">
          <h1>办事指南</h1>
          <ol start="2">
            <li><a href="https://example.com/a">准备材料</a></li>
            <li><a href="javascript:alert(1)">提交申请</a></li>
          </ol>
        </div>
      `,
    });

    expect(parsed.detectedSource).toBe("wps");
    expect(parsed.blocks.map((block) => block.role)).toEqual([
      "title",
      "ordered_item",
      "ordered_item",
    ]);
    expect(parsed.blocks[1]?.styleMetadata.inlineContent).toEqual([
      {
        marks: [{ attrs: { href: "https://example.com/a" }, type: "link" }],
        text: "准备材料",
        type: "text",
      },
    ]);
    expect(JSON.stringify(parsed.blocks[2]?.styleMetadata)).not.toContain("javascript:");
    expect(parsed.warnings).toContainEqual(
      expect.objectContaining({ code: "UNSAFE_LINK_REMOVED", count: 1 }),
    );
  });

  it("flattens web tables and extracts external image references with clear warnings", () => {
    const parsed = parsePasteImport({
      cleaningMode: "preserve_compatible",
      detectedSourceHint: "web",
      html: `
        <article>
          <h1>网页文章</h1>
          <table><tr><th>项目</th><th>数量</th></tr><tr><td>案例</td><td>3</td></tr></table>
          <img src="https://cdn.example.com/photo.png" alt="现场照片">
          <img src="data:image/png;base64,SECRET" alt="内联图">
        </article>
      `,
    });

    expect(parsed.statistics.tableCount).toBe(1);
    expect(parsed.statistics.imageCount).toBe(2);
    expect(parsed.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "项目 ｜ 数量", role: "paragraph" }),
        expect.objectContaining({
          relationMetadata: expect.objectContaining({
            sourceUrl: "https://cdn.example.com/photo.png",
          }),
          role: "image_reference",
        }),
        expect.objectContaining({
          relationMetadata: expect.objectContaining({ sourceUrl: null }),
          role: "image_reference",
        }),
      ]),
    );
    expect(parsed.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_STRUCTURE_FLATTENED" }),
        expect.objectContaining({ code: "EXTERNAL_IMAGE_REFERENCE", count: 2 }),
      ]),
    );
    expect(JSON.stringify(parsed)).not.toContain("base64,SECRET");
  });

  it("uses plain text as traceable source and produces a valid Document Schema V1 document", () => {
    const parsed = parsePasteImport({
      cleaningMode: "plain_text",
      detectedSourceHint: "plain_text",
      plainText: "年度总结\n（一）主要成绩\n第一段正文。\n第二段正文。",
      html: "<script>window.hidden = true</script><h1>不会采用的 HTML</h1>",
    });
    const document = buildImportedDocument({
      accountId: null,
      articleId: "019c0000-0000-7000-8000-000000000002",
      blocks: parsed.blocks,
      documentId: "019c0000-0000-7000-8000-000000000001",
      documentSourceType: parsed.documentSourceType,
      now: new Date("2026-07-30T00:00:00.000Z"),
      originalTextHash: parsed.originalTextHash,
    });

    expect(parsed.documentSourceType).toBe("plainText");
    expect(parsed.warnings).toContainEqual(
      expect.objectContaining({ code: "SECURITY_CONTENT_REMOVED", count: 1 }),
    );
    expect(parsed.originalText).toBe("年度总结\n（一）主要成绩\n第一段正文。\n第二段正文。");
    expect(document.meta.originalTextHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(document.content.content.map((node) => node.type)).toEqual([
      "heading",
      "heading",
      "paragraph",
      "paragraph",
    ]);
    expect(validateDocument(document)).toEqual(expect.objectContaining({ success: true }));
  });

  it("inserts uploaded private images at selected paragraph positions", () => {
    const firstResourceId = "019c0000-0000-7000-8000-000000000011";
    const secondResourceId = "019c0000-0000-7000-8000-000000000012";
    const parsed = parsePasteImport({
      cleaningMode: "preserve_structure",
      detectedSourceHint: "plain_text",
      plainText: "活动回顾\n第一段正文。\n第二段正文。",
      images: [
        {
          resourceId: firstResourceId,
          placementIndex: 1,
          alt: "活动现场.jpg",
          caption: "活动现场合影",
        },
        {
          resourceId: secondResourceId,
          placementIndex: 99,
          alt: "成果展示.png",
        },
      ],
    });
    const document = buildImportedDocument({
      accountId: null,
      articleId: "019c0000-0000-7000-8000-000000000002",
      blocks: parsed.blocks,
      documentId: "019c0000-0000-7000-8000-000000000001",
      documentSourceType: parsed.documentSourceType,
      now: new Date("2026-07-30T00:00:00.000Z"),
      originalTextHash: parsed.originalTextHash,
    });

    expect(parsed.originalText).toBe("活动回顾\n第一段正文。\n第二段正文。");
    expect(parsed.statistics.imageCount).toBe(2);
    expect(parsed.blocks.map((block) => block.role)).toEqual([
      "title",
      "image_reference",
      "paragraph",
      "paragraph",
      "image_reference",
    ]);
    expect(document.content.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "imageBlock",
          attrs: expect.objectContaining({
            resourceId: firstResourceId,
            alt: "活动现场.jpg",
            caption: "活动现场合影",
          }),
        }),
        expect.objectContaining({
          type: "imageBlock",
          attrs: expect.objectContaining({ resourceId: secondResourceId }),
        }),
      ]),
    );
    expect(validateDocument(document)).toEqual(expect.objectContaining({ success: true }));
  });
});
