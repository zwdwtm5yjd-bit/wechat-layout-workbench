import {
  OFFICIAL_COMPONENT_ASSETS,
  createOfficialComponentRegistry,
  type OfficialComponentAsset,
} from "@wechat-layout/component-registry";
import { OFFICIAL_THEME_PACKAGES } from "@wechat-layout/design-tokens";
import type { BlockNode, DocumentV1, ParagraphNode } from "@wechat-layout/document-schema";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";

import {
  WechatComponentRendererRegistry,
  WechatHtmlRenderer,
  createOfficialComponentRendererRegistry,
  renderWechatHtml,
} from "./index.js";

type TopLevelBlockNode = Exclude<BlockNode, { readonly type: "listItem" }>;
type HtmlElement = DefaultTreeAdapterMap["element"];
type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlParentNode = DefaultTreeAdapterMap["parentNode"];
type HtmlTextNode = DefaultTreeAdapterMap["textNode"];

function isHtmlElement(node: HtmlNode): node is HtmlElement {
  return "tagName" in node;
}

function isHtmlTextNode(node: HtmlNode): node is HtmlTextNode {
  return node.nodeName === "#text" && "value" in node;
}

function childElements(node: HtmlParentNode): readonly HtmlElement[] {
  return node.childNodes.filter(isHtmlElement);
}

function renderedBlockElement(html: string): HtmlElement {
  const fragment = parseFragment(html);
  const root = childElements(fragment)[0];
  const block = root === undefined ? undefined : childElements(root)[0];
  if (block === undefined) {
    throw new Error("Renderer 未输出可检查的组件根节点");
  }
  return block;
}

