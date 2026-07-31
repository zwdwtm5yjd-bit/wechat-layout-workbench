import {
  validateComponentTokenDefinition,
  type ComponentTokenDefinition,
} from "@wechat-layout/design-tokens";

export const LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION = "1.0.0" as const;
export const COMPONENT_MANIFEST_SCHEMA_VERSION = "1.1.0" as const;
export const COMPONENT_MANIFEST_SCHEMA_VERSIONS = [
  LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION,
  COMPONENT_MANIFEST_SCHEMA_VERSION,
] as const;

export const COMPONENT_CATEGORIES = [
  "BODY",
  "CARD",
  "DATA",
  "DIVIDER",
  "FOOTER",
  "GALLERY",
  "GOV",
  "HEAD",
  "HERO",
  "IMAGE",
  "INTRO",
  "LEGAL",
  "LIST",
  "NOTICE",
  "PERSON",
  "QR",
  "QUOTE",
  "STEP",
  "SVG",
  "TECH",
  "TIME",
] as const;

export const COMPONENT_COMPATIBILITY_LEVELS = [
  "safe",
  "compatible",
  "conditional",
  "risky",
] as const;

export const COMPONENT_SLOT_KINDS = ["image", "number", "rich_text", "text"] as const;
export const COMPONENT_SLOT_BINDINGS = ["content", "eyebrow", "footer", "title"] as const;
export const COMPONENT_SLOT_EXPORT_METHODS = ["image", "omit", "plain_text", "rich_text"] as const;
export const COMPONENT_NODE_TYPES = [
  "heading",
  "blockquote",
  "semanticCard",
  "imageBlock",
  "divider",
  "brandFooter",
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];
export type ComponentCompatibilityLevel = (typeof COMPONENT_COMPATIBILITY_LEVELS)[number];
export type ComponentSlotKind = (typeof COMPONENT_SLOT_KINDS)[number];
export type ComponentSlotBinding = (typeof COMPONENT_SLOT_BINDINGS)[number];
export type ComponentSlotExportMethod = (typeof COMPONENT_SLOT_EXPORT_METHODS)[number];
export type ComponentNodeType = (typeof COMPONENT_NODE_TYPES)[number];

export interface ComponentSlotSchema {
  readonly allowImages: boolean;
  readonly allowRichText: boolean;
  readonly editorBinding: ComponentSlotBinding;
  readonly kind: ComponentSlotKind;
  readonly label: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly recommendedMaxLength?: number;
  readonly required: boolean;
  readonly slotId: string;
  readonly textLocked: boolean;
  readonly wechatExport: ComponentSlotExportMethod;
}

export interface ComponentVariantManifest {
  readonly name: string;
  readonly tokenMap?: ComponentTokenDefinition;
  readonly variantId: string;
}

export interface ComponentFallbackManifest {
  readonly kind: "plain_text" | "semantic_card";
  readonly preserveOriginalText: true;
  readonly rendererKey: string;
}

export type ComponentSlotTarget =
  | {
      readonly kind: "root_text";
    }
  | {
      readonly attribute: "alt" | "caption" | "eyebrow" | "footer" | "source" | "title";
      readonly kind: "root_attribute";
    }
  | {
      readonly kind: "root_image";
    }
  | {
      readonly index: number;
      readonly kind: "child_text";
      readonly nodeType: "paragraph";
    }
  | {
      readonly index: number;
      readonly kind: "child_image";
    };

export interface ComponentSlotBindingPreset {
  readonly slotId: string;
  readonly target: ComponentSlotTarget;
}

export interface HeadingInsertionPreset {
  readonly attributes: {
    readonly level: 1 | 2 | 3;
    readonly numbering?: string;
  };
  readonly nodeType: "heading";
  readonly slotBindings: readonly ComponentSlotBindingPreset[];
}

export interface BlockquoteInsertionPreset {
  readonly attributes: {
    readonly quoteType?: "citation" | "standard" | "warning";
    readonly showQuotes?: boolean;
    readonly showSource?: boolean;
    readonly variant?: string;
  };
  readonly nodeType: "blockquote";
  readonly slotBindings: readonly ComponentSlotBindingPreset[];
}

export interface SemanticCardInsertionPreset {
  readonly attributes: {
    readonly eyebrow?: string;
    readonly footer?: string;
    readonly title?: string;
    readonly variant?: string;
  };
  readonly nodeType: "semanticCard";
  readonly slotBindings: readonly ComponentSlotBindingPreset[];
}

export interface ImageBlockInsertionPreset {
  readonly attributes: {
    readonly alt?: string;
    readonly aspectRatio?: string;
    readonly caption?: string;
    readonly objectFit?: "contain" | "cover" | "fill";
    readonly widthMode?: "full" | "original" | "percent";
    readonly widthPercent?: number;
  };
  readonly nodeType: "imageBlock";
  readonly slotBindings: readonly ComponentSlotBindingPreset[];
}

export interface DividerInsertionPreset {
  readonly attributes: {
    readonly align?: "center" | "left" | "right";
    readonly icon?: string;
    readonly spacingAfter?: number;
    readonly spacingBefore?: number;
    readonly variant?: "dashed" | "dotted" | "ornament" | "solid";
    readonly widthPercent?: number;
  };
  readonly nodeType: "divider";
  readonly slotBindings: readonly [];
}

