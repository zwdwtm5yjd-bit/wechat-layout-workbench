import type { WechatOutputMode } from "./types.js";

export const WECHAT_STYLE_PROPERTIES = [
  "background",
  "background-color",
  "background-image",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-style",
  "border-top",
  "border-width",
  "box-shadow",
  "box-sizing",
  "color",
  "display",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "letter-spacing",
  "line-height",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-width",
  "object-fit",
  "opacity",
  "overflow",
  "overflow-wrap",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "position",
  "text-align",
  "text-decoration",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
] as const;

export type WechatStyleProperty = (typeof WECHAT_STYLE_PROPERTIES)[number];
export type WechatStyleValue = number | string;
export type WechatStyleMap = Readonly<Partial<Record<WechatStyleProperty, WechatStyleValue>>>;

export interface StyleSerializationWarning {
  readonly message: string;
  readonly property: string;
}

export interface StyleSerializationResult {
  readonly css: string;
  readonly warnings: readonly StyleSerializationWarning[];
}

const ALLOWED_PROPERTIES = new Set<string>(WECHAT_STYLE_PROPERTIES);
const SAFE_MODE_BLOCKED = new Set(["background", "background-image", "box-shadow"]);
const DANGEROUS_VALUE_PATTERN =
  /[;{}<>\\]|(?:url|expression|javascript|@import|behavior|var)\s*\(/i;
const VALUE_PATTERN = /^[#%(),.'" A-Za-z0-9_+\-/]*$/;

function validValue(value: WechatStyleValue): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    DANGEROUS_VALUE_PATTERN.test(normalized) ||
    !VALUE_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function modeAllows(property: string, value: string, mode: WechatOutputMode): boolean {
  const normalizedValue = value.toLowerCase();
  if (mode === "standard") {
    return property !== "position" || (normalizedValue !== "fixed" && normalizedValue !== "sticky");
  }
  if (SAFE_MODE_BLOCKED.has(property)) {
    return false;
  }
  return property !== "position" || normalizedValue === "static";
}

export function serializeInlineStyles(
  styles: WechatStyleMap,
  mode: WechatOutputMode,
): StyleSerializationResult {
  const warnings: StyleSerializationWarning[] = [];
  const declarations: string[] = [];

  for (const [property, rawValue] of Object.entries(styles).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    if (!ALLOWED_PROPERTIES.has(property)) {
      warnings.push({ message: "CSS 属性不在白名单中", property });
      continue;
    }
    const value = validValue(rawValue);
    if (value === null) {
      warnings.push({ message: "CSS 值不安全或格式不合法", property });
      continue;
    }
    if (!modeAllows(property, value, mode)) {
      warnings.push({ message: "当前输出模式已移除高风险样式", property });
      continue;
    }
    declarations.push(`${property}:${value}`);
  }

  return {
    css: declarations.length === 0 ? "" : `${declarations.join(";")};`,
    warnings,
  };
}
