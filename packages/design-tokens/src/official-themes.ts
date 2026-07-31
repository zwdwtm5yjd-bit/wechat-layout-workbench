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
} as const;

export const OFFICIAL_THEME_PALETTE_IDS = {
  editorialMinimal: "0198f8e1-7a01-7000-8000-000000000201",
  modernCivic: "0198f8e1-7a01-7000-8000-000000000202",
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
    categories: ["general", "editorial", "brand"],
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
    categories: ["government", "inspection", "state_enterprise"],
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

export const OFFICIAL_THEME_PACKAGES: readonly OfficialThemePackage[] = deepFreeze([
  editorialMinimal,
  modernCivic,
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
