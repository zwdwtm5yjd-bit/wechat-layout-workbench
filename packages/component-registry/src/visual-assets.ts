export const VISUAL_ASSET_MOTIONS = ["static", "dynamic"] as const;
export type VisualAssetMotion = (typeof VISUAL_ASSET_MOTIONS)[number];

export const VISUAL_ASSET_FUNCTIONS = [
  "background",
  "hero",
  "heading",
  "divider",
  "frame",
  "corner",
  "badge",
  "ribbon",
  "gallery",
  "sticker",
] as const;
export type VisualAssetFunction = (typeof VISUAL_ASSET_FUNCTIONS)[number];

export const VISUAL_ASSET_STYLES = [
  "oriental-ink",
  "botanical-nature",
  "civic-red",
  "tech-blue",
  "festival-heritage",
  "childlike-education",
  "warm-lifestyle",
  "editorial-geometric",
  "hand-drawn",
  "premium-business",
] as const;
export type VisualAssetStyle = (typeof VISUAL_ASSET_STYLES)[number];

export const VISUAL_ASSET_EFFECTS = [
  "float",
  "pulse",
  "shimmer",
  "orbit",
  "wave",
  "falling-leaves",
  "twinkle",
  "reveal",
  "marquee",
  "breathe",
] as const;
export type VisualAssetEffect = (typeof VISUAL_ASSET_EFFECTS)[number];

export const VISUAL_ASSET_FUNCTION_LABELS: Readonly<Record<VisualAssetFunction, string>> = {
  background: "背景氛围",
  hero: "头图主视觉",
  heading: "标题装饰",
  divider: "分隔过渡",
  frame: "图片边框",
  corner: "边角装饰",
  badge: "徽章标签",
  ribbon: "丝带横幅",
  gallery: "图集容器",
  sticker: "贴纸点缀",
};

export const VISUAL_ASSET_STYLE_LABELS: Readonly<Record<VisualAssetStyle, string>> = {
  "oriental-ink": "东方水墨",
  "botanical-nature": "植物自然",
  "civic-red": "政务红金",
  "tech-blue": "科技蓝",
  "festival-heritage": "传统节庆",
  "childlike-education": "童趣教育",
  "warm-lifestyle": "温暖生活",
  "editorial-geometric": "杂志几何",
  "hand-drawn": "手绘线稿",
  "premium-business": "高级商务",
};

export const VISUAL_ASSET_EFFECT_LABELS: Readonly<Record<VisualAssetEffect, string>> = {
  float: "轻柔漂浮",
  pulse: "节奏脉冲",
  shimmer: "流光扫过",
  orbit: "环绕运行",
  wave: "波浪起伏",
  "falling-leaves": "落叶飘动",
  twinkle: "星光闪烁",
  reveal: "渐次显现",
  marquee: "横向巡游",
  breathe: "呼吸明暗",
};

interface VisualAssetStyleDefinition {
  readonly colors: readonly string[];
  readonly scenes: readonly string[];
  readonly style: VisualAssetStyle;
}

const STATIC_STYLE_DEFINITIONS: readonly VisualAssetStyleDefinition[] = [
  { colors: ["青绿", "米白"], scenes: ["节气", "国风", "文化"], style: "oriental-ink" },
  { colors: ["绿色", "米白"], scenes: ["自然", "旅行", "健康"], style: "botanical-nature" },
  { colors: ["红色", "金色"], scenes: ["党政", "会议", "国庆"], style: "civic-red" },
  { colors: ["蓝色", "紫色"], scenes: ["科技", "企业", "发布会"], style: "tech-blue" },
  { colors: ["橙色", "金色"], scenes: ["春节", "中秋", "端午"], style: "festival-heritage" },
  {
    colors: ["彩色", "天蓝"],
    scenes: ["教育", "幼儿园", "招生活动"],
    style: "childlike-education",
  },
  { colors: ["粉色", "暖黄"], scenes: ["亲子", "母亲节", "生活"], style: "warm-lifestyle" },
  { colors: ["黑白", "橙色"], scenes: ["杂志", "人物", "品牌"], style: "editorial-geometric" },
  { colors: ["蓝灰", "绿色"], scenes: ["散文", "手账", "文艺"], style: "hand-drawn" },
  { colors: ["深蓝", "金色"], scenes: ["商务", "总结", "金融"], style: "premium-business" },
] as const;

const DYNAMIC_STYLE_DEFINITIONS = [
  STATIC_STYLE_DEFINITIONS[0]!,
  STATIC_STYLE_DEFINITIONS[1]!,
  STATIC_STYLE_DEFINITIONS[2]!,
  STATIC_STYLE_DEFINITIONS[3]!,
  STATIC_STYLE_DEFINITIONS[4]!,
] as const;

