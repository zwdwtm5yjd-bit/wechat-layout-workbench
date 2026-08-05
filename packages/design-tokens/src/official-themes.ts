import { SYSTEM_THEME_TOKENS, WECHAT_SYSTEM_FONT } from "./defaults.js";
import {
  TOKEN_SCHEMA_VERSION,
  type ComponentTokenDefinition,
  type ThemeTokenDocument,
  type ThemeTokenTree,
} from "./types.js";

export const OFFICIAL_THEME_IDS = {
  editorialMinimal: "0198f8e1-7a01-7000-8000-000000000101",
  modernCivic: "0198f8e1-7a01-7000-8000-000000000102",
  techBlueGold: "0198f8e1-7a01-7000-8000-000000000103",
  campusYouth: "0198f8e1-7a01-7000-8000-000000000104",
  forestSummer: "0198f8e1-7a01-7000-8000-000000000105",
  travelMagazine: "0198f8e1-7a01-7000-8000-000000000106",
  foodWarmOrange: "0198f8e1-7a01-7000-8000-000000000107",
  portraitEditorial: "0198f8e1-7a01-7000-8000-000000000108",
  festivalRedGold: "0198f8e1-7a01-7000-8000-000000000109",
  orientalInk: "0198f8e1-7a01-7000-8000-000000000110",
} as const;

export const OFFICIAL_THEME_PALETTE_IDS = {
  editorialMinimal: "0198f8e1-7a01-7000-8000-000000000201",
  modernCivic: "0198f8e1-7a01-7000-8000-000000000202",
  techBlueGold: "0198f8e1-7a01-7000-8000-000000000203",
  campusYouth: "0198f8e1-7a01-7000-8000-000000000204",
  forestSummer: "0198f8e1-7a01-7000-8000-000000000205",
  travelMagazine: "0198f8e1-7a01-7000-8000-000000000206",
  foodWarmOrange: "0198f8e1-7a01-7000-8000-000000000207",
  portraitEditorial: "0198f8e1-7a01-7000-8000-000000000208",
  festivalRedGold: "0198f8e1-7a01-7000-8000-000000000209",
  orientalInk: "0198f8e1-7a01-7000-8000-000000000210",
} as const;

export type OfficialThemeId = (typeof OFFICIAL_THEME_IDS)[keyof typeof OFFICIAL_THEME_IDS];
export type ThemeCompatibilityLevel = "compatible" | "conditional" | "safe";

export interface ThemeManifest {
  readonly categories: readonly string[];
  readonly compatibilityLevel: ThemeCompatibilityLevel;
  readonly componentSetId: string;
  readonly createdAt: string;
  readonly defaultPaletteId: string;
  readonly description: string;
  readonly familyId: string;
  readonly isDefault: boolean;
  readonly name: string;
  readonly recommendedContentTypes: readonly string[];
  readonly status: "published";
  readonly supportedPalettes: readonly string[];
  readonly themeId: OfficialThemeId;
  readonly version: string;
}

export interface ThemePreviewAsset {
  readonly accentColors: readonly [string, string, string];
  readonly body: string;
  readonly dataLabel: string;
  readonly dataValue: string;
  readonly footer: string;
  readonly heading1: string;
  readonly heading2: string;
  readonly heading3: string;
  readonly imageAlt: string;
  readonly mobileViewportWidth: 375;
  readonly quote: string;
  readonly wechatContentWidth: 677;
}

export interface ThemeCompatibilityAsset {
  readonly level: ThemeCompatibilityLevel;
  readonly modes: readonly ["standard", "wechat_safe", "static"];
  readonly preserveOriginalText: true;
  readonly safeMode: {
    readonly allowComplexBackground: false;
    readonly allowCustomFont: false;
    readonly allowRiskyLayout: false;
    readonly allowShadow: false;
    readonly maxNestingDepth: 3;
  };
  readonly testedBlocks: readonly string[];
}

export interface OfficialThemePackage {
  readonly changelog: readonly {
    readonly changes: readonly string[];
    readonly releasedAt: string;
    readonly version: string;
  }[];
  readonly compatibility: ThemeCompatibilityAsset;
  readonly componentRefs: readonly string[];
  readonly fallback: {
    readonly mode: "wechat_safe";
    readonly tokenSource: "same-package";
  };
  readonly manifest: ThemeManifest;
  readonly migration: {
    readonly from: readonly string[];
    readonly strategy: "immutable-first-version";
  };
  readonly preview: ThemePreviewAsset;
  readonly renderer: {
    readonly key: "wechat-token-renderer";
    readonly minimumVersion: "1.0.0";
  };
  readonly tokens: ThemeTokenDocument;
  readonly variants: readonly {
    readonly name: string;
    readonly paletteId: string;
    readonly swatches: readonly [string, string, string];
  }[];
}

export interface OfficialThemeQuery {
  readonly category?: string;
  readonly compatibilityLevel?: ThemeCompatibilityLevel;
  readonly contentType?: string;
  readonly search?: string;
}

const REQUIRED_COMPONENT_REFS = [
  "paragraph.default",
  "heading.level1.default",
  "heading.level2.default",
  "heading.level3.default",
  "quote.default",
  "image.default",
  "card.data.default",
  "divider.default",
  "footer.brand.default",
] as const;

