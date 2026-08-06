import { createHash } from "node:crypto";

import {
  builtInVisualAssetPublicUrl,
  createOfficialComponentRegistry,
  type ComponentRegistry,
} from "@wechat-layout/component-registry";
import {
  TokenEngine,
  type ComponentStyleTokens,
  type ComponentTokenDefinition,
  type ThemeTokenTree,
} from "@wechat-layout/design-tokens";
import {
  blockText,
  documentPlainText,
  validateDocument,
  type BlockNode,
  type DocumentV1,
  type StyleOverrides,
} from "@wechat-layout/document-schema";

import { createDefaultNodeRendererRegistry } from "./default-renderers.js";
import { createOfficialComponentRendererRegistry } from "./official-component-renderers.js";
import { WECHAT_COMPATIBILITY_RULE_VERSION } from "./compatibility-version.js";
import { htmlElement, serializeSafeHtml, type SafeHtmlNode } from "./html.js";
import {
  WechatComponentRendererRegistry,
  type ResolvedWechatResource,
  type WechatNodeRenderContext,
  type WechatNodeRenderState,
  type WechatNodeRendererRegistry,
} from "./registry.js";
import type { WechatStyleMap, WechatStyleProperty, WechatStyleValue } from "./style-serializer.js";
import {
  WECHAT_OUTPUT_MODES,
  WECHAT_RENDERER_VERSION,
  WechatRenderError,
  documentIssues,
  tokenIssues,
  type WechatOutputMode,
  type WechatRenderAttempt,
  type WechatRenderInput,
  type WechatRenderResult,
  type WechatRenderWarning,
  type WechatResourceMap,
} from "./types.js";
import { sanitizeWechatUrl } from "./url-sanitizer.js";

export interface WechatHtmlRendererOptions {
  readonly componentRegistry?: ComponentRegistry;
  readonly componentRenderers?: WechatComponentRendererRegistry;
  readonly nodeRenderers?: WechatNodeRendererRegistry;
  readonly tokenEngine?: TokenEngine;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach((entry) => {
    deepFreeze(entry);
  });
  return value;
}

function tokenMode(mode: WechatOutputMode): "standard" | "wechat_safe" {
  return mode === "standard" ? "standard" : "wechat_safe";
}

function styleOverrides(value: StyleOverrides | undefined): ComponentStyleTokens | undefined {
  if (value === undefined) {
    return undefined;
  }
  return {
    ...(value.backgroundColor === undefined ? {} : { backgroundColor: value.backgroundColor }),
    ...(value.borderColor === undefined ? {} : { borderColor: value.borderColor }),
    ...(value.borderRadius === undefined ? {} : { borderRadius: value.borderRadius }),
    ...(value.borderStyle === undefined ? {} : { borderStyle: value.borderStyle }),
    ...(value.borderWidth === undefined ? {} : { borderWidth: value.borderWidth }),
    ...(value.fontFamily === undefined ? {} : { fontFamily: value.fontFamily }),
    ...(value.fontSize === undefined ? {} : { fontSize: value.fontSize }),
    ...(value.fontWeight === undefined ? {} : { fontWeight: value.fontWeight }),
    ...(value.letterSpacing === undefined ? {} : { letterSpacing: value.letterSpacing }),
    ...(value.lineHeight === undefined ? {} : { lineHeight: value.lineHeight }),
    ...(value.marginBottom === undefined ? {} : { marginBottom: value.marginBottom }),
    ...(value.marginTop === undefined ? {} : { marginTop: value.marginTop }),
    ...(value.paddingBottom === undefined ? {} : { paddingBottom: value.paddingBottom }),
    ...(value.paddingLeft === undefined ? {} : { paddingLeft: value.paddingLeft }),
    ...(value.paddingRight === undefined ? {} : { paddingRight: value.paddingRight }),
    ...(value.paddingTop === undefined ? {} : { paddingTop: value.paddingTop }),
    ...(value.textAlign === undefined ? {} : { textAlign: value.textAlign }),
    ...(value.textColor === undefined ? {} : { color: value.textColor }),
  };
}

function setStyle(
  target: Partial<Record<WechatStyleProperty, WechatStyleValue>>,
  property: WechatStyleProperty,
  value: unknown,
  unit = "",
): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[property] = `${String(value)}${unit}`;
  } else if (typeof value === "string") {
    target[property] = value;
  }
}

