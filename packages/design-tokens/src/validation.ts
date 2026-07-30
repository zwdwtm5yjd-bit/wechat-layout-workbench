import {
  TOKEN_SCHEMA_VERSION,
  type BrandTokenPlaceholder,
  type ComponentStyleTokens,
  type ComponentTokenDefinition,
  type ResolveTokenInput,
  type ThemeTokenDocument,
  type ThemeTokenOverride,
  type ThemeTokenTree,
  type TokenValidationIssue,
  type TokenValidationResult,
} from "./types.js";

type MutableIssues = TokenValidationIssue[];
type LeafValidator = (value: unknown, path: string, issues: MutableIssues) => void;
type ObjectEntry = readonly [string, unknown];

const REFERENCE_PATTERN = /^\{[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+\}$/;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/;
const BORDER_PATTERN = /^(?:none|[1-8]px (?:dashed|dotted|solid))$/;
const COMPONENT_REF_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const FONT_PATTERN = /^[A-Za-z0-9\u3400-\u9FFF\s,'".-]+$/u;
const CUBIC_BEZIER_PATTERN =
  /^cubic-bezier\(-?(?:\d+(?:\.\d+)?|\.\d+),-?(?:\d+(?:\.\d+)?|\.\d+),-?(?:\d+(?:\.\d+)?|\.\d+),-?(?:\d+(?:\.\d+)?|\.\d+)\)$/;
const SHADOW_PATTERN =
  /^(?:none|(?:(?:-?\d{1,2}px|0) ){2}(?:\d{1,3}px|0)(?: (?:\d{1,2}px|0))? rgba\((?:\d{1,3},){3}(?:0|1|0?\.\d{1,2})\))$/;
const RGBA_PATTERN = /rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(0|1|0?\.\d{1,2})\)$/;
const GRADIENT_PATTERN =
  /^linear-gradient\((?:\d{1,3}deg,\s*)?#[0-9A-Fa-f]{6}(?:\s+\d{1,3}%)?\s*,\s*#[0-9A-Fa-f]{6}(?:\s+\d{1,3}%)?\)$/;

function compareEntries([left]: ObjectEntry, [right]: ObjectEntry): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function issue(
  issues: MutableIssues,
  code: TokenValidationIssue["code"],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function isReference(value: unknown): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}

function validateRecord(
  value: unknown,
  path: string,
  issues: MutableIssues,
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", path, "必须是普通对象");
    return false;
  }
  return true;
}

function validateKnownObject(
  value: unknown,
  path: string,
  validators: Readonly<Record<string, LeafValidator>>,
  issues: MutableIssues,
): void {
  if (!validateRecord(value, path, issues)) {
    return;
  }

  for (const [key, entry] of Object.entries(value).sort(compareEntries)) {
    const validator = validators[key];
    if (validator === undefined) {
      issue(issues, "UNKNOWN_TOKEN", `${path}/${key}`, `不支持 Token “${key}”`);
      continue;
    }
    validator(entry, `${path}/${key}`, issues);
  }
}

function referenceOr(validator: LeafValidator): LeafValidator {
  return (value, path, issues) => {
    if (isReference(value)) {
      return;
    }
    if (typeof value === "string" && (value.startsWith("{") || value.endsWith("}"))) {
      issue(issues, "INVALID_REFERENCE", path, "Token 引用必须使用完整的 {group.name} 格式");
      return;
    }
    validator(value, path, issues);
  };
}

function stringMatching(pattern: RegExp, description: string, maximumLength = 256): LeafValidator {
  return (value, path, issues) => {
    if (typeof value !== "string") {
      issue(issues, "INVALID_TYPE", path, "必须是字符串");
    } else if (value.length > maximumLength || !pattern.test(value)) {
      issue(issues, "UNSAFE_VALUE", path, description);
    }
  };
}

function numberInRange(minimum: number, maximum: number, integer = false): LeafValidator {
  return (value, path, issues) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issue(issues, "INVALID_TYPE", path, "必须是有限数字");
    } else if (value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      issue(issues, "OUT_OF_RANGE", path, `必须位于 ${minimum} 至 ${maximum} 之间`);
    }
  };
}

