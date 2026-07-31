import type { ComponentManifest, ComponentRegistry } from "@wechat-layout/component-registry";
import type { ComponentTokenDefinition, ThemeTokenTree } from "@wechat-layout/design-tokens";
import type { BlockNode, SemanticCardNode } from "@wechat-layout/document-schema";

import type { SafeHtmlNode } from "./html.js";
import type { WechatStyleMap } from "./style-serializer.js";
import type { WechatOutputMode, WechatRenderWarning } from "./types.js";

export interface ResolvedWechatResource {
  readonly alt?: string;
  readonly resourceId: string;
  readonly url: string;
}

export interface WechatNodeRenderState {
  readonly depth: number;
  readonly listMarker?: string;
}

export interface WechatNodeRenderContext {
  readonly componentRegistry: ComponentRegistry | undefined;
  readonly componentRenderers: WechatComponentRendererRegistry;
  readonly mode: WechatOutputMode;
  readonly tokens: ThemeTokenTree;
  renderBlock(node: BlockNode, path: string, state: WechatNodeRenderState): SafeHtmlNode;
  renderBlocks(nodes: readonly BlockNode[], path: string, depth: number): readonly SafeHtmlNode[];
  recordComponent(componentId: string, version: string): void;
  resolveResource(resourceId: string, path: string): ResolvedWechatResource | null;
  styleFor(
    node: BlockNode,
    defaultComponentRef?: string,
    componentTokens?: ComponentTokenDefinition,
  ): WechatStyleMap;
  warn(warning: WechatRenderWarning): void;
}

export type WechatNodeRenderer = (
  node: BlockNode,
  context: WechatNodeRenderContext,
  path: string,
  state: WechatNodeRenderState,
) => SafeHtmlNode;

export interface WechatComponentRenderInput {
  readonly children: readonly SafeHtmlNode[];
  readonly context: WechatNodeRenderContext;
  readonly manifest: ComponentManifest;
  readonly node: SemanticCardNode;
  readonly path: string;
  readonly style: WechatStyleMap;
}

export type WechatComponentRenderer = (input: WechatComponentRenderInput) => SafeHtmlNode;

export class RendererRegistrationError extends Error {
  readonly code: "DUPLICATE_RENDERER" | "REGISTRY_FROZEN";

  constructor(code: "DUPLICATE_RENDERER" | "REGISTRY_FROZEN", message: string) {
    super(message);
    this.name = "RendererRegistrationError";
    this.code = code;
  }
}

export class WechatNodeRendererRegistry {
  readonly #renderers = new Map<BlockNode["type"], WechatNodeRenderer>();
  #frozen = false;

  register(nodeType: BlockNode["type"], renderer: WechatNodeRenderer): this {
    if (this.#frozen) {
      throw new RendererRegistrationError("REGISTRY_FROZEN", "Node Renderer 注册表已冻结");
    }
    if (this.#renderers.has(nodeType)) {
      throw new RendererRegistrationError(
        "DUPLICATE_RENDERER",
        `Node “${nodeType}” 已注册 Renderer`,
      );
    }
    this.#renderers.set(nodeType, renderer);
    return this;
  }

  freeze(): this {
    this.#frozen = true;
    return this;
  }

  get(nodeType: BlockNode["type"]): WechatNodeRenderer | null {
    return this.#renderers.get(nodeType) ?? null;
  }

  list(): readonly BlockNode["type"][] {
    return Object.freeze([...this.#renderers.keys()].sort());
  }
}

export class WechatComponentRendererRegistry {
  readonly #renderers = new Map<string, WechatComponentRenderer>();
  #frozen = false;

  register(rendererKey: string, renderer: WechatComponentRenderer): this {
    if (this.#frozen) {
      throw new RendererRegistrationError("REGISTRY_FROZEN", "Component Renderer 注册表已冻结");
    }
    if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(rendererKey)) {
      throw new TypeError("Component Renderer Key 格式不合法");
    }
    if (this.#renderers.has(rendererKey)) {
      throw new RendererRegistrationError(
        "DUPLICATE_RENDERER",
        `Component Renderer “${rendererKey}” 已注册`,
      );
    }
    this.#renderers.set(rendererKey, renderer);
    return this;
  }

  freeze(): this {
    this.#frozen = true;
    return this;
  }

  get(rendererKey: string): WechatComponentRenderer | null {
    return this.#renderers.get(rendererKey) ?? null;
  }

  list(): readonly string[] {
    return Object.freeze([...this.#renderers.keys()].sort());
  }
}
