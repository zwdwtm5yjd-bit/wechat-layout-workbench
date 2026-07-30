export const TOKEN_SCHEMA_VERSION = "1.0.0" as const;

export type TokenSchemaVersion = typeof TOKEN_SCHEMA_VERSION;
export type TokenReference = `{${string}}`;
export type TokenValue<T> = T | TokenReference;
export type TokenResolutionMode = "standard" | "wechat_safe";

export interface ColorTokens {
  accent: TokenValue<string>;
  background: TokenValue<string>;
  border: TokenValue<string>;
  borderStrong: TokenValue<string>;
  danger: TokenValue<string>;
  primary: TokenValue<string>;
  primaryDark: TokenValue<string>;
  primaryLight: TokenValue<string>;
  secondary: TokenValue<string>;
  success: TokenValue<string>;
  surface: TokenValue<string>;
  surfaceStrong: TokenValue<string>;
  textMuted: TokenValue<string>;
  textPrimary: TokenValue<string>;
  textSecondary: TokenValue<string>;
  warning: TokenValue<string>;
}

export interface TypographyTokens {
  bodyLetterSpacing: TokenValue<number>;
  bodyLineHeight: TokenValue<number>;
  bodySize: TokenValue<number>;
  bodyWeight: TokenValue<300 | 400 | 500 | 600 | 700>;
  captionLineHeight: TokenValue<number>;
  captionSize: TokenValue<number>;
  dataSize: TokenValue<number>;
  fontFamilyWechat: TokenValue<string>;
  heading1LineHeight: TokenValue<number>;
  heading1Size: TokenValue<number>;
  heading1Weight: TokenValue<300 | 400 | 500 | 600 | 700>;
  heading2LineHeight: TokenValue<number>;
  heading2Size: TokenValue<number>;
  heading2Weight: TokenValue<300 | 400 | 500 | 600 | 700>;
  heading3LineHeight: TokenValue<number>;
  heading3Size: TokenValue<number>;
  heading3Weight: TokenValue<300 | 400 | 500 | 600 | 700>;
  quoteSize: TokenValue<number>;
}

export interface SpacingTokens {
  contentPadding: TokenValue<number>;
  headingBottom: TokenValue<number>;
  headingTop: TokenValue<number>;
  lg: TokenValue<number>;
  md: TokenValue<number>;
  paragraphGap: TokenValue<number>;
  section: TokenValue<number>;
  sm: TokenValue<number>;
  xl: TokenValue<number>;
  xs: TokenValue<number>;
  xxl: TokenValue<number>;
}

export interface RadiusTokens {
  lg: TokenValue<number>;
  md: TokenValue<number>;
  none: TokenValue<number>;
  pill: TokenValue<number>;
  sm: TokenValue<number>;
  xl: TokenValue<number>;
}

export interface BorderTokens {
  leftAccent: TokenValue<string>;
  medium: TokenValue<string>;
  strong: TokenValue<string>;
  thin: TokenValue<string>;
}

export interface ShadowTokens {
  medium: TokenValue<string>;
  none: TokenValue<string>;
  soft: TokenValue<string>;
}

export interface ImageTokens {
  border: TokenValue<string>;
  captionAlign: TokenValue<"center" | "left" | "right">;
  captionColor: TokenValue<string>;
  captionSize: TokenValue<number>;
  defaultMarginBottom: TokenValue<number>;
  defaultMarginTop: TokenValue<number>;
  defaultRadius: TokenValue<number>;
  shadow: TokenValue<string>;
}

export interface MotionTokens {
  durationFast: TokenValue<number>;
  durationNormal: TokenValue<number>;
  durationSlow: TokenValue<number>;
  easingEmphasized: TokenValue<string>;
  easingStandard: TokenValue<string>;
}

export interface CompatibilityTokens {
  allowComplexBackground: TokenValue<boolean>;
  allowCustomFont: TokenValue<boolean>;
  allowRiskyLayout: TokenValue<boolean>;
  allowShadow: TokenValue<boolean>;
  maxNestingDepth: TokenValue<number>;
}

export interface ComponentStyleTokens {
  backgroundColor?: TokenValue<string>;
  backgroundImage?: TokenValue<string>;
  borderColor?: TokenValue<string>;
  borderRadius?: TokenValue<number>;
  borderStyle?: TokenValue<"dashed" | "dotted" | "none" | "solid">;
  borderWidth?: TokenValue<number>;
  boxShadow?: TokenValue<string>;
  color?: TokenValue<string>;
  columns?: TokenValue<1 | 2 | 3 | 4>;
  fontFamily?: TokenValue<string>;
  fontSize?: TokenValue<number>;
  fontWeight?: TokenValue<300 | 400 | 500 | 600 | 700>;
  letterSpacing?: TokenValue<number>;
  lineHeight?: TokenValue<number>;
  marginBottom?: TokenValue<number>;
  marginTop?: TokenValue<number>;
  paddingBottom?: TokenValue<number>;
  paddingLeft?: TokenValue<number>;
  paddingRight?: TokenValue<number>;
  paddingTop?: TokenValue<number>;
  position?: TokenValue<"absolute" | "relative" | "static">;
  textAlign?: TokenValue<"center" | "justify" | "left" | "right">;
}