function oneOf<const Values extends readonly (boolean | number | string)[]>(
  values: Values,
): LeafValidator {
  return (value, path, issues) => {
    if (!values.includes(value as Values[number])) {
      issue(issues, "INVALID_TYPE", path, `必须是 ${values.join("、")} 之一`);
    }
  };
}

const color = referenceOr(stringMatching(COLOR_PATTERN, "颜色必须是 #RRGGBB 或 #RRGGBBAA"));
const border = referenceOr(
  stringMatching(BORDER_PATTERN, "边框只允许 none 或 1px 至 8px 的受控线型"),
);
const shadow = referenceOr((value, path, issues) => {
  if (typeof value !== "string" || !SHADOW_PATTERN.test(value)) {
    issue(issues, "UNSAFE_VALUE", path, "阴影必须是 none 或受控 rgba 阴影");
    return;
  }
  const rgba = RGBA_PATTERN.exec(value);
  if (rgba !== null && rgba.slice(1, 4).some((channel) => Number(channel) > 255)) {
    issue(issues, "OUT_OF_RANGE", path, "阴影 RGB 通道必须位于 0 至 255 之间");
  }
});
const fontFamily = referenceOr(stringMatching(FONT_PATTERN, "字体栈包含不安全字符或长度超限"));
const size = referenceOr(numberInRange(8, 64));
const spacing = referenceOr(numberInRange(0, 160));
const radius = referenceOr(numberInRange(0, 999));
const weight = referenceOr(oneOf([300, 400, 500, 600, 700] as const));
const lineHeight = referenceOr(numberInRange(1, 3));
const letterSpacing = referenceOr(numberInRange(-2, 10));

const groupValidators = {
  colors: {
    accent: color,
    background: color,
    border: color,
    borderStrong: color,
    danger: color,
    primary: color,
    primaryDark: color,
    primaryLight: color,
    secondary: color,
    success: color,
    surface: color,
    surfaceStrong: color,
    textMuted: color,
    textPrimary: color,
    textSecondary: color,
    warning: color,
  },
  typography: {
    bodyLetterSpacing: letterSpacing,
    bodyLineHeight: lineHeight,
    bodySize: size,
    bodyWeight: weight,
    captionLineHeight: lineHeight,
    captionSize: size,
    dataSize: size,
    fontFamilyWechat: fontFamily,
    heading1LineHeight: lineHeight,
    heading1Size: size,
    heading1Weight: weight,
    heading2LineHeight: lineHeight,
    heading2Size: size,
    heading2Weight: weight,
    heading3LineHeight: lineHeight,
    heading3Size: size,
    heading3Weight: weight,
    quoteSize: size,
  },
  spacing: {
    contentPadding: spacing,
    headingBottom: spacing,
    headingTop: spacing,
    lg: spacing,
    md: spacing,
    paragraphGap: spacing,
    section: spacing,
    sm: spacing,
    xl: spacing,
    xs: spacing,
    xxl: spacing,
  },
  radius: {
    lg: radius,
    md: radius,
    none: radius,
    pill: radius,
    sm: radius,
    xl: radius,
  },
  border: {
    leftAccent: border,
    medium: border,
    strong: border,
    thin: border,
  },
  shadow: {
    medium: shadow,
    none: shadow,
    soft: shadow,
  },
  image: {
    border,
    captionAlign: referenceOr(oneOf(["center", "left", "right"] as const)),
    captionColor: color,
    captionSize: size,
    defaultMarginBottom: spacing,
    defaultMarginTop: spacing,
    defaultRadius: radius,
    shadow,
  },
  motion: {
    durationFast: referenceOr(numberInRange(0, 5000)),
    durationNormal: referenceOr(numberInRange(0, 5000)),
    durationSlow: referenceOr(numberInRange(0, 5000)),
    easingEmphasized: referenceOr((value, path, issues) => {
      if (
        typeof value !== "string" ||
        (!["ease", "ease-in", "ease-in-out", "ease-out", "linear"].includes(value) &&
          !CUBIC_BEZIER_PATTERN.test(value))
      ) {
        issue(issues, "UNSAFE_VALUE", path, "动效曲线不在受控白名单中");
      }
    }),
    easingStandard: referenceOr((value, path, issues) => {
      if (
        typeof value !== "string" ||
        (!["ease", "ease-in", "ease-in-out", "ease-out", "linear"].includes(value) &&
          !CUBIC_BEZIER_PATTERN.test(value))
      ) {
        issue(issues, "UNSAFE_VALUE", path, "动效曲线不在受控白名单中");
      }
    }),
  },
  compatibility: {
    allowComplexBackground: referenceOr(oneOf([false, true] as const)),
    allowCustomFont: referenceOr(oneOf([false, true] as const)),
    allowRiskyLayout: referenceOr(oneOf([false, true] as const)),
    allowShadow: referenceOr(oneOf([false, true] as const)),
    maxNestingDepth: referenceOr(numberInRange(1, 8, true)),
  },
} as const satisfies Record<
  Exclude<keyof ThemeTokenTree, "components">,
  Readonly<Record<string, LeafValidator>>