const COMPATIBILITY = {
  level: "safe",
  modes: ["standard", "wechat_safe", "static"],
  preserveOriginalText: true,
  safeMode: {
    allowComplexBackground: false,
    allowCustomFont: false,
    allowRiskyLayout: false,
    allowShadow: false,
    maxNestingDepth: 3,
  },
  testedBlocks: [
    "paragraph",
    "heading:1",
    "heading:2",
    "heading:3",
    "blockquote",
    "imageBlock",
    "semanticCard:data",
    "divider",
    "brandFooter",
  ],
} as const satisfies ThemeCompatibilityAsset;

const COMMON_TYPOGRAPHY = {
  ...SYSTEM_THEME_TOKENS.typography,
  fontFamilyWechat: WECHAT_SYSTEM_FONT,
} as const;

function editorialMinimalComponents(): Readonly<Record<string, ComponentTokenDefinition>> {
  return {
    "card.data.default": {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.border}",
      borderRadius: "{radius.none}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "minimalData",
    },
    "divider.default": {
      borderColor: "{colors.borderStrong}",
      borderStyle: "solid",
      borderWidth: 1,
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      variant: "hairline",
    },
    "footer.brand.default": {
      borderColor: "{colors.border}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textMuted}",
      fontSize: "{typography.captionSize}",
      letterSpacing: 0.8,
      lineHeight: "{typography.captionLineHeight}",
      marginTop: "{spacing.xxl}",
      paddingTop: "{spacing.xl}",
      textAlign: "center",
      variant: "quietEnding",
    },
    "heading.level1.default": {
      color: "{colors.textPrimary}",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      letterSpacing: -0.4,
      lineHeight: "{typography.heading1LineHeight}",
      marginBottom: "{spacing.lg}",
      marginTop: "{spacing.section}",
      textAlign: "left",
      variant: "editorialLead",
    },
    "heading.level2.default": {
      color: "{colors.textPrimary}",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      lineHeight: "{typography.heading2LineHeight}",
      marginBottom: "{spacing.md}",
      marginTop: "{spacing.xxl}",
      variant: "editorialSection",
    },
    "heading.level3.default": {
      color: "{colors.textSecondary}",
      fontSize: "{typography.heading3Size}",
      fontWeight: "{typography.heading3Weight}",
      letterSpacing: 0.4,
      lineHeight: "{typography.heading3LineHeight}",
      marginBottom: "{spacing.sm}",
      marginTop: "{spacing.xl}",
      variant: "editorialMinor",
    },
    "image.default": {
      borderColor: "{colors.border}",
      borderRadius: "{radius.none}",
      borderStyle: "solid",
      borderWidth: 1,
      boxShadow: "{shadow.none}",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "fullBleedClean",
    },
    "paragraph.default": {
      color: "{colors.textPrimary}",
      fontFamily: "{typography.fontFamilyWechat}",
      fontSize: "{typography.bodySize}",
      fontWeight: "{typography.bodyWeight}",
      letterSpacing: "{typography.bodyLetterSpacing}",
      lineHeight: "{typography.bodyLineHeight}",
      marginBottom: "{spacing.paragraphGap}",
      textAlign: "justify",
      variant: "editorialBody",
    },
    "quote.default": {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.none}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textSecondary}",
      fontSize: "{typography.quoteSize}",
      lineHeight: "{typography.bodyLineHeight}",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "accentHairline",
    },
  };
}

function modernCivicComponents(): Readonly<Record<string, ComponentTokenDefinition>> {
  return {
    "card.data.default": {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "civicData",
    },
    "divider.default": {
      borderColor: "{colors.accent}",
      borderStyle: "solid",
      borderWidth: 1,
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      variant: "goldHairline",
    },
    "footer.brand.default": {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.primary}",
      borderRadius: "{radius.none}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.primaryDark}",
      fontSize: "{typography.captionSize}",
      lineHeight: "{typography.captionLineHeight}",
      marginTop: "{spacing.section}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      textAlign: "center",
      variant: "solemnEnding",
    },
    "heading.level1.default": {
      color: "{colors.primaryDark}",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      letterSpacing: 0.4,
      lineHeight: "{typography.heading1LineHeight}",
      marginBottom: "{spacing.lg}",
      marginTop: "{spacing.section}",
      textAlign: "center",
      variant: "civicLead",
    },
    "heading.level2.default": {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.primary}",
      borderRadius: "{radius.none}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.primaryDark}",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      lineHeight: "{typography.heading2LineHeight}",
      marginBottom: "{spacing.md}",
      marginTop: "{spacing.xxl}",
      paddingBottom: "{spacing.sm}",
      paddingLeft: "{spacing.md}",
      paddingRight: "{spacing.md}",
      paddingTop: "{spacing.sm}",
      variant: "civicSection",
    },
    "heading.level3.default": {
      color: "{colors.primary}",
      fontSize: "{typography.heading3Size}",
      fontWeight: "{typography.heading3Weight}",
      letterSpacing: 0.3,
      lineHeight: "{typography.heading3LineHeight}",
      marginBottom: "{spacing.sm}",
      marginTop: "{spacing.xl}",
      variant: "civicMinor",
    },
    "image.default": {
      borderColor: "{colors.border}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      boxShadow: "{shadow.none}",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "civicFrame",
    },
    "paragraph.default": {
      color: "{colors.textPrimary}",
      fontFamily: "{typography.fontFamilyWechat}",
      fontSize: "{typography.bodySize}",
      fontWeight: "{typography.bodyWeight}",
      letterSpacing: "{typography.bodyLetterSpacing}",
      lineHeight: "{typography.bodyLineHeight}",
      marginBottom: "{spacing.paragraphGap}",
      textAlign: "justify",
      variant: "civicBody",
    },
    "quote.default": {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.primary}",
      borderRadius: "{radius.none}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textSecondary}",
      fontSize: "{typography.quoteSize}",
      lineHeight: "{typography.bodyLineHeight}",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "civicQuote",
    },
  };
}

