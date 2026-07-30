import { SYSTEM_THEME_TOKENS, WECHAT_SYSTEM_FONT } from "./defaults.js";
import {
  TOKEN_SCHEMA_VERSION,
  type BrandTokenPlaceholder,
  type ComponentStyleTokens,
  type ComponentTokenDefinition,
  type ResolveTokenInput,
  type ResolvedBrandPlaceholder,
  type ThemeTokenOverride,
  type ThemeTokenTree,
  type TokenCacheStats,
  type TokenResolutionAttempt,
  type TokenResolutionResult,
  type TokenResolutionTraceEntry,
  type TokenValidationIssue,
} from "./types.js";
import {
  validateComponentTokenDefinition,
  validateResolveTokenInput,
  validateResolvedThemeTokenTree,
} from "./validation.js";

type JsonRecord = Record<string, unknown>;
type ObjectEntry = readonly [string, unknown];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareEntries([left]: ObjectEntry, [right]: ObjectEntry): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry)) as T;
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  ) as T;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (isRecord(value) || Array.isArray(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      if ((isRecord(entry) || Array.isArray(entry)) && !Object.isFrozen(entry)) {
        deepFreeze(entry);
      }
    }
  }
  return value;
}

function baseTokenTree(): ThemeTokenTree {
  return structuredClone({
    border: SYSTEM_THEME_TOKENS.border,
    colors: SYSTEM_THEME_TOKENS.colors,
    compatibility: SYSTEM_THEME_TOKENS.compatibility,
    components: SYSTEM_THEME_TOKENS.components,
    image: SYSTEM_THEME_TOKENS.image,
    motion: SYSTEM_THEME_TOKENS.motion,
    radius: SYSTEM_THEME_TOKENS.radius,
    shadow: SYSTEM_THEME_TOKENS.shadow,
    spacing: SYSTEM_THEME_TOKENS.spacing,
    typography: SYSTEM_THEME_TOKENS.typography,
  }) as ThemeTokenTree;
}

function mergeRecord<T extends object>(current: T, override: object | undefined): T {
  return override === undefined ? current : ({ ...current, ...override } as T);
}

function mergeThemeTokens(
  current: ThemeTokenTree,
  override: ThemeTokenOverride | undefined,
): ThemeTokenTree {
  if (override === undefined) {
    return current;
  }

  const components = { ...current.components };
  for (const [componentRef, definition] of Object.entries(override.components ?? {})) {
    components[componentRef] = {
      ...(components[componentRef] ?? {}),
      ...definition,
    };
  }

  return {
    border: mergeRecord(current.border, override.border),
    colors: mergeRecord(current.colors, override.colors),
    compatibility: mergeRecord(current.compatibility, override.compatibility),
    components,
    image: mergeRecord(current.image, override.image),
    motion: mergeRecord(current.motion, override.motion),
    radius: mergeRecord(current.radius, override.radius),
    shadow: mergeRecord(current.shadow, override.shadow),
    spacing: mergeRecord(current.spacing, override.spacing),
    typography: mergeRecord(current.typography, override.typography),
  };
}

function pathsIn(value: unknown, prefix = ""): string[] {
  if (!isRecord(value)) {
    return prefix.length === 0 ? [] : [prefix];
  }
  return Object.keys(value)
    .filter((key) => key !== "schemaVersion")
    .sort()
    .flatMap((key) => pathsIn(value[key], prefix.length === 0 ? key : `${prefix}.${key}`));
}

function referencePath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("{") || !value.endsWith("}")) {
    return null;
  }
  return value.slice(1, -1);
}

