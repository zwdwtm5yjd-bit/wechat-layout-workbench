import type { DocumentV1 } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import {
  WECHAT_COMPATIBILITY_RULE_VERSION,
  WECHAT_COMPATIBILITY_RULES,
  WechatCompatibilityEngine,
} from "./index.js";

function attrs(blockId: string) {
  return { blockId, locked: false } as const;
}

function documentWith(content: DocumentV1["content"]["content"]): DocumentV1 {
  return {
    articleId: "article_compatibility_test",
    content: { content, type: "doc" },
    documentId: "document_compatibility_test",
    meta: {
      createdAt: "2026-07-31T10:00:00+08:00",
      sourceType: "manual",
      textLocked: true,
      updatedAt: "2026-07-31T10:00:00+08:00",
    },
    schemaVersion: "1.0.0",
  };
}

function fixedEngine(): WechatCompatibilityEngine {
  return new WechatCompatibilityEngine({
    now: () => new Date("2026-07-31T12:00:00.000Z"),
  });
}

function cleanDocument(): DocumentV1 {
  return documentWith([
    {
      attrs: { ...attrs("heading_clean"), level: 1 },
      content: [{ text: "兼容检查", type: "text" }],
      type: "heading",
    },
    {
      attrs: attrs("paragraph_clean"),
      content: [
        {
          marks: [
            {
              attrs: {
                href: "https://example.com/article",
                openInNewTab: true,
              },
              type: "link",
            },
          ],
          text: "安全链接",
          type: "text",
        },
      ],
      type: "paragraph",
    },
    {
      attrs: {
        ...attrs("image_clean"),
        alt: "兼容图片",
        resourceId: "resource_clean",
        widthMode: "full",
      },
      type: "imageBlock",
    },
  ]);
}