function buildThemeTokens(
  variant: "editorialMinimal" | "modernCivic",
): ThemeTokenDocument & ThemeTokenTree {
  const editorial = variant === "editorialMinimal";
  return {
    schemaVersion: TOKEN_SCHEMA_VERSION,
    colors: editorial
      ? {
          accent: "#4F46E5",
          background: "#FFFFFF",
          border: "#E7E5E4",
          borderStrong: "#A8A29E",
          danger: "#B42318",
          primary: "#18181B",
          primaryDark: "#09090B",
          primaryLight: "#F4F4F5",
          secondary: "#57534E",
          success: "#157F3D",
          surface: "#F7F7F5",
          surfaceStrong: "#EFEEEA",
          textMuted: "#78716C",
          textPrimary: "#18181B",
          textSecondary: "#57534E",
          warning: "#B54708",
        }
      : {
          accent: "#B08D32",
          background: "#FFFCF8",
          border: "#E7D8CC",
          borderStrong: "#C9AA91",
          danger: "#9F1D24",
          primary: "#9F1D24",
          primaryDark: "#6F151A",
          primaryLight: "#FFF4EC",
          secondary: "#5F4A42",
          success: "#2D7148",
          surface: "#FFF8F2",
          surfaceStrong: "#F7ECE2",
          textMuted: "#8A746A",
          textPrimary: "#2F2525",
          textSecondary: "#66534C",
          warning: "#A65F16",
        },
    typography: editorial
      ? {
          ...COMMON_TYPOGRAPHY,
          bodyLetterSpacing: 0.35,
          bodyLineHeight: 1.92,
          heading1LineHeight: 1.38,
          heading1Size: 26,
          heading1Weight: 700,
          heading2LineHeight: 1.48,
          heading2Size: 21,
          heading2Weight: 700,
          heading3LineHeight: 1.55,
          heading3Size: 18,
          heading3Weight: 600,
        }
      : {
          ...COMMON_TYPOGRAPHY,
          bodyLetterSpacing: 0.45,
          bodyLineHeight: 1.88,
          heading1LineHeight: 1.42,
          heading1Size: 25,
          heading1Weight: 700,
          heading2LineHeight: 1.5,
          heading2Size: 20,
          heading2Weight: 700,
          heading3LineHeight: 1.55,
          heading3Size: 17,
          heading3Weight: 600,
        },
    spacing: editorial
      ? {
          ...SYSTEM_THEME_TOKENS.spacing,
          headingBottom: 16,
          headingTop: 36,
          paragraphGap: 18,
          section: 40,
          xl: 24,
          xxl: 36,
        }
      : {
          ...SYSTEM_THEME_TOKENS.spacing,
          headingBottom: 14,
          headingTop: 32,
          paragraphGap: 17,
          section: 38,
          xl: 24,
          xxl: 32,
        },
    radius: editorial
      ? { ...SYSTEM_THEME_TOKENS.radius, lg: 6, md: 4, sm: 2, xl: 8 }
      : { ...SYSTEM_THEME_TOKENS.radius, lg: 8, md: 6, sm: 3, xl: 12 },
    border: SYSTEM_THEME_TOKENS.border,
    shadow: {
      medium: editorial ? "0 6px 20px rgba(24,24,27,0.08)" : "0 6px 20px rgba(111,21,26,0.08)",
      none: "none",
      soft: editorial ? "0 3px 12px rgba(24,24,27,0.05)" : "0 3px 12px rgba(111,21,26,0.05)",
    },
    image: editorial
      ? {
          border: "1px solid",
          captionAlign: "left",
          captionColor: "{colors.textMuted}",
          captionSize: 12,
          defaultMarginBottom: 24,
          defaultMarginTop: 24,
          defaultRadius: 0,
          shadow: "{shadow.none}",
        }
      : {
          border: "1px solid",
          captionAlign: "center",
          captionColor: "{colors.textMuted}",
          captionSize: 13,
          defaultMarginBottom: 22,
          defaultMarginTop: 22,
          defaultRadius: 3,
          shadow: "{shadow.none}",
        },
    motion: SYSTEM_THEME_TOKENS.motion,
    compatibility: {
      allowComplexBackground: false,
      allowCustomFont: false,
      allowRiskyLayout: false,
      allowShadow: true,
      maxNestingDepth: 4,
    },
    components: editorial ? editorialMinimalComponents() : modernCivicComponents(),
  };
}

interface ExpressiveThemeStyle {
  readonly colors: ThemeTokenTree["colors"];
  readonly headingAlign?: "center" | "left";
  readonly imageRadius?: number;
  readonly sectionFill?: boolean;
}

