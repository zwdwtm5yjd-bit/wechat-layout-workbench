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

const VISUAL_ASSET_FILES: Readonly<Record<string, string>> = {
  autumn_persimmon_intro: "autumn-persimmon-branch.png",
  bamboo_note: "bamboo-corner.svg",
  civic_red_banner: "red-gold-wave.svg",
  civic_red_notice: "red-gold-wave.svg",
  cloud_scroll_heading: "cloud-scroll.svg",
  festival_lantern_hero: "festival-lanterns.svg",
  film_triptych: "photo-film-frame.svg",
  ink_mountain_hero: "ink-mountain-panorama.png",
  leaf_story_intro: "leaf-divider.svg",
  magazine_duo: "photo-film-frame.svg",
  mist_mountain_heading: "mist-mountains.svg",
  tech_orbit_hero: "tech-orbit.svg",
};

function visualArtwork(variant: string, name: string): SafeHtmlNode | null {
  const file = VISUAL_ASSET_FILES[variant];
  if (file === undefined) return null;
  return htmlElement("img", {
    attributes: {
      alt: `${name}原创视觉装饰`,
      src: `https://visual.ericmm.com/visual-assets/${file}`,
    },
    style: {
      display: "block",
      height: "auto",
      "max-width": "100%",
      width: "100%",
    },
  });
}

function visualTextContent(
  input: Parameters<typeof genericSemanticCardRenderer>[0],
  dark: boolean,
  children: readonly SafeHtmlNode[],
): SafeHtmlNode {
  return htmlElement("section", {
    children: [
      ...(input.node.attrs.eyebrow === undefined
        ? []
        : [
            htmlElement("p", {
              children: [input.node.attrs.eyebrow],
              style: {
                ...TEXT_WRAP_STYLE,
                color: dark ? "#e6c66f" : String(input.context.tokens.colors.primary),
                "font-size": `${String(input.context.tokens.typography.captionSize)}px`,
                "font-weight": 700,
                "letter-spacing": "1.6px",
                margin: "0 0 8px",
              },
            }),
          ]),
      ...(input.node.attrs.title === undefined
        ? []
        : [
            htmlElement("p", {
              children: [input.node.attrs.title],
              style: {
                ...TEXT_WRAP_STYLE,
                color: dark ? "#ffffff" : String(input.context.tokens.colors.textPrimary),
                "font-size": `${String(input.context.tokens.typography.heading2Size)}px`,
                "font-weight": 700,
                "line-height": 1.45,
                margin: "0 0 12px",
              },
            }),
          ]),
      ...children,
    ],
    style: {
      ...TEXT_WRAP_STYLE,
      color: dark ? "#eef4f8" : String(input.context.tokens.colors.textSecondary),
      padding: "18px 20px 20px",
    },
  });
}

function officialVisualCardRenderer(
  input: Parameters<typeof genericSemanticCardRenderer>[0],
): SafeHtmlNode {
  const variant = visualVariant(input.manifest as (typeof OFFICIAL_COMPONENT_MANIFESTS)[number]);
  const artwork = visualArtwork(variant, input.manifest.name);
  const gallery = input.manifest.semanticRoles.includes("gallery");
  const dark = variant === "tech_orbit_hero" || variant === "film_triptych";
  const [body, ...media] = input.children;
  const galleryWidth = media.length >= 3 ? "32%" : "49%";
  const galleryChildren = media.map((child, index) =>
    htmlElement("span", {
      children: [child],
      style: {
        display: "inline-block",
        "margin-right": index === media.length - 1 ? "0" : "1.5%",
        "vertical-align": "top",
        width: galleryWidth,
      },
    }),
  );
  const content = visualTextContent(input, dark, [
    ...(body === undefined ? [] : [body]),
    ...(gallery
      ? [
          htmlElement("section", {
            children: galleryChildren,
            style: { margin: "14px 0 0", "text-align": "center", width: "100%" },
          }),
        ]
      : media),
  ]);

  return htmlElement("section", {
    children: [...(artwork === null ? [] : [artwork]), content],
    style: {
      ...TEXT_WRAP_STYLE,
      "background-color": dark ? "#102d4c" : String(input.context.tokens.colors.background),
      border: `1px solid ${String(input.context.tokens.colors.border)}`,
      "border-radius": "10px",
      margin: "18px 0",
      "max-width": "100%",
      overflow: "hidden",
    },
  });
}

function officialSemanticCardRenderer(
  input: Parameters<typeof genericSemanticCardRenderer>[0],
): SafeHtmlNode {
  if (input.manifest.semanticRoles.includes("visual")) {
    return officialVisualCardRenderer(input);
  }
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