function firstDescendant(element: HtmlElement, tagName: string): HtmlElement | undefined {
  for (const child of childElements(element)) {
    if (child.tagName === tagName) return child;
    const nested = firstDescendant(child, tagName);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function styleMap(element: HtmlElement): Readonly<Record<string, string>> {
  const style = element.attrs.find((attribute) => attribute.name === "style")?.value ?? "";
  return Object.fromEntries(
    style
      .split(";")
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration.length > 0)
      .map((declaration) => {
        const separator = declaration.indexOf(":");
        return [declaration.slice(0, separator), declaration.slice(separator + 1)];
      }),
  );
}

function elementPathToText(
  node: HtmlNode,
  text: string,
  ancestors: readonly HtmlElement[] = [],
): readonly HtmlElement[] | undefined {
  if (isHtmlTextNode(node)) {
    return node.value.includes(text) ? ancestors : undefined;
  }
  if (!("childNodes" in node)) return undefined;
  const nextAncestors = isHtmlElement(node) ? [...ancestors, node] : ancestors;
  for (const child of node.childNodes) {
    const path = elementPathToText(child, text, nextAncestors);
    if (path !== undefined) return path;
  }
  return undefined;
}

function nearestWrappingElement(html: string, text: string): HtmlElement {
  const block = renderedBlockElement(html);
  const path = elementPathToText(block, text);
  if (path === undefined) {
    throw new Error("Renderer 输出中未找到压力测试文本");
  }
  const wrappingIndex = path.findLastIndex((element) => {
    const style = styleMap(element);
    return (
      style["max-width"] === "100%" &&
      style["overflow-wrap"] === "anywhere" &&
      style["word-break"] === "break-word"
    );
  });
  if (wrappingIndex < 0 || wrappingIndex < path.length - 2) {
    throw new Error("压力测试文本附近没有安全换行容器");
  }
  return path[wrappingIndex]!;
}

function paragraph(blockId: string, text: string): ParagraphNode {
  return {
    type: "paragraph",
    attrs: { blockId, locked: false, semanticRole: "component.body" },
    content: [{ type: "text", text }],
  };
}

function componentBlock(
  asset: OfficialComponentAsset,
  index: number,
  text: string,
): TopLevelBlockNode {
  const preset = asset.manifest.insertionPreset;
  const common = {
    blockId: `official_component_${String(index)}`,
    componentId: asset.manifest.componentId,
    componentVariantId: asset.manifest.defaultVariantId,
    componentVersion: asset.manifest.version,
    locked: false,
    semanticRole: asset.manifest.semanticRoles[0]!,
  };

  switch (preset.nodeType) {
    case "heading":
      return {
        type: "heading",
        attrs: { ...common, ...preset.attributes },
        content: [{ type: "text", text }],
      };
    case "blockquote":
      return {
        type: "blockquote",
        attrs: { ...common, ...preset.attributes },
        content: [paragraph(`official_component_${String(index)}_body`, text)],
      };
    case "semanticCard":
      return {
        type: "semanticCard",
        attrs: {
          ...common,
          ...preset.attributes,
          title: preset.attributes.title ?? asset.preview.sample.title ?? "组件标题",
          variant: preset.attributes.variant ?? asset.manifest.defaultVariantId,
        },
        content: [paragraph(`official_component_${String(index)}_body`, text)],
      };
    case "imageBlock":
      return {
        type: "imageBlock",
        attrs: {
          ...common,
          ...preset.attributes,
          alt: text,
          caption: `${text}图注`,
          resourceId: "resource_official_component",
        },
      };
    case "divider":
      return { type: "divider", attrs: { ...common, ...preset.attributes } };
    case "brandFooter":
      return {
        type: "brandFooter",
        attrs: { ...common, ...preset.attributes },
        content: [paragraph(`official_component_${String(index)}_body`, text)],
      };
  }
}

function documentWith(block: TopLevelBlockNode, index: number): DocumentV1 {
  const timestamp = "2026-08-01T00:00:00.000Z";
  return {
    articleId: `article_official_component_${String(index)}`,
    content: { type: "doc", content: [block] },
    documentId: `document_official_component_${String(index)}`,
    meta: {
      createdAt: timestamp,
      sourceType: "manual",
      textLocked: true,
      updatedAt: timestamp,
    },
    schemaVersion: "1.0.0",
  };
}

describe("official component renderers", () => {
  it("registers and safely renders every one of the 29 official component versions", () => {
    expect(OFFICIAL_COMPONENT_ASSETS).toHaveLength(29);
    expect(createOfficialComponentRendererRegistry().list().toSorted()).toEqual(
      [
        ...new Set(OFFICIAL_COMPONENT_ASSETS.map((asset) => asset.manifest.wechatRendererKey)),
      ].toSorted(),
    );

    OFFICIAL_COMPONENT_ASSETS.forEach((asset, index) => {
      const sentinel = `官方组件正文${String(index + 1)}`;
      const output = renderWechatHtml({
        document: documentWith(componentBlock(asset, index, sentinel), index),
        mode: "wechat_safe",
        resources: {
          resource_official_component: "https://cdn.example.com/official-component.png",
        },
      });

      expect(output.manifest.componentVersions).toEqual([
        `${asset.manifest.componentId}@${asset.manifest.version}`,
      ]);
      expect(output.warnings.map((warning) => warning.code)).not.toContain("COMPONENT_MISSING");
      expect(output.warnings.map((warning) => warning.code)).not.toContain(
        "COMPONENT_RENDERER_MISSING",
      );
      if (asset.manifest.nodeType !== "divider") {
        expect(output.html).toContain(sentinel);
      }
      expect(output.textIntegrity.unchanged).toBe(true);
    });
  });

  it("keeps every heading and long-body component readable at its actual text node", () => {
    const stressAssets = OFFICIAL_COMPONENT_ASSETS.filter((asset) =>
      ["HEAD", "QUOTE", "NOTICE", "FOOTER"].includes(asset.manifest.category),
    );
    expect(stressAssets).toHaveLength(18);

    stressAssets.forEach((asset, index) => {
      const text =
        asset.manifest.category === "HEAD"
          ? "长标题".repeat(80)
          : asset.manifest.category === "FOOTER"
            ? "长正文".repeat(500)
            : "长正文".repeat(1_000);
      const output = renderWechatHtml({
        document: documentWith(componentBlock(asset, 200 + index, text), 200 + index),
        mode: "wechat_safe",
      });
      const wrappingElement = nearestWrappingElement(output.html, text);
      const wrappingStyle = styleMap(wrappingElement);

      expect(output.plainText, asset.manifest.componentId).toContain(text);
      expect(output.textIntegrity.unchanged, asset.manifest.componentId).toBe(true);
      expect(wrappingStyle.overflow, asset.manifest.componentId).not.toBe("hidden");
      expect(wrappingStyle["white-space"], asset.manifest.componentId).not.toBe("nowrap");
      expect(wrappingStyle["text-overflow"], asset.manifest.componentId).not.toBe("ellipsis");
    });
  });

  it("recolors the rendered component node for representatives of all eight catalog groups", () => {
    const cases = [
      {
        colorKey: "primary",
        componentId: "cmp_head_level1_leftbar_001",
        group: "一级标题",
        property: "border-left",
      },
      {
        colorKey: "primary",
        componentId: "cmp_head_level2_leftbar_002",
        group: "二级标题",
        property: "border-left",
      },
      {
        colorKey: "primary",
        componentId: "cmp_quote_standard_leftline_001",
        group: "引用",
        property: "border-left",
      },
      {
        colorKey: "secondary",
        componentId: "cmp_notice_info_blue_001",
        group: "提示",
        property: "border-color",
      },
      {
        colorKey: "primary",
        componentId: "cmp_data_progress_metric_003",
        group: "数据卡",
        property: "border-color",
      },
      {
        colorKey: "borderStrong",
        componentId: "cmp_image_border_documentary_003",
        group: "图片样式",
        property: "border-color",
        targetTag: "img",
      },
      {
        colorKey: "accent",
        componentId: "cmp_divider_ornament_center_003",
        group: "分割线",
        property: "border-color",
      },
      {
        colorKey: "border",
        componentId: "cmp_footer_minimal_brand_001",
        group: "文末",
        property: "border-top",
      },
    ] as const;

    cases.forEach((entry, index) => {
      const asset = OFFICIAL_COMPONENT_ASSETS.find(
        (candidate) => candidate.manifest.componentId === entry.componentId,
      );
      expect(asset, entry.group).toBeDefined();
      const values = OFFICIAL_THEME_PACKAGES.map((theme) => {
        const output = renderWechatHtml({
          document: documentWith(componentBlock(asset!, 300 + index, entry.group), 300 + index),
          mode: "wechat_safe",
          resources: {
            resource_official_component: "https://cdn.example.com/official-component.png",
          },
          theme: theme.tokens,
        });
        const block = renderedBlockElement(output.html);
        const target = "targetTag" in entry ? firstDescendant(block, entry.targetTag) : block;
        expect(target, entry.group).toBeDefined();
        const value = styleMap(target!)[entry.property];
        const colors = theme.tokens.colors;
        expect(colors, entry.group).toBeDefined();
        expect(value, entry.group).toContain(colors![entry.colorKey]);
        return value;
      });

      expect(values[0], entry.group).not.toBe(values[1]);
    });
  });

  it("falls back safely when a component is attached to the wrong native node type", () => {
    const dataAsset = OFFICIAL_COMPONENT_ASSETS.find(
      (candidate) => candidate.manifest.componentId === "cmp_data_single_metric_001",
    );
    expect(dataAsset).toBeDefined();
    const text = "仍应保留的标题";
    const block: TopLevelBlockNode = {
      type: "heading",
      attrs: {
        blockId: "wrong_component_node_type",
        componentId: dataAsset!.manifest.componentId,
        componentVersion: dataAsset!.manifest.version,
        level: 1,
        locked: false,
      },
      content: [{ type: "text", text }],
    };
    const output = renderWechatHtml({ document: documentWith(block, 101) });

    expect(output.html).toContain(text);
    expect(output.manifest.componentVersions).toEqual([]);
    expect(output.warnings).toContainEqual(
      expect.objectContaining({ code: "COMPONENT_NODE_TYPE_MISMATCH" }),
    );
  });

  it("honors structural variants and audits native renderer keys", () => {
    const doubleData = OFFICIAL_COMPONENT_ASSETS.find(
      (asset) => asset.manifest.componentId === "cmp_data_double_compare_002",
    );
    const quote = OFFICIAL_COMPONENT_ASSETS.find(
      (asset) => asset.manifest.componentId === "cmp_quote_citation_marks_002",
    );
    const heading = OFFICIAL_COMPONENT_ASSETS.find(
      (asset) => asset.manifest.componentId === "cmp_head_level1_leftbar_001",
    );
    expect(doubleData).toBeDefined();
    expect(quote).toBeDefined();
    expect(heading).toBeDefined();

    const dataBlock = componentBlock(doubleData!, 401, "128");
    if (dataBlock.type !== "semanticCard") throw new Error("双数据组件节点类型错误");
    dataBlock.content = [
      paragraph("double_value_primary", "128"),
      paragraph("double_value_secondary", "96"),
    ];
    const standard = renderWechatHtml({ document: documentWith(dataBlock, 401), mode: "standard" });
    const safe = renderWechatHtml({ document: documentWith(dataBlock, 402), mode: "wechat_safe" });
    for (const [output, expectedWidth] of [
      [standard, "50%"],
      [safe, "100%"],
    ] as const) {
      for (const value of ["128", "96"]) {
        const path = elementPathToText(renderedBlockElement(output.html), value);
        expect(path, value).toBeDefined();
        expect(styleMap(path!.at(-1)!).width, value).toBe(expectedWidth);
      }
    }

    const quoteOutput = renderWechatHtml({
      document: documentWith(componentBlock(quote!, 403, "引号结构正文"), 403),
    });
    expect(quoteOutput.html).toContain("“");
    expect(quoteOutput.html).toContain("”");

    const rendererWithoutOfficialKeys = new WechatHtmlRenderer({
      componentRegistry: createOfficialComponentRegistry(),
      componentRenderers: new WechatComponentRendererRegistry(),
    });
    const missingKeyOutput = rendererWithoutOfficialKeys.render({
      document: documentWith(componentBlock(heading!, 404, "仍需保留的原生标题"), 404),
    });
    expect(missingKeyOutput.html).toContain("仍需保留的原生标题");
    expect(missingKeyOutput.manifest.componentVersions).toEqual([]);
    expect(missingKeyOutput.warnings).toContainEqual(
      expect.objectContaining({ code: "COMPONENT_RENDERER_MISSING" }),
    );
  });
});