function expressiveComponents(
  style: ExpressiveThemeStyle,
): Readonly<Record<string, ComponentTokenDefinition>> {
  return {
    "card.data.default": {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.md}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.primaryDark}",
      compatibilityLevel: "safe",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "expressiveData",
    },
    "divider.default": {
      borderColor: "{colors.accent}",
      borderStyle: "solid",
      borderWidth: 1,
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      variant: "accentHairline",
    },
    "footer.brand.default": {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.border}",
      borderRadius: "{radius.md}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textMuted}",
      fontSize: "{typography.captionSize}",
      lineHeight: "{typography.captionLineHeight}",
      marginTop: "{spacing.section}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      textAlign: "center",
      variant: "themedEnding",
    },
    "heading.level1.default": {
      color: "{colors.primaryDark}",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      letterSpacing: style.headingAlign === "center" ? 1 : 0.2,
      lineHeight: "{typography.heading1LineHeight}",
      marginBottom: "{spacing.lg}",
      marginTop: "{spacing.section}",
      textAlign: style.headingAlign ?? "left",
      variant: style.headingAlign === "center" ? "centeredLead" : "accentLead",
    },
    "heading.level2.default": {
      backgroundColor: style.sectionFill ? "{colors.primaryLight}" : "{colors.background}",
      borderColor: "{colors.primary}",
      borderRadius: style.sectionFill ? "{radius.sm}" : "{radius.none}",
      borderStyle: "solid",
      borderWidth: style.sectionFill ? 1 : 3,
      color: "{colors.primaryDark}",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      lineHeight: "{typography.heading2LineHeight}",
      marginBottom: "{spacing.md}",
      marginTop: "{spacing.xxl}",
      paddingBottom: "{spacing.sm}",
      paddingLeft: "{spacing.md}",
      paddingRight: "{spacing.md}",
      paddingTop: "{spacing.sm}",
      variant: style.sectionFill ? "filledSection" : "leftAccentSection",
    },
    "heading.level3.default": {
      color: "{colors.primary}",
      fontSize: "{typography.heading3Size}",
      fontWeight: "{typography.heading3Weight}",
      lineHeight: "{typography.heading3LineHeight}",
      marginBottom: "{spacing.sm}",
      marginTop: "{spacing.xl}",
      variant: "accentMinor",
    },
    "image.default": {
      borderColor: "{colors.border}",
      borderRadius: style.imageRadius ?? "{radius.md}",
      borderStyle: "solid",
      borderWidth: 1,
      boxShadow: "{shadow.none}",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "themedFrame",
    },
    "paragraph.default": {
      color: "{colors.textPrimary}",
      fontFamily: "{typography.fontFamilyWechat}",
      fontSize: "{typography.bodySize}",
      fontWeight: "{typography.bodyWeight}",
      letterSpacing: "{typography.bodyLetterSpacing}",
      lineHeight: "{typography.bodyLineHeight}",
      marginBottom: "{spacing.paragraphGap}",
      textAlign: "justify",
      variant: "themedBody",
    },
    "quote.default": {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textSecondary}",
      fontSize: "{typography.quoteSize}",
      lineHeight: "{typography.bodyLineHeight}",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "softAccentQuote",
    },
  };
}