export interface ComponentTokenDefinition extends ComponentStyleTokens {
  background?: TokenValue<string>;
  compatibilityLevel?: "compatible" | "conditional" | "risky" | "safe";
  variant?: string;
}

export interface ThemeTokenTree {
  border: BorderTokens;
  colors: ColorTokens;
  compatibility: CompatibilityTokens;
  components: Readonly<Record<string, ComponentTokenDefinition>>;
  image: ImageTokens;
  motion: MotionTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
}

export type TokenGroupOverride<T> = {
  readonly [Key in keyof T]?: T[Key];
};

export interface ThemeTokenOverride {
  readonly border?: TokenGroupOverride<BorderTokens>;
  readonly colors?: TokenGroupOverride<ColorTokens>;
  readonly compatibility?: TokenGroupOverride<CompatibilityTokens>;
  readonly components?: Readonly<Record<string, ComponentTokenDefinition>>;
  readonly image?: TokenGroupOverride<ImageTokens>;
  readonly motion?: TokenGroupOverride<MotionTokens>;
  readonly radius?: TokenGroupOverride<RadiusTokens>;
  readonly shadow?: TokenGroupOverride<ShadowTokens>;
  readonly spacing?: TokenGroupOverride<SpacingTokens>;
  readonly typography?: TokenGroupOverride<TypographyTokens>;
}

export interface ThemeTokenDocument extends ThemeTokenOverride {
  readonly schemaVersion: TokenSchemaVersion;
}

export interface BrandTokenPlaceholder {
  readonly accountId?: string;
  readonly assets?: {
    readonly avatarResourceId?: string;
    readonly logoResourceId?: string;
    readonly qrCodeResourceId?: string;
  };
  readonly colors?: Partial<Pick<ColorTokens, "accent" | "primary" | "secondary" | "textPrimary">>;
  readonly defaults?: {
    readonly footerComponentId?: string;
    readonly imageStyleRef?: string;
    readonly themeId?: string;
  };
  readonly schemaVersion: TokenSchemaVersion;
  readonly version: string;
}

export interface ComponentTokenLayer {
  readonly ref?: string;
  readonly tokens?: ComponentTokenDefinition;
}

export interface ArticleTokenLayer {
  readonly style?: ComponentStyleTokens;
  readonly tokens?: ThemeTokenOverride;
}

export interface ResolveTokenInput {
  readonly article?: ArticleTokenLayer;
  readonly brand?: BrandTokenPlaceholder;
  readonly component?: ComponentTokenLayer;
  readonly inline?: ComponentStyleTokens;
  readonly mode?: TokenResolutionMode;
  readonly node?: ComponentStyleTokens;
  readonly theme?: ThemeTokenDocument;
}

export interface ResolvedBrandPlaceholder {
  readonly accountId?: string;
  readonly assets: Readonly<NonNullable<BrandTokenPlaceholder["assets"]>>;
  readonly defaults: Readonly<NonNullable<BrandTokenPlaceholder["defaults"]>>;
  readonly version: string;
}

export interface TokenResolutionTraceEntry {
  readonly layer:
    "article" | "brand" | "component" | "inline" | "node" | "safety" | "system" | "theme";
  readonly paths: readonly string[];
}

export interface TokenResolutionResult {
  readonly brand: ResolvedBrandPlaceholder | null;
  readonly componentRef: string | null;
  readonly mode: TokenResolutionMode;
  readonly schemaVersion: TokenSchemaVersion;
  readonly style: Readonly<ComponentTokenDefinition>;
  readonly tokens: Readonly<ThemeTokenTree>;
  readonly trace: readonly TokenResolutionTraceEntry[];
}

export type TokenValidationErrorCode =
  | "INVALID_REFERENCE"
  | "INVALID_TYPE"
  | "OUT_OF_RANGE"
  | "REFERENCE_CYCLE"
  | "REFERENCE_NOT_FOUND"
  | "UNKNOWN_TOKEN"
  | "UNSAFE_VALUE"
  | "UNSUPPORTED_SCHEMA_VERSION";

export interface TokenValidationIssue {
  readonly code: TokenValidationErrorCode;
  readonly message: string;
  readonly path: string;
}

export type TokenValidationResult<T> =
  | {
      readonly data: T;
      readonly success: true;
    }
  | {
      readonly issues: readonly TokenValidationIssue[];
      readonly success: false;
    };

export type TokenResolutionAttempt =
  | {
      readonly data: TokenResolutionResult;
      readonly success: true;
    }
  | {
      readonly issues: readonly TokenValidationIssue[];
      readonly success: false;
    };

export interface TokenCacheStats {
  readonly hits: number;
  readonly maxEntries: number;
  readonly misses: number;
  readonly size: number;
}
