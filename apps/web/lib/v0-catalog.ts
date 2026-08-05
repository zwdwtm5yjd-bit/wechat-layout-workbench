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

export const EDITOR_COMPONENT_SECTIONS = [
  { id: "heading", label: "标题" },
  { id: "card", label: "卡片" },
  { id: "image", label: "图片" },
  { id: "layout", label: "布局" },
  { id: "svg", label: "SVG" },
  { id: "utility", label: "组件" },
  { id: "popular", label: "热门" },
] as const;

export type EditorComponentSection = (typeof EDITOR_COMPONENT_SECTIONS)[number]["id"];

export const EDITOR_COMPONENT_SECTION_DETAILS: Readonly<
  Partial<Record<EditorComponentSection, readonly ComponentCatalogGroup[]>>
> = {
  heading: ["一级标题", "二级标题"],
  card: ["引用", "提示", "数据卡"],
  image: ["图片样式", "图集模块"],
  utility: ["分割线", "文末"],
};

export const EDITOR_COMPONENT_SCENES = [
  { id: "all", label: "全部场景" },
  { id: "longform", label: "通用长文" },
  { id: "formal", label: "政务正式" },
  { id: "business", label: "商务科技" },
  { id: "culture", label: "国风节庆" },
  { id: "brand", label: "品牌人物" },
  { id: "lifestyle", label: "旅行生活" },
  { id: "event", label: "活动教育" },
] as const;

export type EditorComponentScene = (typeof EDITOR_COMPONENT_SCENES)[number]["id"];

const POPULAR_COMPONENT_IDS = new Set([
  "cmp_head_level1_leftbar_001",
  "cmp_head_level1_centered_004",
  "cmp_head_level2_marker_006",
  "cmp_quote_conclusion_card_003",
  "cmp_notice_info_blue_001",
  "cmp_notice_checklist_action_005",
  "cmp_data_double_compare_002",
  "cmp_image_rounded_caption_002",
  "cmp_divider_ornament_center_003",
  "cmp_footer_qrcode_follow_002",
  "cmp_hero_ink_mountain_001",
  "cmp_head_mist_mountains_007",
  "cmp_tech_orbit_hero_001",
  "cmp_gallery_magazine_duo_002",
]);

const EDITOR_SCENE_TAGS: Readonly<Record<Exclude<EditorComponentScene, "all">, readonly string[]>> =
  {
    longform: [
      "general",
      "longform",
      "editorial",
      "opinion",
      "interview",
      "analysis",
      "documentation",
    ],
    formal: ["government", "legal", "report", "meeting", "party_building", "notice", "risk"],
    business: ["technology", "product", "summit", "data", "brand", "financial"],
    culture: [
      "culture",
      "festival",
      "heritage",
      "solar_term",
      "spring_festival",
      "new_year",
      "poetry",
    ],
    brand: ["brand", "person", "portrait", "personal_brand", "story"],
    lifestyle: ["travel", "nature", "summer", "autumn", "lifestyle", "photography"],
    event: ["event", "campus", "guide", "tutorial", "process", "checklist", "opening"],
  };

export interface ComponentPreview {
  readonly asset: OfficialComponentAsset;
  readonly category: ComponentCatalogGroup;
  readonly description: string;
  readonly id: string;
  readonly layoutKey: OfficialComponentPreview["layoutKey"];
  readonly name: string;
  readonly version: string;
}

export function editorComponentSection(component: ComponentPreview): EditorComponentSection {
  if (component.category === "一级标题" || component.category === "二级标题") return "heading";
  if (["引用", "提示", "数据卡"].includes(component.category)) return "card";
  if (component.category === "图片样式" || component.category === "图集模块") return "image";
  if (component.category === "SVG装饰") return "svg";
  if (component.category === "高级模块") return "layout";
  return "utility";
}

export function isPopularEditorComponent(component: ComponentPreview): boolean {
  return POPULAR_COMPONENT_IDS.has(component.id);
}

export function componentMatchesEditorScene(
  component: ComponentPreview,
  scene: EditorComponentScene,
): boolean {
  if (scene === "all") return true;
  const scenarios = component.asset.manifest.scenarios ?? [];
  return EDITOR_SCENE_TAGS[scene].some((tag) => scenarios.includes(tag));
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
