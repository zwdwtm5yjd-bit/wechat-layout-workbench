import {
  OFFICIAL_VISUAL_ASSETS,
  type OfficialVisualAsset,
  type VisualAssetStyle,
} from "@wechat-layout/component-registry";
import type {
  BlockNode,
  DocNode,
  DocumentV1,
  ParagraphNode,
  StyleOverrides,
} from "@wechat-layout/document-schema";

import type { OfficialTheme } from "./themes/client";

export type LayoutDesignMode = "preset" | "described" | "original";
export type LayoutPlanId = `${LayoutDesignMode}:${string}`;
export type DesignLanguageId =
  "minimal-blue" | "warm-paper" | "night-cyan" | "forest-green" | "crimson-editorial" | "ink-gold";
export type ArticleType = "tutorial" | "list" | "opinion" | "interview" | "data" | "essay" | "case";
export type ArticleEmotion = "calm" | "passionate" | "warm" | "authoritative" | "light";

export interface ArticleGene {
  readonly articleType: ArticleType;
  readonly articleTypeLabel: string;
  readonly density: "compact" | "balanced" | "airy";
  readonly emotion: ArticleEmotion;
  readonly emotionLabel: string;
  readonly keywords: readonly string[];
  readonly seed: number;
  readonly structureSignals: readonly string[];
  readonly summary: string;
}

export interface LayoutAnalysis {
  readonly characterCount: number;
  readonly gene: ArticleGene;
  readonly headingCount: number;
  readonly imageCount: number;
  readonly missingImageCount: number;
  readonly paragraphCount: number;
  readonly quoteCount: number;
}

export interface LayoutPlan {
  readonly accentColors: readonly [string, string, string];
  readonly articleGene: ArticleGene;
  readonly assetStyle: VisualAssetStyle;
  readonly brief: string | null;
  readonly description: string;
  readonly designName: string;
  readonly highlights: readonly string[];
  readonly id: LayoutPlanId;
  readonly imageNeed: number;
  readonly languageId: DesignLanguageId;
  readonly languageName: string;
  readonly mode: LayoutDesignMode;
  readonly name: string;
  readonly reasoning: string;
  readonly recommended: boolean;
  readonly theme: OfficialTheme | null;
  readonly themeName: string;
  readonly tone: string;
  readonly visualVariant: 0 | 1 | 2;
}

interface DesignLanguageDefinition {
  readonly assetStyle: VisualAssetStyle;
  readonly description: string;
  readonly emotions: readonly ArticleEmotion[];
  readonly id: DesignLanguageId;
  readonly name: string;
  readonly palette: readonly [string, string, string];
  readonly themeNames: readonly string[];
  readonly tone: string;
  readonly types: readonly ArticleType[];
}

