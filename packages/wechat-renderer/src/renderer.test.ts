import {
  LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION,
  ComponentRegistry,
  type LegacyComponentManifest,
} from "@wechat-layout/component-registry";
import type { BlockNode, DocumentV1 } from "@wechat-layout/document-schema";
import { describe, expect, it } from "vitest";

import {
  RendererRegistrationError,
  WECHAT_RENDERER_VERSION,
  WechatComponentRendererRegistry,
  WechatHtmlRenderer,
  WechatNodeRendererRegistry,
  htmlElement,
  renderWechatHtml,
} from "./index.js";

function attrs(blockId: string) {
  return { blockId, locked: false } as const;
}

function paragraph(
  blockId: string,
  text: string,
): Extract<BlockNode, { readonly type: "paragraph" }> {
  return {
    attrs: attrs(blockId),
    content: [{ text, type: "text" }],
    type: "paragraph",
  };
}

function documentWith(content: DocumentV1["content"]["content"]): DocumentV1 {
  return {
    articleId: "article_renderer_test",
    content: { content, type: "doc" },
    documentId: "document_renderer_test",
    meta: {
      createdAt: "2026-07-31T10:00:00+08:00",
      sourceType: "manual",
      textLocked: true,
      updatedAt: "2026-07-31T10:00:00+08:00",
    },
    schemaVersion: "1.0.0",
  };
}

function representativeDocument(): DocumentV1 {
  return documentWith([
    ...([1, 2, 3] as const).map((level) => ({
      attrs: {
        ...attrs(`heading_${String(level)}`),
        level,
        numbering: `${String(level)}.`,
      },
      content: [{ text: `第${String(level)}级标题`, type: "text" as const }],
      type: "heading" as const,
    })),
    {
      attrs: attrs("paragraph_main"),
      content: [
        {
          marks: [{ type: "bold" }, { type: "underline" }],
          text: "正文<script>不是标签</script>",
          type: "text",
        },
        { type: "hardBreak" },
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
        ...attrs("quote"),
        showSource: true,
        source: "Renderer 测试",
      },
      content: [paragraph("quote_body", "引用正文")],
      type: "blockquote",
    },
    {
      attrs: { ...attrs("bullet_list"), bulletStyle: "check" },
      content: [
        {
          attrs: attrs("bullet_item"),
          content: [paragraph("bullet_body", "无序列表项")],
          type: "listItem",
        },
      ],
      type: "bulletList",
    },
    {
      attrs: {
        ...attrs("ordered_list"),
        preserveOriginalNumbering: true,
        start: 3,
      },
      content: [
        {
          attrs: {
            ...attrs("ordered_item"),
            originalNumberText: "三、",
          },
          content: [paragraph("ordered_body", "保留原始编号")],
          type: "listItem",
        },
      ],
      type: "orderedList",
    },
    {
      attrs: {
        ...attrs("image"),
        alt: "测试图片",
        caption: "图片说明",
        objectFit: "cover",
        resourceId: "resource_image",
        widthMode: "full",
      },
      type: "imageBlock",
    },
    {
      attrs: {
        ...attrs("divider"),
        spacingAfter: 8,
        spacingBefore: 8,
        variant: "solid",
      },
      type: "divider",
    },
    {
      attrs: {
        ...attrs("svg"),
        configuration: { trigger: "click" },
        fallbackResourceId: "resource_svg_fallback",
        interactionId: "interaction_test",
        interactionType: "before_after",
        resourceIds: ["resource_before", "resource_after"],
        templateId: "template_before_after",
        templateVersion: "1.0.0",
      },
      type: "svgInteraction",
    },
  ]);
}

function componentManifest(
  overrides: Partial<LegacyComponentManifest> = {},
): LegacyComponentManifest {
  return {
    adjustableProperties: ["backgroundColor", "paddingTop"],
    category: "CARD",
    compatibilityLevel: "safe",
    componentId: "cmp_card_renderer_test_001",
    defaultTokenMap: {
      backgroundColor: "#FFF7ED",
      compatibilityLevel: "safe",
      paddingTop: 18,
    },
    defaultVariantId: "default",
    editorRendererKey: "RendererTestNodeView",
    fallback: {
      kind: "semantic_card",
      preserveOriginalText: true,
      rendererKey: "safePlaceholder",
    },
    name: "Renderer 测试卡片",
    nodeType: "semanticCard",
    schemaVersion: LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION,
    semanticRoles: ["summary"],
    slots: [],
    variants: [
      { name: "默认", variantId: "default" },
      {
        name: "强调",
        tokenMap: { borderWidth: 1 },
        variantId: "accent",
      },
    ],
    version: "1.2.0",
    wechatRendererKey: "rendererTestCard",
    ...overrides,
  };
}