describe("WechatCompatibilityEngine", () => {
  it("为安全 Document JSON 和 Renderer 输出生成可复制的版本化报告", () => {
    const result = fixedEngine().check({
      document: cleanDocument(),
      resources: {
        resource_clean: "https://cdn.example.com/clean.png",
      },
    });

    expect(result.report).toEqual({
      canCopy: true,
      checkedAt: "2026-07-31T12:00:00.000Z",
      documentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      issues: [],
      mode: "standard",
      outputHash: result.renderResult?.outputHash,
      rendererVersion: "1.0.0",
      ruleVersion: WECHAT_COMPATIBILITY_RULE_VERSION,
      score: 100,
      status: "passed",
      summary: {
        autoFixable: 0,
        critical: 0,
        suggestion: 0,
        total: 0,
        warning: 0,
      },
    });
    expect(result.renderResult?.manifest.compatibilityRuleVersion).toBe(
      WECHAT_COMPATIBILITY_RULE_VERSION,
    );
    expect(Object.isFrozen(result.report)).toBe(true);
    expect(Object.isFrozen(result.report.issues)).toBe(true);
    expect(Object.isFrozen(WECHAT_COMPATIBILITY_RULES)).toBe(true);
    expect(WECHAT_COMPATIBILITY_RULES.every((rule) => Object.isFrozen(rule))).toBe(true);
  });

  it("识别危险标签、事件、非法 CSS、非法链接、超宽和空图片", () => {
    const html = [
      '<section style="margin:0;">',
      "<script>alert(1)</script>",
      '<div class="editor-control">保留文字</div>',
      '<img src="" srcset="javascript:alert(1)" style="width:calc(100% + 80px);position:FIXED;" onclick="alert(1)">',
      '<a href="javascript:alert(1)">危险链接</a>',
      "</section>",
    ].join("");
    const report = fixedEngine().checkHtml(html);
    const codes = new Set(report.issues.map((issue) => issue.code));

    expect(codes).toEqual(
      new Set([
        "CSS_POSITION_UNSAFE",
        "HTML_DANGEROUS_TAG",
        "HTML_EVENT_ATTRIBUTE",
        "HTML_TEXT_LEAF_MISSING",
        "HTML_UNSUPPORTED_ATTRIBUTE",
        "HTML_UNSUPPORTED_TAG",
        "HTML_URL_ATTRIBUTE_UNSAFE",
        "IMAGE_ALT_MISSING",
        "IMAGE_DRAGGABLE_MISSING",
        "IMAGE_MAX_WIDTH_MISSING",
        "IMAGE_SOURCE_MISSING",
        "IMAGE_WIDTH_OVERFLOW",
        "LINK_URL_INVALID",
      ]),
    );
    expect(report.canCopy).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.score).toBe(0);
    expect(report.ruleVersion).toBe("1.1.0");
    expect(report.summary.critical).toBeGreaterThan(0);
  });

  it("把文档级链接、图片和 SVG 问题定位到 Block ID", () => {
    const document = documentWith([
      {
        attrs: attrs("block_unsafe_link"),
        content: [
          {
            marks: [
              {
                attrs: {
                  href: "http://example.com/plain",
                  openInNewTab: false,
                },
                type: "link",
              },
            ],
            text: "HTTP 链接",
            type: "text",
          },
        ],
        type: "paragraph",
      },
      {
        attrs: {
          ...attrs("block_missing_image"),
          alt: "缺失图片",
          resourceId: "resource_missing",
        },
        type: "imageBlock",
      },
      {
        attrs: {
          ...attrs("block_svg"),
          configuration: { trigger: "click" },
          fallbackResourceId: "resource_svg_missing",
          interactionId: "interaction_compat",
          interactionType: "before_after",
          resourceIds: ["resource_before", "resource_after"],
          templateId: "template_compat",
          templateVersion: "1.0.0",
        },
        type: "svgInteraction",
      },
      {
        attrs: {
          ...attrs("block_component"),
          componentId: "component_missing_card",
          componentVersion: "1.0.0",
          title: "缺失组件",
        },
        content: [
          {
            attrs: attrs("block_component_body"),
            content: [{ text: "保留正文", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "semanticCard",
      },
    ]);
    const report = fixedEngine().check({ document }).report;

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockId: "block_unsafe_link",
          code: "LINK_URL_INVALID",
          source: "document",
        }),
        expect.objectContaining({
          blockId: "block_missing_image",
          code: "IMAGE_SOURCE_MISSING",
          source: "document",
        }),
        expect.objectContaining({
          blockId: "block_svg",
          code: "SVG_FALLBACK_MISSING",
          source: "document",
        }),
        expect.objectContaining({
          blockId: "block_component",
          code: "COMPONENT_UNAVAILABLE",
          source: "renderer",
        }),
      ]),
    );
    expect(report.canCopy).toBe(false);
  });

  it("安全修复只生成预览副本，不修改权威文档", () => {
    const source = documentWith([
      {
        attrs: attrs("block_fix_link"),
        content: [
          {
            marks: [
              {
                attrs: {
                  href: "http://example.com/plain",
                  openInNewTab: false,
                },
                type: "link",
              },
              { type: "bold" },
            ],
            text: "保留链接文字",
            type: "text",
          },
        ],
        type: "paragraph",
      },
      {
        attrs: {
          ...attrs("block_fix_image"),
          alt: "超宽图片",
          resourceId: "resource_fix",
          widthMode: "percent",
          widthPercent: 140,
        },
        type: "imageBlock",
      },
    ]) as unknown as DocumentV1;
    const original = structuredClone(source);
    const preview = fixedEngine().previewFixes({
      document: source,
      resources: {
        resource_fix: "https://cdn.example.com/fix.png",
      },
    });
    const fixed = preview.fixedDocument as DocumentV1;
    const fixedParagraph = fixed.content.content[0];
    const fixedImage = fixed.content.content[1];

    expect(source).toEqual(original);
    expect(preview.changed).toBe(true);
    expect(preview.appliedIssueIds).toHaveLength(2);
    expect(preview.before.canCopy).toBe(false);
    expect(preview.after).toMatchObject({
      canCopy: true,
      score: 100,
      status: "passed",
    });
    expect(fixedParagraph?.type).toBe("paragraph");
    if (fixedParagraph?.type === "paragraph") {
      expect(fixedParagraph.content?.[0]).toEqual({
        marks: [{ type: "bold" }],
        text: "保留链接文字",
        type: "text",
      });
    }
    expect(fixedImage?.type).toBe("imageBlock");
    if (fixedImage?.type === "imageBlock") {
      expect(fixedImage.attrs.widthPercent).toBe(100);
    }
    expect(preview.fixedHtml).toContain("保留链接文字");
  });

  it("HTML 自动修复预览移除危险结构并约束图片宽度", () => {
    const html = [
      "<script>alert(1)</script>",
      '<div class="editor-shell">保留正文</div>',
      '<img alt="安全图" src="https://cdn.example.com/image.png" style="width:140%;position:fixed;" onload="alert(1)">',
      '<a href="http://example.com">保留链接文字</a>',
    ].join("");
    const preview = fixedEngine().previewHtmlFixes(html);

    expect(preview.before.canCopy).toBe(false);
    expect(preview.appliedIssueIds.length).toBeGreaterThan(0);
    expect(preview.fixedHtml).not.toContain("<script");
    expect(preview.fixedHtml).not.toContain("editor-shell");
    expect(preview.fixedHtml).not.toContain("onload");
    expect(preview.fixedHtml).not.toContain("position:");
    expect(preview.fixedHtml).not.toContain("http://example.com");
    expect(preview.fixedHtml).toContain("保留正文");
    expect(preview.fixedHtml).toContain("保留链接文字");
    expect(preview.fixedHtml).toContain("max-width:100%");
    expect(preview.fixedHtml).toContain("width:100%");
    expect(preview.after).toMatchObject({
      canCopy: true,
      score: 100,
      status: "passed",
    });
  });

  it("安全模式识别复杂背景、阴影和非 static 定位", () => {
    const html =
      '<section style="background:linear-gradient(90deg,#fff,#000);box-shadow:0 4px 8px #000;position:relative;">安全模式</section>';
    const report = fixedEngine().checkHtml(html, {
      mode: "wechat_safe",
    });

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CSS_PROPERTY_FORBIDDEN",
          details: expect.objectContaining({ property: "background" }),
        }),
        expect.objectContaining({
          code: "CSS_PROPERTY_FORBIDDEN",
          details: expect.objectContaining({ property: "box-shadow" }),
        }),
        expect.objectContaining({
          code: "CSS_POSITION_UNSAFE",
          details: expect.objectContaining({ property: "position" }),
        }),
      ]),
    );
    expect(report.canCopy).toBe(false);
  });
});