export const DESIGN_LANGUAGES: readonly DesignLanguageDefinition[] = [
  {
    id: "minimal-blue",
    name: "极简蓝",
    tone: "克制、理性、清晰",
    description: "蓝色只做阅读路标，用字阶、留白和细分隔组织知识内容。",
    palette: ["#2563EB", "#F5F7FA", "#1A1A2E"],
    themeNames: ["极简蓝", "高级极简"],
    assetStyle: "editorial-geometric",
    types: ["tutorial", "list", "data"],
    emotions: ["calm", "authoritative"],
  },
  {
    id: "warm-paper",
    name: "暖纸墨",
    tone: "温暖、杂志、人文",
    description: "用纸色、墨色和陶土锚点建立可慢慢翻阅的杂志节奏。",
    palette: ["#B8532A", "#F7F0E6", "#4A3728"],
    themeNames: ["暖纸墨", "人物专访", "食味暖橙"],
    assetStyle: "warm-lifestyle",
    types: ["opinion", "essay", "interview"],
    emotions: ["warm", "calm"],
  },
  {
    id: "night-cyan",
    name: "暗夜青",
    tone: "科技、终端、数据",
    description: "深空底色降低噪音，青色像仪表灯一样标记代码、步骤和关键数据。",
    palette: ["#00D4AA", "#252540", "#E8E8F0"],
    themeNames: ["暗夜青", "科技蓝金"],
    assetStyle: "tech-blue",
    types: ["tutorial", "data", "case"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "forest-green",
    name: "森语绿",
    tone: "自然、安静、留白",
    description: "降低视觉焦点密度，用更宽松的段距和灰绿层级让文字自由呼吸。",
    palette: ["#4A7C59", "#F5F7F3", "#2C3A2E"],
    themeNames: ["森语绿", "夏日森系"],
    assetStyle: "botanical-nature",
    types: ["essay", "opinion", "interview"],
    emotions: ["calm", "warm"],
  },
  {
    id: "crimson-editorial",
    name: "绯红编",
    tone: "编辑、权威、结构",
    description: "以极少量绯红作为编辑标记，让案例、报告和观点更容易快速扫描。",
    palette: ["#C1292E", "#FEF9F7", "#1A1210"],
    themeNames: ["绯红编", "现代政务红"],
    assetStyle: "civic-red",
    types: ["case", "data", "opinion"],
    emotions: ["authoritative", "passionate"],
  },
  {
    id: "ink-gold",
    name: "墨金雅",
    tone: "深沉、经典、收藏感",
    description: "极深暖灰托住长文，只把有限的金色留给最重要的几个阅读瞬间。",
    palette: ["#C9A96E", "#252525", "#D4D0C8"],
    themeNames: ["墨金雅", "人物专访", "国风雅韵"],
    assetStyle: "oriental-ink",
    types: ["interview", "essay", "case"],
    emotions: ["authoritative", "calm"],
  },
];

const ARTICLE_TYPE_LABELS: Readonly<Record<ArticleType, string>> = {
  tutorial: "教程方法",
  list: "盘点清单",
  opinion: "观点分析",
  interview: "人物访谈",
  data: "数据报告",
  essay: "随笔叙事",
  case: "案例复盘",
};

const EMOTION_LABELS: Readonly<Record<ArticleEmotion, string>> = {
  calm: "沉静理性",
  passionate: "有力热烈",
  warm: "温暖亲近",
  authoritative: "专业权威",
  light: "轻快活泼",
};

const TYPE_TERMS: Readonly<Record<ArticleType, readonly string[]>> = {
  tutorial: ["教程", "步骤", "方法", "如何", "操作", "指南", "攻略", "第一步", "第二步"],
  list: ["盘点", "清单", "推荐", "几个", "种方法", "大重点", "合集"],
  opinion: ["观点", "认为", "本质", "不是", "而是", "为什么", "真正", "意味着"],
  interview: ["访谈", "专访", "对话", "问：", "答：", "人物", "故事"],
  data: ["数据", "报告", "同比", "增长", "下降", "比例", "调查", "%", "统计"],
  essay: ["随笔", "散文", "生活", "记得", "那天", "时光", "心里", "我们"],
  case: ["案例", "复盘", "项目", "实践", "经验", "结果", "问题", "解决"],
};

const EMOTION_TERMS: Readonly<Record<ArticleEmotion, readonly string[]>> = {
  calm: ["思考", "观察", "分析", "理解", "安静", "慢慢", "沉淀"],
  passionate: ["突破", "使命", "奋斗", "必须", "未来", "全力", "增长", "！"],
  warm: ["温暖", "陪伴", "感谢", "生活", "家", "我们", "愿你", "喜欢"],
  authoritative: ["报告", "研究", "数据", "标准", "机制", "政策", "结论", "实践"],
  light: ["有趣", "轻松", "可爱", "快乐", "玩", "打卡", "惊喜", "哈哈"],
};

const KEYWORD_TERMS = [
  "人工智能",
  "AI",
  "数字化",
  "科技",
  "教育",
  "校园",
  "党建",
  "政务",
  "文化",
  "品牌",
  "旅行",
  "自然",
  "美食",
  "健康",
  "数据",
  "案例",
  "方法",
  "人物",
  "活动",
] as const;

function textFromNode(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  const record = node as { readonly content?: readonly unknown[]; readonly text?: unknown };
  return `${typeof record.text === "string" ? record.text : ""}${
    record.content?.map(textFromNode).join("") ?? ""
  }`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function bestMatch<T extends string>(
  text: string,
  groups: Readonly<Record<T, readonly string[]>>,
  fallback: T,
  bonus: Partial<Record<T, number>> = {},
): T {
  let selected = fallback;
  let selectedScore = -1;
  for (const [key, terms] of Object.entries(groups) as [T, readonly string[]][]) {
    const score =
      terms.reduce(
        (total, term) =>
          total +
          (text.toLocaleLowerCase("zh-CN").includes(term.toLocaleLowerCase("zh-CN")) ? 1 : 0),
        0,
      ) + (bonus[key] ?? 0);
    if (score > selectedScore) {
      selected = key;
      selectedScore = score;
    }
  }
  return selected;
}

function articleGene(document: DocumentV1): ArticleGene {
  const topLevel = document.content.content;
  const text = textFromNode(document.content);
  const compactText = text.replaceAll(/\s/gu, "");
  const headingCount = topLevel.filter((node) => node.type === "heading").length;
  const listCount = topLevel.filter(
    (node) => node.type === "bulletList" || node.type === "orderedList",
  ).length;
  const imageCount = topLevel.filter((node) => node.type === "imageBlock").length;
  const quoteCount = topLevel.filter((node) => node.type === "blockquote").length;
  const paragraphCount = Math.max(1, topLevel.filter((node) => node.type === "paragraph").length);
  const numericCount = (compactText.match(/\d+(?:\.\d+)?(?:%|万|亿|倍|年|个|项)?/gu) ?? []).length;
  const articleType = bestMatch<ArticleType>(text, TYPE_TERMS, "opinion", {
    tutorial: listCount > 0 ? 2 : 0,
    data: numericCount >= 5 ? 2 : 0,
    interview: quoteCount >= 3 ? 1 : 0,
    list: listCount >= 2 ? 2 : 0,
  });
  const emotion = bestMatch<ArticleEmotion>(text, EMOTION_TERMS, "calm", {
    authoritative: articleType === "data" || articleType === "case" ? 2 : 0,
    warm: articleType === "essay" || articleType === "interview" ? 1 : 0,
  });
  const averageParagraphLength = compactText.length / paragraphCount;
  const density =
    averageParagraphLength > 150 ? "compact" : averageParagraphLength < 70 ? "airy" : "balanced";
  const structureSignals = [
    ...(headingCount > 0 ? [`${String(headingCount)} 个标题层级`] : []),
    ...(listCount > 0 ? [`${String(listCount)} 组列表/步骤`] : []),
    ...(quoteCount > 0 ? [`${String(quoteCount)} 处引用`] : []),
    ...(numericCount >= 3 ? [`${String(numericCount)} 个数据表达`] : []),
    ...(imageCount > 0 ? [`${String(imageCount)} 张已有图片`] : ["正文尚无图片"]),
  ];
  const keywords = KEYWORD_TERMS.filter((term) =>
    text.toLocaleLowerCase("zh-CN").includes(term.toLocaleLowerCase("zh-CN")),
  ).slice(0, 5);
  const articleTypeLabel = ARTICLE_TYPE_LABELS[articleType];
  const emotionLabel = EMOTION_LABELS[emotion];
  return {
    articleType,
    articleTypeLabel,
    emotion,
    emotionLabel,
    density,
    keywords,
    seed: stableHash(compactText || document.documentId),
    structureSignals,
    summary: `识别为“${articleTypeLabel}”，整体情绪偏“${emotionLabel}”，信息密度${
      density === "compact" ? "较高" : density === "airy" ? "舒展" : "适中"
    }。`,
  };
}

export function analyzeDocumentLayout(document: DocumentV1): LayoutAnalysis {
  const topLevel = document.content.content;
  const characterCount = textFromNode(document.content).replaceAll(/\s/gu, "").length;
  const imageCount = topLevel.filter((node) => node.type === "imageBlock").length;
  const headingCount = topLevel.filter((node) => node.type === "heading").length;
  const paragraphCount = topLevel.filter((node) => node.type === "paragraph").length;
  const quoteCount = topLevel.filter((node) => node.type === "blockquote").length;
  const gene = articleGene(document);
  const typeMultiplier =
    gene.articleType === "essay" || gene.articleType === "interview" ? 560 : 700;
  const recommendedImageCount = Math.max(1, Math.ceil(characterCount / typeMultiplier));
  return {
    characterCount,
    gene,
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

function languageScore(language: DesignLanguageDefinition, gene: ArticleGene): number {
  return (
    (language.types.includes(gene.articleType) ? 6 : 0) +
    (language.emotions.includes(gene.emotion) ? 3 : 0) +
    ((gene.keywords.includes("科技") || gene.keywords.includes("AI")) &&
    language.id === "night-cyan"
      ? 4
      : 0) +
    ((gene.keywords.includes("党建") || gene.keywords.includes("政务")) &&
    language.id === "crimson-editorial"
      ? 5
      : 0) +
    (gene.density === "airy" && language.id === "forest-green" ? 2 : 0) +
    (gene.seed % 7) / 100
  );
}

function recommendedLanguage(gene: ArticleGene): DesignLanguageDefinition {
  return DESIGN_LANGUAGES.toSorted(
    (left, right) => languageScore(right, gene) - languageScore(left, gene),
  )[0]!;
}

function languageFromBrief(brief: string, gene: ArticleGene): DesignLanguageDefinition {
  const normalized = brief.toLocaleLowerCase("zh-CN");
  const rules: readonly [DesignLanguageId, readonly string[]][] = [
    ["night-cyan", ["暗色", "深色", "科技", "终端", "霓虹", "未来", "黑底", "数据"]],
    ["ink-gold", ["高端", "奢华", "金色", "经典", "收藏", "深沉", "品牌", "访谈"]],
    ["warm-paper", ["温暖", "杂志", "纸张", "人文", "复古", "棕色", "故事"]],
    ["forest-green", ["自然", "绿色", "安静", "留白", "森系", "清新", "治愈"]],
    ["crimson-editorial", ["红色", "权威", "报告", "政务", "编辑", "报刊", "正式"]],
    ["minimal-blue", ["简洁", "极简", "蓝色", "清晰", "理性", "专业", "教程"]],
  ];
  const matched = rules
    .map(([id, terms]) => ({
      language: DESIGN_LANGUAGES.find((candidate) => candidate.id === id)!,
      score: terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0),
    }))
    .toSorted((left, right) => right.score - left.score)[0];
  return matched !== undefined && matched.score > 0 ? matched.language : recommendedLanguage(gene);
}

function originalDesignName(gene: ArticleGene, language: DesignLanguageDefinition): string {
  const prefixes: Readonly<Record<ArticleEmotion, readonly string[]>> = {
    calm: ["静水", "深读", "留白"],
    passionate: ["燃点", "向前", "破浪"],
    warm: ["微光", "暖笺", "相遇"],
    authoritative: ["坐标", "定标", "洞见"],
    light: ["晴日", "跳格", "轻风"],
  };
  const suffixes: Readonly<Record<ArticleType, readonly string[]>> = {
    tutorial: ["路径", "工作台", "行动图"],
    list: ["索引", "收藏夹", "图鉴"],
    opinion: ["论场", "观察册", "思考线"],
    interview: ["人物志", "对话录", "侧影"],
    data: ["仪表盘", "信号场", "数据志"],
    essay: ["手记", "慢读本", "叙事页"],
    case: ["复盘册", "作战图", "案例档案"],
  };
  const prefixOptions = prefixes[gene.emotion];
  const suffixOptions = suffixes[gene.articleType];
  const prefix = prefixOptions[gene.seed % prefixOptions.length]!;
  const suffix = suffixOptions[Math.floor(gene.seed / 7) % suffixOptions.length]!;
  return `${prefix}·${suffix}（${language.name}基因）`;
}

function planFor(
  analysis: LayoutAnalysis,
  themes: readonly OfficialTheme[],
  language: DesignLanguageDefinition,
  mode: LayoutDesignMode,
  recommended: boolean,
  brief: string | null,
  index: number,
): LayoutPlan {
  const { gene } = analysis;
  const theme = findTheme(themes, language.themeNames);
  const originalName = originalDesignName(gene, language);
  const designName =
    mode === "original"
      ? originalName
      : mode === "described"
        ? `你的风格 · ${language.name}`
        : `${language.name} · ${gene.articleTypeLabel}`;
  const quotedBrief = brief === null ? null : brief.trim().slice(0, 56);
  const reasoning =
    mode === "described" && quotedBrief !== ""
      ? `你的描述“${quotedBrief}”与${language.name}的视觉基因最接近；同时文章属于${gene.articleTypeLabel}，因此保留清晰的内容层级。`
      : `${gene.summary}${language.name}在${gene.articleTypeLabel}中的组件节奏与“${gene.emotionLabel}”情绪匹配。`;
  const visualVariant = ((gene.seed + index + (mode === "original" ? 2 : 0)) % 3) as 0 | 1 | 2;
  return {
    id: `${mode}:${language.id}${mode === "original" ? `-${String(gene.seed)}` : ""}`,
    mode,
    languageId: language.id,
    languageName: language.name,
    name: designName,
    designName,
    tone: language.tone,
    description:
      mode === "original"
        ? `不套固定样式：根据正文的章节密度、金句候选和图片缺口，生成一套只属于当前文章的“${originalName}”。`
        : mode === "described"
          ? `把你的风格描述翻译成可在公众号稳定渲染的标题、正文、引用、图片和章节节奏。`
          : language.description,
    reasoning,
    highlights: [
      `识别：${gene.articleTypeLabel} · ${gene.emotionLabel}`,
      analysis.quoteCount > 0
        ? `重排 ${String(analysis.quoteCount)} 处已有引用`
        : "从正文中识别 1–2 处金句",
      analysis.missingImageCount > 0
        ? `建议补充 ${String(analysis.missingImageCount)} 张内容图片`
        : "沿用现有图片节奏",
      "微信安全样式与原文保护",
    ],
    accentColors: language.palette,
    assetStyle: language.assetStyle,
    articleGene: gene,
    imageNeed: analysis.missingImageCount,
    brief: quotedBrief === "" ? null : quotedBrief,
    recommended,
    theme,
    themeName: theme?.manifest.name ?? language.themeNames[0] ?? language.name,
    visualVariant,
  };
}

export function createLayoutPlans(
  document: DocumentV1,
  themes: readonly OfficialTheme[],
  options: { readonly brief?: string; readonly mode?: LayoutDesignMode } = {},
): readonly LayoutPlan[] {
  const analysis = analyzeDocumentLayout(document);
  const mode = options.mode ?? "preset";
  const recommended = recommendedLanguage(analysis.gene);
  if (mode === "described") {
    const brief = options.brief?.trim() ?? "";
    const language = languageFromBrief(brief, analysis.gene);
    return [planFor(analysis, themes, language, mode, true, brief, 0)];
  }
  if (mode === "original") {
    return [planFor(analysis, themes, recommended, mode, true, null, 0)];
  }
  return DESIGN_LANGUAGES.map((language, index) =>
    planFor(analysis, themes, language, mode, language.id === recommended.id, null, index),
  );
}

function blockId(): string {
  const value =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `block_layout_${value}`;
}

const BODY_COLORS: Readonly<Record<DesignLanguageId, string>> = {
  "minimal-blue": "#333333",
  "warm-paper": "#4A3728",
  "night-cyan": "#D0D0D0",
  "forest-green": "#3A4A3E",
  "crimson-editorial": "#2A2218",
  "ink-gold": "#D4D0C8",
};

function languageRhythm(plan: LayoutPlan): {
  readonly bodyGap: number;
  readonly headingGap: number;
  readonly lineHeight: number;
  readonly radius: number;
} {
  switch (plan.languageId) {
    case "forest-green":
      return { bodyGap: 22, headingGap: 40, lineHeight: 1.9, radius: 6 };
    case "ink-gold":
      return { bodyGap: 20, headingGap: 36, lineHeight: 1.9, radius: 4 };
    case "warm-paper":
      return { bodyGap: 18, headingGap: 34, lineHeight: 1.85, radius: 4 };
    case "night-cyan":
      return { bodyGap: 18, headingGap: 32, lineHeight: 1.85, radius: 8 };
    case "crimson-editorial":
      return { bodyGap: 16, headingGap: 32, lineHeight: 1.85, radius: 3 };
    default:
      return { bodyGap: 18, headingGap: 32, lineHeight: 1.85, radius: 6 };
  }
}

function planStyle(node: BlockNode, plan: LayoutPlan): StyleOverrides {
  const [accent, surface, title] = plan.accentColors;
  const rhythm = languageRhythm(plan);
  const body = BODY_COLORS[plan.languageId];
  if (node.type === "heading") {
    const levelOne = node.attrs.level === 1;
    const quietHeading = plan.languageId === "forest-green" || plan.languageId === "ink-gold";
    const sectionSurface =
      levelOne || quietHeading || plan.visualVariant === 2 ? undefined : surface;
    return {
      ...(sectionSurface === undefined ? {} : { backgroundColor: sectionSurface }),
      borderColor: levelOne ? surface : accent,
      borderRadius: levelOne ? 0 : rhythm.radius,
      borderStyle: "solid",
      borderWidth: levelOne || quietHeading ? 0 : 1,
      fontSize: levelOne ? 26 : node.attrs.level === 2 ? 20 : 17,
      fontWeight: plan.languageId === "forest-green" ? 500 : levelOne ? 700 : 600,
      letterSpacing: plan.languageId === "ink-gold" ? 0.5 : 0.3,
      lineHeight: levelOne ? 1.4 : 1.5,
      marginBottom: levelOne ? 28 : 16,
      marginTop: levelOne ? 8 : rhythm.headingGap,
      paddingBottom: levelOne || quietHeading ? 8 : 10,
      paddingLeft: levelOne || quietHeading ? 0 : 14,
      paddingRight: levelOne || quietHeading ? 0 : 14,
      paddingTop: levelOne || quietHeading ? 8 : 10,
      textAlign:
        levelOne || plan.visualVariant === 1 || plan.languageId === "warm-paper"
          ? "center"
          : "left",
      textColor: levelOne ? title : plan.languageId === "night-cyan" ? title : title,
    };
  }
  if (node.type === "paragraph") {
    return {
      fontSize: 14,
      letterSpacing: plan.languageId === "ink-gold" ? 0.5 : 0.3,
      lineHeight: rhythm.lineHeight,
      marginBottom: rhythm.bodyGap,
      textAlign: "justify",
      textColor: body,
    };
  }
  if (node.type === "blockquote") {
    return {
      backgroundColor: surface,
      borderColor: accent,
      borderRadius: rhythm.radius,
      borderStyle: "solid",
      borderWidth: plan.languageId === "forest-green" ? 1 : 2,
      marginBottom: 24,
      marginTop: 24,
      paddingBottom: 16,
      paddingLeft: 18,
      paddingRight: 18,
      paddingTop: 16,
      textColor: body,
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return {
      ...(plan.visualVariant === 0 ? { backgroundColor: surface } : {}),
      borderColor: accent,
      borderRadius: rhythm.radius,
      borderStyle: "solid",
      borderWidth: plan.visualVariant === 0 ? 1 : 0,
      lineHeight: rhythm.lineHeight,
      marginBottom: 24,
      paddingBottom: plan.visualVariant === 0 ? 14 : 0,
      paddingLeft: 20,
      paddingRight: plan.visualVariant === 0 ? 14 : 0,
      paddingTop: plan.visualVariant === 0 ? 14 : 0,
      textColor: body,
    };
  }
  if (node.type === "imageBlock") {
    return {
      borderColor: plan.languageId === "forest-green" ? surface : accent,
      borderRadius: rhythm.radius,
      borderStyle: "solid",
      borderWidth: plan.languageId === "forest-green" ? 0 : 1,
      marginBottom: 24,
      marginTop: 20,
    };
  }
  if (node.type === "divider") {
    return { borderColor: accent, marginBottom: 24, marginTop: 24 };
  }
  return {};
}

function visualAsset(
  plan: LayoutPlan,
  functionName: "divider" | "hero",
  offset: number,
): OfficialVisualAsset {
  const exact = OFFICIAL_VISUAL_ASSETS.filter(
    (asset) =>
      asset.motion === "static" &&
      asset.style === plan.assetStyle &&
      asset.function === functionName,
  );
  const fallback = OFFICIAL_VISUAL_ASSETS.filter(
    (asset) => asset.motion === "static" && asset.function === functionName,
  );
  const candidates = exact.length > 0 ? exact : fallback;
  return candidates[(plan.articleGene.seed + offset) % candidates.length]!;
}

function generatedImage(plan: LayoutPlan, functionName: "divider" | "hero", offset: number) {
  const asset = visualAsset(plan, functionName, offset);
  return {
    type: "imageBlock" as const,
    attrs: {
      alt: `${plan.designName}${functionName === "hero" ? "主视觉" : "章节转场"}`,
      blockId: blockId(),
      compatibilityLevel: "safe" as const,
      locked: false,
      objectFit: "contain" as const,
      resourceId: asset.resourceId,
      semanticRole: "layout_plan_generated",
      widthMode: "full" as const,
      styleRef: `layout.${plan.languageId}.${plan.visualVariant}`,
    },
  };
}

function unwrapGeneratedEmphasis(node: DocNode["content"][number]): DocNode["content"][number] {
  if (
    node.type === "blockquote" &&
    node.attrs.semanticRole === "layout_plan_emphasis" &&
    node.content.length === 1 &&
    node.content[0]?.type === "paragraph"
  ) {
    return structuredClone(node.content[0]);
  }
  return structuredClone(node);
}

function emphasisCandidates(blocks: readonly DocNode["content"][number][]): ReadonlySet<number> {
  const scored = blocks
    .map((node, index) => {
      if (node.type !== "paragraph") return { index, score: -1 };
      const text = textFromNode(node).trim();
      if (text.length < 12 || text.length > 100) return { index, score: -1 };
      const signalTerms = [
        "本质",
        "关键",
        "真正",
        "结论",
        "因此",
        "所以",
        "意味着",
        "数据显示",
        "不是",
        "而是",
      ];
      const signalScore = signalTerms.reduce(
        (score, term) => score + (text.includes(term) ? 3 : 0),
        0,
      );
      return {
        index,
        score: signalScore + (/[。！？]$/u.test(text) ? 1 : 0) + (text.length <= 45 ? 2 : 0),
      };
    })
    .filter((entry) => entry.score > 1)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((entry) => entry.index);
  return new Set(scored);
}

function emphasisBlock(node: ParagraphNode, plan: LayoutPlan): DocNode["content"][number] {
  return {
    type: "blockquote",
    attrs: {
      blockId: blockId(),
      compatibilityLevel: "safe",
      locked: false,
      quoteType: "standard",
      semanticRole: "layout_plan_emphasis",
      showQuotes: plan.languageId === "warm-paper" || plan.languageId === "ink-gold",
      styleRef: `layout.${plan.languageId}.quote.${plan.visualVariant}`,
      styleOverrides: planStyle(
        {
          type: "blockquote",
          attrs: { blockId: "preview", locked: false },
          content: [node],
        },
        plan,
      ),
      variant: `${plan.languageId}-${String(plan.visualVariant)}`,
    },
    content: [node],
  };
}

export function applyLayoutPlanToDocument(document: DocumentV1, plan: LayoutPlan): DocumentV1 {
  const originalBlocks = document.content.content
    .filter((node) => node.attrs.semanticRole !== "layout_plan_generated")
    .map(unwrapGeneratedEmphasis);
  const styledBlocks = originalBlocks.map((node) => ({
    ...structuredClone(node),
    attrs: {
      ...structuredClone(node.attrs),
      styleRef: `layout.${plan.languageId}.${plan.visualVariant}`,
      styleOverrides: {
        ...structuredClone(node.attrs.styleOverrides ?? {}),
        ...planStyle(node, plan),
      },
    },
  })) as DocNode["content"];
  const result: DocNode["content"] = [];
  const emphasis = emphasisCandidates(styledBlocks);
  const headingCount = styledBlocks.filter(
    (node) => node.type === "heading" && node.attrs.level === 2,
  ).length;
  const dividerCadence =
    plan.languageId === "forest-green" || plan.languageId === "ink-gold" ? 2 : 1;
  let sectionIndex = 0;
  let heroInserted = false;

  styledBlocks.forEach((node, index) => {
    if (node.type === "heading" && node.attrs.level === 2) {
      sectionIndex += 1;
      if (headingCount > 1 && result.length > 0 && (sectionIndex - 1) % dividerCadence === 0) {
        result.push(generatedImage(plan, "divider", sectionIndex));
      }
    }
    const outputNode =
      emphasis.has(index) && node.type === "paragraph" ? emphasisBlock(node, plan) : node;
    result.push(outputNode);
    if (!heroInserted && node.type === "heading" && node.attrs.level === 1) {
      result.push(generatedImage(plan, "hero", 0));
      heroInserted = true;
    }
  });
  if (!heroInserted) {
    result.unshift(generatedImage(plan, "hero", 0));
  }

  return {
    ...structuredClone(document),
    content: { type: "doc", content: result },
    meta: { ...structuredClone(document.meta), updatedAt: new Date().toISOString() },
  };
}