function buildExpressiveThemeTokens(
  style: ExpressiveThemeStyle,
): ThemeTokenDocument & ThemeTokenTree {
  return {
    schemaVersion: TOKEN_SCHEMA_VERSION,
    colors: style.colors,
    typography: {
      ...COMMON_TYPOGRAPHY,
      bodyLetterSpacing: 0.4,
      bodyLineHeight: 1.9,
      heading1LineHeight: 1.4,
      heading1Size: 26,
      heading1Weight: 700,
      heading2LineHeight: 1.48,
      heading2Size: 20,
      heading2Weight: 700,
      heading3LineHeight: 1.55,
      heading3Size: 17,
      heading3Weight: 600,
    },
    spacing: {
      ...SYSTEM_THEME_TOKENS.spacing,
      headingBottom: 15,
      headingTop: 34,
      paragraphGap: 18,
      section: 38,
      xl: 24,
      xxl: 34,
    },
    radius: {
      ...SYSTEM_THEME_TOKENS.radius,
      lg: 12,
      md: 8,
      sm: 4,
      xl: 16,
    },
    border: SYSTEM_THEME_TOKENS.border,
    shadow: { medium: "none", none: "none", soft: "none" },
    image: {
      border: "1px solid",
      captionAlign: style.headingAlign === "center" ? "center" : "left",
      captionColor: "{colors.textMuted}",
      captionSize: 12,
      defaultMarginBottom: 24,
      defaultMarginTop: 24,
      defaultRadius: style.imageRadius ?? 8,
      shadow: "{shadow.none}",
    },
    motion: SYSTEM_THEME_TOKENS.motion,
    compatibility: {
      allowComplexBackground: false,
      allowCustomFont: false,
      allowRiskyLayout: false,
      allowShadow: false,
      maxNestingDepth: 4,
    },
    components: expressiveComponents(style),
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

const createdAt = "2026-08-01T00:00:00+08:00";

const editorialMinimal = {
  manifest: {
    themeId: OFFICIAL_THEME_IDS.editorialMinimal,
    familyId: "family_editorial_minimal",
    version: "1.0.0",
    name: "高级极简",
    description: "以大留白、鲜明字阶与细线建立安静的长文阅读秩序。",
    categories: [
      "用途:公司宣传",
      "用途:放假通知",
      "用途:温馨提示",
      "用途:安全提醒",
      "行业:企业",
      "风格:简洁",
      "色调:黑",
      "general",
      "editorial",
      "brand",
    ],
    recommendedContentTypes: ["general", "opinion", "interview", "essay"],
    defaultPaletteId: OFFICIAL_THEME_PALETTE_IDS.editorialMinimal,
    supportedPalettes: [OFFICIAL_THEME_PALETTE_IDS.editorialMinimal],
    componentSetId: "component_set_editorial_minimal_01",
    compatibilityLevel: "safe",
    status: "published",
    isDefault: true,
    createdAt,
  },
  tokens: buildThemeTokens("editorialMinimal"),
  componentRefs: REQUIRED_COMPONENT_REFS,
  variants: [
    {
      name: "墨白靛蓝",
      paletteId: OFFICIAL_THEME_PALETTE_IDS.editorialMinimal,
      swatches: ["#18181B", "#F7F7F5", "#4F46E5"],
    },
  ],
  preview: {
    accentColors: ["#18181B", "#F7F7F5", "#4F46E5"],
    heading1: "让真正重要的内容被看见",
    heading2: "阅读秩序比装饰更重要",
    heading3: "留白也是信息",
    body: "好的排版不是装饰内容，而是让标题、正文、引用与留白各自承担清楚的职责。",
    quote: "每一处视觉强调都必须服务于信息，而不是争夺注意力。",
    imageAlt: "长文编辑场景示意图",
    dataLabel: "原文变化",
    dataValue: "0",
    footer: "让内容保持安静而清晰的力量",
    mobileViewportWidth: 375,
    wechatContentWidth: 677,
  },
  compatibility: COMPATIBILITY,
  renderer: { key: "wechat-token-renderer", minimumVersion: "1.0.0" },
  fallback: { mode: "wechat_safe", tokenSource: "same-package" },
  migration: { from: [], strategy: "immutable-first-version" },
  changelog: [
    {
      version: "1.0.0",
      releasedAt: createdAt,
      changes: ["首发正文、三级标题、引用、图片、数据卡、分割线与文末样式"],
    },
  ],
} as const satisfies OfficialThemePackage;

const modernCivic = {
  manifest: {
    themeId: OFFICIAL_THEME_IDS.modernCivic,
    familyId: "family_government_modern",
    version: "1.0.0",
    name: "现代政务红",
    description: "以克制深红、米白底色和细金线承载正式政务与国企内容。",
    categories: [
      "用途:总结报告",
      "用途:党建宣传",
      "用途:党日活动",
      "用途:会议报道",
      "行业:政务",
      "行业:企业",
      "风格:商务",
      "色调:红",
      "节假:国庆节",
      "government",
      "inspection",
      "state_enterprise",
    ],
    recommendedContentTypes: ["meeting", "inspection", "rectification", "work_summary"],
    defaultPaletteId: OFFICIAL_THEME_PALETTE_IDS.modernCivic,
    supportedPalettes: [OFFICIAL_THEME_PALETTE_IDS.modernCivic],
    componentSetId: "component_set_government_modern_01",
    compatibilityLevel: "safe",
    status: "published",
    isDefault: false,
    createdAt,
  },
  tokens: buildThemeTokens("modernCivic"),
  componentRefs: REQUIRED_COMPONENT_REFS,
  variants: [
    {
      name: "深红米金",
      paletteId: OFFICIAL_THEME_PALETTE_IDS.modernCivic,
      swatches: ["#9F1D24", "#FFF8F2", "#2F2525"],
    },
  ],
  preview: {
    accentColors: ["#9F1D24", "#FFF8F2", "#2F2525"],
    heading1: "把工作做深，把责任压实",
    heading2: "以高质量执行回应发展要求",
    heading3: "工作进展",
    body: "坚持问题导向和结果导向，以清晰层级呈现工作部署、责任分工与阶段性成效。",
    quote: "红色只用于关键信息，每一次强调都要有明确含义。",
    imageAlt: "政务会议与工作场景示意图",
    dataLabel: "重点任务完成率",
    dataValue: "96%",
    footer: "凝心聚力抓落实，砥砺奋进开新局",
    mobileViewportWidth: 375,
    wechatContentWidth: 677,
  },
  compatibility: COMPATIBILITY,
  renderer: { key: "wechat-token-renderer", minimumVersion: "1.0.0" },
  fallback: { mode: "wechat_safe", tokenSource: "same-package" },
  migration: { from: [], strategy: "immutable-first-version" },
  changelog: [
    {
      version: "1.0.0",
      releasedAt: createdAt,
      changes: ["首发正文、三级标题、引用、图片、数据卡、分割线与庄重文末样式"],
    },
  ],
} as const satisfies OfficialThemePackage;

function createExpressiveTheme(input: {
  readonly categories: readonly string[];
  readonly colors: ThemeTokenTree["colors"];
  readonly contentTypes: readonly string[];
  readonly description: string;
  readonly familyId: string;
  readonly headingAlign?: "center" | "left";
  readonly name: string;
  readonly paletteId: string;
  readonly preview: Omit<
    ThemePreviewAsset,
    "accentColors" | "mobileViewportWidth" | "wechatContentWidth"
  >;
  readonly sectionFill?: boolean;
  readonly swatches: readonly [string, string, string];
  readonly themeId: OfficialThemeId;
}): OfficialThemePackage {
  return {
    manifest: {
      themeId: input.themeId,
      familyId: input.familyId,
      version: "1.0.0",
      name: input.name,
      description: input.description,
      categories: input.categories,
      recommendedContentTypes: input.contentTypes,
      defaultPaletteId: input.paletteId,
      supportedPalettes: [input.paletteId],
      componentSetId: `component_set_${input.familyId}_01`,
      compatibilityLevel: "safe",
      status: "published",
      isDefault: false,
      createdAt,
    },
    tokens: buildExpressiveThemeTokens({
      colors: input.colors,
      ...(input.headingAlign === undefined ? {} : { headingAlign: input.headingAlign }),
      ...(input.sectionFill === undefined ? {} : { sectionFill: input.sectionFill }),
    }),
    componentRefs: REQUIRED_COMPONENT_REFS,
    variants: [{ name: input.name, paletteId: input.paletteId, swatches: input.swatches }],
    preview: {
      ...input.preview,
      accentColors: input.swatches,
      mobileViewportWidth: 375,
      wechatContentWidth: 677,
    },
    compatibility: COMPATIBILITY,
    renderer: { key: "wechat-token-renderer", minimumVersion: "1.0.0" },
    fallback: { mode: "wechat_safe", tokenSource: "same-package" },
    migration: { from: [], strategy: "immutable-first-version" },
    changelog: [
      {
        version: "1.0.0",
        releasedAt: createdAt,
        changes: ["新增场景化正文、标题、引用、数据卡、图片与文末样式"],
      },
    ],
  };
}

const techBlueGold = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.techBlueGold,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.techBlueGold,
  familyId: "tech_blue_gold",
  name: "科技蓝金",
  description: "深蓝秩序配合金色锚点，适合企业介绍、科技产品和峰会报道。",
  categories: [
    "用途:公司宣传",
    "用途:活动纪实",
    "用途:会议报道",
    "行业:科技",
    "风格:商务",
    "色调:蓝",
  ],
  contentTypes: ["company", "technology", "product", "conference"],
  swatches: ["#123B70", "#F4F7FB", "#D3A84A"],
  sectionFill: true,
  colors: {
    accent: "#D3A84A",
    background: "#FFFFFF",
    border: "#D8E2EF",
    borderStrong: "#8EA7C2",
    danger: "#B42318",
    primary: "#123B70",
    primaryDark: "#0A2850",
    primaryLight: "#EAF2FA",
    secondary: "#486783",
    success: "#16794B",
    surface: "#F4F7FB",
    surfaceStrong: "#E6EDF6",
    textMuted: "#718399",
    textPrimary: "#172B43",
    textSecondary: "#486078",
    warning: "#A55B08",
  },
  preview: {
    heading1: "聚焦新格局，拥抱新未来",
    heading2: "用技术重新定义效率",
    heading3: "核心亮点",
    body: "把产品价值、数据表现与行业观点放进清晰、可扫读的商务叙事中。",
    quote: "真正的科技感来自秩序和信心，而不是堆叠发光装饰。",
    imageAlt: "科技产品与峰会场景",
    dataLabel: "效率提升",
    dataValue: "42%",
    footer: "智慧科技 拥抱未来",
  },
});