>;

const componentValidators = {
  background: color,
  backgroundColor: color,
  backgroundImage: referenceOr((value, path, issues) => {
    if (value !== "none" && (typeof value !== "string" || !GRADIENT_PATTERN.test(value))) {
      issue(issues, "UNSAFE_VALUE", path, "背景只允许 none 或两色线性渐变，禁止 URL");
      return;
    }
    if (typeof value === "string" && value !== "none") {
      const angle = /linear-gradient\((\d{1,3})deg/.exec(value)?.[1];
      const stops = [...value.matchAll(/(\d{1,3})%/g)].map((match) => Number(match[1]));
      if ((angle !== undefined && Number(angle) > 360) || stops.some((stop) => stop > 100)) {
        issue(issues, "OUT_OF_RANGE", path, "渐变角度必须不超过 360，色标必须不超过 100%");
      }
    }
  }),
  borderColor: color,
  borderRadius: radius,
  borderStyle: referenceOr(oneOf(["dashed", "dotted", "none", "solid"] as const)),
  borderWidth: referenceOr(numberInRange(0, 8)),
  boxShadow: shadow,
  color,
  columns: referenceOr(oneOf([1, 2, 3, 4] as const)),
  compatibilityLevel: oneOf(["compatible", "conditional", "risky", "safe"] as const),
  fontFamily,
  fontSize: size,
  fontWeight: weight,
  letterSpacing,
  lineHeight,
  marginBottom: spacing,
  marginTop: spacing,
  paddingBottom: spacing,
  paddingLeft: spacing,
  paddingRight: spacing,
  paddingTop: spacing,
  position: referenceOr(oneOf(["absolute", "relative", "static"] as const)),
  textAlign: referenceOr(oneOf(["center", "justify", "left", "right"] as const)),
  variant: stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/, "组件变体名称不合法", 64),
} as const satisfies Readonly<Record<keyof ComponentTokenDefinition, LeafValidator>>;

function validateComponents(value: unknown, path: string, issues: MutableIssues): void {
  if (!validateRecord(value, path, issues)) {
    return;
  }
  if (Object.keys(value).length > 5000) {
    issue(issues, "OUT_OF_RANGE", path, "单个 Token 文档最多包含 5000 个组件规则");
  }
  for (const [componentRef, definition] of Object.entries(value).sort(compareEntries)) {
    const componentPath = `${path}/${componentRef}`;
    if (!COMPONENT_REF_PATTERN.test(componentRef) || componentRef.length > 128) {
      issue(issues, "UNSAFE_VALUE", componentPath, "组件引用名称不合法");
      continue;
    }
    validateKnownObject(definition, componentPath, componentValidators, issues);
  }
}

function validateThemeOverrideInto(
  value: unknown,
  path: string,
  issues: MutableIssues,
  allowSchemaVersion: boolean,
): void {
  if (!validateRecord(value, path, issues)) {
    return;
  }

  const allowed = new Set([
    ...Object.keys(groupValidators),
    "components",
    ...(allowSchemaVersion ? ["schemaVersion"] : []),
  ]);
  for (const key of Object.keys(value).sort()) {
    if (!allowed.has(key)) {
      issue(issues, "UNKNOWN_TOKEN", `${path}/${key}`, `不支持 Token 分组 “${key}”`);
    }
  }

  for (const [group, validators] of Object.entries(groupValidators)) {
    const entry = value[group];
    if (entry !== undefined) {
      validateKnownObject(entry, `${path}/${group}`, validators, issues);
    }
  }
  if (value.components !== undefined) {
    validateComponents(value.components, `${path}/components`, issues);
  }
}

