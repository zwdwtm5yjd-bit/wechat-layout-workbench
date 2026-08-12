import {
  AI_LAYOUT_STRUCTURE_STRATEGY_IDS,
  type AiLayoutCandidateProfileId,
  type AiLayoutComponentId,
  type AiLayoutDecision,
  type AiLayoutDesignLanguageId,
  type AiLayoutTemplateCatalogCategoryId,
  type AiLayoutTemplateContentClass,
  type AiLayoutTemplateImagePolicy,
  type AiLayoutTemplateSummary,
  type AiLayoutStructureStrategyId,
  type AiLayoutTreatment,
} from "@wechat-layout/api-contracts";

export const AI_LAYOUT_TEMPLATE_CATALOG_VERSION = "2026.08.1";

export { AI_LAYOUT_STRUCTURE_STRATEGY_IDS };

export const AI_LAYOUT_TEMPLATE_VARIANT_IDS = [
  "classic",
  "compact",
  "visual",
  "narrative",
  "modular",
] as const;

export type AiLayoutTemplateVariantId = (typeof AI_LAYOUT_TEMPLATE_VARIANT_IDS)[number];

export type AiLayoutTemplateDividerPolicy =
  "alternating-sections" | "evidence" | "milestones" | "sections" | "visual-beats";

export interface AiLayoutTemplateDefinition extends AiLayoutTemplateSummary {
  readonly components: Readonly<Partial<Record<AiLayoutTreatment, AiLayoutComponentId>>>;
  readonly conceptLead: string;
  readonly differenceHighlights: readonly string[];
  readonly dividerComponentId: AiLayoutDecision["dividerComponentId"];
  readonly dividerPolicy: AiLayoutTemplateDividerPolicy;
  readonly footerComponentId: AiLayoutDecision["footer"]["componentId"];
  readonly footerMode: string;
  readonly heroComponentId: AiLayoutDecision["hero"]["componentId"];
  readonly heroMode: string;
  readonly maxCards: number;
  readonly maxDataCards: number;
  readonly maxQuotes: number;
  readonly minimumSourceImages: number;
  readonly negativeSignals: readonly string[];
  readonly preferredLanguageIds: readonly AiLayoutDesignLanguageId[];
  readonly positiveSignals: readonly string[];
  readonly promotionOffset: number;
  readonly promotionStride: number;
  readonly rhythm: AiLayoutDecision["rhythm"];
  readonly strategyId: AiLayoutStructureStrategyId;
  readonly structuralFingerprint: string;
  readonly variantId: AiLayoutTemplateVariantId;
  readonly visualIntensity: AiLayoutDecision["visualIntensity"];
}

interface StrategyDefinition {
  readonly catalogCategoryId: AiLayoutTemplateCatalogCategoryId;
  readonly categoryLabel: string;
  readonly conceptLead: string;
  readonly contentClasses: readonly AiLayoutTemplateContentClass[];
  readonly label: string;
  readonly names: readonly [string, string, string, string, string];
  readonly preferredLanguageIds: readonly AiLayoutDesignLanguageId[];
  readonly profileId: AiLayoutCandidateProfileId;
  readonly strategyId: AiLayoutStructureStrategyId;
  readonly tags: readonly string[];
  readonly positiveSignals: readonly string[];
}

interface VariantDefinition {
  readonly dividerPolicy: AiLayoutTemplateDividerPolicy;
  readonly footerMode: string;
  readonly heroMode: string;
  readonly imagePolicy: AiLayoutTemplateImagePolicy;
  readonly label: string;
  readonly maxCards: number;
  readonly maxDataCards: number;
  readonly maxQuotes: number;
  readonly minimumSourceImages: number;
  readonly promotionOffset: number;
  readonly promotionStride: number;
  readonly rhythm: AiLayoutDecision["rhythm"];
  readonly variantId: AiLayoutTemplateVariantId;
  readonly visualIntensity: AiLayoutDecision["visualIntensity"];
}

