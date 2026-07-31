import {
  validateComponentTokenDefinition,
  type ComponentTokenDefinition,
} from "@wechat-layout/design-tokens";

export const COMPONENT_MANIFEST_SCHEMA_VERSION = "1.0.0" as const;

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

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];
export type ComponentCompatibilityLevel = (typeof COMPONENT_COMPATIBILITY_LEVELS)[number];
export type ComponentSlotKind = (typeof COMPONENT_SLOT_KINDS)[number];
export type ComponentSlotBinding = (typeof COMPONENT_SLOT_BINDINGS)[number];
export type ComponentSlotExportMethod = (typeof COMPONENT_SLOT_EXPORT_METHODS)[number];

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

export interface ComponentManifest {
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
  readonly nodeType: "semanticCard";
  readonly previewAssetId?: string;
  readonly scenarios?: readonly string[];
  readonly schemaVersion: typeof COMPONENT_MANIFEST_SCHEMA_VERSION;
  readonly semanticRoles: readonly string[];
  readonly slots: readonly ComponentSlotSchema[];
  readonly supportedThemeIds?: readonly string[];
  readonly variants: readonly ComponentVariantManifest[];
  readonly version: string;
  readonly wechatRendererKey: string;
}

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

function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: MutableIssues,
): value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
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
  if (value.schemaVersion !== COMPONENT_MANIFEST_SCHEMA_VERSION) {
    issue(
      issues,
      "UNSUPPORTED_SCHEMA_VERSION",
      "/manifest/schemaVersion",
      `当前仅支持 Manifest Schema ${COMPONENT_MANIFEST_SCHEMA_VERSION}`,
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
  if (value.nodeType !== "semanticCard") {
    issue(issues, "INVALID_TYPE", "/manifest/nodeType", "当前注册中心仅支持 semanticCard 节点");
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
  if (value.previewAssetId !== undefined) {
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