function componentStyle(value: ComponentTokenDefinition): WechatStyleMap {
  const style: Partial<Record<WechatStyleProperty, WechatStyleValue>> = {};
  setStyle(style, "background", value.background);
  setStyle(style, "background-color", value.backgroundColor);
  setStyle(style, "background-image", value.backgroundImage);
  setStyle(style, "border-color", value.borderColor);
  setStyle(style, "border-radius", value.borderRadius, "px");
  setStyle(style, "border-style", value.borderStyle);
  setStyle(style, "border-width", value.borderWidth, "px");
  setStyle(style, "box-shadow", value.boxShadow);
  setStyle(style, "color", value.color);
  setStyle(style, "font-family", value.fontFamily);
  setStyle(style, "font-size", value.fontSize, "px");
  setStyle(style, "font-weight", value.fontWeight);
  setStyle(style, "letter-spacing", value.letterSpacing, "px");
  setStyle(style, "line-height", value.lineHeight);
  setStyle(style, "margin-bottom", value.marginBottom, "px");
  setStyle(style, "margin-top", value.marginTop, "px");
  setStyle(style, "padding-bottom", value.paddingBottom, "px");
  setStyle(style, "padding-left", value.paddingLeft, "px");
  setStyle(style, "padding-right", value.paddingRight, "px");
  setStyle(style, "padding-top", value.paddingTop, "px");
  setStyle(style, "position", value.position);
  setStyle(style, "text-align", value.textAlign);
  return style;
}

function textWithBreaks(value: string): readonly SafeHtmlNode[] {
  return value
    .split("\n")
    .flatMap((line, index) => (index === 0 ? [line] : [htmlElement("br"), line]));
}

class RenderSession implements WechatNodeRenderContext {
  readonly componentRegistry: ComponentRegistry | undefined;
  readonly componentRenderers: WechatComponentRendererRegistry;
  readonly mode: WechatOutputMode;
  readonly tokens: ThemeTokenTree;
  readonly #brand: WechatRenderInput["brand"];
  readonly #componentVersions = new Set<string>();
  readonly #nodeRenderers: WechatNodeRendererRegistry;
  readonly #resourceIds = new Set<string>();
  readonly #resources: WechatResourceMap;
  readonly #theme: WechatRenderInput["theme"];
  readonly #tokenEngine: TokenEngine;
  readonly #warnings: WechatRenderWarning[] = [];

  constructor(
    input: WechatRenderInput,
    options: {
      readonly componentRegistry?: ComponentRegistry;
      readonly componentRenderers: WechatComponentRendererRegistry;
      readonly nodeRenderers: WechatNodeRendererRegistry;
      readonly tokenEngine: TokenEngine;
    },
    mode: WechatOutputMode,
  ) {
    this.mode = mode;
    this.#brand = input.brand;
    this.componentRegistry = options.componentRegistry;
    this.componentRenderers = options.componentRenderers;
    this.#nodeRenderers = options.nodeRenderers;
    this.#resources = input.resources ?? {};
    this.#theme = input.theme;
    this.#tokenEngine = options.tokenEngine;

    const rootTokens = this.#tokenEngine.tryResolve({
      ...(this.#brand === undefined ? {} : { brand: this.#brand }),
      mode: tokenMode(mode),
      ...(this.#theme === undefined ? {} : { theme: this.#theme }),
    });
    if (!rootTokens.success) {
      throw new WechatRenderError(tokenIssues(rootTokens.issues));
    }
    this.tokens = rootTokens.data.tokens;
  }