export interface BrandFooterInsertionPreset {
  readonly attributes: {
    readonly accountId: string;
    readonly autoUpdate: boolean;
    readonly frozenVersion?: string;
    readonly mode: "frozen" | "linked";
    readonly templateId: string;
  };
  readonly nodeType: "brandFooter";
  readonly slotBindings: readonly ComponentSlotBindingPreset[];
}

export type ComponentInsertionPreset =
  | BlockquoteInsertionPreset
  | BrandFooterInsertionPreset
  | DividerInsertionPreset
  | HeadingInsertionPreset
  | ImageBlockInsertionPreset
  | SemanticCardInsertionPreset;

interface ComponentManifestBase {
  readonly adjustableProperties: readonly string[];
  readonly category: ComponentCategory;
  readonly compatibilityLevel: ComponentCompatibilityLevel;
  readonly componentId: string;
  readonly defaultTokenMap: ComponentTokenDefinition;
  readonly defaultVariantId: string;
  readonly description?: string;
  readonly documentation?: string;
  readonly editorRendererKey: string;
  readonly fallback: ComponentFallbackManifest;
  readonly name: string;
  readonly scenarios?: readonly string[];
  readonly semanticRoles: readonly string[];
  readonly slots: readonly ComponentSlotSchema[];
  readonly supportedThemeIds?: readonly string[];
  readonly variants: readonly ComponentVariantManifest[];
  readonly version: string;
  readonly wechatRendererKey: string;
}

export interface LegacyComponentManifest extends ComponentManifestBase {
  readonly nodeType: "semanticCard";
  readonly previewAssetId?: string;
  readonly schemaVersion: typeof LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION;
}

export interface ComponentManifestV1_1 extends ComponentManifestBase {
  readonly insertionPreset: ComponentInsertionPreset;
  readonly nodeType: ComponentNodeType;
  readonly previewAssetId: string;
  readonly schemaVersion: typeof COMPONENT_MANIFEST_SCHEMA_VERSION;
}

export type ComponentManifest = ComponentManifestV1_1 | LegacyComponentManifest;

export type ComponentManifestIssueCode =
  | "DUPLICATE_VALUE"
  | "INVALID_RELATION"
  | "INVALID_TYPE"
  | "OUT_OF_RANGE"
  | "UNKNOWN_FIELD"
  | "UNSAFE_VALUE"
  | "UNSUPPORTED_SCHEMA_VERSION";

export interface ComponentManifestIssue {
  readonly code: ComponentManifestIssueCode;
  readonly message: string;
  readonly path: string;
}

export type ComponentManifestValidationResult =
  | {
      readonly data: ComponentManifest;
      readonly success: true;
    }
  | {
      readonly issues: readonly ComponentManifestIssue[];
      readonly success: false;
    };

export class ComponentManifestValidationError extends Error {
  readonly issues: readonly ComponentManifestIssue[];

  constructor(issues: readonly ComponentManifestIssue[]) {
    super(`组件 Manifest 校验失败（${String(issues.length)} 项）`);
    this.name = "ComponentManifestValidationError";
    this.issues = issues;
  }
}

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const COMPONENT_ID_PATTERN =
  /^(?:cmp_[a-z0-9]+(?:_[a-z0-9]+){2,}_[0-9]{3}|component_[a-z0-9]+(?:_[a-z0-9]+)+)$/;
const SEMANTIC_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const RENDERER_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const ADJUSTABLE_PROPERTIES = new Set([
  "background",
  "backgroundColor",
  "backgroundImage",
  "borderColor",
  "borderRadius",
  "borderStyle",
  "borderWidth",
  "boxShadow",
  "color",
  "columns",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "marginBottom",
  "marginTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "position",
  "textAlign",
  "variant",
]);

type MutableIssues = ComponentManifestIssue[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  issues: MutableIssues,
  code: ComponentManifestIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, message, path });
}

function validateKnownFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  path: string,
  issues: MutableIssues,
): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(value).sort()) {
    if (!allowed.has(key)) {
      issue(issues, "UNKNOWN_FIELD", `${path}/${key}`, `不支持字段 “${key}”`);
    }
  }
}

function validateString(
  value: unknown,
  path: string,
  issues: MutableIssues,
  options: {
    readonly maximum?: number;
    readonly pattern?: RegExp;
    readonly required?: boolean;
  } = {},
): value is string {
  const minimum = options.required === false ? 0 : 1;
  const maximum = options.maximum ?? 500;
  if (typeof value !== "string") {
    issue(issues, "INVALID_TYPE", path, "必须是字符串");
    return false;
  }
  if (value.length < minimum || value.length > maximum) {
    issue(issues, "OUT_OF_RANGE", path, `长度必须在 ${String(minimum)}—${String(maximum)} 之间`);
    return false;
  }
  if (options.pattern !== undefined && !options.pattern.test(value)) {
    issue(issues, "UNSAFE_VALUE", path, "字符串格式不合法");
    return false;
  }
  return true;
}

