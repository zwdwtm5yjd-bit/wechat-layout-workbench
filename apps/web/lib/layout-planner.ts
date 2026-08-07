import {
  findOfficialVisualAsset,
  type OfficialVisualAsset,
  type VisualAssetStyle,
} from "@wechat-layout/component-registry";
import type {
  AiLayoutComponentId,
  AiLayoutDecision,
  AiLayoutDesignLanguageId,
  AiLayoutDesignTokens,
  AiLayoutRhythm,
  AiLayoutTreatment,
  AiLayoutVisualIntensity,
} from "@wechat-layout/api-contracts";
import type {
  BlockNode,
  DividerNode,
  DocNode,
  DocumentV1,
  HeadingNode,
  ImageBlockNode,
  InlineNode,
  ParagraphNode,
  SemanticCardNode,
  StyleOverrides,
} from "@wechat-layout/document-schema";

import type { OfficialTheme } from "./themes/client";

export type LayoutDesignMode = "preset" | "described" | "original";
export type LayoutPlanId = `${LayoutDesignMode}:${string}`;
export type DesignLanguageId = AiLayoutDesignLanguageId;
export type DesignLanguageFamily =
  "civic-media" | "business-data" | "technology" | "culture-life" | "education-event";

export const DESIGN_LANGUAGE_FAMILY_LABELS: Readonly<Record<DesignLanguageFamily, string>> = {
  "civic-media": "政务传媒",
  "business-data": "商业数据",
  technology: "科技未来",
  "culture-life": "文化生活",
  "education-event": "教育活动",
};

export const DESIGN_LANGUAGE_FAMILY_BY_ID: Readonly<
  Record<DesignLanguageId, DesignLanguageFamily>
> = {
  "minimal-blue": "technology",
  "warm-paper": "culture-life",
  "night-cyan": "technology",
  "forest-green": "culture-life",
  "crimson-editorial": "civic-media",
  "ink-gold": "culture-life",
  "civic-blue": "civic-media",
  "news-editorial": "civic-media",
  "annual-report": "business-data",
  "data-dashboard": "business-data",
  "monochrome-finance": "business-data",
  "future-purple": "technology",
  "cyber-neon": "technology",
  "jade-oriental": "culture-life",
  "seasonal-poetry": "culture-life",
  "academic-journal": "education-event",
  "playful-notebook": "education-event",
  "event-poster": "education-event",
};
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
  readonly designTokens: AiLayoutDesignTokens;
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
  readonly rhythm: AiLayoutRhythm;
  readonly theme: OfficialTheme | null;
  readonly themeName: string;
  readonly tone: string;
  readonly visualVariant: 0 | 1 | 2;
  readonly visualIntensity: AiLayoutVisualIntensity;
}

interface DesignLanguageDefinition {
  readonly assetStyle: VisualAssetStyle;
  readonly description: string;
  readonly emotions: readonly ArticleEmotion[];
  readonly id: DesignLanguageId;
  readonly keywords: readonly string[];
  readonly name: string;
  readonly palette: readonly [string, string, string];
  readonly themeNames: readonly string[];
  readonly tone: string;
  readonly types: readonly ArticleType[];
}

const DARK_DESIGN_LANGUAGES = new Set<DesignLanguageId>([
  "night-cyan",
  "ink-gold",
  "annual-report",
  "data-dashboard",
  "cyber-neon",
]);

const CENTERED_TITLE_LANGUAGES = new Set<DesignLanguageId>([
  "warm-paper",
  "forest-green",
  "ink-gold",
  "jade-oriental",
  "seasonal-poetry",
  "academic-journal",
  "playful-notebook",
  "event-poster",
]);

