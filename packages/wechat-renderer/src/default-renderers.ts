import type { ComponentManifest } from "@wechat-layout/component-registry";
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
      case "fontFamily":
        style["font-family"] = mark.attrs.family;
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

interface ResolvedComponentAppearance {
  readonly manifest: ComponentManifest;
  readonly style: WechatStyleMap;
  readonly visualVariant?: string;
}

type BorderEdge = "border-bottom" | "border-left" | "border-top";

function edgeBorderStyle(style: WechatStyleMap, edge: BorderEdge): WechatStyleMap {
  const {
    "border-color": borderColor,
    "border-style": borderStyle,
    "border-width": borderWidth,
    ...rest
  } = style;
  if (borderColor === undefined && borderStyle === undefined && borderWidth === undefined) {
    return style;
  }
  return {
    ...rest,
    [edge]: `${String(borderWidth ?? "1px")} ${String(borderStyle ?? "solid")} ${String(
      borderColor ?? "currentColor",
    )}`,
  };
}

function resolvedComponentAppearance(
  node: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  defaultStyleRef?: string,
): ResolvedComponentAppearance | null {
  const componentId = node.attrs.componentId;
  const componentVersion = node.attrs.componentVersion;
  if (componentId === undefined && componentVersion === undefined) {
    return null;
  }

  let manifest: ComponentManifest | undefined;
  try {
    if (componentId !== undefined && componentVersion !== undefined) {
      const resolution = context.componentRegistry?.resolve({
        componentId,
        version: componentVersion,
      });
      if (resolution?.status === "available") {
        manifest = resolution.descriptor.manifest;
      }
    }
  } catch {
    manifest = undefined;
  }

  if (manifest === undefined) {
    context.warn({
      code: "COMPONENT_MISSING",
      message: `组件 ${componentId ?? "unknown"}@${componentVersion ?? "unknown"} 不可用，已使用安全基础结构`,
      path,
      severity: "warning",
    });
    return null;
  }

  if (manifest.nodeType !== node.type) {
    context.warn({
      code: "COMPONENT_NODE_TYPE_MISMATCH",
      message: `组件 ${manifest.componentId}@${manifest.version} 需要 ${manifest.nodeType} 节点，实际为 ${node.type}，已使用安全基础结构`,
      path,
      severity: "warning",
    });
    return null;
  }

  if (context.componentRenderers.get(manifest.wechatRendererKey) === null) {
    context.warn({
      code: "COMPONENT_RENDERER_MISSING",
      message: `内置 Renderer “${manifest.wechatRendererKey}” 不存在，已使用安全基础结构`,
      path,
      severity: "warning",
    });
    return null;
  }

  context.recordComponent(manifest.componentId, manifest.version);
  const legacyVariant = "variant" in node.attrs ? node.attrs.variant : undefined;
  const variantId = node.attrs.componentVariantId ?? legacyVariant ?? manifest.defaultVariantId;
  const variant = manifest.variants.find((candidate) => candidate.variantId === variantId);
  const componentTokens: ComponentTokenDefinition = {
    ...manifest.defaultTokenMap,
    ...(variant?.tokenMap ?? {}),
  };
  const visualVariant = componentTokens.variant;
  return {
    manifest,
    style: context.styleFor(node, node.attrs.styleRef ?? defaultStyleRef, componentTokens),
    ...(typeof visualVariant === "string" ? { visualVariant } : {}),
  };
}

function resolvedNodeStyle(
  node: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  defaultStyleRef?: string,
): WechatStyleMap {
  return (
    resolvedComponentAppearance(node, context, path, defaultStyleRef)?.style ??
    context.styleFor(node, node.attrs.styleRef ?? defaultStyleRef)
  );
}

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

function headingRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
): SafeHtmlNode {
  const node = expectNode(input, "heading");
  const defaultRef = `heading.level${String(node.attrs.level)}.default`;
  const appearance = resolvedComponentAppearance(node, context, path, defaultRef);
  const resolvedStyle = appearance?.style ?? context.styleFor(node, defaultRef);
  const structuralStyle =
    appearance?.visualVariant === "leftbar"
      ? edgeBorderStyle(resolvedStyle, "border-left")
      : appearance?.visualVariant === "underlined"
        ? edgeBorderStyle(resolvedStyle, "border-bottom")
        : resolvedStyle;
  const content: SafeHtmlNode[] = [];
  if (appearance?.visualVariant === "dot") {
    content.push(
      htmlElement("span", {
        children: ["●"],
        style: {
          color: String(context.tokens.colors.primary),
          display: "inline",
          "font-size": "0.55em",
          "margin-right": "8px",
          "vertical-align": "middle",
        },
      }),
    );
  }
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
      structuralStyle,
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
  const appearance = resolvedComponentAppearance(node, context, path, "quote.default");
  const resolvedStyle = appearance?.style ?? context.styleFor(node, "quote.default");
  const structuralStyle =
    appearance?.visualVariant === "leftline"
      ? edgeBorderStyle(resolvedStyle, "border-left")
      : resolvedStyle;
  const children: SafeHtmlNode[] = [];
  if (node.attrs.showQuotes === true) {
    children.push(
      htmlElement("span", {
        children: ["“"],
        style: {
          color: String(context.tokens.colors.primary),
          display: "block",
          "font-size": "32px",
          "font-weight": 700,
          height: "24px",
          "line-height": 1,
        },
      }),
    );
  }
  children.push(...context.renderBlocks(node.content, `${path}/content`, state.depth + 1));
  if (node.attrs.showQuotes === true) {
    children.push(
      htmlElement("span", {
        children: ["”"],
        style: {
          color: String(context.tokens.colors.primary),
          display: "block",
          "font-size": "32px",
          "font-weight": 700,
          height: "20px",
          "line-height": 1,
          "text-align": "right",
        },
      }),
    );
  }
  if (node.attrs.showSource === true && node.attrs.source !== undefined) {
    children.push(
      htmlElement("p", {
        children: [`— ${node.attrs.source}`],
        style: {
          color: String(context.tokens.colors.textMuted),
          "font-size": `${String(context.tokens.typography.captionSize)}px`,
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
        ...(appearance === null
          ? { "border-left": `4px solid ${String(context.tokens.colors.primary)}` }
          : {}),
        margin: "16px 0",
      },
      structuralStyle,
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
          color: String(context.tokens.colors.primary),
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

function unavailableImage(
  label: string,
  caption: string | undefined,
  context: WechatNodeRenderContext,
): SafeHtmlNode {
  return htmlElement("section", {
    children: [
      htmlElement("p", {
        children: [`[图片不可用：${label || "未命名图片"}]`],
        style: {
          ...TEXT_WRAP_STYLE,
          color: String(context.tokens.colors.textSecondary),
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
                ...TEXT_WRAP_STYLE,
                color: String(context.tokens.image.captionColor),
                "font-size": `${String(context.tokens.image.captionSize)}px`,
                margin: "8px 0 0",
                "text-align": context.tokens.image.captionAlign,
              },
            }),
          ]),
    ],
    style: {
      ...TEXT_WRAP_STYLE,
      "background-color": String(context.tokens.colors.surface),
      border:
        context.tokens.image.border === "none"
          ? "none"
          : `${String(context.tokens.image.border)} ${String(context.tokens.colors.border)}`,
      "box-sizing": "border-box",
      margin: "16px 0",
      padding: "16px",
    },
  });
}

function pendingImage(
  label: string,
  caption: string | undefined,
  context: WechatNodeRenderContext,
): SafeHtmlNode {
  return htmlElement("section", {
    children: [
      htmlElement("p", {
        children: [`[图片待选择：${label || "未命名图片"}]`],
        style: {
          ...TEXT_WRAP_STYLE,
          color: String(context.tokens.colors.textSecondary),
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
                ...TEXT_WRAP_STYLE,
                color: String(context.tokens.image.captionColor),
                "font-size": `${String(context.tokens.image.captionSize)}px`,
                margin: "8px 0 0",
                "text-align": context.tokens.image.captionAlign,
              },
            }),
          ]),
    ],
    style: {
      ...TEXT_WRAP_STYLE,
      "background-color": String(context.tokens.colors.surface),
      border: `1px dashed ${String(context.tokens.colors.borderStrong)}`,
      "box-sizing": "border-box",
      margin: "16px 0",
      padding: "16px",
    },
  });
}

function isPendingImageResource(resourceId: string): boolean {
  return (
    resourceId === "component_slot_image_pending" ||
    resourceId === "component_slot_qrcode_pending" ||
    (resourceId.startsWith("component_slot_") && resourceId.endsWith("_pending"))
  );
}

function imageRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
): SafeHtmlNode {
  const node = expectNode(input, "imageBlock");
  if (isPendingImageResource(node.attrs.resourceId)) {
    return pendingImage(node.attrs.alt ?? "", node.attrs.caption, context);
  }
  const resource = context.resolveResource(node.attrs.resourceId, path);
  if (resource === null) {
    return unavailableImage(node.attrs.alt ?? "", node.attrs.caption, context);
  }
  const width =
    node.attrs.widthMode === "percent"
      ? `${String(node.attrs.widthPercent ?? 100)}%`
      : node.attrs.widthMode === "original"
        ? "auto"
        : "100%";
  const horizontalAlign = node.attrs.horizontalAlign;
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
            ...(node.attrs.objectPositionX === undefined && node.attrs.objectPositionY === undefined
              ? {}
              : {
                  "object-position": `${String(node.attrs.objectPositionX ?? 50)}% ${String(
                    node.attrs.objectPositionY ?? 50,
                  )}%`,
                }),
            ...(node.attrs.opacity === undefined ? {} : { opacity: node.attrs.opacity }),
            ...(horizontalAlign === undefined
              ? {}
              : {
                  "margin-left":
                    horizontalAlign === "right" || horizontalAlign === "center" ? "auto" : "0",
                  "margin-right":
                    horizontalAlign === "left" || horizontalAlign === "center" ? "auto" : "0",
                }),
            width,
          },
          resolvedNodeStyle(node, context, path, "image.default"),
        ),
      }),
      ...(node.attrs.caption === undefined
        ? []
        : [
            htmlElement("p", {
              children: [node.attrs.caption],
              style: {
                ...TEXT_WRAP_STYLE,
                color: String(context.tokens.image.captionColor),
                "font-size": `${String(context.tokens.image.captionSize)}px`,
                "line-height": context.tokens.typography.captionLineHeight,
                margin: "8px 0 0",
                "text-align": context.tokens.image.captionAlign,
              },
            }),
          ]),
    ],
    style: {
      "box-sizing": "border-box",
      margin: "0",
      "max-width": "100%",
      ...(node.attrs.offsetX === undefined &&
      node.attrs.offsetY === undefined &&
      node.attrs.rotation === undefined &&
      node.attrs.layer === undefined
        ? {}
        : {
            position: "relative",
            transform: `translate(${String(node.attrs.offsetX ?? 0)}px, ${String(
              node.attrs.offsetY ?? 0,
            )}px) rotate(${String(node.attrs.rotation ?? 0)}deg)`,
            "transform-origin": "center",
            "z-index": node.attrs.layer ?? 1,
          }),
    },
  });
}

function decorativeContainerRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
): SafeHtmlNode {
  const node = expectNode(input, "decorativeContainer");
  const resource = context.resolveResource(node.attrs.resourceId, path);
  const isRibbon = node.attrs.decorationType === "ribbon";
  return htmlElement("section", {
    children: renderInline(node.content),
    style: mergeStyles(
      {
        ...TEXT_WRAP_STYLE,
        ...(resource === null ? {} : { "background-image": `url('${resource.url}')` }),
        "background-position": "center",
        "background-repeat": "no-repeat",
        "background-size": "100% 100%",
        "box-sizing": "border-box",
        display: "block",
        "font-size": `${String(context.tokens.typography.bodySize)}px`,
        "line-height": context.tokens.typography.bodyLineHeight,
        margin: "16px 0",
        "min-height": `${String(node.attrs.minHeight ?? (isRibbon ? 80 : 160))}px`,
        padding: isRibbon ? "24px 72px" : "48px 56px",
        "text-align": "center",
      },
      context.styleFor(node, node.attrs.styleRef ?? "paragraph.default"),
    ),
  });
}

function dividerRenderer(
  input: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
): SafeHtmlNode {
  const node = expectNode(input, "divider");
  const appearance = resolvedComponentAppearance(node, context, path, "divider.default");
  const componentStyle = appearance?.style ?? context.styleFor(node, "divider.default");
  if (node.attrs.variant === "ornament" && node.attrs.icon !== undefined) {
    const {
      "border-color": borderColor,
      "border-style": borderStyle,
      "border-width": borderWidth,
      ...rootStyle
    } = componentStyle;
    const line = `${String(borderWidth ?? "1px")} ${String(borderStyle ?? "solid")} ${String(
      borderColor ?? context.tokens.colors.accent,
    )}`;
    return htmlElement("section", {
      children: [
        htmlElement("span", {
          style: {
            "border-top": line,
            display: "inline-block",
            "vertical-align": "middle",
            width: "34%",
          },
        }),
        htmlElement("span", {
          children: [node.attrs.icon],
          style: {
            display: "inline-block",
            "margin-left": "10px",
            "margin-right": "10px",
            "vertical-align": "middle",
          },
        }),
        htmlElement("span", {
          style: {
            "border-top": line,
            display: "inline-block",
            "vertical-align": "middle",
            width: "34%",
          },
        }),
      ],
      style: mergeStyles(
        {
          color: String(context.tokens.colors.accent),
          margin: `${String(node.attrs.spacingBefore ?? 24)}px 0 ${String(node.attrs.spacingAfter ?? 24)}px`,
          "text-align": node.attrs.align ?? "center",
        },
        {
          ...rootStyle,
          ...(borderColor === undefined ? {} : { "border-color": borderColor }),
        },
      ),
    });
  }
  const lineStyle =
    appearance === null
      ? {
          "border-top": `1px ${node.attrs.variant ?? "solid"} ${String(
            context.tokens.colors.border,
          )}`,
        }
      : edgeBorderStyle(componentStyle, "border-top");
  return htmlElement("section", {
    style: mergeStyles(
      {
        height: "0",
        margin: `${String(node.attrs.spacingBefore ?? 24)}px 0 ${String(node.attrs.spacingAfter ?? 24)}px`,
        width: `${String(node.attrs.widthPercent ?? 100)}%`,
      },
      lineStyle,
    ),
  });
}