function validateBoolean(value: unknown, path: string, issues: MutableIssues): value is boolean {
  if (typeof value !== "boolean") {
    issue(issues, "INVALID_TYPE", path, "必须是布尔值");
    return false;
  }
  return true;
}

function validateNumber(
  value: unknown,
  path: string,
  issues: MutableIssues,
  options: {
    readonly integer?: boolean;
    readonly maximum: number;
    readonly minimum: number;
  },
): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (options.integer === true && !Number.isInteger(value))
  ) {
    issue(issues, "INVALID_TYPE", path, options.integer === true ? "必须是整数" : "必须是有限数字");
    return false;
  }
  if (value < options.minimum || value > options.maximum) {
    issue(
      issues,
      "OUT_OF_RANGE",
      path,
      `必须在 ${String(options.minimum)}—${String(options.maximum)} 之间`,
    );
    return false;
  }
  return true;
}

function validateEnum<T extends number | string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: MutableIssues,
): value is T {
  if ((typeof value !== "string" && typeof value !== "number") || !allowed.includes(value as T)) {
    issue(issues, "INVALID_TYPE", path, `必须是：${allowed.join("、")}`);
    return false;
  }
  return true;
}

function validateStringArray(
  value: unknown,
  path: string,
  issues: MutableIssues,
  options: {
    readonly maximumItems?: number;
    readonly pattern?: RegExp;
    readonly required?: boolean;
  } = {},
): value is string[] {
  if (!Array.isArray(value)) {
    issue(issues, "INVALID_TYPE", path, "必须是字符串数组");
    return false;
  }
  const minimum = options.required === false ? 0 : 1;
  const maximum = options.maximumItems ?? 100;
  if (value.length < minimum || value.length > maximum) {
    issue(
      issues,
      "OUT_OF_RANGE",
      path,
      `元素数量必须在 ${String(minimum)}—${String(maximum)} 之间`,
    );
  }
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}/${String(index)}`;
    if (
      validateString(entry, entryPath, issues, {
        maximum: 128,
        ...(options.pattern === undefined ? {} : { pattern: options.pattern }),
      })
    ) {
      if (seen.has(entry)) {
        issue(issues, "DUPLICATE_VALUE", entryPath, `不能重复使用 “${entry}”`);
      }
      seen.add(entry);
    }
  });
  return true;
}

function validateOptionalLength(
  value: unknown,
  path: string,
  issues: MutableIssues,
): value is number | undefined {
  if (value === undefined) {
    return true;
  }
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 100_000) {
    issue(issues, "OUT_OF_RANGE", path, "必须是 0—100000 的整数");
    return false;
  }
  return true;
}

function validateSlot(value: unknown, path: string, issues: MutableIssues): void {
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", path, "Slot 必须是对象");
    return;
  }
  validateKnownFields(
    value,
    [
      "allowImages",
      "allowRichText",
      "editorBinding",
      "kind",
      "label",
      "maxLength",
      "minLength",
      "recommendedMaxLength",
      "required",
      "slotId",
      "textLocked",
      "wechatExport",
    ],
    path,
    issues,
  );
  validateString(value.slotId, `${path}/slotId`, issues, {
    maximum: 128,
    pattern: SEMANTIC_PATTERN,
  });
  validateString(value.label, `${path}/label`, issues, { maximum: 100 });
  const kindValid = validateEnum(value.kind, COMPONENT_SLOT_KINDS, `${path}/kind`, issues);
  const bindingValid = validateEnum(
    value.editorBinding,
    COMPONENT_SLOT_BINDINGS,
    `${path}/editorBinding`,
    issues,
  );
  const exportValid = validateEnum(
    value.wechatExport,
    COMPONENT_SLOT_EXPORT_METHODS,
    `${path}/wechatExport`,
    issues,
  );
  validateBoolean(value.required, `${path}/required`, issues);
  const richTextValid = validateBoolean(value.allowRichText, `${path}/allowRichText`, issues);
  const imagesValid = validateBoolean(value.allowImages, `${path}/allowImages`, issues);
  validateBoolean(value.textLocked, `${path}/textLocked`, issues);
  const minValid = validateOptionalLength(value.minLength, `${path}/minLength`, issues);
  const maxValid = validateOptionalLength(value.maxLength, `${path}/maxLength`, issues);
  const recommendedValid = validateOptionalLength(
    value.recommendedMaxLength,
    `${path}/recommendedMaxLength`,
    issues,
  );

  if (
    minValid &&
    maxValid &&
    typeof value.minLength === "number" &&
    typeof value.maxLength === "number" &&
    value.minLength > value.maxLength
  ) {
    issue(issues, "INVALID_RELATION", `${path}/minLength`, "不能大于 maxLength");
  }
  if (
    recommendedValid &&
    maxValid &&
    typeof value.recommendedMaxLength === "number" &&
    typeof value.maxLength === "number" &&
    value.recommendedMaxLength > value.maxLength
  ) {
    issue(issues, "INVALID_RELATION", `${path}/recommendedMaxLength`, "不能大于 maxLength");
  }
  if (kindValid && richTextValid && value.allowRichText !== (value.kind === "rich_text")) {
    issue(issues, "INVALID_RELATION", `${path}/allowRichText`, "仅 rich_text Slot 可以开启富文本");
  }
  if (kindValid && imagesValid && value.allowImages !== (value.kind === "image")) {
    issue(issues, "INVALID_RELATION", `${path}/allowImages`, "仅 image Slot 可以开启图片");
  }
  if (
    kindValid &&
    bindingValid &&
    value.editorBinding !== "content" &&
    (value.kind === "image" || value.kind === "rich_text")
  ) {
    issue(
      issues,
      "INVALID_RELATION",
      `${path}/editorBinding`,
      "图片和富文本 Slot 必须绑定到内容区",
    );
  }
  if (kindValid && exportValid && value.wechatExport !== "omit") {
    const matchesKind =
      (value.kind === "image" && value.wechatExport === "image") ||
      (value.kind === "rich_text" &&
        (value.wechatExport === "rich_text" || value.wechatExport === "plain_text")) ||
      ((value.kind === "number" || value.kind === "text") && value.wechatExport === "plain_text");
    if (!matchesKind) {
      issue(issues, "INVALID_RELATION", `${path}/wechatExport`, "导出方式与 Slot 类型不匹配");
    }
  }
}

function validateVariant(value: unknown, path: string, issues: MutableIssues): void {
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", path, "Variant 必须是对象");
    return;
  }
  validateKnownFields(value, ["name", "tokenMap", "variantId"], path, issues);
  validateString(value.variantId, `${path}/variantId`, issues, {
    maximum: 128,
    pattern: SEMANTIC_PATTERN,
  });
  validateString(value.name, `${path}/name`, issues, { maximum: 100 });
  if (value.tokenMap !== undefined) {
    const result = validateComponentTokenDefinition(value.tokenMap, `${path}/tokenMap`);
    if (!result.success) {
      result.issues.forEach((tokenIssue) => {
        issue(issues, "UNSAFE_VALUE", tokenIssue.path, tokenIssue.message);
      });
    }
  }
}

function validateFallback(value: unknown, path: string, issues: MutableIssues): void {
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", path, "Fallback 必须是对象");
    return;
  }
  validateKnownFields(value, ["kind", "preserveOriginalText", "rendererKey"], path, issues);
  validateEnum(value.kind, ["plain_text", "semantic_card"] as const, `${path}/kind`, issues);
  if (value.preserveOriginalText !== true) {
    issue(issues, "INVALID_RELATION", `${path}/preserveOriginalText`, "安全占位必须保留原文");
  }
  validateString(value.rendererKey, `${path}/rendererKey`, issues, {
    maximum: 128,
    pattern: RENDERER_KEY_PATTERN,
  });
}

function validateOptionalPresetString(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: MutableIssues,
  maximum = 500,
): void {
  if (value[field] !== undefined) {
    validateString(value[field], `${path}/${field}`, issues, { maximum, required: false });
  }
}

function validateOptionalPresetBoolean(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: MutableIssues,
): void {
  if (value[field] !== undefined) {
    validateBoolean(value[field], `${path}/${field}`, issues);
  }
}

function validateOptionalPresetNumber(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: MutableIssues,
  minimum: number,
  maximum: number,
): void {
  if (value[field] !== undefined) {
    validateNumber(value[field], `${path}/${field}`, issues, { maximum, minimum });
  }
}

function validateInsertionAttributes(
  nodeType: ComponentNodeType,
  value: unknown,
  path: string,
  issues: MutableIssues,
): void {
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", path, "Insertion attributes 必须是对象");
    return;
  }

  switch (nodeType) {
    case "heading":
      validateKnownFields(value, ["level", "numbering"], path, issues);
      validateEnum(value.level, [1, 2, 3] as const, `${path}/level`, issues);
      validateOptionalPresetString(value, "numbering", path, issues, 32);
      return;
    case "blockquote":
      validateKnownFields(
        value,
        ["quoteType", "showQuotes", "showSource", "variant"],
        path,
        issues,
      );
      if (value.quoteType !== undefined) {
        validateEnum(
          value.quoteType,
          ["citation", "standard", "warning"] as const,
          `${path}/quoteType`,
          issues,
        );
      }
      validateOptionalPresetBoolean(value, "showQuotes", path, issues);
      validateOptionalPresetBoolean(value, "showSource", path, issues);
      if (value.variant !== undefined) {
        validateString(value.variant, `${path}/variant`, issues, {
          maximum: 128,
          pattern: SEMANTIC_PATTERN,
        });
      }
      return;
    case "semanticCard":
      validateKnownFields(value, ["eyebrow", "footer", "title", "variant"], path, issues);
      validateOptionalPresetString(value, "eyebrow", path, issues, 100);
      validateOptionalPresetString(value, "footer", path, issues, 500);
      validateOptionalPresetString(value, "title", path, issues, 500);
      if (value.variant !== undefined) {
        validateString(value.variant, `${path}/variant`, issues, {
          maximum: 128,
          pattern: SEMANTIC_PATTERN,
        });
      }
      return;
    case "imageBlock":
      validateKnownFields(
        value,
        ["alt", "aspectRatio", "caption", "objectFit", "widthMode", "widthPercent"],
        path,
        issues,
      );
      validateOptionalPresetString(value, "alt", path, issues, 500);
      validateOptionalPresetString(value, "caption", path, issues, 1_000);
      if (value.aspectRatio !== undefined) {
        validateString(value.aspectRatio, `${path}/aspectRatio`, issues, {
          maximum: 32,
          pattern: /^(?:[1-9]\d{0,3})(?::|\/)(?:[1-9]\d{0,3})$/,
        });
      }
      if (value.objectFit !== undefined) {
        validateEnum(
          value.objectFit,
          ["contain", "cover", "fill"] as const,
          `${path}/objectFit`,
          issues,
        );
      }
      if (value.widthMode !== undefined) {
        validateEnum(
          value.widthMode,
          ["full", "original", "percent"] as const,
          `${path}/widthMode`,
          issues,
        );
      }
      validateOptionalPresetNumber(value, "widthPercent", path, issues, 1, 100);
      if (value.widthMode === "percent" && value.widthPercent === undefined) {
        issue(issues, "INVALID_RELATION", `${path}/widthPercent`, "percent 宽度模式必须声明百分比");
      }
      if (value.widthMode !== "percent" && value.widthPercent !== undefined) {
        issue(
          issues,
          "INVALID_RELATION",
          `${path}/widthPercent`,
          "仅 percent 宽度模式可声明百分比",
        );
      }
      return;
    case "divider":
      validateKnownFields(
        value,
        ["align", "icon", "spacingAfter", "spacingBefore", "variant", "widthPercent"],
        path,
        issues,
      );
      if (value.align !== undefined) {
        validateEnum(value.align, ["center", "left", "right"] as const, `${path}/align`, issues);
      }
      validateOptionalPresetString(value, "icon", path, issues, 20);
      validateOptionalPresetNumber(value, "spacingAfter", path, issues, 0, 128);
      validateOptionalPresetNumber(value, "spacingBefore", path, issues, 0, 128);
      if (value.variant !== undefined) {
        validateEnum(
          value.variant,
          ["dashed", "dotted", "ornament", "solid"] as const,
          `${path}/variant`,
          issues,
        );
      }
      validateOptionalPresetNumber(value, "widthPercent", path, issues, 1, 100);
      return;
    case "brandFooter": {
      validateKnownFields(
        value,
        ["accountId", "autoUpdate", "frozenVersion", "mode", "templateId"],
        path,
        issues,
      );
      validateString(value.accountId, `${path}/accountId`, issues, {
        maximum: 128,
        pattern: IDENTIFIER_PATTERN,
      });
      validateBoolean(value.autoUpdate, `${path}/autoUpdate`, issues);
      const modeValid = validateEnum(
        value.mode,
        ["frozen", "linked"] as const,
        `${path}/mode`,
        issues,
      );
      validateString(value.templateId, `${path}/templateId`, issues, {
        maximum: 128,
        pattern: IDENTIFIER_PATTERN,
      });
      if (value.frozenVersion !== undefined) {
        validateString(value.frozenVersion, `${path}/frozenVersion`, issues, {
          maximum: 32,
          pattern: VERSION_PATTERN,
        });
      }
      if (modeValid && value.mode === "frozen" && value.frozenVersion === undefined) {
        issue(issues, "INVALID_RELATION", `${path}/frozenVersion`, "frozen 模式必须声明冻结版本");
      }
      if (modeValid && value.mode === "linked" && value.frozenVersion !== undefined) {
        issue(issues, "INVALID_RELATION", `${path}/frozenVersion`, "linked 模式不能声明冻结版本");
      }
      if (modeValid && value.mode === "frozen" && value.autoUpdate === true) {
        issue(issues, "INVALID_RELATION", `${path}/autoUpdate`, "frozen 模式不能自动更新");
      }
      return;
    }
  }
}

function validateSlotTarget(
  value: unknown,
  path: string,
  nodeType: ComponentNodeType,
  slot: Record<string, unknown> | undefined,
  issues: MutableIssues,
): string | null {
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", path, "Slot target 必须是对象");
    return null;
  }
  if (
    !validateEnum(
      value.kind,
      ["child_image", "child_text", "root_attribute", "root_image", "root_text"] as const,
      `${path}/kind`,
      issues,
    )
  ) {
    return null;
  }

  switch (value.kind) {
    case "root_text":
      validateKnownFields(value, ["kind"], path, issues);
      if (nodeType !== "heading") {
        issue(issues, "INVALID_RELATION", path, "root_text 仅可用于 heading");
      }
      if (slot?.kind === "image") {
        issue(issues, "INVALID_RELATION", path, "图片 Slot 不能绑定到文本目标");
      }
      return "root_text";
    case "root_attribute": {
      validateKnownFields(value, ["attribute", "kind"], path, issues);
      const attributeValid = validateEnum(
        value.attribute,
        ["alt", "caption", "eyebrow", "footer", "source", "title"] as const,
        `${path}/attribute`,
        issues,
      );
      const allowedAttributes: Readonly<Record<ComponentNodeType, readonly string[]>> = {
        blockquote: ["source"],
        brandFooter: [],
        divider: [],
        heading: [],
        imageBlock: ["alt", "caption"],
        semanticCard: ["eyebrow", "footer", "title"],
      };
      const attribute = value.attribute as string;
      if (attributeValid && !allowedAttributes[nodeType].includes(attribute)) {
        issue(
          issues,
          "INVALID_RELATION",
          `${path}/attribute`,
          `属性 “${attribute}” 不属于 ${nodeType} 的可绑定白名单`,
        );
      }
      if (slot?.kind === "image") {
        issue(issues, "INVALID_RELATION", path, "图片 Slot 不能绑定到文本属性");
      }
      return attributeValid ? `root_attribute:${attribute}` : null;
    }
    case "root_image":
      validateKnownFields(value, ["kind"], path, issues);
      if (nodeType !== "imageBlock") {
        issue(issues, "INVALID_RELATION", path, "root_image 仅可用于 imageBlock");
      }
      if (slot?.kind !== "image") {
        issue(issues, "INVALID_RELATION", path, "root_image 必须绑定 image Slot");
      }
      return "root_image";
    case "child_text": {
      validateKnownFields(value, ["index", "kind", "nodeType"], path, issues);
      validateNumber(value.index, `${path}/index`, issues, {
        integer: true,
        maximum: 99,
        minimum: 0,
      });
      if (value.nodeType !== "paragraph") {
        issue(issues, "INVALID_TYPE", `${path}/nodeType`, "child_text 当前仅允许 paragraph");
      }
      if (!(["blockquote", "brandFooter", "semanticCard"] as const).includes(nodeType as never)) {
        issue(issues, "INVALID_RELATION", path, `${nodeType} 不允许 child_text`);
      }
      if (slot?.kind === "image") {
        issue(issues, "INVALID_RELATION", path, "图片 Slot 不能绑定到文本子节点");
      }
      return typeof value.index === "number" ? `child:${String(value.index)}` : null;
    }
    case "child_image":
      validateKnownFields(value, ["index", "kind"], path, issues);
      validateNumber(value.index, `${path}/index`, issues, {
        integer: true,
        maximum: 99,
        minimum: 0,
      });
      if (!(["brandFooter", "semanticCard"] as const).includes(nodeType as never)) {
        issue(issues, "INVALID_RELATION", path, `${nodeType} 不允许 child_image`);
      }
      if (slot?.kind !== "image") {
        issue(issues, "INVALID_RELATION", path, "child_image 必须绑定 image Slot");
      }
      return typeof value.index === "number" ? `child:${String(value.index)}` : null;
  }
}

function validateInsertionPreset(
  value: unknown,
  manifest: Record<string, unknown>,
  issues: MutableIssues,
): void {
  const path = "/manifest/insertionPreset";
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", path, "Manifest 1.1.0 必须声明 insertionPreset");
    return;
  }
  validateKnownFields(value, ["attributes", "nodeType", "slotBindings"], path, issues);
  const nodeTypeValid = validateEnum(
    value.nodeType,
    COMPONENT_NODE_TYPES,
    `${path}/nodeType`,
    issues,
  );
  if (!nodeTypeValid) {
    return;
  }
  const presetNodeType = value.nodeType as ComponentNodeType;
  if (presetNodeType !== manifest.nodeType) {
    issue(
      issues,
      "INVALID_RELATION",
      `${path}/nodeType`,
      "Insertion preset 的 nodeType 必须与 Manifest 一致",
    );
  }
  validateInsertionAttributes(presetNodeType, value.attributes, `${path}/attributes`, issues);
  if (!Array.isArray(value.slotBindings)) {
    issue(issues, "INVALID_TYPE", `${path}/slotBindings`, "slotBindings 必须是数组");
    return;
  }
  if (value.slotBindings.length > 100) {
    issue(issues, "OUT_OF_RANGE", `${path}/slotBindings`, "slotBindings 最多 100 项");
  }

  const slots = Array.isArray(manifest.slots)
    ? new Map(
        manifest.slots.flatMap((slot) =>
          isRecord(slot) && typeof slot.slotId === "string" ? [[slot.slotId, slot] as const] : [],
        ),
      )
    : new Map<string, Record<string, unknown>>();
  const boundSlots = new Set<string>();
  const boundTargets = new Set<string>();
  value.slotBindings.forEach((binding, index) => {
    const bindingPath = `${path}/slotBindings/${String(index)}`;
    if (!isRecord(binding)) {
      issue(issues, "INVALID_TYPE", bindingPath, "Slot binding 必须是对象");
      return;
    }
    validateKnownFields(binding, ["slotId", "target"], bindingPath, issues);
    const slotIdValid = validateString(binding.slotId, `${bindingPath}/slotId`, issues, {
      maximum: 128,
      pattern: SEMANTIC_PATTERN,
    });
    const slotId = binding.slotId as string;
    const slot = slotIdValid ? slots.get(slotId) : undefined;
    if (slotIdValid && slot === undefined) {
      issue(
        issues,
        "INVALID_RELATION",
        `${bindingPath}/slotId`,
        `Slot “${slotId}” 未在 Manifest slots 中声明`,
      );
    }
    if (slotIdValid && boundSlots.has(slotId)) {
      issue(issues, "DUPLICATE_VALUE", `${bindingPath}/slotId`, `Slot “${slotId}” 只能绑定一次`);
    }
    if (slotIdValid) {
      boundSlots.add(slotId);
    }
    const targetKey = validateSlotTarget(
      binding.target,
      `${bindingPath}/target`,
      presetNodeType,
      slot,
      issues,
    );
    if (targetKey !== null && boundTargets.has(targetKey)) {
      issue(
        issues,
        "DUPLICATE_VALUE",
        `${bindingPath}/target`,
        `插入目标 “${targetKey}” 只能绑定一次`,
      );
    }
    if (targetKey !== null) {
      boundTargets.add(targetKey);
    }
  });

  slots.forEach((_slot, slotId) => {
    if (!boundSlots.has(slotId)) {
      issue(
        issues,
        "INVALID_RELATION",
        `${path}/slotBindings`,
        `Slot “${slotId}” 必须有且仅有一个插入绑定`,
      );
    }
  });
}

function validateOptionalStringArray(value: unknown, path: string, issues: MutableIssues): void {
  if (value !== undefined) {
    validateStringArray(value, path, issues, {
      maximumItems: 100,
      pattern: IDENTIFIER_PATTERN,
      required: false,
    });
  }
}

function validateCoreFields(value: Record<string, unknown>, issues: MutableIssues): void {
  if (
    typeof value.schemaVersion !== "string" ||
    !COMPONENT_MANIFEST_SCHEMA_VERSIONS.includes(
      value.schemaVersion as (typeof COMPONENT_MANIFEST_SCHEMA_VERSIONS)[number],
    )
  ) {
    issue(
      issues,
      "UNSUPPORTED_SCHEMA_VERSION",
      "/manifest/schemaVersion",
      `当前支持 Manifest Schema ${COMPONENT_MANIFEST_SCHEMA_VERSIONS.join("、")}`,
    );
  }
  validateString(value.componentId, "/manifest/componentId", issues, {
    maximum: 128,
    pattern: COMPONENT_ID_PATTERN,
  });
  validateString(value.version, "/manifest/version", issues, {
    maximum: 32,
    pattern: VERSION_PATTERN,
  });
  validateString(value.name, "/manifest/name", issues, { maximum: 100 });
  if (value.description !== undefined) {
    validateString(value.description, "/manifest/description", issues, {
      maximum: 1_000,
      required: false,
    });
  }
  validateEnum(value.category, COMPONENT_CATEGORIES, "/manifest/category", issues);
  if (value.schemaVersion === LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION) {
    if (value.nodeType !== "semanticCard") {
      issue(
        issues,
        "INVALID_TYPE",
        "/manifest/nodeType",
        "Legacy Manifest 1.0.0 仅支持 semanticCard 节点",
      );
    }
  } else {
    validateEnum(value.nodeType, COMPONENT_NODE_TYPES, "/manifest/nodeType", issues);
  }
  validateStringArray(value.semanticRoles, "/manifest/semanticRoles", issues, {
    pattern: SEMANTIC_PATTERN,
  });
  validateOptionalStringArray(value.scenarios, "/manifest/scenarios", issues);
  validateOptionalStringArray(value.supportedThemeIds, "/manifest/supportedThemeIds", issues);
  validateString(value.editorRendererKey, "/manifest/editorRendererKey", issues, {
    maximum: 128,
    pattern: RENDERER_KEY_PATTERN,
  });
  validateString(value.wechatRendererKey, "/manifest/wechatRendererKey", issues, {
    maximum: 128,
    pattern: RENDERER_KEY_PATTERN,
  });
  validateEnum(
    value.compatibilityLevel,
    COMPONENT_COMPATIBILITY_LEVELS,
    "/manifest/compatibilityLevel",
    issues,
  );
  if (
    value.schemaVersion === COMPONENT_MANIFEST_SCHEMA_VERSION ||
    value.previewAssetId !== undefined
  ) {
    validateString(value.previewAssetId, "/manifest/previewAssetId", issues, {
      maximum: 128,
      pattern: IDENTIFIER_PATTERN,
    });
  }
  if (value.documentation !== undefined) {
    validateString(value.documentation, "/manifest/documentation", issues, {
      maximum: 2_000,
    });
  }
}

function validateSlots(value: Record<string, unknown>, issues: MutableIssues): void {
  if (!Array.isArray(value.slots)) {
    issue(issues, "INVALID_TYPE", "/manifest/slots", "必须是 Slot 数组");
    return;
  }
  if (value.slots.length > 100) {
    issue(issues, "OUT_OF_RANGE", "/manifest/slots", "单个组件最多包含 100 个 Slot");
  }
  const slotIds = new Set<string>();
  const attributeBindings = new Set<ComponentSlotBinding>();
  value.slots.forEach((slot, index) => {
    const path = `/manifest/slots/${String(index)}`;
    validateSlot(slot, path, issues);
    if (!isRecord(slot) || typeof slot.slotId !== "string") {
      return;
    }
    if (slotIds.has(slot.slotId)) {
      issue(issues, "DUPLICATE_VALUE", `${path}/slotId`, `Slot “${slot.slotId}” 重复`);
    }
    slotIds.add(slot.slotId);
    if (
      typeof slot.editorBinding === "string" &&
      slot.editorBinding !== "content" &&
      COMPONENT_SLOT_BINDINGS.includes(slot.editorBinding as ComponentSlotBinding)
    ) {
      const binding = slot.editorBinding as ComponentSlotBinding;
      if (attributeBindings.has(binding)) {
        issue(
          issues,
          "DUPLICATE_VALUE",
          `${path}/editorBinding`,
          `属性绑定 “${binding}” 只能使用一次`,
        );
      }
      attributeBindings.add(binding);
    }
  });
}

function validateVariants(value: Record<string, unknown>, issues: MutableIssues): void {
  if (!Array.isArray(value.variants)) {
    issue(issues, "INVALID_TYPE", "/manifest/variants", "必须是 Variant 数组");
    return;
  }
  if (value.variants.length === 0 || value.variants.length > 100) {
    issue(issues, "OUT_OF_RANGE", "/manifest/variants", "Variant 数量必须在 1—100 之间");
  }
  const variantIds = new Set<string>();
  value.variants.forEach((variant, index) => {
    const path = `/manifest/variants/${String(index)}`;
    validateVariant(variant, path, issues);
    if (!isRecord(variant) || typeof variant.variantId !== "string") {
      return;
    }
    if (variantIds.has(variant.variantId)) {
      issue(issues, "DUPLICATE_VALUE", `${path}/variantId`, `Variant “${variant.variantId}” 重复`);
    }
    variantIds.add(variant.variantId);
  });
  if (
    validateString(value.defaultVariantId, "/manifest/defaultVariantId", issues, {
      maximum: 128,
      pattern: SEMANTIC_PATTERN,
    }) &&
    !variantIds.has(value.defaultVariantId)
  ) {
    issue(
      issues,
      "INVALID_RELATION",
      "/manifest/defaultVariantId",
      "默认 Variant 必须存在于 variants",
    );
  }
}

function validateTokens(value: Record<string, unknown>, issues: MutableIssues): void {
  const tokenResult = validateComponentTokenDefinition(
    value.defaultTokenMap,
    "/manifest/defaultTokenMap",
  );
  if (!tokenResult.success) {
    tokenResult.issues.forEach((tokenIssue) => {
      issue(issues, "UNSAFE_VALUE", tokenIssue.path, tokenIssue.message);
    });
  }
  if (
    isRecord(value.defaultTokenMap) &&
    typeof value.defaultTokenMap.compatibilityLevel === "string" &&
    value.defaultTokenMap.compatibilityLevel !== value.compatibilityLevel
  ) {
    issue(
      issues,
      "INVALID_RELATION",
      "/manifest/defaultTokenMap/compatibilityLevel",
      "默认 Token 兼容等级必须与 Manifest 一致",
    );
  }
  if (
    validateStringArray(value.adjustableProperties, "/manifest/adjustableProperties", issues, {
      maximumItems: ADJUSTABLE_PROPERTIES.size,
      required: false,
    })
  ) {
    value.adjustableProperties.forEach((property, index) => {
      if (!ADJUSTABLE_PROPERTIES.has(property)) {
        issue(
          issues,
          "UNSAFE_VALUE",
          `/manifest/adjustableProperties/${String(index)}`,
          `“${property}” 不是受控组件 Token`,
        );
      }
    });
  }
}

export function validateComponentManifest(value: unknown): ComponentManifestValidationResult {
  const issues: MutableIssues = [];
  if (!isRecord(value)) {
    issue(issues, "INVALID_TYPE", "/manifest", "Manifest 必须是对象");
    return { success: false, issues };
  }

  validateKnownFields(
    value,
    [
      "adjustableProperties",
      "category",
      "compatibilityLevel",
      "componentId",
      "defaultTokenMap",
      "defaultVariantId",
      "description",
      "documentation",
      "editorRendererKey",
      "fallback",
      "insertionPreset",
      "name",
      "nodeType",
      "previewAssetId",
      "scenarios",
      "schemaVersion",
      "semanticRoles",
      "slots",
      "supportedThemeIds",
      "variants",
      "version",
      "wechatRendererKey",
    ],
    "/manifest",
    issues,
  );
  validateCoreFields(value, issues);
  validateSlots(value, issues);
  validateVariants(value, issues);
  validateTokens(value, issues);
  validateFallback(value.fallback, "/manifest/fallback", issues);
  if (value.schemaVersion === COMPONENT_MANIFEST_SCHEMA_VERSION) {
    validateInsertionPreset(value.insertionPreset, value, issues);
  } else if (value.insertionPreset !== undefined) {
    issue(
      issues,
      "INVALID_RELATION",
      "/manifest/insertionPreset",
      "Legacy Manifest 1.0.0 不能声明 1.1.0 insertionPreset",
    );
  }

  return issues.length === 0
    ? { success: true, data: value as unknown as ComponentManifest }
    : { success: false, issues };
}

export function assertComponentManifest(value: unknown): ComponentManifest {
  const result = validateComponentManifest(value);
  if (!result.success) {
    throw new ComponentManifestValidationError(result.issues);
  }
  return result.data;
}