const campusYouth = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.campusYouth,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.campusYouth,
  familyId: "campus_youth",
  name: "校园青春",
  description: "明亮黄绿与柔和蓝色营造轻快节奏，适合开学、招新与社团活动。",
  categories: [
    "用途:活动推广",
    "用途:活动纪实",
    "用途:主题教育",
    "用途:节日祝福",
    "行业:校园",
    "风格:卡通",
    "色调:黄",
    "节假:开学季",
    "节假:劳动节",
    "节假:母亲节",
  ],
  contentTypes: ["campus", "recruitment", "event", "new_student"],
  swatches: ["#2F7D57", "#FFFBEA", "#F1B93A"],
  headingAlign: "center",
  sectionFill: true,
  colors: {
    accent: "#F1B93A",
    background: "#FFFDF6",
    border: "#E7E2C9",
    borderStrong: "#ABC0A4",
    danger: "#B73B3B",
    primary: "#2F7D57",
    primaryDark: "#20583E",
    primaryLight: "#ECF7E8",
    secondary: "#4B7390",
    success: "#2F7D57",
    surface: "#FFFBEA",
    surfaceStrong: "#EAF4E5",
    textMuted: "#7A806F",
    textPrimary: "#24352B",
    textSecondary: "#526158",
    warning: "#A06408",
  },
  preview: {
    heading1: "新生指南 青春正当时",
    heading2: "在校园遇见更好的自己",
    heading3: "报到贴士",
    body: "用轻快而清晰的层级，承载迎新流程、社团介绍和活动信息。",
    quote: "每一次出发，都是和新世界的一次相遇。",
    imageAlt: "校园迎新活动",
    dataLabel: "活动社团",
    dataValue: "36",
    footer: "愿你的校园时光闪闪发光",
  },
});

const forestSummer = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.forestSummer,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.forestSummer,
  familyId: "forest_summer",
  name: "夏日森系",
  description: "叶绿、奶油白与少量杏色营造自然呼吸感，适合夏日活动与公益。",
  categories: [
    "用途:活动回顾",
    "用途:活动纪实",
    "用途:主题教育",
    "行业:旅游",
    "风格:手绘",
    "色调:绿",
    "节假:清明节",
    "节假:劳动节",
    "节假:暑假",
    "节假:二十四节气",
  ],
  contentTypes: ["summer", "public_welfare", "nature", "event_review"],
  swatches: ["#4D7B50", "#FBF8EA", "#E5A86D"],
  headingAlign: "center",
  colors: {
    accent: "#E5A86D",
    background: "#FFFDF7",
    border: "#DEDCCB",
    borderStrong: "#9DB69B",
    danger: "#AD3F32",
    primary: "#4D7B50",
    primaryDark: "#345837",
    primaryLight: "#EEF5E8",
    secondary: "#728069",
    success: "#3C7746",
    surface: "#FBF8EA",
    surfaceStrong: "#EAF1E3",
    textMuted: "#7E8274",
    textPrimary: "#2F3B31",
    textSecondary: "#5C685D",
    warning: "#A26420",
  },
  preview: {
    heading1: "盛夏好时光",
    heading2: "向着有风的地方出发",
    heading3: "活动手记",
    body: "柔和的绿色系层级让照片、故事和活动节点都有舒展的呼吸空间。",
    quote: "夏天的意义，是和喜欢的人一起走进自然。",
    imageAlt: "夏日田野与公益活动",
    dataLabel: "参与伙伴",
    dataValue: "128",
    footer: "珍惜每一次与自然的相遇",
  },
});