describe("WechatHtmlRenderer", () => {
  it("渲染三级标题、列表、引用、图片与静态 SVG，并保持原文哈希", () => {
    const source = representativeDocument();
    const original = structuredClone(source);
    const result = renderWechatHtml({
      document: source,
      resources: {
        resource_image: {
          alt: "资源 Alt",
          url: "https://cdn.example.com/article/image.png#preview",
        },
        resource_svg_fallback: "https://cdn.example.com/article/svg-fallback.png",
      },
    });

    expect(source).toEqual(original);
    expect(result.rendererVersion).toBe(WECHAT_RENDERER_VERSION);
    expect(result.textIntegrity).toMatchObject({
      unchanged: true,
      renderedTextHash: result.textIntegrity.sourceTextHash,
    });
    expect(result.outputHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.manifest).toEqual({
      componentVersions: [],
      compatibilityRuleVersion: "1.1.0",
      documentSchemaVersion: "1.0.0",
      rendererVersion: WECHAT_RENDERER_VERSION,
      resourceIds: ["resource_image", "resource_svg_fallback"],
    });

    for (const text of ["第1级标题", "第2级标题", "第3级标题"]) {
      expect(result.html).toContain(text);
    }
    expect(result.html).toContain("<blockquote");
    expect(result.html).toContain("<ul");
    expect(result.html).toContain('<ol start="3"');
    expect(result.html).toContain("list-style-type:none");
    expect(result.html).toMatch(
      /三、 <\/span><span leaf="" style="[^"]*display:inline[^"]*">保留原始编号/u,
    );
    expect(result.html).toContain('src="https://cdn.example.com/article/image.png"');
    expect(result.html).toContain("图片说明");
    expect(result.html).toContain('src="https://cdn.example.com/article/svg-fallback.png"');
    expect(result.html).not.toMatch(/<(?:script|style|iframe|button|input)\b/i);
    expect(result.html).not.toContain("contenteditable");
    expect(result.html).not.toContain("ProseMirror");
    expect(result.html).not.toContain('class="');
    expect(result.html).toContain("&lt;script&gt;不是标签&lt;/script&gt;");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "SVG_STATIC_FALLBACK" }),
    );
  });

  it("生成稳定的全内联 HTML 快照", () => {
    const result = renderWechatHtml({
      document: documentWith([
        {
          attrs: { ...attrs("snapshot_heading"), level: 1 },
          content: [{ text: "快照标题", type: "text" }],
          type: "heading",
        },
        paragraph("snapshot_body", "稳定正文"),
        {
          attrs: {
            ...attrs("snapshot_image"),
            alt: "快照图",
            resourceId: "snapshot_resource",
            widthMode: "full",
          },
          type: "imageBlock",
        },
      ]),
      resources: {
        snapshot_resource: "https://cdn.example.com/snapshot.png",
      },
    });

    expect(result.html).toMatchInlineSnapshot(
      `"<section style="background-color:#FFFFFF;box-sizing:border-box;color:#1D2939;font-family:-apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, &#39;PingFang SC&#39;, &#39;Hiragino Sans GB&#39;, &#39;Microsoft YaHei&#39;, sans-serif;margin:0;max-width:100%!important;padding:16px;word-break:break-word;"><section style="box-sizing:border-box;color:#1D2939;font-size:22px;font-weight:700;line-height:1.45;margin:28px 0 14px;margin-bottom:14px;margin-top:28px;max-width:100%!important;overflow-wrap:anywhere;word-break:break-word;"><span leaf="" style="box-sizing:border-box;display:inline;max-width:100%!important;overflow-wrap:anywhere;word-break:break-word;">快照标题</span></section><p style="box-sizing:border-box;color:#1D2939;font-family:-apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, &#39;PingFang SC&#39;, &#39;Hiragino Sans GB&#39;, &#39;Microsoft YaHei&#39;, sans-serif;font-size:16px;font-weight:400;letter-spacing:0.3px;line-height:1.8;margin:0 0 16px;margin-bottom:16px;max-width:100%!important;overflow-wrap:anywhere;text-align:justify;word-break:break-word;"><span leaf="">稳定正文</span></p><section style="box-sizing:border-box;margin:0;max-width:100%!important;"><img alt="快照图" draggable="false" src="https://cdn.example.com/snapshot.png" style="border-color:#EAECF0;border-radius:8px;box-shadow:none;box-sizing:border-box;display:block;height:auto;margin-bottom:16px;margin-top:16px;max-width:100%!important;object-fit:contain;width:100%;"></section></section>"`,
    );
  });

  it("提供可比较的标准、安全和静态输出", () => {
    const input = {
      document: documentWith([
        {
          attrs: { ...attrs("mode_heading"), level: 1 },
          content: [{ text: "模式对比", type: "text" as const }],
          type: "heading" as const,
        },
      ]),
      theme: {
        components: {
          "heading.level1.default": {
            backgroundImage: "linear-gradient(90deg,#FFFFFF,#F2F4F7)",
            boxShadow: "0 4px 16px rgba(16,24,40,0.10)",
            position: "relative" as const,
          },
        },
        schemaVersion: "1.0.0" as const,
      },
    };
    const standard = renderWechatHtml({ ...input, mode: "standard" });
    const safe = renderWechatHtml({ ...input, mode: "wechat_safe" });
    const staticResult = renderWechatHtml({ ...input, mode: "static" });

    expect(standard.html).toContain("background-image:");
    expect(standard.html).toContain("box-shadow:");
    expect(standard.html).toContain("position:relative");
    expect(safe.html).not.toContain("background-image:");
    expect(safe.html).not.toContain("box-shadow:");
    expect(safe.html).toContain("position:static");
    expect(staticResult.html).toBe(safe.html);
    expect(standard.outputHash).not.toBe(safe.outputHash);
  });

  it("按 Manifest 精确版本调用内置组件 Renderer", () => {
    const componentRegistry = new ComponentRegistry();
    componentRegistry.register(componentManifest());
    componentRegistry.register(
      componentManifest({ name: "Renderer 测试卡片 2", version: "2.0.0" }),
    );
    const componentRenderers = new WechatComponentRendererRegistry().register(
      "rendererTestCard",
      ({ children, node, style }) =>
        htmlElement("section", {
          children: [
            htmlElement("p", {
              children: [`组件：${node.attrs.title ?? ""}`],
            }),
            ...children,
          ],
          style,
        }),
    );
    const result = renderWechatHtml(
      {
        document: documentWith([
          {
            attrs: {
              ...attrs("component"),
              componentId: "cmp_card_renderer_test_001",
              componentVersion: "1.2.0",
              title: "精确版本",
              variant: "accent",
            },
            content: [paragraph("component_body", "组件正文")],
            type: "semanticCard",
          },
        ]),
      },
      { componentRegistry, componentRenderers },
    );

    expect(result.html).toContain("组件：精确版本");
    expect(result.html).toContain("组件正文");
    expect(result.html).toContain("background-color:#FFF7ED");
    expect(result.manifest.componentVersions).toEqual(["cmp_card_renderer_test_001@1.2.0"]);
    expect(result.warnings).toEqual([]);
  });

  it("对缺失资源、缺失组件和无效输入采用明确失败或安全降级", () => {
    const document = documentWith([
      {
        attrs: {
          ...attrs("missing_image"),
          alt: "丢失图片",
          resourceId: "missing_resource",
        },
        type: "imageBlock",
      },
      {
        attrs: {
          ...attrs("private_image"),
          alt: "私网图片",
          resourceId: "private_resource",
        },
        type: "imageBlock",
      },
      {
        attrs: {
          ...attrs("missing_component"),
          componentId: "component_missing_card",
          componentVersion: "1.0.0",
          title: "仍保留组件正文",
        },
        content: [paragraph("missing_component_body", "安全降级正文")],
        type: "semanticCard",
      },
    ]);
    const renderer = new WechatHtmlRenderer();
    const result = renderer.render({
      document,
      resources: {
        private_resource: "https://127.0.0.1/private.png",
      },
    });

    expect(result.html).toContain("[图片不可用：丢失图片]");
    expect(result.html).toContain("[图片不可用：私网图片]");
    expect(result.html).toContain("仍保留组件正文");
    expect(result.html).toContain("安全降级正文");
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "RESOURCE_MISSING",
      "URL_BLOCKED",
      "COMPONENT_MISSING",
    ]);

    expect(renderer.tryRender({ document: { schemaVersion: "1.0.0" } })).toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: "INVALID_DOCUMENT" })]),
      success: false,
    });
    expect(
      renderer.tryRender({
        document,
        expectedSourceTextHash: `sha256:${"0".repeat(64)}`,
      }),
    ).toEqual({
      issues: [
        {
          code: "TEXT_HASH_MISMATCH",
          message: "渲染前原文哈希与调用方预期不一致",
          path: "/expectedSourceTextHash",
        },
      ],
      success: false,
    });
  });
});

describe("Renderer 注册表", () => {
  it("拒绝重复注册和冻结后的修改", () => {
    const nodeRegistry = new WechatNodeRendererRegistry().register("paragraph", () =>
      htmlElement("p"),
    );
    expect(() => nodeRegistry.register("paragraph", () => htmlElement("p"))).toThrow(
      RendererRegistrationError,
    );
    nodeRegistry.freeze();
    expect(() => nodeRegistry.register("heading", () => htmlElement("section"))).toThrow(
      RendererRegistrationError,
    );

    const componentRegistry = new WechatComponentRendererRegistry().register("testRenderer", () =>
      htmlElement("section"),
    );
    expect(componentRegistry.list()).toEqual(["testRenderer"]);
    componentRegistry.freeze();
    expect(() =>
      componentRegistry.register("anotherRenderer", () => htmlElement("section")),
    ).toThrow(RendererRegistrationError);
  });
});
