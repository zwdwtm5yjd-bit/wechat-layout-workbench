import {
  OFFICIAL_VISUAL_ASSETS,
  type OfficialVisualAsset,
  type VisualAssetStyle,
} from "@wechat-layout/component-registry";
import type {
  BlockNode,
  DocNode,
  DocumentV1,
  StyleOverrides,
} from "@wechat-layout/document-schema";

import type { OfficialTheme } from "./themes/client";

export type LayoutPlanId = "clarity" | "editorial" | "impact";

export interface LayoutAnalysis {
  readonly characterCount: number;
  readonly headingCount: number;
  readonly imageCount: number;
  readonly missingImageCount: number;
  readonly paragraphCount: number;
  readonly quoteCount: number;
}

export interface LayoutPlan {
  readonly accentColors: readonly string[];
  readonly assetStyle: VisualAssetStyle;
  readonly description: string;
  readonly highlights: readonly string[];
  readonly id: LayoutPlanId;
  readonly name: string;
  readonly recommended: boolean;
  readonly theme: OfficialTheme | null;
  readonly themeName: string;
  readonly tone: string;
}

function textFromNode(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  const record = node as { readonly content?: readonly unknown[]; readonly text?: unknown };
  return `${typeof record.text === "string" ? record.text : ""}${
    record.content?.map(textFromNode).join("") ?? ""
  }`;
}

export function analyzeDocumentLayout(document: DocumentV1): LayoutAnalysis {
  const topLevel = document.content.content;
  const characterCount = textFromNode(document.content).replaceAll(/\s/gu, "").length;
  const imageCount = topLevel.filter((node) => node.type === "imageBlock").length;
  const headingCount = topLevel.filter((node) => node.type === "heading").length;
  const paragraphCount = topLevel.filter((node) => node.type === "paragraph").length;
  const quoteCount = topLevel.filter((node) => node.type === "blockquote").length;
  const recommendedImageCount = Math.max(1, Math.ceil(characterCount / 700));
  return {
    characterCount,
    headingCount,
    imageCount,
    missingImageCount: Math.max(0, recommendedImageCount - imageCount),
    paragraphCount,
    quoteCount,
  };
}

function findTheme(
  themes: readonly OfficialTheme[],
  names: readonly string[],
): OfficialTheme | null {
  for (const name of names) {
    const theme = themes.find((candidate) => candidate.manifest.name === name);
    if (theme !== undefined) return theme;
  }
  return themes.find((theme) => theme.manifest.isDefault) ?? themes[0] ?? null;
}

function contentDirection(document: DocumentV1): {
  readonly style: VisualAssetStyle;
  readonly themeNames: readonly string[];
} {
  const text = textFromNode(document.content).toLocaleLowerCase("zh-CN");
  const includes = (...terms: readonly string[]) => terms.some((term) => text.includes(term));
  if (includes("党建", "党委", "会议", "工作总结", "巡察", "国企")) {
    return { style: "civic-red", themeNames: ["现代政务红", "节日红金"] };
  }
  if (includes("科技", "ai", "人工智能", "发布会", "创新", "数字化")) {
    return { style: "tech-blue", themeNames: ["科技蓝金", "高级极简"] };
  }
  if (includes("校园", "学生", "开学", "课程", "教育", "招生")) {
    return { style: "childlike-education", themeNames: ["校园青春", "夏日森系"] };
  }
  if (includes("旅行", "城市", "风景", "露营", "户外")) {
    return { style: "botanical-nature", themeNames: ["旅行杂志", "夏日森系"] };
  }
  if (includes("美食", "餐厅", "菜", "味道", "烘焙")) {
    return { style: "warm-lifestyle", themeNames: ["食味暖橙", "高级极简"] };
  }
  if (includes("春节", "中秋", "端午", "国庆", "节日", "元宵")) {
    return { style: "festival-heritage", themeNames: ["节日红金", "国风雅韵"] };
  }
  if (includes("国风", "传统文化", "诗", "节气", "非遗", "书法")) {
    return { style: "oriental-ink", themeNames: ["国风雅韵", "高级极简"] };
  }
  return { style: "premium-business", themeNames: ["科技蓝金", "高级极简"] };
}