function defaultPlanTokens(language: DesignLanguageDefinition): AiLayoutDesignTokens {
  const [primaryColor, surfaceAltColor, textColor] = language.palette;
  const dark = DARK_DESIGN_LANGUAGES.has(language.id);
  return {
    accentColor:
      language.id === "crimson-editorial"
        ? "#D29A54"
        : language.id === "annual-report"
          ? "#D7B56D"
          : language.id === "cyber-neon"
            ? "#FF3DCE"
            : primaryColor,
    bodyFontSize:
      language.id === "minimal-blue" ||
      language.id === "night-cyan" ||
      language.id === "data-dashboard" ||
      language.id === "future-purple"
        ? 14
        : 15,
    bodyLineHeight: language.id === "night-cyan" || language.id === "data-dashboard" ? 1.82 : 1.88,
    cardRadius:
      language.id === "ink-gold" || language.id === "news-editorial"
        ? 3
        : language.id === "forest-green" || language.id === "academic-journal"
          ? 4
          : language.id === "playful-notebook"
            ? 14
            : 8,
    mutedColor: dark ? "#A7B0B7" : "#667085",
    primaryColor,
    sectionSpacing: language.id === "forest-green" ? 44 : 38,
    surfaceAltColor,
    surfaceColor: dark ? (language.id === "night-cyan" ? "#0C2732" : "#171717") : "#FFFFFF",
    textColor,
    titleAlign: CENTERED_TITLE_LANGUAGES.has(language.id) ? "center" : "left",
  };
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
    keywords: ["教程", "方法", "知识", "工具", "效率"],
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
    keywords: ["人物", "故事", "生活", "人文", "品牌"],
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
    keywords: ["科技", "AI", "代码", "产品", "开发"],
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
    keywords: ["自然", "健康", "旅行", "治愈", "环保"],
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
    keywords: ["党建", "政务", "纪检", "会议", "报告"],
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
    keywords: ["文化", "国风", "人物", "历史", "传承"],
    types: ["interview", "essay", "case"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "civic-blue",
    name: "蓝白政务",
    tone: "清正、秩序、公信",
    description: "以蓝白公文秩序组织政策解读、工作动态和会议材料，稳重但不沉闷。",
    palette: ["#1D5FA7", "#EEF5FB", "#18324A"],
    themeNames: ["现代政务红", "科技蓝金", "高级极简"],
    assetStyle: "tech-blue",
    keywords: ["政务", "政策", "会议", "通报", "工作动态"],
    types: ["data", "case", "tutorial"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "news-editorial",
    name: "央媒新闻",
    tone: "新闻、庄重、直达",
    description: "借鉴报刊头版的标题层级、导语和细线规则，适合权威发布与深度报道。",
    palette: ["#B21F2D", "#F8F5EE", "#211E1C"],
    themeNames: ["高级极简", "现代政务红"],
    assetStyle: "editorial-geometric",
    keywords: ["新闻", "发布", "报道", "要闻", "权威"],
    types: ["opinion", "data", "case", "interview"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "annual-report",
    name: "深蓝年报",
    tone: "商务、稳健、价值",
    description: "深蓝与金色建立年报级重量，用数据、章节和结论卡呈现经营成果。",
    palette: ["#C9A55C", "#153250", "#F2F5F7"],
    themeNames: ["科技蓝金", "人物专访"],
    assetStyle: "premium-business",
    keywords: ["年报", "总结", "经营", "业绩", "金融"],
    types: ["data", "case", "list"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "data-dashboard",
    name: "数据仪表",
    tone: "精确、模块、洞察",
    description: "用仪表盘式的数据锚点和短节奏章节突出指标、趋势与关键结论。",
    palette: ["#22C7D6", "#102C3A", "#F0FAFC"],
    themeNames: ["暗夜青", "科技蓝金"],
    assetStyle: "tech-blue",
    keywords: ["数据", "指标", "增长", "统计", "分析"],
    types: ["data", "tutorial", "list"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "monochrome-finance",
    name: "黑白财经",
    tone: "冷静、克制、判断",
    description: "黑白灰搭配极少量金色，用财经杂志的留白和边线承载观点与数字。",
    palette: ["#1C1C1C", "#F3F3F1", "#171717"],
    themeNames: ["高级极简", "人物专访"],
    assetStyle: "premium-business",
    keywords: ["财经", "商业", "资本", "市场", "投资"],
    types: ["opinion", "data", "case"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "future-purple",
    name: "未来渐变紫",
    tone: "前沿、轻盈、产品",
    description: "以蓝紫渐变和几何分区营造数字产品感，适合新品、AI 与创新项目。",
    palette: ["#6757E8", "#F2F0FF", "#252044"],
    themeNames: ["科技蓝金", "极简蓝"],
    assetStyle: "editorial-geometric",
    keywords: ["未来", "创新", "新品", "互联网", "数字化"],
    types: ["tutorial", "case", "data"],
    emotions: ["passionate", "calm"],
  },
  {
    id: "cyber-neon",
    name: "赛博霓虹",
    tone: "霓虹、锋利、实验",
    description: "深色舞台配合青色与洋红信号，制造强烈的科技发布和先锋阅读体验。",
    palette: ["#00D7F0", "#121426", "#F4F5FF"],
    themeNames: ["暗夜青", "科技蓝金"],
    assetStyle: "tech-blue",
    keywords: ["赛博", "霓虹", "游戏", "元宇宙", "先锋"],
    types: ["case", "tutorial", "data"],
    emotions: ["passionate", "light"],
  },
  {
    id: "jade-oriental",
    name: "新中式青绿",
    tone: "青绿、雅正、东方",
    description: "用青绿山水、印章式编号和疏朗留白呈现传统文化与东方生活。",
    palette: ["#2F6F62", "#F2F5EC", "#263A34"],
    themeNames: ["国风雅韵", "森语绿"],
    assetStyle: "oriental-ink",
    keywords: ["国风", "东方", "传统", "非遗", "青绿"],
    types: ["essay", "interview", "opinion"],
    emotions: ["calm", "warm"],
  },
  {
    id: "seasonal-poetry",
    name: "节气雅集",
    tone: "时令、诗意、手作",
    description: "以节气纹样、暖色题签和诗意分隔建立季节性的慢阅读节奏。",
    palette: ["#B9683A", "#FBF4E7", "#47362D"],
    themeNames: ["国风雅韵", "节日红金", "暖纸墨"],
    assetStyle: "festival-heritage",
    keywords: ["节气", "春节", "中秋", "端午", "传统节日"],
    types: ["essay", "list", "interview"],
    emotions: ["warm", "calm"],
  },
  {
    id: "academic-journal",
    name: "学术期刊",
    tone: "严谨、清晰、文献",
    description: "以期刊目录、编号标题和注释式卡片组织研究、课程与知识型长文。",
    palette: ["#334E68", "#F4F1E9", "#1F2D38"],
    themeNames: ["高级极简", "科技蓝金"],
    assetStyle: "premium-business",
    keywords: ["学术", "研究", "论文", "课程", "课题"],
    types: ["tutorial", "data", "opinion"],
    emotions: ["authoritative", "calm"],
  },
  {
    id: "playful-notebook",
    name: "童趣手账",
    tone: "可爱、轻松、参与",
    description: "用手账贴纸、圆角题签和彩色章节为亲子、校园与活动内容增加参与感。",
    palette: ["#FF7A8A", "#FFF5D9", "#493C42"],
    themeNames: ["校园青春", "食味暖橙"],
    assetStyle: "childlike-education",
    keywords: ["亲子", "儿童", "幼儿园", "校园", "可爱"],
    types: ["list", "tutorial", "essay"],
    emotions: ["light", "warm"],
  },
  {
    id: "event-poster",
    name: "活动海报",
    tone: "聚焦、热烈、行动",
    description: "用海报式首屏、丝带标题和行动卡突出时间、亮点与参与路径。",
    palette: ["#E84A3C", "#FFF2D6", "#33211D"],
    themeNames: ["节日红金", "校园青春"],
    assetStyle: "festival-heritage",
    keywords: ["活动", "招募", "邀请", "报名", "发布会"],
    types: ["list", "tutorial", "case"],
    emotions: ["passionate", "light"],
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
  ...new Set([
    "人工智能",
    "AI",
    "数字化",
    "科技",
    "教育",
    "文化",
    "美食",
    ...DESIGN_LANGUAGES.flatMap((language) => language.keywords),
  ]),
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
  ).slice(0, 8);
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
  const keywordMatches = language.keywords.filter((keyword) =>
    gene.keywords.some((candidate) => candidate.includes(keyword) || keyword.includes(candidate)),
  ).length;
  return (
    (language.types.includes(gene.articleType) ? 6 : 0) +
    (language.emotions.includes(gene.emotion) ? 3 : 0) +
    keywordMatches * 4 +
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
    ["civic-blue", ["蓝白政务", "公文", "政策解读", "清正", "政务蓝"]],
    ["news-editorial", ["新闻", "报刊", "央媒", "头版", "报道"]],
    ["annual-report", ["年报", "深蓝", "经营", "商务金", "业绩"]],
    ["data-dashboard", ["仪表盘", "数据可视化", "指标", "统计", "图表"]],
    ["monochrome-finance", ["财经", "金融", "黑白", "资本", "商业杂志"]],
    ["future-purple", ["紫色", "渐变", "数字化", "新品", "未来感"]],
    ["cyber-neon", ["赛博", "霓虹", "元宇宙", "游戏", "先锋"]],
    ["jade-oriental", ["新中式", "青绿", "非遗", "东方", "山水"]],
    ["seasonal-poetry", ["节气", "雅集", "春节", "中秋", "端午"]],
    ["academic-journal", ["学术", "期刊", "论文", "研究", "课程"]],
    ["playful-notebook", ["童趣", "手账", "亲子", "幼儿园", "可爱"]],
    ["event-poster", ["活动", "海报", "招募", "报名", "邀请函"]],
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
    designTokens: defaultPlanTokens(language),
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
    rhythm: gene.density,
    theme,
    themeName: theme?.manifest.name ?? language.themeNames[0] ?? language.name,
    visualVariant,
    visualIntensity: mode === "preset" ? "restrained" : "balanced",
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

export function createLayoutPlanForLanguage(
  document: DocumentV1,
  themes: readonly OfficialTheme[],
  languageId: DesignLanguageId,
  options: { readonly brief?: string; readonly mode: LayoutDesignMode },
): LayoutPlan {
  const analysis = analyzeDocumentLayout(document);
  const language = DESIGN_LANGUAGES.find((candidate) => candidate.id === languageId)!;
  return planFor(
    analysis,
    themes,
    language,
    options.mode,
    true,
    options.brief?.trim() || null,
    DESIGN_LANGUAGES.findIndex((candidate) => candidate.id === languageId),
  );
}

export function layoutPlanFromAiDecision(
  document: DocumentV1,
  themes: readonly OfficialTheme[],
  sourcePlan: LayoutPlan,
  decision: AiLayoutDecision,
): LayoutPlan {
  const base = createLayoutPlanForLanguage(document, themes, decision.languageId, {
    mode: sourcePlan.mode,
    ...(sourcePlan.brief === null ? {} : { brief: sourcePlan.brief }),
  });
  return {
    ...base,
    accentColors: [
      decision.designTokens.primaryColor,
      decision.designTokens.surfaceAltColor,
      decision.designTokens.textColor,
    ],
    designTokens: decision.designTokens,
    id: `${sourcePlan.mode}:${decision.languageId}-ai-${String(base.articleGene.seed)}`,
    name: decision.designName,
    designName: decision.designName,
    description: decision.concept,
    reasoning: decision.concept,
    highlights: [
      `模型逐段判断 ${String(decision.blocks.length)} 个内容区块`,
      `组件：按内容选择首屏、标题、金句、图片与数据卡`,
      `原创色板：${decision.designTokens.primaryColor} · ${decision.designTokens.accentColor}`,
      `节奏：${decision.rhythm} · 视觉强度：${decision.visualIntensity}`,
      `智能素材：自动落位 ${String(decision.visualAssets.length)} 个匹配装饰`,
      "不生成占位图片或无关图集",
      "微信安全样式与原文保护",
    ],
    rhythm: decision.rhythm,
    visualIntensity: decision.visualIntensity,
    visualVariant: (decision.variantSeed % 3) as 0 | 1 | 2,
  };
}

function blockId(): string {
  const value =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `block_layout_${value}`;
}

function clipped(value: string | undefined, fallback: string, maxLength: number): string {
  const normalized = value?.trim() || fallback;
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function languageRhythm(plan: LayoutPlan): {
  readonly bodyGap: number;
  readonly headingGap: number;
  readonly lineHeight: number;
  readonly radius: number;
} {
  const base = (() => {
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
        return { bodyGap: 20, headingGap: 38, lineHeight: 1.8, radius: 6 };
      default:
        return { bodyGap: 18, headingGap: 32, lineHeight: 1.85, radius: 6 };
    }
  })();
  const designed = {
    ...base,
    headingGap: plan.designTokens.sectionSpacing,
    lineHeight: plan.designTokens.bodyLineHeight,
    radius: plan.designTokens.cardRadius,
  };
  if (plan.rhythm === "compact") {
    return {
      ...designed,
      bodyGap: Math.max(12, designed.bodyGap - 4),
      headingGap: Math.max(24, designed.headingGap - 6),
      lineHeight: Math.max(1.7, designed.lineHeight - 0.1),
    };
  }
  if (plan.rhythm === "airy") {
    return {
      ...designed,
      bodyGap: designed.bodyGap + 5,
      headingGap: designed.headingGap + 8,
      lineHeight: designed.lineHeight + 0.08,
    };
  }
  return designed;
}

function planStyle(node: BlockNode, plan: LayoutPlan): StyleOverrides {
  const accent = plan.designTokens.primaryColor;
  const surface = plan.designTokens.surfaceAltColor;
  const title = plan.designTokens.textColor;
  const rhythm = languageRhythm(plan);
  const body = plan.designTokens.textColor;
  const expressive = plan.visualIntensity === "bold";
  const restrained = plan.visualIntensity === "restrained";
  if (node.type === "heading") {
    const levelOne = node.attrs.level === 1;
    if (plan.languageId === "crimson-editorial") {
      const levelTwo = node.attrs.level === 2;
      return {
        backgroundColor: plan.designTokens.surfaceColor,
        borderColor: levelTwo ? accent : plan.designTokens.surfaceAltColor,
        borderRadius: 0,
        borderStyle: "solid",
        borderWidth: levelTwo ? 3 : node.attrs.level === 3 ? 0 : 1,
        fontSize: levelOne ? 24 : levelTwo ? 18 : 15,
        fontWeight: levelOne ? 700 : 600,
        letterSpacing: levelTwo ? 0.5 : 0.3,
        lineHeight: levelTwo ? 1.4 : 1.5,
        marginBottom: levelTwo ? 20 : 14,
        marginTop: levelOne ? 8 : levelTwo ? 42 : 28,
        paddingBottom: levelTwo ? 14 : 0,
        paddingLeft: node.attrs.level === 3 ? 10 : 0,
        paddingRight: 0,
        paddingTop: 0,
        textAlign: levelOne ? plan.designTokens.titleAlign : "left",
        textColor: title,
      };
    }
    const quietHeading = plan.languageId === "forest-green" || plan.languageId === "ink-gold";
    const sectionSurface =
      levelOne || quietHeading || plan.visualVariant === 2 ? undefined : surface;
    return {
      ...(sectionSurface === undefined ? {} : { backgroundColor: sectionSurface }),
      borderColor: levelOne ? surface : accent,
      borderRadius: levelOne ? 0 : rhythm.radius,
      borderStyle: "solid",
      borderWidth: levelOne || quietHeading ? 0 : expressive ? 2 : 1,
      fontSize: levelOne
        ? expressive
          ? 29
          : restrained
            ? 24
            : 26
        : node.attrs.level === 2
          ? expressive
            ? 21
            : 20
          : 17,
      fontWeight: plan.languageId === "forest-green" ? 500 : levelOne ? 700 : 600,
      letterSpacing: plan.languageId === "ink-gold" ? 0.5 : 0.3,
      lineHeight: levelOne ? 1.4 : 1.5,
      marginBottom: levelOne ? 28 : 16,
      marginTop: levelOne ? 8 : rhythm.headingGap,
      paddingBottom: levelOne || quietHeading ? 8 : 10,
      paddingLeft: levelOne || quietHeading ? 0 : 14,
      paddingRight: levelOne || quietHeading ? 0 : 14,
      paddingTop: levelOne || quietHeading ? 8 : 10,
      textAlign: levelOne
        ? plan.designTokens.titleAlign
        : plan.visualVariant === 1 || plan.languageId === "warm-paper"
          ? "center"
          : "left",
      textColor: title,
    };
  }
  if (node.type === "paragraph") {
    return {
      fontSize: plan.designTokens.bodyFontSize,
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
      borderWidth: plan.languageId === "forest-green" ? 1 : expressive ? 3 : restrained ? 1 : 2,
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
      borderWidth: plan.visualVariant === 0 ? (expressive ? 2 : 1) : 0,
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
      borderWidth: plan.languageId === "forest-green" ? 0 : expressive ? 2 : 1,
      marginBottom: 24,
      marginTop: 20,
    };
  }
  if (node.type === "divider") {
    return { borderColor: accent, marginBottom: 24, marginTop: 24 };
  }
  return {};
}

interface LayoutComponentSet {
  readonly divider: { readonly id: string; readonly variant: string };
  readonly heading1: { readonly id: string; readonly variant: string };
  readonly heading2: { readonly id: string; readonly variant: string };
  readonly hero: { readonly id: string; readonly variant: string };
  readonly image: { readonly id: string; readonly variant: string };
  readonly notice: { readonly id: string; readonly variant: string };
  readonly quote: { readonly id: string; readonly variant: string };
}

const LAYOUT_COMPONENTS: Readonly<Record<DesignLanguageId, LayoutComponentSet>> = {
  "minimal-blue": {
    hero: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
    heading1: { id: "cmp_head_level1_underlined_003", variant: "underlined" },
    heading2: { id: "cmp_head_level2_marker_006", variant: "marker" },
    quote: { id: "cmp_quote_highlight_center_006", variant: "highlight" },
    notice: { id: "cmp_notice_info_blue_001", variant: "info" },
    image: { id: "cmp_image_rounded_caption_002", variant: "rounded_caption" },
    divider: { id: "cmp_divider_ornament_center_003", variant: "ornament" },
  },
  "warm-paper": {
    hero: { id: "cmp_intro_autumn_persimmon_001", variant: "autumn_persimmon_intro" },
    heading1: { id: "cmp_head_level1_frame_006", variant: "framed" },
    heading2: { id: "cmp_head_level2_pill_005", variant: "pill" },
    quote: { id: "cmp_quote_postcard_warm_005", variant: "postcard" },
    notice: { id: "cmp_notice_story_intro_006", variant: "story" },
    image: { id: "cmp_image_polaroid_caption_005", variant: "polaroid" },
    divider: { id: "cmp_divider_ornament_dots_004", variant: "ornament" },
  },
  "night-cyan": {
    hero: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
    heading1: { id: "cmp_head_level1_ribbon_005", variant: "ribbon" },
    heading2: { id: "cmp_head_level2_marker_006", variant: "marker" },
    quote: { id: "cmp_quote_conclusion_card_003", variant: "conclusion" },
    notice: { id: "cmp_notice_info_blue_001", variant: "info" },
    image: { id: "cmp_image_border_documentary_003", variant: "documentary" },
    divider: { id: "cmp_divider_dashed_subtle_002", variant: "dashed" },
  },
  "forest-green": {
    hero: { id: "cmp_intro_leaf_story_003", variant: "leaf_story_intro" },
    heading1: { id: "cmp_head_level1_centered_004", variant: "centered" },
    heading2: { id: "cmp_head_level2_underlined_003", variant: "underlined" },
    quote: { id: "cmp_quote_postcard_warm_005", variant: "postcard" },
    notice: { id: "cmp_notice_success_green_002", variant: "success" },
    image: { id: "cmp_image_rounded_caption_002", variant: "rounded_caption" },
    divider: { id: "cmp_divider_ornament_dots_004", variant: "ornament" },
  },
  "crimson-editorial": {
    hero: { id: "cmp_gov_red_gold_banner_001", variant: "civic_red_banner" },
    heading1: { id: "cmp_head_level1_numbered_002", variant: "numbered" },
    heading2: { id: "cmp_head_level2_leftbar_002", variant: "leftbar" },
    quote: { id: "cmp_quote_document_source_004", variant: "document" },
    notice: { id: "cmp_notice_risk_red_004", variant: "risk" },
    image: { id: "cmp_image_border_documentary_003", variant: "documentary" },
    divider: { id: "cmp_divider_ornament_center_003", variant: "ornament" },
  },
  "ink-gold": {
    hero: { id: "cmp_hero_ink_mountain_001", variant: "ink_mountain_hero" },
    heading1: { id: "cmp_head_level1_frame_006", variant: "framed" },
    heading2: { id: "cmp_head_level2_underlined_003", variant: "underlined" },
    quote: { id: "cmp_quote_citation_marks_002", variant: "quotation" },
    notice: { id: "cmp_notice_story_intro_006", variant: "story" },
    image: { id: "cmp_image_polaroid_caption_005", variant: "polaroid" },
    divider: { id: "cmp_divider_ornament_dots_004", variant: "ornament" },
  },
  "civic-blue": {
    hero: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
    heading1: { id: "cmp_head_level1_leftbar_001", variant: "leftbar" },
    heading2: { id: "cmp_head_level2_dot_001", variant: "dot" },
    quote: { id: "cmp_quote_document_source_004", variant: "document" },
    notice: { id: "cmp_notice_info_blue_001", variant: "info" },
    image: { id: "cmp_image_border_documentary_003", variant: "documentary" },
    divider: { id: "cmp_divider_solid_clean_001", variant: "solid" },
  },
  "news-editorial": {
    hero: { id: "cmp_gov_red_gold_banner_001", variant: "civic_red_banner" },
    heading1: { id: "cmp_head_level1_underlined_003", variant: "underlined" },
    heading2: { id: "cmp_head_level2_plain_004", variant: "plain" },
    quote: { id: "cmp_quote_standard_leftline_001", variant: "leftline" },
    notice: { id: "cmp_notice_story_intro_006", variant: "story" },
    image: { id: "cmp_image_fullwidth_clean_001", variant: "fullwidth" },
    divider: { id: "cmp_divider_solid_clean_001", variant: "solid" },
  },
  "annual-report": {
    hero: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
    heading1: { id: "cmp_head_level1_frame_006", variant: "framed" },
    heading2: { id: "cmp_head_level2_leftbar_002", variant: "leftbar" },
    quote: { id: "cmp_quote_conclusion_card_003", variant: "conclusion" },
    notice: { id: "cmp_notice_checklist_action_005", variant: "checklist" },
    image: { id: "cmp_image_centered_numbered_004", variant: "centered_numbered" },
    divider: { id: "cmp_divider_dashed_subtle_002", variant: "dashed" },
  },
  "data-dashboard": {
    hero: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
    heading1: { id: "cmp_head_level1_ribbon_005", variant: "ribbon" },
    heading2: { id: "cmp_head_level2_marker_006", variant: "marker" },
    quote: { id: "cmp_quote_highlight_center_006", variant: "highlight" },
    notice: { id: "cmp_notice_info_blue_001", variant: "info" },
    image: { id: "cmp_image_centered_numbered_004", variant: "centered_numbered" },
    divider: { id: "cmp_divider_dashed_subtle_002", variant: "dashed" },
  },
  "monochrome-finance": {
    hero: { id: "cmp_intro_bamboo_note_002", variant: "bamboo_note" },
    heading1: { id: "cmp_head_level1_centered_004", variant: "centered" },
    heading2: { id: "cmp_head_level2_underlined_003", variant: "underlined" },
    quote: { id: "cmp_quote_conclusion_card_003", variant: "conclusion" },
    notice: { id: "cmp_notice_checklist_action_005", variant: "checklist" },
    image: { id: "cmp_image_fullwidth_clean_001", variant: "fullwidth" },
    divider: { id: "cmp_divider_solid_clean_001", variant: "solid" },
  },
  "future-purple": {
    hero: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
    heading1: { id: "cmp_head_level1_ribbon_005", variant: "ribbon" },
    heading2: { id: "cmp_head_level2_pill_005", variant: "pill" },
    quote: { id: "cmp_quote_highlight_center_006", variant: "highlight" },
    notice: { id: "cmp_notice_info_blue_001", variant: "info" },
    image: { id: "cmp_image_rounded_caption_002", variant: "rounded_caption" },
    divider: { id: "cmp_divider_ornament_center_003", variant: "ornament" },
  },
  "cyber-neon": {
    hero: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
    heading1: { id: "cmp_head_level1_frame_006", variant: "framed" },
    heading2: { id: "cmp_head_level2_marker_006", variant: "marker" },
    quote: { id: "cmp_quote_citation_marks_002", variant: "quotation" },
    notice: { id: "cmp_notice_warning_amber_003", variant: "warning" },
    image: { id: "cmp_image_border_documentary_003", variant: "documentary" },
    divider: { id: "cmp_divider_dashed_subtle_002", variant: "dashed" },
  },
  "jade-oriental": {
    hero: { id: "cmp_hero_ink_mountain_001", variant: "ink_mountain_hero" },
    heading1: { id: "cmp_head_mist_mountains_007", variant: "mist_mountain_heading" },
    heading2: { id: "cmp_head_cloud_scroll_008", variant: "cloud_scroll_heading" },
    quote: { id: "cmp_quote_citation_marks_002", variant: "quotation" },
    notice: { id: "cmp_notice_story_intro_006", variant: "story" },
    image: { id: "cmp_image_polaroid_caption_005", variant: "polaroid" },
    divider: { id: "cmp_divider_ornament_dots_004", variant: "ornament" },
  },
  "seasonal-poetry": {
    hero: { id: "cmp_hero_festival_lantern_002", variant: "festival_lantern_hero" },
    heading1: { id: "cmp_head_mist_mountains_007", variant: "mist_mountain_heading" },
    heading2: { id: "cmp_head_level2_pill_005", variant: "pill" },
    quote: { id: "cmp_quote_postcard_warm_005", variant: "postcard" },
    notice: { id: "cmp_notice_story_intro_006", variant: "story" },
    image: { id: "cmp_image_polaroid_caption_005", variant: "polaroid" },
    divider: { id: "cmp_divider_ornament_dots_004", variant: "ornament" },
  },
  "academic-journal": {
    hero: { id: "cmp_intro_bamboo_note_002", variant: "bamboo_note" },
    heading1: { id: "cmp_head_level1_numbered_002", variant: "numbered" },
    heading2: { id: "cmp_head_level2_plain_004", variant: "plain" },
    quote: { id: "cmp_quote_document_source_004", variant: "document" },
    notice: { id: "cmp_notice_checklist_action_005", variant: "checklist" },
    image: { id: "cmp_image_centered_numbered_004", variant: "centered_numbered" },
    divider: { id: "cmp_divider_solid_clean_001", variant: "solid" },
  },
  "playful-notebook": {
    hero: { id: "cmp_intro_leaf_story_003", variant: "leaf_story_intro" },
    heading1: { id: "cmp_head_level1_ribbon_005", variant: "ribbon" },
    heading2: { id: "cmp_head_level2_pill_005", variant: "pill" },
    quote: { id: "cmp_quote_postcard_warm_005", variant: "postcard" },
    notice: { id: "cmp_notice_success_green_002", variant: "success" },
    image: { id: "cmp_image_polaroid_caption_005", variant: "polaroid" },
    divider: { id: "cmp_divider_ornament_dots_004", variant: "ornament" },
  },
  "event-poster": {
    hero: { id: "cmp_hero_festival_lantern_002", variant: "festival_lantern_hero" },
    heading1: { id: "cmp_head_level1_ribbon_005", variant: "ribbon" },
    heading2: { id: "cmp_head_level2_leftbar_002", variant: "leftbar" },
    quote: { id: "cmp_quote_highlight_center_006", variant: "highlight" },
    notice: { id: "cmp_notice_checklist_action_005", variant: "checklist" },
    image: { id: "cmp_image_rounded_caption_002", variant: "rounded_caption" },
    divider: { id: "cmp_divider_ornament_center_003", variant: "ornament" },
  },
};

const COMPONENT_VARIANTS: Readonly<
  Record<AiLayoutComponentId, { readonly id: AiLayoutComponentId; readonly variant: string }>
> = {
  cmp_head_level1_leftbar_001: { id: "cmp_head_level1_leftbar_001", variant: "leftbar" },
  cmp_head_level1_numbered_002: { id: "cmp_head_level1_numbered_002", variant: "numbered" },
  cmp_head_level1_underlined_003: {
    id: "cmp_head_level1_underlined_003",
    variant: "underlined",
  },
  cmp_head_level1_centered_004: { id: "cmp_head_level1_centered_004", variant: "centered" },
  cmp_head_level1_ribbon_005: { id: "cmp_head_level1_ribbon_005", variant: "ribbon" },
  cmp_head_level1_frame_006: { id: "cmp_head_level1_frame_006", variant: "framed" },
  cmp_head_mist_mountains_007: {
    id: "cmp_head_mist_mountains_007",
    variant: "mist_mountain_heading",
  },
  cmp_head_level2_dot_001: { id: "cmp_head_level2_dot_001", variant: "dot" },
  cmp_head_level2_leftbar_002: { id: "cmp_head_level2_leftbar_002", variant: "leftbar" },
  cmp_head_level2_underlined_003: {
    id: "cmp_head_level2_underlined_003",
    variant: "underlined",
  },
  cmp_head_level2_plain_004: { id: "cmp_head_level2_plain_004", variant: "plain" },
  cmp_head_level2_pill_005: { id: "cmp_head_level2_pill_005", variant: "pill" },
  cmp_head_level2_marker_006: { id: "cmp_head_level2_marker_006", variant: "marker" },
  cmp_head_cloud_scroll_008: {
    id: "cmp_head_cloud_scroll_008",
    variant: "cloud_scroll_heading",
  },
  cmp_quote_standard_leftline_001: {
    id: "cmp_quote_standard_leftline_001",
    variant: "leftline",
  },
  cmp_quote_citation_marks_002: {
    id: "cmp_quote_citation_marks_002",
    variant: "quotation",
  },
  cmp_quote_conclusion_card_003: {
    id: "cmp_quote_conclusion_card_003",
    variant: "conclusion",
  },
  cmp_quote_document_source_004: {
    id: "cmp_quote_document_source_004",
    variant: "document",
  },
  cmp_quote_postcard_warm_005: {
    id: "cmp_quote_postcard_warm_005",
    variant: "postcard",
  },
  cmp_quote_highlight_center_006: {
    id: "cmp_quote_highlight_center_006",
    variant: "highlight",
  },
  cmp_notice_info_blue_001: { id: "cmp_notice_info_blue_001", variant: "info" },
  cmp_notice_success_green_002: { id: "cmp_notice_success_green_002", variant: "success" },
  cmp_notice_warning_amber_003: { id: "cmp_notice_warning_amber_003", variant: "warning" },
  cmp_notice_risk_red_004: { id: "cmp_notice_risk_red_004", variant: "risk" },
  cmp_notice_checklist_action_005: {
    id: "cmp_notice_checklist_action_005",
    variant: "checklist",
  },
  cmp_notice_story_intro_006: { id: "cmp_notice_story_intro_006", variant: "story" },
  cmp_image_fullwidth_clean_001: {
    id: "cmp_image_fullwidth_clean_001",
    variant: "fullwidth",
  },
  cmp_image_rounded_caption_002: {
    id: "cmp_image_rounded_caption_002",
    variant: "rounded_caption",
  },
  cmp_image_border_documentary_003: {
    id: "cmp_image_border_documentary_003",
    variant: "documentary",
  },
  cmp_image_centered_numbered_004: {
    id: "cmp_image_centered_numbered_004",
    variant: "centered_numbered",
  },
  cmp_image_polaroid_caption_005: {
    id: "cmp_image_polaroid_caption_005",
    variant: "polaroid",
  },
  cmp_divider_solid_clean_001: { id: "cmp_divider_solid_clean_001", variant: "solid" },
  cmp_divider_dashed_subtle_002: {
    id: "cmp_divider_dashed_subtle_002",
    variant: "dashed",
  },
  cmp_divider_ornament_center_003: {
    id: "cmp_divider_ornament_center_003",
    variant: "ornament",
  },
  cmp_divider_ornament_dots_004: {
    id: "cmp_divider_ornament_dots_004",
    variant: "ornament",
  },
  cmp_hero_ink_mountain_001: {
    id: "cmp_hero_ink_mountain_001",
    variant: "ink_mountain_hero",
  },
  cmp_intro_autumn_persimmon_001: {
    id: "cmp_intro_autumn_persimmon_001",
    variant: "autumn_persimmon_intro",
  },
  cmp_intro_bamboo_note_002: { id: "cmp_intro_bamboo_note_002", variant: "bamboo_note" },
  cmp_gov_red_gold_banner_001: {
    id: "cmp_gov_red_gold_banner_001",
    variant: "civic_red_banner",
  },
  cmp_tech_orbit_hero_001: { id: "cmp_tech_orbit_hero_001", variant: "tech_orbit_hero" },
  cmp_intro_leaf_story_003: { id: "cmp_intro_leaf_story_003", variant: "leaf_story_intro" },
  cmp_hero_festival_lantern_002: {
    id: "cmp_hero_festival_lantern_002",
    variant: "festival_lantern_hero",
  },
};

function selectedComponent(
  componentId: AiLayoutComponentId | null | undefined,
  fallback: { readonly id: string; readonly variant: string },
): { readonly id: string; readonly variant: string } {
  return componentId === null || componentId === undefined
    ? fallback
    : COMPONENT_VARIANTS[componentId];
}

function isGeneratedLayoutRole(role: string | undefined): boolean {
  return role?.startsWith("layout_plan_generated") === true;
}

function containsPendingImage(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  const record = node as {
    readonly attrs?: Readonly<Record<string, unknown>>;
    readonly content?: readonly unknown[];
  };
  return (
    record.attrs?.resourceId === "component_slot_image_pending" ||
    record.content?.some(containsPendingImage) === true
  );
}

function containsSourceBlock(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  const record = node as {
    readonly attrs?: Readonly<Record<string, unknown>>;
    readonly content?: readonly unknown[];
  };
  return (
    typeof record.attrs?.sourceBlockId === "string" ||
    record.content?.some(containsSourceBlock) === true
  );
}

function isUnresolvedVisualPlaceholder(node: DocNode["content"][number]): boolean {
  return (
    (node.type === "imageBlock" || node.type === "semanticCard") &&
    containsPendingImage(node) &&
    !containsSourceBlock(node)
  );
}

function restoreOriginalBlocks(nodes: readonly DocNode["content"][number][]): DocNode["content"] {
  return nodes.flatMap((node): DocNode["content"] => {
    if (isGeneratedLayoutRole(node.attrs.semanticRole)) {
      if (node.type === "semanticCard" && node.content !== undefined) {
        return restoreOriginalBlocks(node.content);
      }
      return [];
    }
    if (isUnresolvedVisualPlaceholder(node)) {
      return [];
    }
    return [unwrapGeneratedEmphasis(node)];
  });
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

function emphasisBlock(
  node: ParagraphNode,
  plan: LayoutPlan,
  componentId?: AiLayoutComponentId | null,
): DocNode["content"][number] {
  const component = selectedComponent(componentId, LAYOUT_COMPONENTS[plan.languageId].quote);
  return {
    type: "blockquote",
    attrs: {
      blockId: blockId(),
      componentId: component.id,
      componentVersion: "1.0.0",
      componentVariantId: "default",
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
      variant: component.variant,
    },
    content: [node],
  };
}

function componentizeBlock(
  node: DocNode["content"][number],
  plan: LayoutPlan,
  sectionNumber: number,
  componentId?: AiLayoutComponentId | null,
): DocNode["content"][number] {
  const components = LAYOUT_COMPONENTS[plan.languageId];
  const baseAttrs = {
    ...structuredClone(node.attrs),
    styleRef: `layout.${plan.languageId}.${plan.visualVariant}`,
    styleOverrides: {
      ...structuredClone(node.attrs.styleOverrides ?? {}),
      ...planStyle(node, plan),
    },
  };
  if (node.type === "heading") {
    const component = selectedComponent(
      componentId,
      node.attrs.level === 1 ? components.heading1 : components.heading2,
    );
    const crimsonChapter = plan.languageId === "crimson-editorial" && node.attrs.level === 2;
    const crimsonSubheading = plan.languageId === "crimson-editorial" && node.attrs.level === 3;
    const shouldNumber =
      node.attrs.level === 2 &&
      (crimsonChapter || component.variant === "marker") &&
      !/^\s*(?:\d+|[一二三四五六七八九十]+)[.、/]/u.test(textFromNode(node));
    return {
      ...structuredClone(node),
      attrs: {
        ...baseAttrs,
        componentId: component.id,
        componentVersion: "1.0.0",
        componentVariantId: "default",
        ...(crimsonChapter ? { semanticRole: "layout_plan_crimson_chapter" } : {}),
        ...(crimsonSubheading ? { semanticRole: "layout_plan_crimson_subheading" } : {}),
        ...(shouldNumber ? { numbering: String(sectionNumber).padStart(2, "0") } : {}),
      },
    } as HeadingNode;
  }
  if (node.type === "blockquote") {
    const component = selectedComponent(componentId, components.quote);
    return {
      ...structuredClone(node),
      attrs: {
        ...baseAttrs,
        componentId: component.id,
        componentVersion: "1.0.0",
        componentVariantId: "default",
        variant: component.variant,
        showQuotes: component.variant === "quotation" || component.variant === "postcard",
      },
    };
  }
  if (node.type === "imageBlock") {
    const component = selectedComponent(componentId, components.image);
    return {
      ...structuredClone(node),
      attrs: {
        ...baseAttrs,
        componentId: component.id,
        componentVersion: "1.0.0",
        componentVariantId: "default",
        horizontalAlign: node.attrs.horizontalAlign ?? "center",
        objectFit: node.attrs.objectFit ?? "cover",
      },
    } as ImageBlockNode;
  }
  if (node.type === "bulletList") {
    return {
      ...structuredClone(node),
      attrs: {
        ...baseAttrs,
        bulletStyle:
          plan.articleGene.articleType === "tutorial" || plan.articleGene.articleType === "list"
            ? "check"
            : "brand",
      },
    };
  }
  return { ...structuredClone(node), attrs: baseAttrs } as DocNode["content"][number];
}

function generatedDivider(plan: LayoutPlan, componentId?: AiLayoutComponentId | null): DividerNode {
  const component = selectedComponent(componentId, LAYOUT_COMPONENTS[plan.languageId].divider);
  const variant =
    component.variant === "solid" ||
    component.variant === "dashed" ||
    component.variant === "dotted"
      ? component.variant
      : "ornament";
  return {
    type: "divider",
    attrs: {
      align: "center",
      blockId: blockId(),
      componentId: component.id,
      componentVersion: "1.0.0",
      componentVariantId: "default",
      compatibilityLevel: "safe",
      ...(variant === "ornament" ? { icon: "\u2022  \u2022  \u2022" } : {}),
      locked: false,
      semanticRole: "layout_plan_generated_divider",
      spacingAfter: 28,
      spacingBefore: 28,
      styleRef: `layout.${plan.languageId}.divider`,
      styleOverrides: planStyle(
        { type: "divider", attrs: { blockId: "preview", locked: false } },
        plan,
      ),
      variant,
      widthPercent: variant === "ornament" ? 28 : 68,
    },
  };
}

function generatedVisualAsset(asset: OfficialVisualAsset, plan: LayoutPlan): ImageBlockNode {
  const floating =
    asset.function === "sticker" || asset.function === "corner" || asset.function === "badge";
  return {
    type: "imageBlock",
    attrs: {
      alt: asset.name,
      blockId: blockId(),
      compatibilityLevel: "safe",
      elementKind: floating ? "sticker" : "decoration",
      freePosition: floating,
      horizontalAlign: floating && plan.visualVariant === 1 ? "right" : "center",
      layer: floating ? 2 : 1,
      locked: false,
      objectFit: "contain",
      objectPositionX: 50,
      objectPositionY: 50,
      offsetX: 0,
      offsetY: 0,
      opacity: plan.visualIntensity === "restrained" ? 0.86 : 1,
      resourceId: asset.resourceId,
      rotation: floating ? (plan.visualVariant - 1) * 4 : 0,
      semanticRole: "layout_plan_generated_visual_asset",
      styleRef: `layout.${plan.languageId}.asset.${asset.function}`,
      styleOverrides: {
        marginBottom: floating ? 8 : 20,
        marginTop: floating ? 4 : 12,
      },
      widthMode: floating ? "percent" : "full",
      ...(floating ? { widthPercent: plan.visualIntensity === "bold" ? 28 : 22 } : {}),
    },
  };
}

function introCard(
  paragraph: ParagraphNode | undefined,
  plan: LayoutPlan,
  characterCount: number,
  copy?: AiLayoutDecision["hero"],
): SemanticCardNode {
  const component = selectedComponent(copy?.componentId, LAYOUT_COMPONENTS[plan.languageId].hero);
  const readingMinutes = Math.max(1, Math.ceil(characterCount / 500));
  const crimson = plan.languageId === "crimson-editorial";
  const keywords =
    plan.articleGene.keywords.length > 0
      ? plan.articleGene.keywords.slice(0, 3).join(" \u00b7 ")
      : `${plan.articleGene.articleTypeLabel} \u00b7 ${plan.articleGene.emotionLabel}`;
  return {
    type: "semanticCard",
    attrs: {
      blockId: blockId(),
      componentId: component.id,
      componentVersion: "1.0.0",
      componentVariantId: "default",
      compatibilityLevel: "safe",
      eyebrow: clipped(
        crimson ? "“" : copy?.eyebrow,
        `ARTICLE GUIDE \u00b7 ${plan.articleGene.articleTypeLabel}`,
        160,
      ),
      footer: clipped(
        copy?.footer,
        crimson
          ? `${String(characterCount)} 字 · 约 ${String(readingMinutes)} 分钟`
          : `${String(characterCount)} 字 \u00b7 约 ${String(readingMinutes)} 分钟 \u00b7 ${keywords}`,
        900,
      ),
      locked: false,
      semanticRole: "layout_plan_generated_intro",
      styleRef: `layout.${plan.languageId}.hero`,
      ...(crimson
        ? {
            styleOverrides: {
              backgroundColor: plan.designTokens.surfaceColor,
              borderColor: plan.designTokens.surfaceAltColor,
              borderRadius: plan.designTokens.cardRadius,
              borderStyle: "solid",
              borderWidth: 1,
              marginBottom: 32,
              marginTop: 10,
              paddingBottom: 22,
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 24,
            },
          }
        : {}),
      title: clipped(copy?.title, plan.articleGene.summary, 460),
      variant: crimson ? "editorial_quote_intro" : component.variant,
    },
    ...(paragraph === undefined ? {} : { content: [paragraph] }),
  };
}

function dataCard(
  paragraph: ParagraphNode,
  plan: LayoutPlan,
  treatment: "callout" | "data" = "data",
  componentId?: AiLayoutComponentId | null,
): SemanticCardNode {
  const component = selectedComponent(componentId, LAYOUT_COMPONENTS[plan.languageId].notice);
  const crimson = plan.languageId === "crimson-editorial";
  return {
    type: "semanticCard",
    attrs: {
      blockId: blockId(),
      componentId: component.id,
      componentVersion: "1.0.0",
      componentVariantId: "default",
      compatibilityLevel: "safe",
      eyebrow: treatment === "data" ? "DATA \u00b7 关键信息" : "FOCUS \u00b7 阅读提示",
      footer: treatment === "data" ? "核心数据来自原文" : "信息来自原文",
      locked: false,
      semanticRole: "layout_plan_generated_data",
      styleRef: `layout.${plan.languageId}.data`,
      styleOverrides: {
        backgroundColor: plan.designTokens.surfaceAltColor,
        borderColor: plan.designTokens.primaryColor,
        borderRadius: plan.designTokens.cardRadius,
        borderStyle: "solid",
        borderWidth: 1,
        marginBottom: 24,
        marginTop: 24,
      },
      title: treatment === "data" ? "关键数据" : "重点提示",
      variant: crimson && treatment === "data" ? "editorial_data_triptych" : component.variant,
    },
    content: [paragraph],
  };
}

function tailCard(plan: LayoutPlan, copy?: AiLayoutDecision["footer"]): SemanticCardNode {
  const component = selectedComponent(
    copy?.componentId,
    COMPONENT_VARIANTS.cmp_notice_checklist_action_005,
  );
  return {
    type: "semanticCard",
    attrs: {
      blockId: blockId(),
      componentId: component.id,
      componentVersion: "1.0.0",
      componentVariantId: "default",
      compatibilityLevel: "safe",
      eyebrow: plan.languageId === "crimson-editorial" ? "END" : "READ \u00b7 SHARE",
      footer: clipped(copy?.text, "感谢阅读 \u00b7 愿好内容被更多人看见", 900),
      locked: false,
      semanticRole: "layout_plan_generated_footer",
      styleRef: `layout.${plan.languageId}.footer`,
      styleOverrides: {
        backgroundColor: plan.designTokens.surfaceAltColor,
        borderColor: plan.designTokens.primaryColor,
        borderRadius: plan.designTokens.cardRadius,
        borderStyle: "dashed",
        borderWidth: 1,
        marginBottom: 16,
        marginTop: 38,
        paddingBottom: 20,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 20,
        textAlign: "center",
      },
      title: clipped(
        copy?.title,
        "\ud83d\udc4d 点赞 \u00b7 \ud83d\udc40 在看 \u00b7 \u2197 转发",
        460,
      ),
      variant: plan.languageId === "crimson-editorial" ? "editorial_footer" : component.variant,
    },
  };
}

function overviewCard(plan: LayoutPlan, headings: readonly HeadingNode[]): SemanticCardNode | null {
  if (headings.length < 2) return null;
  const crimson = plan.languageId === "crimson-editorial";
  const items = headings.slice(0, 3).map((heading, index) => {
    const number = String(index + 1).padStart(2, "0");
    return `${number}\t${clipped(textFromNode(heading), `第 ${String(index + 1)} 部分`, 72)}`;
  });
  return {
    type: "semanticCard",
    attrs: {
      blockId: blockId(),
      componentId: "cmp_notice_checklist_action_005",
      componentVersion: "1.0.0",
      componentVariantId: "default",
      compatibilityLevel: "safe",
      eyebrow: crimson ? "📌 本文看点" : "READING MAP · 本文看点",
      footer: items.join("\n"),
      locked: false,
      semanticRole: "layout_plan_generated_overview",
      styleRef: `layout.${plan.languageId}.overview`,
      styleOverrides: {
        backgroundColor: crimson
          ? plan.designTokens.surfaceColor
          : plan.designTokens.surfaceAltColor,
        borderColor: crimson ? plan.designTokens.surfaceColor : plan.designTokens.primaryColor,
        borderRadius: crimson ? 0 : plan.designTokens.cardRadius,
        borderStyle: "solid",
        borderWidth: crimson ? 0 : 1,
        marginBottom: 32,
        marginTop: 10,
        paddingBottom: crimson ? 0 : 18,
        paddingLeft: crimson ? 0 : 20,
        paddingRight: crimson ? 0 : 20,
        paddingTop: crimson ? 0 : 18,
      },
      title: "阅读导航",
      variant: crimson ? "editorial_overview" : "section_roadmap",
    },
  };
}

function dataCandidates(
  blocks: readonly DocNode["content"][number][],
  introIndex: number,
  plan: LayoutPlan,
): ReadonlySet<number> {
  const limit =
    plan.articleGene.articleType === "data" || plan.articleGene.articleType === "case" ? 2 : 1;
  return new Set(
    blocks
      .map((node, index) => {
        if (node.type !== "paragraph" || index === introIndex) return { index, score: -1 };
        const text = textFromNode(node).trim();
        const numbers =
          text.match(/\d+(?:\.\d+)?(?:%|\u4e07|\u4ebf|\u500d|\u5e74|\u4e2a|\u9879|\u4eba)?/gu) ??
          [];
        return {
          index,
          score: text.length >= 18 && text.length <= 180 ? numbers.length : -1,
        };
      })
      .filter((entry) => entry.score >= 2)
      .toSorted((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((entry) => entry.index),
  );
}

function editorialHighlightContent(
  content: readonly InlineNode[] | undefined,
  budget: number,
): { readonly content: readonly InlineNode[] | undefined; readonly used: number } {
  if (content === undefined || budget <= 0) return { content, used: 0 };
  let used = 0;
  const highlighted = content.flatMap((inline): readonly InlineNode[] => {
    if (inline.type !== "text" || used >= budget) return [structuredClone(inline)];
    const phrases = [...inline.text.matchAll(/[“"]([^”"]{4,24})[”"]/gu)]
      .map((match) => match[1]?.trim() ?? "")
      .filter((phrase) => phrase.length >= 4)
      .slice(0, Math.min(2, budget - used));
    if (phrases.length === 0) return [structuredClone(inline)];
    let segments: InlineNode[] = [structuredClone(inline)];
    for (const phrase of phrases) {
      let applied = false;
      segments = segments.flatMap((segment): readonly InlineNode[] => {
        if (applied || segment.type !== "text") return [segment];
        const start = segment.text.indexOf(phrase);
        if (start < 0) return [segment];
        applied = true;
        used += 1;
        const before = segment.text.slice(0, start);
        const after = segment.text.slice(start + phrase.length);
        return [
          ...(before === "" ? [] : [{ ...segment, text: before }]),
          {
            ...segment,
            text: phrase,
            marks: [
              ...(segment.marks ?? []),
              ...(segment.marks?.some((mark) => mark.type === "bold") === true
                ? []
                : [{ type: "bold" as const }]),
              ...(segment.marks?.some((mark) => mark.type === "underline") === true
                ? []
                : [{ type: "underline" as const }]),
            ],
          },
          ...(after === "" ? [] : [{ ...segment, text: after }]),
        ];
      });
    }
    return segments;
  });
  return { content: highlighted, used };
}

function editorialHighlightBlocks(
  blocks: readonly DocNode["content"][number][],
  plan: LayoutPlan,
): DocNode["content"] {
  if (plan.languageId !== "crimson-editorial") return [...blocks];
  let budget = 12;
  return blocks.map((node) => {
    if (node.type !== "paragraph" || budget <= 0) return node;
    const highlighted = editorialHighlightContent(node.content, Math.min(2, budget));
    budget -= highlighted.used;
    return {
      ...node,
      ...(highlighted.content === undefined ? {} : { content: [...highlighted.content] }),
    };
  });
}

export function applyLayoutPlanToDocument(document: DocumentV1, plan: LayoutPlan): DocumentV1 {
  const analysis = analyzeDocumentLayout(document);
  const originalBlocks = restoreOriginalBlocks(document.content.content);
  let sectionNumber = 0;
  const styledBlocks = editorialHighlightBlocks(
    originalBlocks.map((node) => {
      if (node.type === "heading" && node.attrs.level === 2) sectionNumber += 1;
      return componentizeBlock(node, plan, sectionNumber);
    }),
    plan,
  );
  const result: DocNode["content"] = [];
  const emphasis = emphasisCandidates(styledBlocks);
  const introIndex = styledBlocks.findIndex(
    (node) => node.type === "paragraph" && textFromNode(node).trim().length >= 12,
  );
  const data = dataCandidates(styledBlocks, introIndex, plan);
  const headingCount = styledBlocks.filter(
    (node) => node.type === "heading" && node.attrs.level === 2,
  ).length;
  const dividerCadence =
    plan.languageId === "forest-green" || plan.languageId === "ink-gold" ? 2 : 1;
  let sectionIndex = 0;
  let introInserted = false;
  let overviewInserted = false;
  const overview = overviewCard(
    plan,
    styledBlocks.filter(
      (node): node is HeadingNode => node.type === "heading" && node.attrs.level === 2,
    ),
  );

  styledBlocks.forEach((node, index) => {
    if (node.type === "heading" && node.attrs.level === 2) {
      if (!overviewInserted && overview !== null) {
        result.push(overview);
        overviewInserted = true;
      }
      sectionIndex += 1;
      if (headingCount > 1 && result.length > 0 && (sectionIndex - 1) % dividerCadence === 0) {
        result.push(generatedDivider(plan));
      }
    }
    if (index === introIndex && node.type === "paragraph") {
      result.push(introCard(node, plan, analysis.characterCount));
      introInserted = true;
    } else if (data.has(index) && node.type === "paragraph") {
      result.push(dataCard(node, plan));
    } else {
      const outputNode =
        emphasis.has(index) && node.type === "paragraph" ? emphasisBlock(node, plan) : node;
      result.push(outputNode);
    }
  });
  if (!introInserted) {
    const titleIndex = result.findIndex(
      (node) => node.type === "heading" && node.attrs.level === 1,
    );
    result.splice(
      titleIndex < 0 ? 0 : titleIndex + 1,
      0,
      introCard(undefined, plan, analysis.characterCount),
    );
  }
  result.push(tailCard(plan));

  return {
    ...structuredClone(document),
    content: { type: "doc", content: result },
    meta: { ...structuredClone(document.meta), updatedAt: new Date().toISOString() },
  };
}

function paragraphAsHeading(paragraph: ParagraphNode, level: 1 | 2): HeadingNode {
  const attributes = structuredClone(paragraph.attrs);
  delete attributes.indentMode;
  return {
    type: "heading",
    attrs: { ...attributes, level },
    ...(paragraph.content === undefined ? {} : { content: structuredClone(paragraph.content) }),
  };
}

function headingAtLevel(heading: HeadingNode, level: 1 | 2): HeadingNode {
  return {
    ...structuredClone(heading),
    attrs: { ...structuredClone(heading.attrs), level },
  };
}

function aiStructuralNode(
  node: DocNode["content"][number],
  treatment: AiLayoutTreatment,
): DocNode["content"][number] {
  if (treatment === "title") {
    if (node.type === "paragraph") return paragraphAsHeading(node, 1);
    if (node.type === "heading") return headingAtLevel(node, 1);
  }
  if (treatment === "section") {
    if (node.type === "paragraph") return paragraphAsHeading(node, 2);
    if (node.type === "heading") return headingAtLevel(node, 2);
  }
  return structuredClone(node);
}

export function applyAiLayoutDecisionToDocument(
  document: DocumentV1,
  plan: LayoutPlan,
  decision: AiLayoutDecision,
): DocumentV1 {
  const analysis = analyzeDocumentLayout(document);
  const decisions = new Map(decision.blocks.map((item) => [item.blockId, item]));
  const dividerAfter = new Set(decision.dividerAfterBlockIds);
  const visualAssetsAfter = new Map<string, OfficialVisualAsset[]>();
  decision.visualAssets.forEach((selection) => {
    const asset = findOfficialVisualAsset(selection.resourceId);
    if (asset === undefined || asset.motion !== "static") return;
    visualAssetsAfter.set(selection.afterBlockId, [
      ...(visualAssetsAfter.get(selection.afterBlockId) ?? []),
      asset,
    ]);
  });
  const originalBlocks = restoreOriginalBlocks(document.content.content);
  let sectionNumber = 0;
  const styledBlocks = editorialHighlightBlocks(
    originalBlocks.map((original) => {
      const blockDecision = decisions.get(original.attrs.blockId);
      const treatment = blockDecision?.treatment ?? "body";
      const structural = aiStructuralNode(original, treatment);
      if (structural.type === "heading" && structural.attrs.level === 2) sectionNumber += 1;
      return componentizeBlock(structural, plan, sectionNumber, blockDecision?.componentId);
    }),
    plan,
  );
  const result: DocNode["content"] = [];
  let leadInserted = false;
  let overviewInserted = false;
  const overview = overviewCard(
    plan,
    styledBlocks.filter(
      (node): node is HeadingNode => node.type === "heading" && node.attrs.level === 2,
    ),
  );

  styledBlocks.forEach((node) => {
    if (
      node.type === "heading" &&
      node.attrs.level === 2 &&
      !overviewInserted &&
      overview !== null
    ) {
      result.push(overview);
      overviewInserted = true;
    }
    const blockDecision = decisions.get(node.attrs.blockId);
    const treatment = blockDecision?.treatment ?? "body";
    if (treatment === "lead" && node.type === "paragraph" && !leadInserted) {
      result.push(introCard(node, plan, analysis.characterCount, decision.hero));
      leadInserted = true;
    } else if (treatment === "quote" && node.type === "paragraph") {
      result.push(emphasisBlock(node, plan, blockDecision?.componentId));
    } else if ((treatment === "data" || treatment === "callout") && node.type === "paragraph") {
      result.push(dataCard(node, plan, treatment, blockDecision?.componentId));
    } else {
      result.push(node);
    }
    if (dividerAfter.has(node.attrs.blockId)) {
      result.push(generatedDivider(plan, decision.dividerComponentId));
    }
    visualAssetsAfter
      .get(node.attrs.blockId)
      ?.slice(0, 2)
      .forEach((asset) => result.push(generatedVisualAsset(asset, plan)));
  });

  if (!leadInserted) {
    const titleIndex = result.findIndex(
      (node) => node.type === "heading" && node.attrs.level === 1,
    );
    result.splice(
      titleIndex < 0 ? 0 : titleIndex + 1,
      0,
      introCard(undefined, plan, analysis.characterCount, decision.hero),
    );
  }
  result.push(tailCard(plan, decision.footer));

  return {
    ...structuredClone(document),
    content: { type: "doc", content: result },
    meta: { ...structuredClone(document.meta), updatedAt: new Date().toISOString() },
  };
}
