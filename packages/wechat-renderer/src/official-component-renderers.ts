import { OFFICIAL_COMPONENT_MANIFESTS } from "@wechat-layout/component-registry";
import { blockText } from "@wechat-layout/document-schema";

import { genericSemanticCardRenderer } from "./default-renderers.js";
import { htmlElement, type SafeHtmlNode } from "./html.js";
import { WechatComponentRendererRegistry } from "./registry.js";
import type { WechatStyleMap } from "./style-serializer.js";

const TEXT_WRAP_STYLE = {
  "box-sizing": "border-box",
  "max-width": "100%",
  "overflow-wrap": "anywhere",
  "word-break": "break-word",
} as const satisfies WechatStyleMap;

function visualVariant(manifest: (typeof OFFICIAL_COMPONENT_MANIFESTS)[number]): string {
  const value = manifest.defaultTokenMap.variant;
  return typeof value === "string" ? value : "default";
}

function dataValue(value: string, style: WechatStyleMap, width: string): SafeHtmlNode {
  return htmlElement("span", {
    children: [value],
    style: {
      ...TEXT_WRAP_STYLE,
      color: style.color ?? "inherit",
      display: "inline-block",
      "font-size": style["font-size"] ?? "28px",
      "font-weight": style["font-weight"] ?? 700,
      "line-height": style["line-height"] ?? 1.25,
      "text-align": "center",
      "vertical-align": "top",
      width,
    },
  });
}

function officialSemanticCardRenderer(
  input: Parameters<typeof genericSemanticCardRenderer>[0],
): SafeHtmlNode {
  if (!input.manifest.semanticRoles.includes("data")) {
    return genericSemanticCardRenderer(input);
  }

  const variant = visualVariant(input.manifest as (typeof OFFICIAL_COMPONENT_MANIFESTS)[number]);
  const values = (input.node.content ?? []).map((child) => blockText(child));
  const valueWidth =
    variant === "double_compare" && input.context.mode === "standard" ? "50%" : "100%";
  const valueNodes = values.map((value) => dataValue(value, input.style, valueWidth));

  return htmlElement("section", {
    children: [
      ...(input.node.attrs.title === undefined
        ? []
        : [
            htmlElement("p", {
              children: [input.node.attrs.title],
              style: {
                ...TEXT_WRAP_STYLE,
                color: String(input.context.tokens.colors.textSecondary),
                "font-size": `${String(input.context.tokens.typography.captionSize)}px`,
                "font-weight": 600,
                margin: "0 0 10px",
                "text-align": "center",
              },
            }),
          ]),
      htmlElement("section", {
        children: valueNodes,
        style: {
          ...TEXT_WRAP_STYLE,
          display: "block",
          margin: "0",
          "text-align": "center",
        },
      }),
      ...(input.node.attrs.footer === undefined
        ? []
        : [
            htmlElement("p", {
              children: [input.node.attrs.footer],
              style: {
                ...TEXT_WRAP_STYLE,
                color: String(input.context.tokens.colors.textMuted),
                "font-size": `${String(input.context.tokens.typography.captionSize)}px`,
                margin: "8px 0 0",
                "text-align": "center",
              },
            }),
          ]),
    ],
    style: {
      ...TEXT_WRAP_STYLE,
      margin: "16px 0",
      padding: "16px",
      ...input.style,
    },
  });
}

/**
 * Creates a fresh, mutable renderer registry for the bundled component pack.
 *
 * Native components are rendered by their semantic node renderer. Registering
 * every key here still makes the renderer contract auditable and lets the
 * semantic NOTICE/DATA families share the same safe, text-preserving shell.
 */
export function createOfficialComponentRendererRegistry(): WechatComponentRendererRegistry {
  const registry = new WechatComponentRendererRegistry();
  const keys = new Set(OFFICIAL_COMPONENT_MANIFESTS.map((manifest) => manifest.wechatRendererKey));
  [...keys].sort().forEach((rendererKey) => {
    registry.register(
      rendererKey,
      rendererKey === "officialSemanticCardRenderer"
        ? officialSemanticCardRenderer
        : genericSemanticCardRenderer,
    );
  });
  return registry;
}
