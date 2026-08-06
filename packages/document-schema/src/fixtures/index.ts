import type { DocumentV1 } from "../document.js";

const sourceTextHash = `sha256:${"a".repeat(64)}`;

export const documentV1Fixture = {
  schemaVersion: "1.0.0",
  documentId: "doc_fixture_v1",
  articleId: "article_fixture_v1",
  accountId: "account_fixture",
  themeId: "theme_fixture",
  themeVersion: "1.0.0",
  brandVersion: "1.0.0",
  content: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: {
          blockId: "block_heading",
          sourceBlockId: "source_heading",
          semanticRole: "section_heading",
          styleRef: "heading.level1.default",
          locked: true,
          sourceTextHash,
          level: 1,
          numbering: "一、",
        },
        content: [
          {
            type: "text",
            text: "Document Schema V1",
            marks: [
              {
                type: "bold",
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: {
          blockId: "block_paragraph",
          sourceBlockId: "source_paragraph",
          semanticRole: "body",
          styleRef: "paragraph.default",
          styleOverrides: {
            textColor: "#222222",
            fontSize: 16,
            lineHeight: 1.8,
            textAlign: "justify",
          },
          locked: true,
          sourceTextHash,
          indentMode: "none",
        },
        content: [
          {
            type: "text",
            text: "正文支持",
            marks: [
              {
                type: "italic",
              },
              {
                type: "underline",
              },
              {
                type: "strike",
              },
            ],
          },
          {
            type: "hardBreak",
          },
          {
            type: "text",
            text: "受控行内样式",
            marks: [
              {
                type: "textColor",
                attrs: {
                  color: "#B42318",
                },
              },
              {
                type: "backgroundColor",
                attrs: {
                  color: "#FFF1F0",
                },
              },
              {
                type: "link",
                attrs: {
                  href: "https://example.com/schema",
                  openInNewTab: true,
                },
              },
              {
                type: "fontSize",
                attrs: {
                  size: 16,
                },
              },
              {
                type: "fontFamily",
                attrs: {
                  family: '"PingFang SC", "Microsoft YaHei", sans-serif',
                },
              },
            ],
          },
        ],
      },
      {
        type: "decorativeContainer",
        attrs: {
          blockId: "block_decorative_container",
          locked: false,
          compatibilityLevel: "conditional",
          resourceId: "builtin_visual_static_005",
          decorationType: "frame",
          minHeight: 160,
        },
        content: [
          {
            type: "text",
            text: "可编辑装饰容器",
          },
        ],
      },
      {
        type: "blockquote",
        attrs: {
          blockId: "block_quote",
          sourceBlockId: "source_quote",
          semanticRole: "citation",
          locked: true,
          sourceTextHash,
          quoteType: "citation",
          source: "测试 Fixture",
          showQuotes: true,
          showSource: true,
        },
        content: [
          {
            type: "paragraph",
            attrs: {
              blockId: "block_quote_paragraph",
              sourceBlockId: "source_quote_paragraph",
              semanticRole: "body",
              locked: true,
              sourceTextHash,
            },
            content: [
              {
                type: "text",
                text: "引用内容",
              },
            ],
          },
        ],
      },
      {
        type: "bulletList",
        attrs: {
          blockId: "block_bullet_list",
          semanticRole: "feature_list",
          locked: false,
          bulletStyle: "check",
          indentLevel: 0,
        },
        content: [
          {
            type: "listItem",
            attrs: {
              blockId: "block_bullet_item",
              semanticRole: "list_item",
              locked: false,
            },
            content: [
              {
                type: "paragraph",
                attrs: {
                  blockId: "block_bullet_item_paragraph",
                  semanticRole: "body",
                  locked: false,
                },
                content: [
                  {
                    type: "text",
                    text: "无序列表项",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        attrs: {
          blockId: "block_ordered_list",
          sourceBlockId: "source_ordered_list",
          semanticRole: "steps",
          locked: true,
          sourceTextHash,
          start: 1,
          numberingStyle: "chinese",
          indentLevel: 0,
          preserveOriginalNumbering: true,
        },
        content: [
          {
            type: "listItem",
            attrs: {
              blockId: "block_ordered_item",
              sourceBlockId: "source_ordered_item",
              semanticRole: "list_item",
              locked: true,
              sourceTextHash,
              originalNumberText: "一、",
            },
            content: [
              {
                type: "paragraph",
                attrs: {
                  blockId: "block_ordered_item_paragraph",
                  sourceBlockId: "source_ordered_item_paragraph",
                  semanticRole: "body",
                  locked: true,
                  sourceTextHash,
                },
                content: [
                  {
                    type: "text",
                    text: "保留原始编号",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "imageBlock",
        attrs: {
          blockId: "block_image",
          semanticRole: "illustration",
          styleRef: "image.default",
          locked: false,
          compatibilityLevel: "safe",
          resourceId: "resource_image",
          originalResourceId: "resource_image_original",
          alt: "测试图片",
          caption: "图片节点只保存资源 ID",
          widthMode: "full",
          widthPercent: 100,
          aspectRatio: "16:9",
          objectFit: "cover",
        },
      },
      {
        type: "divider",
        attrs: {
          blockId: "block_divider",
          semanticRole: "decoration",
          styleRef: "divider.default",
          locked: false,
          compatibilityLevel: "safe",
          variant: "solid",
          widthPercent: 100,
          align: "center",
          spacingBefore: 16,
          spacingAfter: 16,
        },
      },
      {
        type: "semanticCard",
        attrs: {
          blockId: "block_semantic_card",
          semanticRole: "legal_issue",
          styleRef: "component.legal.focus",
          locked: false,
          compatibilityLevel: "safe",
          componentId: "component_legal_focus",
          componentVersion: "1.1.0",
          variant: "line-left",
          eyebrow: "争议焦点",
          title: "语义与视觉分离",
        },
        content: [
          {
            type: "paragraph",
            attrs: {
              blockId: "block_semantic_card_body",
              semanticRole: "body",
              locked: false,
            },
            content: [
              {
                type: "text",
                text: "正文 Slot 继续使用受控子节点。",
              },
            ],
          },
        ],
      },
      {
        type: "brandFooter",
        attrs: {
          blockId: "block_brand_footer",
          semanticRole: "brand_footer",
          styleRef: "footer.brand.default",
          locked: true,
          compatibilityLevel: "safe",
          accountId: "account_fixture",
          templateId: "footer_template_fixture",
          mode: "frozen",
          autoUpdate: false,
          frozenVersion: "1.0.0",
        },
        content: [
          {
            type: "paragraph",
            attrs: {
              blockId: "block_brand_footer_text",
              semanticRole: "copyright",
              locked: true,
            },
            content: [
              {
                type: "text",
                text: "公众号品牌页脚",
              },
            ],
          },
        ],
      },
      {
        type: "svgInteraction",
        attrs: {
          blockId: "block_svg_placeholder",
          semanticRole: "before_after",
          styleRef: "svg.default",
          locked: false,
          compatibilityLevel: "conditional",
          interactionId: "interaction_fixture",
          templateId: "svg_before_after_slider",
          templateVersion: "1.0.0",
          interactionType: "before_after",
          configuration: {
            trigger: "click",
            animationDuration: 400,
          },
          resourceIds: ["resource_before", "resource_after"],
          fallbackResourceId: "resource_static_fallback",
        },
      },
    ],
  },
  meta: {
    sourceType: "docx",
    originalFileId: "file_fixture",
    originalTextHash: sourceTextHash,
    textLocked: true,
    createdAt: "2026-07-30T10:00:00+08:00",
    updatedAt: "2026-07-30T10:00:00+08:00",
  },
} satisfies DocumentV1;