function result<T>(value: unknown, issues: MutableIssues): TokenValidationResult<T> {
  return issues.length === 0 ? { success: true, data: value as T } : { success: false, issues };
}

export function validateThemeTokenOverride(
  value: unknown,
  path = "/tokens",
): TokenValidationResult<ThemeTokenOverride> {
  const issues: MutableIssues = [];
  validateThemeOverrideInto(value, path, issues, false);
  return result(value, issues);
}

export function validateThemeTokenDocument(
  value: unknown,
  path = "/theme",
): TokenValidationResult<ThemeTokenDocument> {
  const issues: MutableIssues = [];
  validateThemeOverrideInto(value, path, issues, true);
  if (isRecord(value) && value.schemaVersion !== TOKEN_SCHEMA_VERSION) {
    issue(
      issues,
      "UNSUPPORTED_SCHEMA_VERSION",
      `${path}/schemaVersion`,
      `当前仅支持 Token Schema ${TOKEN_SCHEMA_VERSION}`,
    );
  }
  return result(value, issues);
}

export function validateComponentStyleTokens(
  value: unknown,
  path = "/style",
): TokenValidationResult<ComponentStyleTokens> {
  const issues: MutableIssues = [];
  const styleValidators = Object.fromEntries(
    Object.entries(componentValidators).filter(
      ([key]) => key !== "background" && key !== "compatibilityLevel" && key !== "variant",
    ),
  );
  validateKnownObject(value, path, styleValidators, issues);
  return result(value, issues);
}

export function validateComponentTokenDefinition(
  value: unknown,
  path = "/component",
): TokenValidationResult<ComponentTokenDefinition> {
  const issues: MutableIssues = [];
  validateKnownObject(value, path, componentValidators, issues);
  return result(value, issues);
}

export function validateBrandTokenPlaceholder(
  value: unknown,
  path = "/brand",
): TokenValidationResult<BrandTokenPlaceholder> {
  const issues: MutableIssues = [];
  if (!validateRecord(value, path, issues)) {
    return result(value, issues);
  }

  const knownKeys = new Set([
    "accountId",
    "assets",
    "colors",
    "defaults",
    "schemaVersion",
    "version",
  ]);
  for (const key of Object.keys(value).sort()) {
    if (!knownKeys.has(key)) {
      issue(issues, "UNKNOWN_TOKEN", `${path}/${key}`, `不支持品牌 Token 字段 “${key}”`);
    }
  }
  if (value.schemaVersion !== TOKEN_SCHEMA_VERSION) {
    issue(
      issues,
      "UNSUPPORTED_SCHEMA_VERSION",
      `${path}/schemaVersion`,
      `当前仅支持 Token Schema ${TOKEN_SCHEMA_VERSION}`,
    );
  }
  if (typeof value.version !== "string" || !VERSION_PATTERN.test(value.version)) {
    issue(issues, "INVALID_TYPE", `${path}/version`, "品牌版本必须是语义化版本");
  }
  if (
    value.accountId !== undefined &&
    (typeof value.accountId !== "string" || !IDENTIFIER_PATTERN.test(value.accountId))
  ) {
    issue(issues, "UNSAFE_VALUE", `${path}/accountId`, "公众号标识不合法");
  }
  if (value.colors !== undefined) {
    validateKnownObject(
      value.colors,
      `${path}/colors`,
      {
        accent: color,
        primary: color,
        secondary: color,
        textPrimary: color,
      },
      issues,
    );
  }

  const resource = stringMatching(IDENTIFIER_PATTERN, "资源标识不合法", 128);
  if (value.assets !== undefined) {
    validateKnownObject(
      value.assets,
      `${path}/assets`,
      {
        avatarResourceId: resource,
        logoResourceId: resource,
        qrCodeResourceId: resource,
      },
      issues,
    );
  }
  if (value.defaults !== undefined) {
    validateKnownObject(
      value.defaults,
      `${path}/defaults`,
      {
        footerComponentId: resource,
        imageStyleRef: stringMatching(COMPONENT_REF_PATTERN, "图片样式引用不合法", 128),
        themeId: resource,
      },
      issues,
    );
  }

  return result(value, issues);
}

