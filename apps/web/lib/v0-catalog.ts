import {
  OFFICIAL_COMPONENT_ASSETS,
  type OfficialComponentAsset,
  type OfficialComponentPreview,
} from "@wechat-layout/component-registry";

export type ThemePreviewId = "editorial-minimal" | "modern-civic";

export interface ThemePreview {
  readonly category: string;
  readonly colors: readonly [string, string, string];
  readonly description: string;
  readonly id: ThemePreviewId;
  readonly name: string;
  readonly scenes: readonly string[];
}

export const V0_THEME_PREVIEWS: readonly ThemePreview[] = [
  {
    id: "editorial-minimal",
    name: "高级极简",
    category: "通用编辑",
    description: "强调留白、字阶与细线分隔，让长文保持安静、稳定的阅读节奏。",
    colors: ["#18181b", "#f5f5f4", "#4f46e5"],
    scenes: ["长文", "观点", "访谈"],
  },
  {
    id: "modern-civic",
    name: "现代政务红",
    category: "党政纪检",
    description: "以克制的深红作为信息锚点，适合正式通知、政策解读和纪检内容。",
    colors: ["#8f1d22", "#fff8f4", "#2f2525"],
    scenes: ["政务", "政策", "纪检"],
  },
] as const;

export const COMPONENT_CATALOG_GROUPS = [
  "高级模块",
  "SVG装饰",
  "图集模块",
  "一级标题",
  "二级标题",
  "引用",
  "提示",
  "数据卡",
  "图片样式",
  "分割线",
  "文末",
] as const;

export type ComponentCatalogGroup = (typeof COMPONENT_CATALOG_GROUPS)[number];

export interface ComponentPreview {
  readonly asset: OfficialComponentAsset;
  readonly category: ComponentCatalogGroup;
  readonly description: string;
  readonly id: string;
  readonly layoutKey: OfficialComponentPreview["layoutKey"];
  readonly name: string;
  readonly version: string;
}

function componentGroup(asset: OfficialComponentAsset): ComponentCatalogGroup {
  const label = asset.preview.categoryLabel;
  if ((COMPONENT_CATALOG_GROUPS as readonly string[]).includes(label)) {
    return label as ComponentCatalogGroup;
  }

  switch (asset.preview.layoutKey) {
    case "heading":
      return asset.manifest.semanticRoles.some((role) => role.includes("level1"))
        ? "一级标题"
        : "二级标题";
    case "quote":
      return "引用";
    case "notice":
      return "提示";
    case "data":
      return "数据卡";
    case "image":
      return "图片样式";
    case "divider":
      return "分割线";
    case "footer":
      return "文末";
    case "visual":
      return "高级模块";
  }
}

export const V0_COMPONENT_PREVIEWS: readonly ComponentPreview[] = Object.freeze(
  OFFICIAL_COMPONENT_ASSETS.map((asset) => ({
    asset,
    category: componentGroup(asset),
    description: asset.preview.description,
    id: asset.manifest.componentId,
    layoutKey: asset.preview.layoutKey,
    name: asset.preview.name,
    version: asset.manifest.version,
  })),
);