const travelMagazine = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.travelMagazine,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.travelMagazine,
  familyId: "travel_magazine",
  name: "旅行杂志",
  description: "森林黑绿、沙岩色与大留白，为游记、摄影和户外图集建立画报感。",
  categories: [
    "用途:图集",
    "用途:活动纪实",
    "行业:旅游",
    "风格:杂志",
    "色调:绿",
    "节假:国庆节",
    "节假:暑假",
  ],
  contentTypes: ["travel", "photo_story", "outdoor", "essay"],
  swatches: ["#203D35", "#F6F2E9", "#B67A4C"],
  colors: {
    accent: "#B67A4C",
    background: "#FEFCF8",
    border: "#DDD7CB",
    borderStrong: "#998F80",
    danger: "#A23B32",
    primary: "#203D35",
    primaryDark: "#142B25",
    primaryLight: "#E9EFEA",
    secondary: "#6C665D",
    success: "#316B4E",
    surface: "#F6F2E9",
    surfaceStrong: "#EDE6DA",
    textMuted: "#817A70",
    textPrimary: "#252B28",
    textSecondary: "#5A625D",
    warning: "#9C5C24",
  },
  preview: {
    heading1: "露营，与自然一起共度日光",
    heading2: "步履不停，真实山野相拥",
    heading3: "TRAVEL NOTES",
    body: "用杂志般的字阶与画面节奏，让风景、人物和路线成为同一个故事。",
    quote: "去看没有天花板的地方，去记住风的形状。",
    imageAlt: "山野露营与旅行摄影",
    dataLabel: "行走距离",
    dataValue: "18km",
    footer: "KEEP WANDERING",
  },
});

const foodWarmOrange = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.foodWarmOrange,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.foodWarmOrange,
  familyId: "food_warm_orange",
  name: "食味暖橙",
  description: "番茄橙、奶油色与深棕创造温热食欲，适合菜单、探店和品牌故事。",
  categories: [
    "用途:产品推介",
    "用途:节气食育",
    "行业:餐饮",
    "风格:手绘",
    "色调:橙",
    "节假:二十四节气",
    "节假:腊八节",
  ],
  contentTypes: ["food", "restaurant", "product", "review"],
  swatches: ["#B94A2C", "#FFF6E8", "#E7A238"],
  headingAlign: "center",
  sectionFill: true,
  colors: {
    accent: "#E7A238",
    background: "#FFFCF7",
    border: "#E8D6C4",
    borderStrong: "#C49772",
    danger: "#A83028",
    primary: "#B94A2C",
    primaryDark: "#7E2E1E",
    primaryLight: "#FFF0DE",
    secondary: "#765747",
    success: "#3F7A4D",
    surface: "#FFF6E8",
    surfaceStrong: "#F5E7D7",
    textMuted: "#8B7669",
    textPrimary: "#3D2C24",
    textSecondary: "#6A5044",
    warning: "#A15D0C",
  },
  preview: {
    heading1: "今日好食光",
    heading2: "认真对待每一口幸福",
    heading3: "CHEF'S PICK",
    body: "暖橙系色彩和稳定的信息卡，适合呈现食材、菜品、价格和门店故事。",
    quote: "好味道不需要大声宣告，它会在第一口里回答。",
    imageAlt: "餐厅菜品与食材",
    dataLabel: "本季新菜",
    dataValue: "12",
    footer: "与你分享每一餐的温度",
  },
});

const portraitEditorial = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.portraitEditorial,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.portraitEditorial,
  familyId: "portrait_editorial",
  name: "人物专访",
  description: "炭黑、纸白和暗金建立人物封面感，适合专访、传记与品牌人物。",
  categories: [
    "用途:人物介绍",
    "用途:活动纪实",
    "行业:媒体",
    "风格:杂志",
    "色调:黑",
    "节假:母亲节",
    "节假:重阳节",
  ],
  contentTypes: ["interview", "portrait", "biography", "brand"],
  swatches: ["#303030", "#F7F4EE", "#B79762"],
  colors: {
    accent: "#B79762",
    background: "#FFFFFF",
    border: "#DEDAD2",
    borderStrong: "#9C9588",
    danger: "#A5352C",
    primary: "#303030",
    primaryDark: "#161616",
    primaryLight: "#F0ECE4",
    secondary: "#65605A",
    success: "#3F7555",
    surface: "#F7F4EE",
    surfaceStrong: "#EBE6DC",
    textMuted: "#858078",
    textPrimary: "#242424",
    textSecondary: "#5C5954",
    warning: "#986027",
  },
  preview: {
    heading1: "他如何把理想变成日常",
    heading2: "一段值得被记住的经历",
    heading3: "PORTRAIT",
    body: "通过大字阶、细金线和克制留白，让人物语言成为视觉的中心。",
    quote: "一个人真正的故事，往往藏在他如何做出选择里。",
    imageAlt: "人物肖像与工作场景",
    dataLabel: "专注领域",
    dataValue: "15年",
    footer: "记录真实的人，传递长久的力量",
  },
});

