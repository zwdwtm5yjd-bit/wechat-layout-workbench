import {
  assertComponentManifest,
  type ComponentCategory,
  type ComponentCompatibilityLevel,
  type ComponentManifest,
  type ComponentSlotSchema,
} from "./manifest-schema.js";

export interface ComponentImageSlotValue {
  readonly alt?: string;
  readonly caption?: string;
  readonly resourceId: string;
}

export type ComponentSlotValue = ComponentImageSlotValue | number | string;
export type ComponentSlotValues = Readonly<Record<string, ComponentSlotValue>>;

export interface ComponentReference {
  readonly componentId: string;
  readonly version?: string;
}

export interface ExactComponentReference {
  readonly componentId: string;
  readonly version: string;
}

export interface ComponentQuery {
  readonly category?: ComponentCategory;
  readonly compatibilityLevel?: ComponentCompatibilityLevel;
  readonly includeDisabled?: boolean;
  readonly semanticRole?: string;
}

export interface FavoritePlaceholder {
  readonly available: false;
  readonly value: false;
}

export interface ComponentCatalogEntry {
  readonly enabled: boolean;
  readonly favorite: FavoritePlaceholder;
  readonly manifest: ComponentManifest;
  readonly reference: ExactComponentReference;
}

export interface ComponentRendererDescriptor {
  readonly compatibilityLevel: ComponentCompatibilityLevel;
  readonly componentId: string;
  readonly editorRendererKey: string;
  readonly manifest: ComponentManifest;
  readonly variantId: string;
  readonly version: string;
  readonly wechatRendererKey: string;
}

export interface ComponentInsertionDescriptor extends ComponentRendererDescriptor {
  readonly slots: ComponentSlotValues;
}

export interface ComponentSafePlaceholder {
  readonly componentId: string;
  readonly message: string;
  readonly originalText: string;
  readonly rendererKey: string;
  readonly requestedVersion?: string;
  readonly status: "disabled" | "missing";
}

export interface ComponentNodeViewDescriptor {
  readonly componentId: string;
  readonly label: string;
  readonly rendererKey: string;
  readonly state: "available" | "disabled" | "missing";
  readonly version?: string;
}

export type ComponentResolution =
  | {
      readonly descriptor: ComponentRendererDescriptor;
      readonly status: "available";
    }
  | {
      readonly placeholder: ComponentSafePlaceholder;
      readonly status: "disabled" | "missing";
    };

export type ComponentInsertionResult =
  | {
      readonly descriptor: ComponentInsertionDescriptor;
      readonly success: true;
    }
  | {
      readonly issues: readonly ComponentSlotIssue[];
      readonly success: false;
    };

export type ComponentSlotIssueCode =
  "INVALID_LENGTH" | "INVALID_TYPE" | "MISSING_REQUIRED_SLOT" | "UNKNOWN_SLOT" | "UNKNOWN_VARIANT";

export interface ComponentSlotIssue {
  readonly code: ComponentSlotIssueCode;
  readonly message: string;
  readonly path: string;
}

export class ComponentRegistryError extends Error {
  readonly code: "CONFLICTING_VERSION" | "INVALID_REFERENCE" | "UNAVAILABLE_COMPONENT";

  constructor(
    code: "CONFLICTING_VERSION" | "INVALID_REFERENCE" | "UNAVAILABLE_COMPONENT",
    message: string,
  ) {
    super(message);
    this.name = "ComponentRegistryError";
    this.code = code;
  }
}

interface RegisteredComponent {
  readonly enabled: boolean;
  readonly fingerprint: string;
  readonly manifest: ComponentManifest;
}

const VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const COMPONENT_ID_PATTERN =
  /^(?:cmp_[a-z0-9]+(?:_[a-z0-9]+){2,}_[0-9]{3}|component_[a-z0-9]+(?:_[a-z0-9]+)+)$/;
const FAVORITE_PLACEHOLDER = Object.freeze({
  available: false,
  value: false,
}) as FavoritePlaceholder;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function immutableManifest(manifest: ComponentManifest): ComponentManifest {
  return deepFreeze(structuredClone(manifest));
}

interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
}

function parseVersion(version: string): ParsedVersion {
  const separator = version.indexOf("-");
  const core = separator < 0 ? version : version.slice(0, separator);
  const prerelease = separator < 0 ? "" : version.slice(separator + 1);
  const [major = "0", minor = "0", patch = "0"] = core.split(".");
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease === "" ? [] : prerelease.split("."),
  };
}

function comparePrerelease(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  }
  const count = Math.max(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) {
      continue;
    }
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) {
      return leftNumber - rightNumber;
    }
    if (leftNumber !== null || rightNumber !== null) {
      return leftNumber !== null ? -1 : 1;
    }
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

export function compareComponentVersions(left: string, right: string): number {
  if (!VERSION_PATTERN.test(left) || !VERSION_PATTERN.test(right)) {
    throw new ComponentRegistryError("INVALID_REFERENCE", "组件版本必须是语义化版本");
  }
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  for (const field of ["major", "minor", "patch"] as const) {
    const difference = parsedLeft[field] - parsedRight[field];
    if (difference !== 0) {
      return difference;
    }
  }
  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

function referenceKey(componentId: string, version: string): string {
  return `${componentId}@${version}`;
}

function isSlotValuesRecord(value: unknown): value is ComponentSlotValues {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateReference(reference: ComponentReference): void {
  if (!COMPONENT_ID_PATTERN.test(reference.componentId)) {
    throw new ComponentRegistryError("INVALID_REFERENCE", "组件 ID 格式不合法");
  }
  if (reference.version !== undefined && !VERSION_PATTERN.test(reference.version)) {
    throw new ComponentRegistryError("INVALID_REFERENCE", "组件版本必须是语义化版本");
  }
}

function textFromSlotValue(value: ComponentSlotValue): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return [value.alt, value.caption]
    .filter((entry): entry is string => entry !== undefined)
    .join(" ");
}

function originalText(slots: ComponentSlotValues): string {
  return Object.keys(slots)
    .sort()
    .map((slotId) => textFromSlotValue(slots[slotId]!))
    .filter((value) => value.length > 0)
    .join("\n");
}

function slotValueIssue(
  slot: ComponentSlotSchema,
  value: ComponentSlotValue,
): ComponentSlotIssue | null {
  const path = `/slots/${slot.slotId}`;
  if (slot.kind === "image") {
    if (
      typeof value !== "object" ||
      value === null ||
      !IDENTIFIER_PATTERN.test(value.resourceId) ||
      Object.keys(value).some((key) => !["alt", "caption", "resourceId"].includes(key)) ||
      (value.alt !== undefined && (typeof value.alt !== "string" || value.alt.length > 500)) ||
      (value.caption !== undefined &&
        (typeof value.caption !== "string" || value.caption.length > 1_000))
    ) {
      return {
        code: "INVALID_TYPE",
        message: `Slot “${slot.slotId}” 必须是合法图片资源`,
        path,
      };
    }
    return null;
  }
  if (
    (slot.kind === "number" && (typeof value !== "number" || !Number.isFinite(value))) ||
    (slot.kind !== "number" && typeof value !== "string")
  ) {
    return {
      code: "INVALID_TYPE",
      message:
        slot.kind === "number"
          ? `Slot “${slot.slotId}” 必须是数字`
          : `Slot “${slot.slotId}” 必须是文本`,
      path,
    };
  }
  const length = String(value).length;
  if (
    (slot.minLength !== undefined && length < slot.minLength) ||
    (slot.maxLength !== undefined && length > slot.maxLength)
  ) {
    return {
      code: "INVALID_LENGTH",
      message: `Slot “${slot.slotId}” 长度不符合约束`,
      path,
    };
  }
  return null;
}

function validateSlotValues(
  manifest: ComponentManifest,
  slots: ComponentSlotValues,
): readonly ComponentSlotIssue[] {
  const issues: ComponentSlotIssue[] = [];
  const slotSchemas = new Map(manifest.slots.map((slot) => [slot.slotId, slot]));
  Object.entries(slots)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([slotId, value]) => {
      const schema = slotSchemas.get(slotId);
      if (schema === undefined) {
        issues.push({
          code: "UNKNOWN_SLOT",
          message: `组件不包含 Slot “${slotId}”`,
          path: `/slots/${slotId}`,
        });
        return;
      }
      const valueIssue = slotValueIssue(schema, value);
      if (valueIssue !== null) {
        issues.push(valueIssue);
      }
    });
  manifest.slots.forEach((slot) => {
    if (slot.required && slots[slot.slotId] === undefined) {
      issues.push({
        code: "MISSING_REQUIRED_SLOT",
        message: `缺少必填 Slot “${slot.slotId}”`,
        path: `/slots/${slot.slotId}`,
      });
    }
  });
  return issues;
}