function valueAtPath(source: ThemeTokenTree, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function resolveReferences(
  source: ThemeTokenTree,
): { readonly data: ThemeTokenTree } | { readonly issues: readonly TokenValidationIssue[] } {
  const issues: TokenValidationIssue[] = [];
  const cache = new Map<string, unknown>();

  const resolvePath = (path: string, stack: readonly string[]): unknown => {
    if (cache.has(path)) {
      return cache.get(path);
    }
    if (path.startsWith("components.")) {
      issues.push({
        code: "INVALID_REFERENCE",
        path: `/resolved/${path.replaceAll(".", "/")}`,
        message: "组件 Token 不能作为引用目标",
      });
      return undefined;
    }
    if (stack.includes(path)) {
      issues.push({
        code: "REFERENCE_CYCLE",
        path: `/resolved/${path.replaceAll(".", "/")}`,
        message: `Token 引用形成循环：${[...stack, path].join(" → ")}`,
      });
      return undefined;
    }

    const raw = valueAtPath(source, path);
    if (raw === undefined || isRecord(raw) || Array.isArray(raw)) {
      issues.push({
        code: "REFERENCE_NOT_FOUND",
        path: `/resolved/${path.replaceAll(".", "/")}`,
        message: `Token 引用目标 “${path}” 不存在或不是标量`,
      });
      return undefined;
    }
    const referencedPath = referencePath(raw);
    const resolved = referencedPath === null ? raw : resolvePath(referencedPath, [...stack, path]);
    cache.set(path, resolved);
    return resolved;
  };

  const resolveValue = (value: unknown, path: string): unknown => {
    const referencedPath = referencePath(value);
    if (referencedPath !== null) {
      const resolved = resolvePath(referencedPath, []);
      if (resolved === undefined) {
        issues.push({
          code: "REFERENCE_NOT_FOUND",
          path,
          message: `无法解析 Token 引用 “${value}”`,
        });
      }
      return resolved;
    }
    if (!isRecord(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, resolveValue(value[key], `${path}/${key}`)]),
    );
  };

  const resolved = resolveValue(source, "/resolved") as ThemeTokenTree;
  return issues.length === 0 ? { data: resolved } : { issues };
}

function resolveStyleReferences(
  style: ComponentTokenDefinition | ComponentStyleTokens | undefined,
  tokens: ThemeTokenTree,
  path: string,
):
  | { readonly data: ComponentTokenDefinition }
  | { readonly issues: readonly TokenValidationIssue[] } {
  if (style === undefined) {
    return { data: {} };
  }

  const issues: TokenValidationIssue[] = [];
  const data: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(style).sort(compareEntries)) {
    const tokenPath = referencePath(raw);
    if (tokenPath === null) {
      data[key] = raw;
      continue;
    }
    if (tokenPath.startsWith("components.")) {
      issues.push({
        code: "INVALID_REFERENCE",
        path: `${path}/${key}`,
        message: "样式不能直接引用组件对象",
      });
      continue;
    }
    const value = valueAtPath(tokens, tokenPath);
    if (value === undefined || isRecord(value) || Array.isArray(value)) {
      issues.push({
        code: "REFERENCE_NOT_FOUND",
        path: `${path}/${key}`,
        message: `Token 引用目标 “${tokenPath}” 不存在或不是标量`,
      });
      continue;
    }
    data[key] = value;
  }

  if (issues.length > 0) {
    return { issues };
  }
  const validation = validateComponentTokenDefinition(data, path);
  return validation.success ? { data: validation.data } : { issues: validation.issues };
}

function applyBrand(
  tokens: ThemeTokenTree,
  brand: BrandTokenPlaceholder | undefined,
): ThemeTokenTree {
  return brand?.colors === undefined
    ? tokens
    : {
        ...tokens,
        colors: {
          ...tokens.colors,
          ...brand.colors,
        },
      };
}

function resolvedBrand(brand: BrandTokenPlaceholder | undefined): ResolvedBrandPlaceholder | null {
  if (brand === undefined) {
    return null;
  }
  return {
    ...(brand.accountId === undefined ? {} : { accountId: brand.accountId }),
    assets: { ...(brand.assets ?? {}) },
    defaults: { ...(brand.defaults ?? {}) },
    version: brand.version,
  };
}

function safeComponentStyle(definition: ComponentTokenDefinition): ComponentTokenDefinition {
  const safe = { ...definition };
  delete safe.backgroundImage;
  if (safe.boxShadow !== undefined) {
    safe.boxShadow = "none";
  }
  if (safe.columns !== undefined) {
    safe.columns = 1;
  }
  if (safe.fontFamily !== undefined) {
    safe.fontFamily = WECHAT_SYSTEM_FONT;
  }
  if (safe.position !== undefined) {
    safe.position = "static";
  }
  return safe;
}