const strategies: readonly StrategyDefinition[] = [
  {
    catalogCategoryId: "official-report",
    categoryLabel: "政务报告",
    conceptLead: "先建立报刊式阅读索引，再用清楚的章节锚点推进全文。",
    contentClasses: ["government", "data", "narrative"],
    label: "报刊导读",
    names: ["报刊导读", "头版快讯", "图片报道", "深度特稿", "专题目录"],
    preferredLanguageIds: ["crimson-editorial", "news-editorial", "civic-blue"],
    profileId: "editorial-index",
    strategyId: "editorial-index",
    tags: ["导读", "目录", "政务", "长文"],
    positiveSignals: ["通报", "要闻", "专题", "观点", "报道"],
  },
  {
    catalogCategoryId: "official-report",
    categoryLabel: "政务报告",
    conceptLead: "把关键判断分组成简报卡片，形成清晰的阅读批次。",
    contentClasses: ["government", "technical", "data"],
    label: "简报卡片",
    names: ["工作简报", "决策摘要", "图解要点", "案例摘要", "模块汇报"],
    preferredLanguageIds: ["civic-blue", "minimal-blue", "annual-report"],
    profileId: "briefing-cards",
    strategyId: "briefing-cards",
    tags: ["简报", "卡片", "汇报", "摘要"],
    positiveSignals: ["简报", "决策", "摘要", "案例", "汇报"],
  },
  {
    catalogCategoryId: "data-business",
    categoryLabel: "数据商业",
    conceptLead: "让数据、成果和来源成为视觉证据链。",
    contentClasses: ["data", "government", "technical"],
    label: "数据证据",
    names: ["数据证据", "指标仪表", "图表解读", "调研发现", "对标分析"],
    preferredLanguageIds: ["data-dashboard", "annual-report", "academic-journal"],
    profileId: "evidence-led",
    strategyId: "evidence-led",
    tags: ["数据", "成果", "报告", "指标"],
    positiveSignals: ["数据", "指标", "图表", "调研", "对标"],
  },
  {
    catalogCategoryId: "knowledge-guide",
    categoryLabel: "知识指南",
    conceptLead: "保持连续阅读，只在真正转折处设置少量强调。",
    contentClasses: ["narrative", "government", "technical"],
    label: "极简长读",
    names: ["极简长读", "观点短评", "摄影随笔", "思辨文章", "学术综述"],
    preferredLanguageIds: ["minimal-blue", "warm-paper", "academic-journal"],
    profileId: "minimal-longread",
    strategyId: "minimal-longread",
    tags: ["长读", "留白", "克制", "评论"],
    positiveSignals: ["观点", "评论", "随笔", "思辨", "综述"],
  },
  {
    catalogCategoryId: "story-people",
    categoryLabel: "故事人物",
    conceptLead: "让原稿图片成为叙事节点，用短引语串联现场。",
    contentClasses: ["narrative", "government"],
    label: "纪实图文",
    names: ["纪实图文", "活动回顾", "摄影图说", "场景故事", "人物特写"],
    preferredLanguageIds: ["warm-paper", "news-editorial", "forest-green"],
    profileId: "documentary-visual",
    strategyId: "documentary-visual",
    tags: ["图片", "现场", "人物", "纪实"],
    positiveSignals: ["现场", "活动", "摄影", "场景", "人物"],
  },
  {
    catalogCategoryId: "official-report",
    categoryLabel: "政务报告",
    conceptLead: "把目标、动作、责任和结果组织成可执行的阅读路线。",
    contentClasses: ["government", "technical", "data"],
    label: "行动路线",
    names: ["行动路线", "部署落实", "工具工作流", "分步实操", "治理闭环"],
    preferredLanguageIds: ["civic-blue", "annual-report", "minimal-blue"],
    profileId: "action-roadmap",
    strategyId: "action-roadmap",
    tags: ["行动", "计划", "机制", "落实"],
    positiveSignals: ["行动", "部署", "流程", "步骤", "闭环"],
  },
  {
    catalogCategoryId: "data-business",
    categoryLabel: "数据商业",
    conceptLead: "按时间、阶段和里程碑组织进展，突出前后变化。",
    contentClasses: ["government", "data", "narrative"],
    label: "时间轴复盘",
    names: ["时间轴复盘", "年度复盘", "发展历程", "项目纪年", "前后焕新"],
    preferredLanguageIds: ["annual-report", "news-editorial", "warm-paper"],
    profileId: "action-roadmap",
    strategyId: "timeline-milestones",
    tags: ["时间轴", "复盘", "阶段", "大事记"],
    positiveSignals: ["时间", "年度", "历程", "项目", "焕新"],
  },
  {
    catalogCategoryId: "story-people",
    categoryLabel: "故事人物",
    conceptLead: "由原文中的关键判断和人物话语领读章节。",
    contentClasses: ["narrative", "government"],
    label: "引语人物",
    names: ["对话访谈", "主理人来信", "语录特写", "人物故事", "团队群像"],
    preferredLanguageIds: ["warm-paper", "ink-gold", "news-editorial"],
    profileId: "documentary-visual",
    strategyId: "quote-led",
    tags: ["人物", "金句", "访谈", "故事"],
    positiveSignals: ["对话", "来信", "语录", "人物", "团队"],
  },
  {
    catalogCategoryId: "brand-event",
    categoryLabel: "品牌活动",
    conceptLead: "用杂志式章节开合、侧记和重点页组织深度内容。",
    contentClasses: ["narrative", "technical", "government"],
    label: "章节杂志",
    names: ["章节杂志", "品牌宣言", "节日专题", "展览导览", "产品发布"],
    preferredLanguageIds: ["news-editorial", "jade-oriental", "future-purple"],
    profileId: "editorial-index",
    strategyId: "chapter-magazine",
    tags: ["杂志", "章节", "专题", "深度"],
    positiveSignals: ["品牌", "节日", "展览", "产品", "专题"],
  },
  {
    catalogCategoryId: "knowledge-guide",
    categoryLabel: "知识指南",
    conceptLead: "把步骤、要点和注意事项组织成可直接执行的清单。",
    contentClasses: ["technical", "government", "data"],
    label: "清单教程",
    names: ["清单教程", "办事指南", "故障排查", "资源目录", "活动议程"],
    preferredLanguageIds: ["minimal-blue", "data-dashboard", "playful-notebook"],
    profileId: "briefing-cards",
    strategyId: "checklist-guide",
    tags: ["教程", "步骤", "清单", "方法"],
    positiveSignals: ["教程", "指南", "排查", "资源", "议程"],
  },
];