export function createLayoutPlans(
  document: DocumentV1,
  themes: readonly OfficialTheme[],
): readonly LayoutPlan[] {
  const direction = contentDirection(document);
  const definitions = [
    {
      id: "clarity" as const,
      name: "清晰专业",
      tone: "稳妥耐读",
      description: "用清楚的标题层级、留白和细分隔建立阅读秩序，适合通知、总结和通用长文。",
      themeNames: ["高级极简"],
      assetStyle: "editorial-geometric" as const,
      highlights: ["保留全部原文", "统一三级标题", "克制装饰与段距"],
    },
    {
      id: "editorial" as const,
      name: "杂志叙事",
      tone: "图文有节奏",
      description: "强化导语、章节转场和图片节奏，适合人物、品牌故事、活动回顾与旅行内容。",
      themeNames: ["人物专访", "旅行杂志"],
      assetStyle: "editorial-geometric" as const,
      highlights: ["增加头图氛围", "章节转场装饰", "更宽松的阅读节奏"],
    },
    {
      id: "impact" as const,
      name: "强视觉品牌",
      tone: "更有记忆点",
      description: "根据正文关键词匹配主题色和主视觉，让重点标题、引用和章节入口更醒目。",
      themeNames: direction.themeNames,
      assetStyle: direction.style,
      highlights: ["内容方向匹配", "主视觉自动加入", "重点信息强强调"],
    },
  ];
  return definitions.map((definition, index): LayoutPlan => {
    const theme = findTheme(themes, definition.themeNames);
    return {
      ...definition,
      accentColors: theme?.preview.accentColors ?? ["#18181b", "#f7f7f5", "#4f46e5"],
      recommended: index === 2,
      theme,
      themeName: theme?.manifest.name ?? definition.themeNames[0] ?? "高级极简",
    };
  });
}

function blockId(): string {
  const value =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `block_layout_${value}`;
}