function normalizeComponentStyle(definition: ComponentTokenDefinition): ComponentTokenDefinition {
  if (definition.background === undefined) {
    return definition;
  }
  const normalized = {
    ...definition,
    ...(definition.backgroundColor === undefined ? { backgroundColor: definition.background } : {}),
  };
  delete normalized.background;
  return normalized;
}

function applyWechatSafety(tokens: ThemeTokenTree): ThemeTokenTree {
  return {
    ...tokens,
    compatibility: {
      allowComplexBackground: false,
      allowCustomFont: false,
      allowRiskyLayout: false,
      allowShadow: false,
      maxNestingDepth: Math.min(Number(tokens.compatibility.maxNestingDepth), 3),
    },
    components: Object.fromEntries(
      Object.entries(tokens.components).map(([ref, definition]) => [
        ref,
        safeComponentStyle(definition),
      ]),
    ),
    image: {
      ...tokens.image,
      shadow: "none",
    },
    shadow: {
      medium: "none",
      none: "none",
      soft: "none",
    },
    typography: {
      ...tokens.typography,
      fontFamilyWechat: WECHAT_SYSTEM_FONT,
    },
  };
}

function traceEntry(
  layer: TokenResolutionTraceEntry["layer"],
  value: unknown,
): TokenResolutionTraceEntry | null {
  const paths = pathsIn(value);
  return paths.length === 0 ? null : { layer, paths };
}

function appendTrace(
  trace: TokenResolutionTraceEntry[],
  layer: TokenResolutionTraceEntry["layer"],
  value: unknown,
): void {
  const entry = traceEntry(layer, value);
  if (entry !== null) {
    trace.push(entry);
  }
}

function resolveUncached(input: ResolveTokenInput): TokenResolutionAttempt {
  const validation = validateResolveTokenInput(input);
  if (!validation.success) {
    return validation;
  }
  const value = validation.data;
  const trace: TokenResolutionTraceEntry[] = [];
  let rawTokens = baseTokenTree();
  appendTrace(trace, "system", rawTokens);

  if (value.theme !== undefined) {
    rawTokens = mergeThemeTokens(rawTokens, value.theme);
    appendTrace(trace, "theme", value.theme);
  }
  if (value.brand !== undefined) {
    rawTokens = applyBrand(rawTokens, value.brand);
    appendTrace(trace, "brand", value.brand.colors);
  }
  if (value.article?.tokens !== undefined) {
    rawTokens = mergeThemeTokens(rawTokens, value.article.tokens);
  }

  const referenceResult = resolveReferences(rawTokens);
  if ("issues" in referenceResult) {
    return { success: false, issues: referenceResult.issues };
  }
  let tokens = referenceResult.data;
  const treeValidation = validateResolvedThemeTokenTree(tokens);
  if (!treeValidation.success) {
    return treeValidation;
  }

  const componentRef = value.component?.ref ?? null;
  const componentDefinition = componentRef === null ? undefined : tokens.components[componentRef];
  if (componentRef !== null && componentDefinition === undefined) {
    return {
      success: false,
      issues: [
        {
          code: "REFERENCE_NOT_FOUND",
          message: `组件 Token “${componentRef}” 不存在`,
          path: "/component/ref",
        },
      ],
    };
  }
  const baseStyle = resolveStyleReferences(componentDefinition, tokens, "/component/ref");
  if ("issues" in baseStyle) {
    return { success: false, issues: baseStyle.issues };
  }
  const componentOverride = resolveStyleReferences(
    value.component?.tokens,
    tokens,
    "/component/tokens",
  );
  if ("issues" in componentOverride) {
    return { success: false, issues: componentOverride.issues };
  }
  const articleStyle = resolveStyleReferences(value.article?.style, tokens, "/article/style");
  if ("issues" in articleStyle) {
    return { success: false, issues: articleStyle.issues };
  }
  const nodeStyle = resolveStyleReferences(value.node, tokens, "/node");
  if ("issues" in nodeStyle) {
    return { success: false, issues: nodeStyle.issues };
  }
  const inlineStyle = resolveStyleReferences(value.inline, tokens, "/inline");
  if ("issues" in inlineStyle) {
    return { success: false, issues: inlineStyle.issues };
  }

  let style = normalizeComponentStyle({
    ...baseStyle.data,
    ...componentOverride.data,
    ...articleStyle.data,
    ...nodeStyle.data,
    ...inlineStyle.data,
  });
  appendTrace(trace, "component", {
    ...(componentDefinition ?? {}),
    ...(value.component?.tokens ?? {}),
  });
  appendTrace(trace, "article", value.article);
  appendTrace(trace, "node", value.node);
  appendTrace(trace, "inline", value.inline);

  const mode = value.mode ?? "standard";
  if (mode === "wechat_safe") {
    tokens = applyWechatSafety(tokens);
    style = safeComponentStyle(style);
    appendTrace(trace, "safety", {
      "compatibility.allowComplexBackground": false,
      "compatibility.allowCustomFont": false,
      "compatibility.allowRiskyLayout": false,
      "compatibility.allowShadow": false,
      "style.backgroundImage": null,
      "style.boxShadow": "none",
      "style.columns": 1,
      "style.fontFamily": WECHAT_SYSTEM_FONT,
      "style.position": "static",
    });
  }

  const finalStyleValidation = validateComponentTokenDefinition(style, "/resolved/style");
  if (!finalStyleValidation.success) {
    return finalStyleValidation;
  }

  const result = canonicalize({
    brand: resolvedBrand(value.brand),
    componentRef,
    mode,
    schemaVersion: TOKEN_SCHEMA_VERSION,
    style: finalStyleValidation.data,
    tokens,
    trace,
  }) as TokenResolutionResult;
  return {
    success: true,
    data: deepFreeze(result) as TokenResolutionResult,
  };
}

