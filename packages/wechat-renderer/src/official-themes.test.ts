import { OFFICIAL_THEME_PACKAGES } from "@wechat-layout/design-tokens";
import type { DocumentV1, ParagraphNode } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import { renderWechatHtml } from "./renderer.js";

const bodyText =
  "主题应用只能改变视觉表达，不得改写、删减或重排原文的语义。标题、正文、引用、图片和数据卡应形成统一、稳定的阅读节奏。";

function blockAttrs(blockId: string, semanticRole: string) {
  return { blockId, locked: false, semanticRole };
}

function paragraph(blockId: string, text: string): ParagraphNode {
  return {
    type: "paragraph",
    attrs: { ...blockAttrs(blockId, "body"), styleRef: "paragraph.default" },
    content: [{ type: "text", text }],
  };
}

function longThemeDocument(): DocumentV1 {
  const repeated = Array.from({ length: 54 }, (_, index) =>
    paragraph(`theme_long_body_${String(index + 1)}`, bodyText),
  );
  return {
    schemaVersion: "1.0.0",
    documentId: "document_theme_acceptance",
    articleId: "article_theme_acceptance",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: {
            ...blockAttrs("theme_heading_1", "section_heading"),
            level: 1,
            styleRef: "heading.level1.default",
          },
          content: [{ type: "text", text: "主题验收长文" }],
        },
        ...repeated.slice(0, 14),
        {
          type: "heading",
          attrs: {
            ...blockAttrs("theme_heading_2", "subsection_heading"),
            level: 2,
            styleRef: "heading.level2.default",
          },
          content: [{ type: "text", text: "第二层阅读秩序" }],
        },
        ...repeated.slice(14, 28),
        {
          type: "heading",
          attrs: {
            ...blockAttrs("theme_heading_3", "minor_heading"),
            level: 3,
            styleRef: "heading.level3.default",
          },
          content: [{ type: "text", text: "第三层信息提示" }],
        },
        ...repeated.slice(28),
        {
          type: "blockquote",
          attrs: {
            ...blockAttrs("theme_quote", "citation"),
            quoteType: "citation",
            showQuotes: true,
            showSource: true,
            source: "主题验收规范",
            styleRef: "quote.default",
          },
          content: [paragraph("theme_quote_body", "排版服务内容，不代替内容。")],
        },
        {
          type: "imageBlock",
          attrs: {
            ...blockAttrs("theme_image", "illustration"),
            alt: "主题图片验收",
            caption: "图片说明继承主题 Token",
            resourceId: "theme_image_resource",
            styleRef: "image.default",
            widthMode: "full",
          },
        },
        {
          type: "semanticCard",
          attrs: {
            ...blockAttrs("theme_data_card", "data"),
            componentId: "component_data_metric",
            componentVersion: "1.0.0",
            eyebrow: "原文变化",
            footer: "渲染完整性校验",
            styleRef: "card.data.default",
            title: "0",
          },
          content: [paragraph("theme_data_body", "所有主题共用同一份权威文档。")],
        },
        {
          type: "divider",
          attrs: {
            ...blockAttrs("theme_divider", "decoration"),
            styleRef: "divider.default",
            variant: "solid",
            widthPercent: 100,
          },
        },
        {
          type: "brandFooter",
          attrs: {
            ...blockAttrs("theme_footer", "brand_footer"),
            accountId: "account_theme_acceptance",
            autoUpdate: false,
            frozenVersion: "1.0.0",
            mode: "frozen",
            styleRef: "footer.brand.default",
            templateId: "footer_theme_acceptance",
          },
          content: [paragraph("theme_footer_body", "让内容被稳定、清晰地阅读。")],
        },
      ],
    },
    meta: {
      createdAt: "2026-08-01T00:00:00+08:00",
      sourceType: "manual",
      textLocked: true,
      updatedAt: "2026-08-01T00:00:00+08:00",
    },
  };
}

describe("official theme rendering", () => {
  it("keeps a 3000-character article intact across all themes and safe mode", () => {
    const document = longThemeDocument();
    const outputs = OFFICIAL_THEME_PACKAGES.map((theme) => {
      const input = {
        document,
        resources: { theme_image_resource: "https://cdn.example.com/theme.jpg" },
        theme: theme.tokens,
      };
      const standard = renderWechatHtml({ ...input, mode: "standard" });
      const safe = renderWechatHtml({ ...input, mode: "wechat_safe" });

      expect(standard.plainText.length).toBeGreaterThanOrEqual(3000);
      expect(standard.textIntegrity.unchanged).toBe(true);
      expect(safe.textIntegrity).toEqual(standard.textIntegrity);
      expect(safe.html).toContain("max-width:100%");
      expect(safe.html).toContain(theme.preview.accentColors[0]);
      expect(safe.html).not.toContain("<script");
      expect(safe.html).toContain("第三层信息提示");
      return safe;
    });

    expect(outputs[0]?.plainText).toBe(outputs[1]?.plainText);
    expect(outputs[0]?.outputHash).not.toBe(outputs[1]?.outputHash);
  });
});