  get componentVersions(): readonly string[] {
    return [...this.#componentVersions].sort();
  }

  get resourceIds(): readonly string[] {
    return [...this.#resourceIds].sort();
  }

  get warnings(): readonly WechatRenderWarning[] {
    return this.#warnings;
  }

  warn(warning: WechatRenderWarning): void {
    this.#warnings.push(warning);
  }

  recordComponent(componentId: string, version: string): void {
    this.#componentVersions.add(`${componentId}@${version}`);
  }

  resolveResource(resourceId: string, path: string): ResolvedWechatResource | null {
    this.#resourceIds.add(resourceId);
    const reference = this.#resources[resourceId] ?? builtInVisualAssetPublicUrl(resourceId);
    if (reference === undefined) {
      this.warn({
        code: "RESOURCE_MISSING",
        message: `资源 “${resourceId}” 未提供可发布地址`,
        path,
        severity: "warning",
      });
      return null;
    }
    const url = typeof reference === "string" ? reference : reference.url;
    const sanitized = sanitizeWechatUrl(url, "image");
    if (!sanitized.success) {
      this.warn({
        code: "URL_BLOCKED",
        message: `资源 “${resourceId}” 地址被阻止：${sanitized.reason}`,
        path,
        severity: "warning",
      });
      return null;
    }
    return {
      ...(typeof reference === "string" || reference.alt === undefined
        ? {}
        : { alt: reference.alt }),
      resourceId,
      url: sanitized.normalized,
    };
  }

  styleFor(
    node: BlockNode,
    defaultComponentRef?: string,
    componentTokens?: ComponentTokenDefinition,
  ): WechatStyleMap {
    const overrides = styleOverrides(node.attrs.styleOverrides);
    const component =
      defaultComponentRef === undefined && componentTokens === undefined
        ? undefined
        : {
            ...(defaultComponentRef === undefined ? {} : { ref: defaultComponentRef }),
            ...(componentTokens === undefined ? {} : { tokens: componentTokens }),
          };
    const resolve = (includeReference: boolean) =>
      this.#tokenEngine.tryResolve({
        ...(this.#brand === undefined ? {} : { brand: this.#brand }),
        ...(component === undefined
          ? {}
          : {
              component: includeReference
                ? component
                : componentTokens === undefined
                  ? {}
                  : { tokens: componentTokens },
            }),
        mode: tokenMode(this.mode),
        ...(overrides === undefined ? {} : { node: overrides }),
        ...(this.#theme === undefined ? {} : { theme: this.#theme }),
      });

    let result = resolve(true);
    if (
      !result.success &&
      defaultComponentRef !== undefined &&
      result.issues.every(
        (issue) => issue.code === "REFERENCE_NOT_FOUND" && issue.path === "/component/ref",
      )
    ) {
      this.warn({
        code: "TOKEN_REFERENCE_MISSING",
        message: `组件 Token “${defaultComponentRef}” 不存在，已使用安全基础样式`,
        path: `/styles/${node.attrs.blockId}`,
        severity: "warning",
      });
      result = resolve(false);
    }
    if (!result.success) {
      throw new WechatRenderError(tokenIssues(result.issues));
    }
    return componentStyle(result.data.style);
  }

  renderBlocks(nodes: readonly BlockNode[], path: string, depth: number): readonly SafeHtmlNode[] {
    return nodes.map((node, index) =>
      this.renderBlock(node, `${path}/${String(index)}`, { depth }),
    );
  }

  renderBlock(node: BlockNode, path: string, state: WechatNodeRenderState): SafeHtmlNode {
    const maximumDepth = this.mode === "standard" ? 8 : 3;
    if (state.depth > maximumDepth) {
      this.warn({
        code: "NESTING_FLATTENED",
        message: `容器深度超过 ${String(maximumDepth)}，已展开为纯文本`,
        path,
        severity: "warning",
      });
      return htmlElement("p", {
        children: textWithBreaks(blockText(node)),
        style: {
          "box-sizing": "border-box",
          margin: "0 0 12px",
          "max-width": "100%",
          "overflow-wrap": "anywhere",
          "word-break": "break-word",
        },
      });
    }
    const renderer = this.#nodeRenderers.get(node.type);
    if (renderer === null) {
      throw new WechatRenderError([
        {
          code: "INVALID_INPUT",
          message: `Node “${node.type}” 没有注册 Renderer`,
          path,
        },
      ]);
    }
    return renderer(node, this, path, state);
  }
}

function validMode(value: unknown): value is WechatOutputMode {
  return typeof value === "string" && WECHAT_OUTPUT_MODES.includes(value as WechatOutputMode);
}

function immutableDocument(document: DocumentV1): DocumentV1 {
  return deepFreeze(structuredClone(document)) as DocumentV1;
}

export class WechatHtmlRenderer {
  readonly #componentRegistry: ComponentRegistry | undefined;
  readonly #componentRenderers: WechatComponentRendererRegistry;
  readonly #nodeRenderers: WechatNodeRendererRegistry;
  readonly #tokenEngine: TokenEngine;

  constructor(options: WechatHtmlRendererOptions = {}) {
    this.#componentRegistry = options.componentRegistry ?? createOfficialComponentRegistry();
    this.#componentRenderers = (
      options.componentRenderers ?? createOfficialComponentRendererRegistry()
    ).freeze();
    this.#nodeRenderers = (options.nodeRenderers ?? createDefaultNodeRendererRegistry()).freeze();
    this.#tokenEngine = options.tokenEngine ?? new TokenEngine();
  }

  render(input: WechatRenderInput): WechatRenderResult {
    const attempt = this.tryRender(input);
    if (!attempt.success) {
      throw new WechatRenderError(attempt.issues);
    }
    return attempt.data;
  }

  tryRender(input: WechatRenderInput): WechatRenderAttempt {
    const mode = input.mode ?? "standard";
    if (!validMode(mode)) {
      return {
        success: false,
        issues: [
          {
            code: "INVALID_INPUT",
            message: "输出模式必须是 standard、wechat_safe 或 static",
            path: "/mode",
          },
        ],
      };
    }
    const validation = validateDocument(input.document);
    if (!validation.success) {
      return {
        success: false,
        issues: documentIssues(validation.errors),
      };
    }

    const document = immutableDocument(validation.data);
    const plainText = documentPlainText(document.content);
    const sourceTextHash = sha256(plainText);
    if (
      input.expectedSourceTextHash !== undefined &&
      input.expectedSourceTextHash !== sourceTextHash
    ) {
      return {
        success: false,
        issues: [
          {
            code: "TEXT_HASH_MISMATCH",
            message: "渲染前原文哈希与调用方预期不一致",
            path: "/expectedSourceTextHash",
          },
        ],
      };
    }

    try {
      const session = new RenderSession(
        input,
        {
          ...(this.#componentRegistry === undefined
            ? {}
            : { componentRegistry: this.#componentRegistry }),
          componentRenderers: this.#componentRenderers,
          nodeRenderers: this.#nodeRenderers,
          tokenEngine: this.#tokenEngine,
        },
        mode,
      );
      const tree = htmlElement("section", {
        children: session.renderBlocks(document.content.content, "/document/content/content", 0),
        style: {
          "background-color": String(session.tokens.colors.background),
          "box-sizing": "border-box",
          color: String(session.tokens.colors.textPrimary),
          "font-family":
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
          margin: "0",
          "max-width": "100%",
          padding: `${String(session.tokens.spacing.contentPadding)}px`,
          "word-break": "break-word",
        },
      });
      const serialized = serializeSafeHtml(tree, mode);
      serialized.warnings.forEach((warning) => {
        session.warn({
          code: "HTML_POLICY_DROPPED",
          message: warning.message,
          path: warning.path,
          severity: "warning",
        });
      });

      const renderedTextHash = sha256(documentPlainText(document.content));
      if (renderedTextHash !== sourceTextHash) {
        return {
          success: false,
          issues: [
            {
              code: "TEXT_INTEGRITY_VIOLATION",
              message: "Renderer 修改了权威文档原文",
              path: "/document/content",
            },
          ],
        };
      }
      const result: WechatRenderResult = {
        html: serialized.html,
        manifest: {
          componentVersions: session.componentVersions,
          compatibilityRuleVersion: WECHAT_COMPATIBILITY_RULE_VERSION,
          documentSchemaVersion: document.schemaVersion,
          rendererVersion: WECHAT_RENDERER_VERSION,
          resourceIds: session.resourceIds,
        },
        mode,
        outputHash: sha256(serialized.html),
        plainText,
        rendererVersion: WECHAT_RENDERER_VERSION,
        textIntegrity: {
          renderedTextHash,
          sourceTextHash,
          unchanged: true,
        },
        warnings: session.warnings,
      };
      return {
        success: true,
        data: deepFreeze(result) as WechatRenderResult,
      };
    } catch (error) {
      if (error instanceof WechatRenderError) {
        return { success: false, issues: error.issues };
      }
      throw error;
    }
  }
}

export function renderWechatHtml(
  input: WechatRenderInput,
  options: WechatHtmlRendererOptions = {},
): WechatRenderResult {
  return new WechatHtmlRenderer(options).render(input);
}