export function validateResolveTokenInput(
  value: unknown,
): TokenValidationResult<ResolveTokenInput> {
  const issues: MutableIssues = [];
  if (!validateRecord(value, "/", issues)) {
    return result(value, issues);
  }
  const allowed = new Set(["article", "brand", "component", "inline", "mode", "node", "theme"]);
  for (const key of Object.keys(value).sort()) {
    if (!allowed.has(key)) {
      issue(issues, "UNKNOWN_TOKEN", `/${key}`, `不支持解析参数 “${key}”`);
    }
  }
  if (value.mode !== undefined && value.mode !== "standard" && value.mode !== "wechat_safe") {
    issue(issues, "INVALID_TYPE", "/mode", "模式必须是 standard 或 wechat_safe");
  }
  if (value.theme !== undefined) {
    const validation = validateThemeTokenDocument(value.theme);
    if (!validation.success) {
      issues.push(...validation.issues);
    }
  }
  if (value.brand !== undefined) {
    const validation = validateBrandTokenPlaceholder(value.brand);
    if (!validation.success) {
      issues.push(...validation.issues);
    }
  }
  if (value.component !== undefined) {
    if (validateRecord(value.component, "/component", issues)) {
      for (const key of Object.keys(value.component).sort()) {
        if (key !== "ref" && key !== "tokens") {
          issue(issues, "UNKNOWN_TOKEN", `/component/${key}`, `不支持组件层字段 “${key}”`);
        }
      }
      if (
        value.component.ref !== undefined &&
        (typeof value.component.ref !== "string" ||
          !COMPONENT_REF_PATTERN.test(value.component.ref))
      ) {
        issue(issues, "UNSAFE_VALUE", "/component/ref", "组件引用名称不合法");
      }
      if (value.component.tokens !== undefined) {
        const validation = validateComponentTokenDefinition(
          value.component.tokens,
          "/component/tokens",
        );
        if (!validation.success) {
          issues.push(...validation.issues);
        }
      }
    }
  }
  if (value.article !== undefined) {
    if (validateRecord(value.article, "/article", issues)) {
      for (const key of Object.keys(value.article).sort()) {
        if (key !== "style" && key !== "tokens") {
          issue(issues, "UNKNOWN_TOKEN", `/article/${key}`, `不支持文章层字段 “${key}”`);
        }
      }
      if (value.article.tokens !== undefined) {
        const validation = validateThemeTokenOverride(value.article.tokens, "/article/tokens");
        if (!validation.success) {
          issues.push(...validation.issues);
        }
      }
      if (value.article.style !== undefined) {
        const validation = validateComponentStyleTokens(value.article.style, "/article/style");
        if (!validation.success) {
          issues.push(...validation.issues);
        }
      }
    }
  }
  for (const layer of ["inline", "node"] as const) {
    if (value[layer] !== undefined) {
      const validation = validateComponentStyleTokens(value[layer], `/${layer}`);
      if (!validation.success) {
        issues.push(...validation.issues);
      }
    }
  }

  return result(value, issues);
}

export function validateResolvedThemeTokenTree(
  value: unknown,
  path = "/resolved",
): TokenValidationResult<ThemeTokenTree> {
  const issues: MutableIssues = [];
  if (!validateRecord(value, path, issues)) {
    return result(value, issues);
  }
  for (const [group, validators] of Object.entries(groupValidators)) {
    if (value[group] === undefined) {
      issue(issues, "INVALID_TYPE", `${path}/${group}`, "缺少必需 Token 分组");
      continue;
    }
    validateKnownObject(value[group], `${path}/${group}`, validators, issues);
    if (isRecord(value[group])) {
      for (const tokenName of Object.keys(validators)) {
        if (value[group][tokenName] === undefined) {
          issue(issues, "INVALID_TYPE", `${path}/${group}/${tokenName}`, "缺少必需 Token");
        }
      }
    }
  }
  if (value.components === undefined) {
    issue(issues, "INVALID_TYPE", `${path}/components`, "缺少组件 Token 分组");
  } else {
    validateComponents(value.components, `${path}/components`, issues);
  }
  for (const key of Object.keys(value).sort()) {
    if (!(key in groupValidators) && key !== "components") {
      issue(issues, "UNKNOWN_TOKEN", `${path}/${key}`, `不支持 Token 分组 “${key}”`);
    }
  }
  return result(value, issues);
}