const festivalRedGold = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.festivalRedGold,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.festivalRedGold,
  familyId: "festival_red_gold",
  name: "节日红金",
  description: "明红与暖金构建庆典氛围，适合春节、年终、开业与品牌庆典。",
  categories: [
    "用途:促销宣传",
    "用途:放假通知",
    "用途:温馨提示",
    "用途:节日祝福",
    "行业:企业",
    "风格:喜庆",
    "色调:红",
    "节假:春节",
    "节假:元旦",
    "节假:除夕",
    "节假:小年",
    "节假:劳动节",
    "节假:国庆节",
  ],
  contentTypes: ["festival", "promotion", "annual", "celebration"],
  swatches: ["#B72C25", "#FFF5E8", "#D8A441"],
  headingAlign: "center",
  sectionFill: true,
  colors: {
    accent: "#D8A441",
    background: "#FFFCF7",
    border: "#EAD4BE",
    borderStrong: "#C69D78",
    danger: "#9E201B",
    primary: "#B72C25",
    primaryDark: "#7F1916",
    primaryLight: "#FFF0E4",
    secondary: "#765044",
    success: "#39744A",
    surface: "#FFF5E8",
    surfaceStrong: "#F5E4D1",
    textMuted: "#8B7166",
    textPrimary: "#3D2823",
    textSecondary: "#68504A",
    warning: "#9B5A11",
  },
  preview: {
    heading1: "新岁启新章",
    heading2: "以初心赶路，以实干续新章",
    heading3: "新年献词",
    body: "在喜庆色彩中保持清晰层级，让祝福、成绩、活动与品牌信息依然好读。",
    quote: "新的一年，愿每份热爱都有回响，每次奔赴都有收获。",
    imageAlt: "新年庆典与品牌活动",
    dataLabel: "年度增长",
    dataValue: "68%",
    footer: "辞旧迎新 共赴新程",
  },
});

const orientalInk = createExpressiveTheme({
  themeId: OFFICIAL_THEME_IDS.orientalInk,
  paletteId: OFFICIAL_THEME_PALETTE_IDS.orientalInk,
  familyId: "oriental_ink",
  name: "国风雅韵",
  description: "墨色、宣纸白与石青构建当代东方感，适合文化、诗词和节气内容。",
  categories: [
    "用途:散文随笔",
    "用途:主题教育",
    "用途:节气科普",
    "用途:节日祝福",
    "行业:文化",
    "风格:中国风",
    "色调:青",
    "节假:二十四节气",
    "节假:清明节",
    "节假:端午节",
    "节假:中秋节",
    "节假:重阳节",
    "节假:腊八节",
  ],
  contentTypes: ["culture", "poetry", "essay", "solar_term"],
  swatches: ["#263B3A", "#F7F3E8", "#4E7B78"],
  headingAlign: "center",
  colors: {
    accent: "#4E7B78",
    background: "#FCFAF4",
    border: "#DDD8CA",
    borderStrong: "#96958B",
    danger: "#9D302A",
    primary: "#263B3A",
    primaryDark: "#172827",
    primaryLight: "#E9F0EC",
    secondary: "#5D6965",
    success: "#39704C",
    surface: "#F7F3E8",
    surfaceStrong: "#EBE5D7",
    textMuted: "#7B7C74",
    textPrimary: "#29312F",
    textSecondary: "#58625F",
    warning: "#93602C",
  },
  preview: {
    heading1: "山水有清音",
    heading2: "于时光深处，听见东方",
    heading3: "节气小记",
    body: "用现代排版的克制与东方色彩的温润，承载诗词、文化、节气与人文故事。",
    quote: "行到水穷处，坐看云起时。",
    imageAlt: "山水与传统文化场景",
    dataLabel: "岁时",
    dataValue: "二十四",
    footer: "一纸清欢 半卷东方",
  },
});

export const OFFICIAL_THEME_PACKAGES: readonly OfficialThemePackage[] = deepFreeze([
  editorialMinimal,
  modernCivic,
  techBlueGold,
  campusYouth,
  forestSummer,
  travelMagazine,
  foodWarmOrange,
  portraitEditorial,
  festivalRedGold,
  orientalInk,
]);

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN");
}

export function listOfficialThemes(
  query: OfficialThemeQuery = {},
): readonly OfficialThemePackage[] {
  const search = query.search === undefined ? "" : normalized(query.search);
  return OFFICIAL_THEME_PACKAGES.filter((theme) => {
    if (
      query.category !== undefined &&
      !theme.manifest.categories.includes(normalized(query.category))
    ) {
      return false;
    }
    if (
      query.contentType !== undefined &&
      !theme.manifest.recommendedContentTypes.includes(normalized(query.contentType))
    ) {
      return false;
    }
    if (
      query.compatibilityLevel !== undefined &&
      theme.manifest.compatibilityLevel !== query.compatibilityLevel
    ) {
      return false;
    }
    return (
      search === "" ||
      normalized(
        [
          theme.manifest.name,
          theme.manifest.description,
          ...theme.manifest.categories,
          ...theme.manifest.recommendedContentTypes,
        ].join(" "),
      ).includes(search)
    );
  });
}

export function getOfficialTheme(themeId: string, version?: string): OfficialThemePackage | null {
  return (
    OFFICIAL_THEME_PACKAGES.find(
      (theme) =>
        theme.manifest.themeId === themeId &&
        (version === undefined || theme.manifest.version === version),
    ) ?? null
  );
}

export function getOfficialThemeVersions(themeId: string): readonly OfficialThemePackage[] {
  return OFFICIAL_THEME_PACKAGES.filter((theme) => theme.manifest.themeId === themeId).toSorted(
    (left, right) => right.manifest.version.localeCompare(left.manifest.version, "en"),
  );
}