export interface OfficialVisualAsset {
  readonly colors: readonly string[];
  readonly description: string;
  readonly effect?: VisualAssetEffect;
  readonly function: VisualAssetFunction;
  readonly id: string;
  readonly motion: VisualAssetMotion;
  readonly name: string;
  readonly previewPath: string;
  readonly resourceId: string;
  readonly fallbackResourceId?: string;
  readonly scenes: readonly string[];
  readonly style: VisualAssetStyle;
  readonly tags: readonly string[];
}

function paddedIndex(index: number): string {
  return String(index).padStart(3, "0");
}

const STATIC_VISUAL_ASSETS: readonly OfficialVisualAsset[] = STATIC_STYLE_DEFINITIONS.flatMap(
  (definition, styleIndex) =>
    VISUAL_ASSET_FUNCTIONS.map((assetFunction, functionIndex) => {
      const index = styleIndex * VISUAL_ASSET_FUNCTIONS.length + functionIndex + 1;
      const serial = paddedIndex(index);
      const styleLabel = VISUAL_ASSET_STYLE_LABELS[definition.style];
      const functionLabel = VISUAL_ASSET_FUNCTION_LABELS[assetFunction];
      return {
        colors: definition.colors,
        description: `${styleLabel}方向的原创${functionLabel}，适合${definition.scenes.join("、")}内容。`,
        function: assetFunction,
        id: `visual_static_${serial}`,
        motion: "static",
        name: `${styleLabel} · ${functionLabel}`,
        previewPath: `/visual-assets/library/static/static-${serial}.svg`,
        resourceId: `builtin_visual_static_${serial}`,
        scenes: definition.scenes,
        style: definition.style,
        tags: [styleLabel, functionLabel, ...definition.scenes, ...definition.colors],
      } satisfies OfficialVisualAsset;
    }),
);

const DYNAMIC_VISUAL_ASSETS: readonly OfficialVisualAsset[] = DYNAMIC_STYLE_DEFINITIONS.flatMap(
  (definition, styleIndex) =>
    VISUAL_ASSET_EFFECTS.map((effect, effectIndex) => {
      const index = styleIndex * VISUAL_ASSET_EFFECTS.length + effectIndex + 1;
      const serial = paddedIndex(index);
      const fallbackSerial = paddedIndex(index);
      const styleLabel = VISUAL_ASSET_STYLE_LABELS[definition.style];
      const effectLabel = VISUAL_ASSET_EFFECT_LABELS[effect];
      return {
        colors: definition.colors,
        description: `${styleLabel}原创动效，编辑器内播放${effectLabel}，复制到微信时自动使用静态备用图。`,
        effect,
        fallbackResourceId: `builtin_visual_static_${fallbackSerial}`,
        function: effectIndex % 2 === 0 ? "hero" : "background",
        id: `visual_dynamic_${serial}`,
        motion: "dynamic",
        name: `${styleLabel} · ${effectLabel}`,
        previewPath: `/visual-assets/library/dynamic/dynamic-${serial}.svg`,
        resourceId: `builtin_visual_dynamic_${serial}`,
        scenes: definition.scenes,
        style: definition.style,
        tags: [styleLabel, effectLabel, "动态", ...definition.scenes, ...definition.colors],
      } satisfies OfficialVisualAsset;
    }),
);

export const OFFICIAL_VISUAL_ASSETS: readonly OfficialVisualAsset[] = [
  ...STATIC_VISUAL_ASSETS,
  ...DYNAMIC_VISUAL_ASSETS,
];

export const OFFICIAL_STATIC_VISUAL_ASSETS = STATIC_VISUAL_ASSETS;
export const OFFICIAL_DYNAMIC_VISUAL_ASSETS = DYNAMIC_VISUAL_ASSETS;

export const BUILTIN_VISUAL_ASSET_ORIGIN = "https://visual.ericmm.com";

export function findOfficialVisualAsset(resourceId: string): OfficialVisualAsset | undefined {
  return OFFICIAL_VISUAL_ASSETS.find((asset) => asset.resourceId === resourceId);
}

export function builtInVisualAssetPublicPath(resourceId: string): string | undefined {
  return findOfficialVisualAsset(resourceId)?.previewPath;
}

export function builtInVisualAssetPublicUrl(resourceId: string): string | undefined {
  const path = builtInVisualAssetPublicPath(resourceId);
  return path === undefined ? undefined : `${BUILTIN_VISUAL_ASSET_ORIGIN}${path}`;
}