const variants: readonly VariantDefinition[] = [
  {
    dividerPolicy: "sections",
    footerMode: "summary",
    heroMode: "cover",
    imagePolicy: "optional",
    label: "经典",
    maxCards: 2,
    maxDataCards: 1,
    maxQuotes: 2,
    minimumSourceImages: 0,
    promotionOffset: 1,
    promotionStride: 4,
    rhythm: "balanced",
    variantId: "classic",
    visualIntensity: "balanced",
  },
  {
    dividerPolicy: "milestones",
    footerMode: "checklist",
    heroMode: "headline",
    imagePolicy: "text-first",
    label: "紧凑",
    maxCards: 3,
    maxDataCards: 2,
    maxQuotes: 1,
    minimumSourceImages: 0,
    promotionOffset: 0,
    promotionStride: 3,
    rhythm: "compact",
    variantId: "compact",
    visualIntensity: "bold",
  },
  {
    dividerPolicy: "visual-beats",
    footerMode: "caption",
    heroMode: "visual-lead",
    imagePolicy: "source-priority",
    label: "视觉",
    maxCards: 1,
    maxDataCards: 1,
    maxQuotes: 2,
    minimumSourceImages: 1,
    promotionOffset: 2,
    promotionStride: 4,
    rhythm: "airy",
    variantId: "visual",
    visualIntensity: "balanced",
  },
  {
    dividerPolicy: "alternating-sections",
    footerMode: "reflection",
    heroMode: "quote-lead",
    imagePolicy: "optional",
    label: "叙事",
    maxCards: 1,
    maxDataCards: 1,
    maxQuotes: 3,
    minimumSourceImages: 0,
    promotionOffset: 2,
    promotionStride: 5,
    rhythm: "airy",
    variantId: "narrative",
    visualIntensity: "restrained",
  },
  {
    dividerPolicy: "evidence",
    footerMode: "action",
    heroMode: "index",
    imagePolicy: "optional",
    label: "模块",
    maxCards: 3,
    maxDataCards: 2,
    maxQuotes: 2,
    minimumSourceImages: 0,
    promotionOffset: 1,
    promotionStride: 2,
    rhythm: "balanced",
    variantId: "modular",
    visualIntensity: "bold",
  },
];