function rendererDescriptor(
  manifest: ComponentManifest,
  variantId: string,
): ComponentRendererDescriptor {
  return deepFreeze({
    compatibilityLevel: manifest.compatibilityLevel,
    componentId: manifest.componentId,
    editorRendererKey: manifest.editorRendererKey,
    manifest,
    variantId,
    version: manifest.version,
    wechatRendererKey: manifest.wechatRendererKey,
  });
}

export class ComponentRegistry {
  readonly #components = new Map<string, RegisteredComponent>();

  register(
    manifestInput: unknown,
    options: { readonly enabled?: boolean } = {},
  ): ComponentManifest {
    const validated = assertComponentManifest(manifestInput);
    const manifest = immutableManifest(validated);
    const key = referenceKey(manifest.componentId, manifest.version);
    const manifestFingerprint = fingerprint(manifest);
    const existing = this.#components.get(key);
    if (existing !== undefined) {
      if (existing.fingerprint !== manifestFingerprint) {
        throw new ComponentRegistryError(
          "CONFLICTING_VERSION",
          `组件 ${key} 已存在且内容不同，已发布版本不可覆盖`,
        );
      }
      return existing.manifest;
    }
    this.#components.set(key, {
      enabled: options.enabled ?? true,
      fingerprint: manifestFingerprint,
      manifest,
    });
    return manifest;
  }

  setEnabled(reference: ExactComponentReference, enabled: boolean): boolean {
    validateReference(reference);
    const key = referenceKey(reference.componentId, reference.version);
    const existing = this.#components.get(key);
    if (existing === undefined) {
      return false;
    }
    this.#components.set(key, { ...existing, enabled });
    return true;
  }

  getExact(
    reference: ExactComponentReference,
    options: { readonly includeDisabled?: boolean } = {},
  ): ComponentManifest | null {
    validateReference(reference);
    const component = this.#components.get(referenceKey(reference.componentId, reference.version));
    if (component === undefined || (!component.enabled && options.includeDisabled !== true)) {
      return null;
    }
    return component.manifest;
  }

  getLatest(
    componentId: string,
    options: { readonly includeDisabled?: boolean } = {},
  ): ComponentManifest | null {
    validateReference({ componentId });
    return (
      [...this.#components.values()]
        .filter(
          (component) =>
            component.manifest.componentId === componentId &&
            (component.enabled || options.includeDisabled === true),
        )
        .sort((left, right) =>
          compareComponentVersions(right.manifest.version, left.manifest.version),
        )[0]?.manifest ?? null
    );
  }

  query(query: ComponentQuery = {}): readonly ComponentCatalogEntry[] {
    return deepFreeze(
      [...this.#components.values()]
        .filter((component) => query.includeDisabled === true || component.enabled)
        .filter(
          (component) =>
            query.category === undefined || component.manifest.category === query.category,
        )
        .filter(
          (component) =>
            query.compatibilityLevel === undefined ||
            component.manifest.compatibilityLevel === query.compatibilityLevel,
        )
        .filter(
          (component) =>
            query.semanticRole === undefined ||
            component.manifest.semanticRoles.includes(query.semanticRole),
        )
        .sort(
          (left, right) =>
            left.manifest.category.localeCompare(right.manifest.category) ||
            left.manifest.componentId.localeCompare(right.manifest.componentId) ||
            compareComponentVersions(right.manifest.version, left.manifest.version) ||
            left.manifest.name.localeCompare(right.manifest.name),
        )
        .map((component) => ({
          enabled: component.enabled,
          favorite: FAVORITE_PLACEHOLDER,
          manifest: component.manifest,
          reference: {
            componentId: component.manifest.componentId,
            version: component.manifest.version,
          },
        })),
    );
  }

  resolve(reference: ComponentReference, slots: ComponentSlotValues = {}): ComponentResolution {
    validateReference(reference);
    const exact =
      reference.version === undefined
        ? (this.getLatest(reference.componentId) ??
          this.getLatest(reference.componentId, { includeDisabled: true }))
        : this.getExact(
            { componentId: reference.componentId, version: reference.version },
            { includeDisabled: true },
          );
    if (exact === null) {
      return {
        status: "missing",
        placeholder: deepFreeze({
          componentId: reference.componentId,
          message: "组件未安装或指定版本不存在，已使用安全占位。",
          originalText: originalText(slots),
          rendererKey: "safePlaceholder",
          ...(reference.version === undefined ? {} : { requestedVersion: reference.version }),
          status: "missing",
        }),
      };
    }
    const registered = this.#components.get(referenceKey(exact.componentId, exact.version))!;
    if (!registered.enabled) {
      return {
        status: "disabled",
        placeholder: deepFreeze({
          componentId: reference.componentId,
          message: "组件当前已停用，已使用安全占位。",
          originalText: originalText(slots),
          rendererKey: exact.fallback.rendererKey,
          requestedVersion: exact.version,
          status: "disabled",
        }),
      };
    }
    return {
      status: "available",
      descriptor: rendererDescriptor(exact, exact.defaultVariantId),
    };
  }

  prepareInsertion(input: {
    readonly componentId: string;
    readonly slots?: ComponentSlotValues;
    readonly variantId?: string;
    readonly version?: string;
  }): ComponentInsertionResult {
    if (input.slots !== undefined && !isSlotValuesRecord(input.slots)) {
      return {
        success: false,
        issues: [
          {
            code: "INVALID_TYPE",
            message: "Slot 值必须是对象",
            path: "/slots",
          },
        ],
      };
    }
    const slots = input.slots ?? {};
    const resolution = this.resolve(input, slots);
    if (resolution.status !== "available") {
      throw new ComponentRegistryError("UNAVAILABLE_COMPONENT", resolution.placeholder.message);
    }
    const manifest = resolution.descriptor.manifest;
    const variantId = input.variantId ?? manifest.defaultVariantId;
    const issues = [...validateSlotValues(manifest, slots)];
    if (!manifest.variants.some((variant) => variant.variantId === variantId)) {
      issues.push({
        code: "UNKNOWN_VARIANT",
        message: `组件不包含 Variant “${variantId}”`,
        path: "/variantId",
      });
    }
    if (issues.length > 0) {
      return { success: false, issues };
    }
    return {
      success: true,
      descriptor: deepFreeze({
        ...rendererDescriptor(manifest, variantId),
        slots: structuredClone(slots),
      }),
    };
  }

  describeNodeView(reference: ExactComponentReference): ComponentNodeViewDescriptor {
    const resolution = this.resolve(reference);
    if (resolution.status === "available") {
      return deepFreeze({
        componentId: resolution.descriptor.componentId,
        label: resolution.descriptor.manifest.name,
        rendererKey: resolution.descriptor.editorRendererKey,
        state: "available",
        version: resolution.descriptor.version,
      });
    }
    return deepFreeze({
      componentId: reference.componentId,
      label: resolution.placeholder.message,
      rendererKey: resolution.placeholder.rendererKey,
      state: resolution.status,
      version: reference.version,
    });
  }
}