function planStyle(node: BlockNode, plan: LayoutPlan): StyleOverrides {
  const primary = plan.accentColors[0] ?? "#18181b";
  const surface = plan.accentColors[1] ?? "#f7f7f5";
  const accent = plan.accentColors[2] ?? "#4f46e5";
  if (node.type === "heading") {
    if (plan.id === "impact") {
      return {
        backgroundColor: surface,
        borderColor: primary,
        borderRadius: 8,
        borderStyle: "solid",
        borderWidth: node.attrs.level === 1 ? 0 : 1,
        fontWeight: 700,
        marginBottom: node.attrs.level === 1 ? 32 : 20,
        marginTop: node.attrs.level === 1 ? 8 : 30,
        paddingBottom: node.attrs.level === 1 ? 16 : 10,
        paddingLeft: node.attrs.level === 1 ? 0 : 14,
        paddingRight: node.attrs.level === 1 ? 0 : 14,
        paddingTop: node.attrs.level === 1 ? 16 : 10,
        textAlign: node.attrs.level === 1 ? "center" : "left",
        textColor: primary,
      };
    }
    return {
      borderColor: accent,
      borderStyle: "solid",
      borderWidth: node.attrs.level === 1 ? 0 : 1,
      fontWeight: 700,
      marginBottom: node.attrs.level === 1 ? 30 : 18,
      marginTop: node.attrs.level === 1 ? 8 : plan.id === "editorial" ? 34 : 28,
      paddingBottom: node.attrs.level === 1 ? 12 : 8,
      paddingLeft: node.attrs.level === 1 ? 0 : 12,
      textAlign: node.attrs.level === 1 || plan.id === "editorial" ? "center" : "left",
      textColor: primary,
    };
  }
  if (node.type === "paragraph") {
    return {
      lineHeight: plan.id === "editorial" ? 1.95 : 1.8,
      marginBottom: plan.id === "editorial" ? 24 : 20,
      textAlign: "justify",
    };
  }
  if (node.type === "blockquote") {
    return {
      backgroundColor: surface,
      borderColor: accent,
      borderRadius: plan.id === "clarity" ? 2 : 10,
      borderStyle: "solid",
      borderWidth: 1,
      marginBottom: 24,
      marginTop: 24,
      paddingBottom: 18,
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 18,
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return { lineHeight: 1.8, marginBottom: 22, paddingLeft: 18 };
  }
  if (node.type === "imageBlock") {
    return { marginBottom: 24, marginTop: 18 };
  }
  return {};
}

function heroAsset(plan: LayoutPlan): OfficialVisualAsset {
  return (
    OFFICIAL_VISUAL_ASSETS.find(
      (asset) =>
        asset.motion === "static" && asset.style === plan.assetStyle && asset.function === "hero",
    ) ??
    OFFICIAL_VISUAL_ASSETS.find((asset) => asset.motion === "static" && asset.function === "hero")!
  );
}

function dividerAsset(plan: LayoutPlan): OfficialVisualAsset {
  return (
    OFFICIAL_VISUAL_ASSETS.find(
      (asset) =>
        asset.motion === "static" &&
        asset.style === plan.assetStyle &&
        asset.function === "divider",
    ) ??
    OFFICIAL_VISUAL_ASSETS.find(
      (asset) => asset.motion === "static" && asset.function === "divider",
    )!
  );
}

export function applyLayoutPlanToDocument(document: DocumentV1, plan: LayoutPlan): DocumentV1 {
  const originalBlocks = document.content.content.filter(
    (node) => node.attrs.semanticRole !== "layout_plan_generated",
  );
  const styledBlocks = originalBlocks.map((node) => ({
    ...structuredClone(node),
    attrs: {
      ...structuredClone(node.attrs),
      styleRef: `layout.${plan.id}`,
      styleOverrides: {
        ...structuredClone(node.attrs.styleOverrides ?? {}),
        ...planStyle(node, plan),
      },
    },
  })) as DocNode["content"];
  const result: DocNode["content"] = [];
  const hero = heroAsset(plan);
  const divider = dividerAsset(plan);
  let heroInserted = false;

  for (const node of styledBlocks) {
    if (node.type === "heading" && node.attrs.level === 2 && result.length > 0) {
      result.push({
        type: "imageBlock",
        attrs: {
          alt: `${plan.name}章节分隔`,
          blockId: blockId(),
          compatibilityLevel: "safe",
          locked: false,
          objectFit: "contain",
          resourceId: divider.resourceId,
          semanticRole: "layout_plan_generated",
          widthMode: "full",
        },
      });
    }
    result.push(node);
    if (!heroInserted && node.type === "heading" && node.attrs.level === 1) {
      result.push({
        type: "imageBlock",
        attrs: {
          alt: `${plan.name}主视觉`,
          blockId: blockId(),
          compatibilityLevel: "safe",
          locked: false,
          objectFit: "contain",
          resourceId: hero.resourceId,
          semanticRole: "layout_plan_generated",
          widthMode: "full",
        },
      });
      heroInserted = true;
    }
  }
  if (!heroInserted) {
    result.unshift({
      type: "imageBlock",
      attrs: {
        alt: `${plan.name}主视觉`,
        blockId: blockId(),
        compatibilityLevel: "safe",
        locked: false,
        objectFit: "contain",
        resourceId: hero.resourceId,
        semanticRole: "layout_plan_generated",
        widthMode: "full",
      },
    });
  }

  return {
    ...structuredClone(document),
    content: { type: "doc", content: result },
    meta: { ...structuredClone(document.meta), updatedAt: new Date().toISOString() },
  };
}