const heading1Components = [
  "cmp_head_level1_underlined_003",
  "cmp_head_level1_frame_006",
  "cmp_head_level1_numbered_002",
  "cmp_head_level1_centered_004",
  "cmp_head_mist_mountains_007",
] as const;
const heading2Components = [
  "cmp_head_level2_leftbar_002",
  "cmp_head_level2_pill_005",
  "cmp_head_level2_underlined_003",
  "cmp_head_level2_plain_004",
  "cmp_head_cloud_scroll_008",
] as const;
const quoteComponents = [
  "cmp_quote_standard_leftline_001",
  "cmp_quote_conclusion_card_003",
  "cmp_quote_document_source_004",
  "cmp_quote_highlight_center_006",
  "cmp_quote_postcard_warm_005",
] as const;
const noticeComponents = [
  "cmp_notice_info_blue_001",
  "cmp_notice_checklist_action_005",
  "cmp_notice_success_green_002",
  "cmp_notice_story_intro_006",
  "cmp_notice_warning_amber_003",
] as const;
const imageComponents = [
  "cmp_image_border_documentary_003",
  "cmp_image_rounded_caption_002",
  "cmp_image_centered_numbered_004",
  "cmp_image_fullwidth_clean_001",
  "cmp_image_polaroid_caption_005",
] as const;
const dividerComponents = [
  "cmp_divider_solid_clean_001",
  "cmp_divider_dashed_subtle_002",
  "cmp_divider_ornament_center_003",
  "cmp_divider_ornament_dots_004",
  "cmp_divider_solid_clean_001",
] as const;
const heroComponents = [
  "cmp_gov_red_gold_banner_001",
  "cmp_tech_orbit_hero_001",
  "cmp_hero_ink_mountain_001",
  "cmp_intro_bamboo_note_002",
  "cmp_intro_leaf_story_003",
] as const;

const strategyRuleVersions: Readonly<Record<AiLayoutStructureStrategyId, string>> = {
  "editorial-index": "heading-signal-short-sections:v1",
  "briefing-cards": "batched-summary-cards:v1",
  "evidence-led": "numeric-evidence-first:v1",
  "minimal-longread": "continuous-reading-single-quote:v1",
  "documentary-visual": "image-adjacent-narrative-beats:v1",
  "action-roadmap": "action-and-responsibility-cards:v1",
  "timeline-milestones": "date-and-stage-milestones:v1",
  "quote-led": "quoted-and-rhythmic-voice:v1",
  "chapter-magazine": "short-chapter-openers:v1",
  "checklist-guide": "imperative-step-cards:v1",
};

function structuralFingerprint(
  strategy: StrategyDefinition,
  variant: VariantDefinition,
  components: Readonly<{
    divider: AiLayoutDecision["dividerComponentId"];
    footer: AiLayoutDecision["footer"]["componentId"];
    hero: AiLayoutDecision["hero"]["componentId"];
    image: AiLayoutComponentId;
    quote: AiLayoutComponentId;
    section: AiLayoutComponentId;
    title: AiLayoutComponentId;
  }>,
): string {
  return [
    `rules=${strategyRuleVersions[strategy.strategyId]}`,
    `hero=${variant.heroMode}`,
    `footer=${variant.footerMode}`,
    `divider=${variant.dividerPolicy}`,
    `image=${variant.imagePolicy}`,
    `budget=${String(variant.maxCards)}.${String(variant.maxDataCards)}.${String(variant.maxQuotes)}`,
    `promotion=${String(variant.promotionOffset)}.${String(variant.promotionStride)}`,
    `components=${components.hero}.${components.footer}.${components.divider}.${components.title}.${components.section}.${components.quote}.${components.image}`,
  ].join("|");
}

function componentAt<T>(values: readonly T[], index: number): T {
  const value = values[index % values.length];
  if (value === undefined) throw new Error("AI layout template component is required");
  return value;
}