export class TokenValidationError extends Error {
  readonly issues: readonly TokenValidationIssue[];

  constructor(issues: readonly TokenValidationIssue[]) {
    super(issues.map((entry) => `${entry.path}: ${entry.message}`).join("; "));
    this.name = "TokenValidationError";
    this.issues = issues;
  }
}

export class TokenEngine {
  readonly #cache = new Map<string, TokenResolutionResult>();
  readonly #maxEntries: number;
  #hits = 0;
  #misses = 0;

  constructor(options: { readonly maxEntries?: number } = {}) {
    const maxEntries = options.maxEntries ?? 128;
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 10_000) {
      throw new RangeError("maxEntries 必须是 1 至 10000 之间的整数");
    }
    this.#maxEntries = maxEntries;
  }

  clear(): void {
    this.#cache.clear();
    this.#hits = 0;
    this.#misses = 0;
  }

  get stats(): TokenCacheStats {
    return {
      hits: this.#hits,
      maxEntries: this.#maxEntries,
      misses: this.#misses,
      size: this.#cache.size,
    };
  }

  tryResolve(input: ResolveTokenInput): TokenResolutionAttempt {
    const inputValidation = validateResolveTokenInput(input);
    if (!inputValidation.success) {
      return inputValidation;
    }

    const key = JSON.stringify(canonicalize(inputValidation.data));
    const cached = this.#cache.get(key);
    if (cached !== undefined) {
      this.#hits += 1;
      this.#cache.delete(key);
      this.#cache.set(key, cached);
      return { success: true, data: cached };
    }

    this.#misses += 1;
    const result = resolveUncached(inputValidation.data);
    if (!result.success) {
      return result;
    }
    this.#cache.set(key, result.data);
    if (this.#cache.size > this.#maxEntries) {
      const oldest = this.#cache.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        this.#cache.delete(oldest);
      }
    }
    return result;
  }

  resolve(input: ResolveTokenInput): TokenResolutionResult {
    const result = this.tryResolve(input);
    if (!result.success) {
      throw new TokenValidationError(result.issues);
    }
    return result.data;
  }
}

const defaultEngine = new TokenEngine();

export function resolveTokens(input: ResolveTokenInput): TokenResolutionResult {
  return defaultEngine.resolve(input);
}

export function tryResolveTokens(input: ResolveTokenInput): TokenResolutionAttempt {
  return defaultEngine.tryResolve(input);
}
