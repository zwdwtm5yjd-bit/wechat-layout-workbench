import type { ComponentTokenDefinition } from "@wechat-layout/design-tokens";
import type { BlockNode, DocumentMark, InlineNode } from "@wechat-layout/document-schema";

import { htmlElement, type SafeHtmlNode } from "./html.js";
import {
  WechatNodeRendererRegistry,
  type WechatComponentRenderInput,
  type WechatNodeRenderContext,
  type WechatNodeRenderState,
} from "./registry.js";
import type { WechatStyleMap, WechatStyleProperty, WechatStyleValue } from "./style-serializer.js";

function expectNode<T extends BlockNode["type"]>(
  node: BlockNode,
  type: T,
): Extract<BlockNode, { readonly type: T }> {
  if (node.type !== type) {
    throw new TypeError(`Node Renderer 期望 ${type}，实际收到 ${node.type}`);
  }
  return node as Extract<BlockNode, { readonly type: T }>;
}

function inlineStyle(marks: readonly DocumentMark[] | undefined): {
  readonly href?: string;
  readonly style: WechatStyleMap;
} {
  const style: Partial<Record<WechatStyleProperty, WechatStyleValue>> = {};
  let href: string | undefined;
  const decorations: string[] = [];

  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        style["font-weight"] = 700;
        break;
      case "italic":
        style["font-style"] = "italic";
        break;
      case "underline":
        decorations.push("underline");
        break;
      case "strike":
        decorations.push("line-through");
        break;
      case "textColor":
        style.color = mark.attrs.color;
        break;
      case "backgroundColor":
        style["background-color"] = mark.attrs.color;
        break;
      case "fontSize":
        style["font-size"] = `${String(mark.attrs.size)}px`;
        break;
      case "link":
        href = mark.attrs.href;
        break;
    }
  }
  if (decorations.length > 0) {
    style["text-decoration"] = [...new Set(decorations)].sort().join(" ");
  }
  return {
    ...(href === undefined ? {} : { href }),
    style,
  };
}

function renderInlineNode(node: InlineNode): SafeHtmlNode {
  if (node.type === "hardBreak") {
    return htmlElement("br");
  }
  const { href, style } = inlineStyle(node.marks);
  if (href !== undefined) {
    return htmlElement("a", {
      attributes: { href },
      children: [node.text],
      style,
    });
  }
  return Object.keys(style).length === 0
    ? node.text
    : htmlElement("span", { children: [node.text], style });
}

function renderInline(nodes: readonly InlineNode[] | undefined): readonly SafeHtmlNode[] {
  return (nodes ?? []).map(renderInlineNode);
}

function mergeStyles(base: WechatStyleMap, resolved: WechatStyleMap): WechatStyleMap {
  return { ...base, ...resolved };
}

const TEXT_WRAP_STYLE = {
  "box-sizing": "border-box",
  "max-width": "100%",
  "overflow-wrap": "anywhere",
  "word-break": "break-word",
} as const satisfies WechatStyleMap;

function paragraphRenderer(input: BlockNode, context: WechatNodeRenderContext): SafeHtmlNode {
  const node = expectNode(input, "paragraph");
  const style = mergeStyles(
    {
      ...TEXT_WRAP_STYLE,
      margin: "0 0 16px",
      "text-align": "justify",
    },
    context.styleFor(node, node.attrs.styleRef ?? "paragraph.default"),
  );
  return htmlElement("p", {
    children: renderInline(node.content),
    style,
  });
}

function headingRenderer(input: BlockNode, context: WechatNodeRenderContext): SafeHtmlNode {
  const node = expectNode(input, "heading");
  const defaultRef = `heading.level${String(node.attrs.level)}.default`;
  const content: SafeHtmlNode[] = [];
  if (node.attrs.numbering !== undefined) {
    content.push(
      htmlElement("span", {
        children: [`${node.attrs.numbering} `],
        style: { "font-weight": "inherit" },
      }),
    );
  }
  content.push(...renderInline(node.content));
  return htmlElement("section", {
    children: [
      htmlElement("span", {
        children: content,
        style: { display: "inline" },
      }),
    ],
    style: mergeStyles(
      {
        ...TEXT_WRAP_STYLE,
        margin: "28px 0 14px",
      },
      context.styleFor(node, node.attrs.styleRef ?? defaultRef),
    ),
  });
}

function blockquoteRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  state: WechatNodeRenderState,
): SafeHtmlNode {
  const node = expectNode(input, "blockquote");
  const children = [...context.renderBlocks(node.content, `${path}/content`, state.depth + 1)];
  if (node.attrs.showSource === true && node.attrs.source !== undefined) {
    children.push(
      htmlElement("p", {
        children: [`— ${node.attrs.source}`],
        style: {
          color: "#667085",
          "font-size": "13px",
          margin: "8px 0 0",
          "text-align": "right",
        },
      }),
    );
  }
  return htmlElement("blockquote", {
    children,
    style: mergeStyles(
      {
        ...TEXT_WRAP_STYLE,
        "border-left": "4px solid #B42318",
        margin: "16px 0",
      },
      context.styleFor(node, node.attrs.styleRef ?? "quote.default"),
    ),
  });
}

function bulletMarker(style: string | undefined): string | undefined {
  if (style === "check") {
    return "✓";
  }
  if (style === "arrow") {
    return "›";
  }
  if (style === "brand") {
    return "•";
  }
  return undefined;
}

function bulletListRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  state: WechatNodeRenderState,
): SafeHtmlNode {
  const node = expectNode(input, "bulletList");
  const marker = bulletMarker(node.attrs.bulletStyle);
  return htmlElement("ul", {
    children: node.content.map((item, index) =>
      context.renderBlock(item, `${path}/content/${String(index)}`, {
        depth: state.depth + 1,
        ...(marker === undefined ? {} : { listMarker: marker }),
      }),
    ),
    style: {
      ...TEXT_WRAP_STYLE,
      "list-style-type":
        marker === undefined ? (node.attrs.bulletStyle === "square" ? "square" : "disc") : "none",
      margin: "0 0 16px",
      padding: "0 0 0 24px",
    },
  });
}

function orderedListRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  state: WechatNodeRenderState,
): SafeHtmlNode {
  const node = expectNode(input, "orderedList");
  const preserve = node.attrs.preserveOriginalNumbering === true;
  return htmlElement("ol", {
    attributes: { start: node.attrs.start },
    children: node.content.map((item, index) =>
      context.renderBlock(item, `${path}/content/${String(index)}`, {
        depth: state.depth + 1,
        ...(preserve && item.attrs.originalNumberText !== undefined
          ? { listMarker: item.attrs.originalNumberText }
          : {}),
      }),
    ),
    style: {
      ...TEXT_WRAP_STYLE,
      "list-style-type": preserve ? "none" : "decimal",
      margin: "0 0 16px",
      padding: "0 0 0 28px",
    },
  });
}

function listItemRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  state: WechatNodeRenderState,
): SafeHtmlNode {
  const node = expectNode(input, "listItem");
  const [first, ...rest] = node.content;
  const children: SafeHtmlNode[] = [];
  if (state.listMarker !== undefined) {
    children.push(
      htmlElement("span", {
        children: [`${state.listMarker} `],
        style: {
          color: "#B42318",
          display: "inline",
          "font-weight": 600,
        },
      }),
    );
  }
  if (state.listMarker !== undefined && first?.type === "paragraph") {
    children.push(
      htmlElement("span", {
        children: renderInline(first.content),
        style: { display: "inline" },
      }),
    );
    children.push(
      ...rest.map((child, index) =>
        context.renderBlock(child, `${path}/content/${String(index + 1)}`, {
          depth: state.depth + 1,
        }),
      ),
    );
  } else {
    children.push(...context.renderBlocks(node.content, `${path}/content`, state.depth + 1));
  }
  return htmlElement("li", {
    children,
    style: {
      ...TEXT_WRAP_STYLE,
      margin: "0 0 8px",
    },
  });
}

function unavailableImage(label: string, caption: string | undefined): SafeHtmlNode {
  return htmlElement("section", {
    children: [
      htmlElement("p", {
        children: [`[图片不可用：${label || "未命名图片"}]`],
        style: {
          color: "#667085",
          margin: "0",
          "text-align": "center",
        },
      }),
      ...(caption === undefined
        ? []
        : [
            htmlElement("p", {
              children: [caption],
              style: {
                color: "#98A2B3",
                "font-size": "13px",
                margin: "8px 0 0",
                "text-align": "center",
              },
            }),
          ]),
    ],
    style: {
      "background-color": "#F9FAFB",
      border: "1px solid #EAECF0",
      "box-sizing": "border-box",
      margin: "16px 0",
      padding: "16px",
    },
  });
}

function imageRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
): SafeHtmlNode {
  const node = expectNode(input, "imageBlock");
  const resource = context.resolveResource(node.attrs.resourceId, path);
  if (resource === null) {
    return unavailableImage(node.attrs.alt ?? "", node.attrs.caption);
  }
  const width =
    node.attrs.widthMode === "percent"
      ? `${String(node.attrs.widthPercent ?? 100)}%`
      : node.attrs.widthMode === "original"
        ? "auto"
        : "100%";
  return htmlElement("section", {
    children: [
      htmlElement("img", {
        attributes: {
          alt: node.attrs.alt ?? resource.alt ?? "",
          src: resource.url,
        },
        style: mergeStyles(
          {
            display: "block",
            height: "auto",
            "max-width": "100%",
            "object-fit": node.attrs.objectFit ?? "contain",
            width,
          },
          context.styleFor(node, node.attrs.styleRef ?? "image.default"),
        ),
      }),
      ...(node.attrs.caption === undefined
        ? []
        : [
            htmlElement("p", {
              children: [node.attrs.caption],
              style: {
                color: "#98A2B3",
                "font-size": "13px",
                "line-height": 1.6,
                margin: "8px 0 0",
                "text-align": "center",
              },
            }),
          ]),
    ],
    style: {
      "box-sizing": "border-box",
      margin: "0",
      "max-width": "100%",
    },
  });
}

function dividerRenderer(input: BlockNode, context: WechatNodeRenderContext): SafeHtmlNode {
  const node = expectNode(input, "divider");
  if (node.attrs.variant === "ornament" && node.attrs.icon !== undefined) {
    return htmlElement("section", {
      children: [node.attrs.icon],
      style: {
        color: "#98A2B3",
        margin: `${String(node.attrs.spacingBefore ?? 24)}px 0 ${String(node.attrs.spacingAfter ?? 24)}px`,
        "text-align": node.attrs.align ?? "center",
      },
    });
  }
  return htmlElement("section", {
    style: mergeStyles(
      {
        "border-top": `1px ${node.attrs.variant ?? "solid"} #EAECF0`,
        height: "0",
        margin: `${String(node.attrs.spacingBefore ?? 24)}px 0 ${String(node.attrs.spacingAfter ?? 24)}px`,
        width: `${String(node.attrs.widthPercent ?? 100)}%`,
      },
      context.styleFor(node, node.attrs.styleRef ?? "divider.default"),
    ),
  });
}

export function genericSemanticCardRenderer({
  children,
  node,
  style,
}: WechatComponentRenderInput): SafeHtmlNode {
  return genericSemanticCardNode(children, node, style);
}

function genericSemanticCardNode(
  children: readonly SafeHtmlNode[],
  node: Extract<BlockNode, { readonly type: "semanticCard" }>,
  style: WechatStyleMap,
): SafeHtmlNode {
  return htmlElement("section", {
    children: [
      ...(node.attrs.eyebrow === undefined
        ? []
        : [
            htmlElement("p", {
              children: [node.attrs.eyebrow],
              style: {
                color: "#B42318",
                "font-size": "13px",
                "font-weight": 600,
                margin: "0 0 6px",
              },
            }),
          ]),
      ...(node.attrs.title === undefined
        ? []
        : [
            htmlElement("p", {
              children: [node.attrs.title],
              style: {
                color: "#1D2939",
                "font-size": "18px",
                "font-weight": 700,
                "line-height": 1.5,
                margin: "0 0 12px",
              },
            }),
          ]),
      ...children,
      ...(node.attrs.footer === undefined
        ? []
        : [
            htmlElement("p", {
              children: [node.attrs.footer],
              style: {
                color: "#98A2B3",
                "font-size": "13px",
                margin: "12px 0 0",
              },
            }),
          ]),
    ],
    style: mergeStyles(
      {
        ...TEXT_WRAP_STYLE,
        margin: "16px 0",
        padding: "16px",
      },
      style,
    ),
  });
}

function semanticCardRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  state: WechatNodeRenderState,
): SafeHtmlNode {
  const node = expectNode(input, "semanticCard");
  const children = context.renderBlocks(node.content ?? [], `${path}/content`, state.depth + 1);
  let manifest;
  try {
    const resolution = context.componentRegistry?.resolve({
      componentId: node.attrs.componentId,
      version: node.attrs.componentVersion,
    });
    if (resolution?.status === "available") {
      manifest = resolution.descriptor.manifest;
    }
  } catch {
    manifest = undefined;
  }
  if (manifest === undefined) {
    context.warn({
      code: "COMPONENT_MISSING",
      message: `组件 ${node.attrs.componentId}@${node.attrs.componentVersion} 不可用，已使用安全占位`,
      path,
      severity: "warning",
    });
    return genericSemanticCardNode(children, node, context.styleFor(node, node.attrs.styleRef));
  }

  context.recordComponent(manifest.componentId, manifest.version);
  const variantId = node.attrs.variant ?? manifest.defaultVariantId;
  const variant = manifest.variants.find((candidate) => candidate.variantId === variantId);
  const componentTokens: ComponentTokenDefinition = {
    ...manifest.defaultTokenMap,
    ...(variant?.tokenMap ?? {}),
  };
  const style = context.styleFor(node, node.attrs.styleRef, componentTokens);
  const renderer = context.componentRenderers.get(manifest.wechatRendererKey);
  if (renderer === null) {
    context.warn({
      code: "COMPONENT_RENDERER_MISSING",
      message: `内置 Renderer “${manifest.wechatRendererKey}” 不存在，已使用安全组件结构`,
      path,
      severity: "warning",
    });
    return genericSemanticCardRenderer({
      children,
      context,
      manifest,
      node,
      path,
      style,
    });
  }
  return renderer({
    children,
    context,
    manifest,
    node,
    path,
    style,
  });
}

function brandFooterRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  state: WechatNodeRenderState,
): SafeHtmlNode {
  const node = expectNode(input, "brandFooter");
  return htmlElement("section", {
    children: context.renderBlocks(node.content ?? [], `${path}/content`, state.depth + 1),
    style: mergeStyles(
      {
        ...TEXT_WRAP_STYLE,
        margin: "36px 0 0",
        "text-align": "center",
      },
      context.styleFor(node, node.attrs.styleRef ?? "footer.brand.default"),
    ),
  });
}

function svgRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
): SafeHtmlNode {
  const node = expectNode(input, "svgInteraction");
  context.warn({
    code: "SVG_STATIC_FALLBACK",
    message:
      context.mode === "standard"
        ? "SVG 安全引擎尚未接入，标准模式暂使用静态备用图"
        : "当前模式已将 SVG 转为静态备用图",
    path,
    severity: "info",
  });
  const resource = context.resolveResource(node.attrs.fallbackResourceId, path);
  if (resource === null) {
    return unavailableImage("SVG 静态备用图", undefined);
  }
  return htmlElement("section", {
    children: [
      htmlElement("img", {
        attributes: {
          alt: resource.alt ?? "互动内容静态备用图",
          src: resource.url,
        },
        style: {
          display: "block",
          height: "auto",
          "max-width": "100%",
          width: "100%",
        },
      }),
    ],
    style: mergeStyles(
      {
        "box-sizing": "border-box",
        margin: "16px 0",
        "max-width": "100%",
      },
      context.styleFor(node, node.attrs.styleRef ?? "svg.default"),
    ),
  });
}

export function createDefaultNodeRendererRegistry(): WechatNodeRendererRegistry {
  return new WechatNodeRendererRegistry()
    .register("paragraph", paragraphRenderer)
    .register("heading", headingRenderer)
    .register("blockquote", blockquoteRenderer)
    .register("bulletList", bulletListRenderer)
    .register("orderedList", orderedListRenderer)
    .register("listItem", listItemRenderer)
    .register("imageBlock", imageRenderer)
    .register("divider", dividerRenderer)
    .register("semanticCard", semanticCardRenderer)
    .register("brandFooter", brandFooterRenderer)
    .register("svgInteraction", svgRenderer);
}