export function genericSemanticCardRenderer({
  children,
  context,
  node,
  style,
}: WechatComponentRenderInput): SafeHtmlNode {
  return genericSemanticCardNode(children, context, node, style);
}

function genericSemanticCardNode(
  children: readonly SafeHtmlNode[],
  context: WechatNodeRenderContext,
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
                color: String(context.tokens.colors.primary),
                "font-size": `${String(context.tokens.typography.captionSize)}px`,
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
                color: String(context.tokens.colors.textPrimary),
                "font-size": `${String(context.tokens.typography.heading3Size)}px`,
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
                color: String(context.tokens.colors.textMuted),
                "font-size": `${String(context.tokens.typography.captionSize)}px`,
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
  const appearance = resolvedComponentAppearance(node, context, path);
  if (appearance === null) {
    return genericSemanticCardNode(
      children,
      context,
      node,
      context.styleFor(node, node.attrs.styleRef),
    );
  }

  const { manifest, style } = appearance;
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
  const appearance = resolvedComponentAppearance(node, context, path, "footer.brand.default");
  const resolvedStyle = appearance?.style ?? context.styleFor(node, "footer.brand.default");
  const structuralStyle =
    appearance?.visualVariant === "minimal_brand"
      ? edgeBorderStyle(resolvedStyle, "border-top")
      : resolvedStyle;
  return htmlElement("section", {
    children: context.renderBlocks(node.content ?? [], `${path}/content`, state.depth + 1),
    style: mergeStyles(
      {
        ...TEXT_WRAP_STYLE,
        margin: "36px 0 0",
        "text-align": "center",
      },
      structuralStyle,
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
    return unavailableImage("SVG 静态备用图", undefined, context);
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
    .register("decorativeContainer", decorativeContainerRenderer)
    .register("divider", dividerRenderer)
    .register("semanticCard", semanticCardRenderer)
    .register("brandFooter", brandFooterRenderer)
    .register("svgInteraction", svgRenderer);
}