function templateDefinition(
  strategy: StrategyDefinition,
  strategyIndex: number,
  variant: VariantDefinition,
  variantIndex: number,
): AiLayoutTemplateDefinition {
  const componentIndex = strategyIndex + variantIndex;
  const templateId = `${strategy.strategyId}-${variant.variantId}`;
  const name = componentAt(strategy.names, variantIndex);
  const components = {
    divider: componentAt(dividerComponents, componentIndex),
    footer: componentAt(noticeComponents, componentIndex + 3),
    hero: componentAt(heroComponents, componentIndex),
    image: componentAt(imageComponents, componentIndex),
    quote: componentAt(quoteComponents, componentIndex),
    section: componentAt(heading2Components, componentIndex),
    title: componentAt(heading1Components, componentIndex),
  } as const;
  const minimumSourceImages =
    strategy.strategyId === "documentary-visual" &&
    ["visual", "modular"].includes(variant.variantId)
      ? 1
      : strategy.strategyId === "timeline-milestones" &&
          ["visual", "modular"].includes(variant.variantId)
        ? 2
        : variant.minimumSourceImages;
  return {
    catalogCategoryId: strategy.catalogCategoryId,
    categoryLabel: strategy.categoryLabel,
    components: {
      callout: componentAt(noticeComponents, componentIndex + 1),
      data: componentAt(noticeComponents, componentIndex + 2),
      image: components.image,
      quote: components.quote,
      section: components.section,
      title: components.title,
    },
    conceptLead: `${strategy.conceptLead}${variant.label}变体采用${variant.heroMode}首屏、${variant.dividerPolicy}分隔和${variant.footerMode}收尾。`,
    contentClasses: strategy.contentClasses,
    defaultLanguageId: componentAt(strategy.preferredLanguageIds, 0),
    description: `${strategy.conceptLead}以${variant.label}节奏组织首屏、强调模块、图片与收尾。`,
    differenceHighlights: [
      `${variant.heroMode}首屏 + ${variant.footerMode}收尾`,
      `${variant.dividerPolicy}章节分隔`,
      `${variant.imagePolicy}图片策略·卡片${String(variant.maxCards)}·引语${String(variant.maxQuotes)}`,
    ],
    dividerComponentId: components.divider,
    dividerPolicy: variant.dividerPolicy,
    footerComponentId: components.footer,
    footerMode: variant.footerMode,
    heroComponentId: components.hero,
    heroMode: variant.heroMode,
    imagePolicy: variant.imagePolicy,
    maxCards: variant.maxCards,
    maxDataCards: variant.maxDataCards,
    maxQuotes: variant.maxQuotes,
    minimumSourceImages,
    name,
    negativeSignals: minimumSourceImages > 0 ? ["无原稿图片", "仅文本"] : [],
    preferredLanguageIds: strategy.preferredLanguageIds,
    positiveSignals: [
      name,
      name.slice(-2),
      ...strategy.positiveSignals,
      ...(variant.imagePolicy === "source-priority" ? ["图片", "照片", "图说"] : []),
    ],
    previewKey: templateId,
    profileId: strategy.profileId,
    promotionOffset: variant.promotionOffset,
    promotionStride: variant.promotionStride,
    rhythm: variant.rhythm,
    sourceImageFallback: "text-first",
    strategyId: strategy.strategyId,
    structuralFingerprint: structuralFingerprint(strategy, variant, components),
    structureLabel: name,
    tags: [...strategy.tags, variant.label],
    templateId,
    variantId: variant.variantId,
    version: 1,
    visualIntensity: variant.visualIntensity,
  };
}

export const AI_LAYOUT_TEMPLATES: readonly AiLayoutTemplateDefinition[] = strategies.flatMap(
  (strategy, strategyIndex) =>
    variants.map((variant, variantIndex) =>
      templateDefinition(strategy, strategyIndex, variant, variantIndex),
    ),
);

const templateById = new Map(
  AI_LAYOUT_TEMPLATES.map((template) => [template.templateId, template]),
);

export function aiLayoutTemplate(templateId: string): AiLayoutTemplateDefinition | undefined {
  return templateById.get(templateId);
}

export function aiLayoutTemplateCatalog(): readonly AiLayoutTemplateSummary[] {
  return AI_LAYOUT_TEMPLATES.map(
    ({
      catalogCategoryId,
      categoryLabel,
      contentClasses,
      defaultLanguageId,
      description,
      imagePolicy,
      minimumSourceImages,
      name,
      preferredLanguageIds,
      previewKey,
      profileId,
      rhythm,
      sourceImageFallback,
      strategyId,
      structureLabel,
      tags,
      templateId,
      version,
      visualIntensity,
    }) => ({
      catalogCategoryId,
      categoryLabel,
      contentClasses,
      defaultLanguageId,
      description,
      imagePolicy,
      minimumSourceImages,
      name,
      preferredLanguageIds,
      previewKey,
      profileId,
      rhythm,
      sourceImageFallback,
      strategyId,
      structureLabel,
      tags,
      templateId,
      version,
      visualIntensity,
    }),
  );
}
