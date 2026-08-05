import {
  COMPONENT_MANIFEST_SCHEMA_VERSION,
  type ComponentCategory,
  type ComponentInsertionPreset,
  type ComponentManifestV1_1,
  type ComponentNodeType,
  type ComponentSlotBinding,
  type ComponentSlotKind,
  type ComponentSlotSchema,
} from "./manifest-schema.js";
import { ComponentRegistry, type ComponentSlotValues } from "./registry.js";

export const OFFICIAL_COMPONENT_PREVIEW_LAYOUTS = [
  "heading",
  "quote",
  "notice",
  "data",
  "image",
  "divider",
  "footer",
] as const;

export type OfficialComponentPreviewLayout = (typeof OFFICIAL_COMPONENT_PREVIEW_LAYOUTS)[number];

export interface OfficialComponentPreviewSample {
  readonly body?: string;
  readonly caption?: string;
  readonly eyebrow?: string;
  readonly footer?: string;
  readonly imageAlt?: string;
  readonly source?: string;
  readonly title?: string;
  readonly unit?: string;
  readonly value?: string;
}

export interface OfficialComponentPreview {
  readonly categoryLabel: string;
  readonly description: string;
  readonly layoutKey: OfficialComponentPreviewLayout;
  readonly name: string;
  readonly sample: OfficialComponentPreviewSample;
}

export interface OfficialComponentAsset {
  readonly defaultSlots: ComponentSlotValues;
  readonly manifest: ComponentManifestV1_1;
  readonly preview: OfficialComponentPreview;
}

interface OfficialComponentDefinition {
  readonly adjustableProperties: readonly string[];
  readonly category: ComponentCategory;
  readonly componentId: string;
  readonly defaultSlots: ComponentSlotValues;
  readonly defaultTokenMap: ComponentManifestV1_1["defaultTokenMap"];
  readonly description: string;
  readonly insertionPreset: ComponentInsertionPreset;
  readonly name: string;
  readonly nodeType: ComponentNodeType;
  readonly preview: Omit<OfficialComponentPreview, "description" | "name">;
  readonly scenarios: readonly string[];
  readonly semanticRoles: readonly string[];
  readonly slots: readonly ComponentSlotSchema[];
}

const OFFICIAL_THEME_IDS = [
  "0198f8e1-7a01-7000-8000-000000000101",
  "0198f8e1-7a01-7000-8000-000000000102",
  "0198f8e1-7a01-7000-8000-000000000103",
  "0198f8e1-7a01-7000-8000-000000000104",
  "0198f8e1-7a01-7000-8000-000000000105",
  "0198f8e1-7a01-7000-8000-000000000106",
  "0198f8e1-7a01-7000-8000-000000000107",
  "0198f8e1-7a01-7000-8000-000000000108",
  "0198f8e1-7a01-7000-8000-000000000109",
  "0198f8e1-7a01-7000-8000-000000000110",
] as const;

const RENDERER_KEYS: Readonly<
  Record<
    ComponentNodeType,
    { readonly editorRendererKey: string; readonly wechatRendererKey: string }
  >
> = {
  blockquote: {
    editorRendererKey: "OfficialBlockquoteNodeView",
    wechatRendererKey: "officialBlockquoteRenderer",
  },
  brandFooter: {
    editorRendererKey: "OfficialBrandFooterNodeView",
    wechatRendererKey: "officialBrandFooterRenderer",
  },
  divider: {
    editorRendererKey: "OfficialDividerNodeView",
    wechatRendererKey: "officialDividerRenderer",
  },
  heading: {
    editorRendererKey: "OfficialHeadingNodeView",
    wechatRendererKey: "officialHeadingRenderer",
  },
  imageBlock: {
    editorRendererKey: "OfficialImageBlockNodeView",
    wechatRendererKey: "officialImageBlockRenderer",
  },
  semanticCard: {
    editorRendererKey: "OfficialSemanticCardNodeView",
    wechatRendererKey: "officialSemanticCardRenderer",
  },
};

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function slot(
  slotId: string,
  label: string,
  kind: ComponentSlotKind,
  editorBinding: ComponentSlotBinding,
  options: {
    readonly maxLength?: number;
    readonly recommendedMaxLength?: number;
    readonly required?: boolean;
    readonly textLocked?: boolean;
  } = {},
): ComponentSlotSchema {
  return {
    allowImages: kind === "image",
    allowRichText: kind === "rich_text",
    editorBinding,
    kind,
    label,
    ...(options.maxLength === undefined ? {} : { maxLength: options.maxLength }),
    ...(options.recommendedMaxLength === undefined
      ? {}
      : { recommendedMaxLength: options.recommendedMaxLength }),
    required: options.required ?? true,
    slotId,
    textLocked: options.textLocked ?? false,
    wechatExport: kind === "image" ? "image" : kind === "rich_text" ? "rich_text" : "plain_text",
  };
}

function defineAsset(definition: OfficialComponentDefinition): OfficialComponentAsset {
  const rendererKeys = RENDERER_KEYS[definition.nodeType];
  const manifest: ComponentManifestV1_1 = {
    adjustableProperties: definition.adjustableProperties,
    category: definition.category,
    compatibilityLevel: "safe",
    componentId: definition.componentId,
    defaultTokenMap: definition.defaultTokenMap,
    defaultVariantId: "default",
    description: definition.description,
    documentation: `内置基础组件：${definition.name}。只使用受控 Token 与微信安全静态结构。`,
    editorRendererKey: rendererKeys.editorRendererKey,
    fallback: {
      kind: definition.nodeType === "semanticCard" ? "semantic_card" : "plain_text",
      preserveOriginalText: true,
      rendererKey: "safePlaceholder",
    },
    insertionPreset: definition.insertionPreset,
    name: definition.name,
    nodeType: definition.nodeType,
    previewAssetId: `preview_${definition.componentId}`,
    scenarios: definition.scenarios,
    schemaVersion: COMPONENT_MANIFEST_SCHEMA_VERSION,
    semanticRoles: definition.semanticRoles,
    slots: definition.slots,
    supportedThemeIds: OFFICIAL_THEME_IDS,
    variants: [{ name: "默认", variantId: "default" }],
    version: "1.0.0",
    wechatRendererKey: rendererKeys.wechatRendererKey,
  };
  return {
    defaultSlots: definition.defaultSlots,
    manifest,
    preview: {
      ...definition.preview,
      description: definition.description,
      name: definition.name,
    },
  };
}

const headingTitleSlot = slot("title", "标题", "text", "content", {
  maxLength: 240,
  recommendedMaxLength: 42,
});
const quoteBodySlot = slot("body", "引用正文", "rich_text", "content", {
  maxLength: 4_000,
  recommendedMaxLength: 280,
});
const quoteSourceSlot = slot("source", "来源", "text", "footer", {
  maxLength: 160,
  recommendedMaxLength: 60,
  required: false,
});
const noticeTitleSlot = slot("title", "提示标题", "text", "title", {
  maxLength: 120,
  recommendedMaxLength: 24,
});
const noticeBodySlot = slot("body", "提示内容", "rich_text", "content", {
  maxLength: 4_000,
  recommendedMaxLength: 240,
});
const imageSlot = slot("image", "图片", "image", "content");
const footerBodySlot = slot("body", "文末文字", "rich_text", "content", {
  maxLength: 2_000,
  recommendedMaxLength: 160,
});

function headingDefinition(input: {
  readonly componentId: string;
  readonly description: string;
  readonly level: 1 | 2;
  readonly name: string;
  readonly sample: string;
  readonly scenarios: readonly string[];
  readonly tokenMap: ComponentManifestV1_1["defaultTokenMap"];
}): OfficialComponentDefinition {
  return {
    adjustableProperties: [
      "color",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "marginBottom",
      "marginTop",
      "textAlign",
    ],
    category: "HEAD",
    componentId: input.componentId,
    defaultSlots: { title: input.sample },
    defaultTokenMap: input.tokenMap,
    description: input.description,
    insertionPreset: {
      attributes: { level: input.level },
      nodeType: "heading",
      slotBindings: [{ slotId: "title", target: { kind: "root_text" } }],
    },
    name: input.name,
    nodeType: "heading",
    preview: {
      categoryLabel: input.level === 1 ? "一级标题" : "二级标题",
      layoutKey: "heading",
      sample: { title: input.sample },
    },
    scenarios: input.scenarios,
    semanticRoles: [input.level === 1 ? "heading.level1" : "heading.level2"],
    slots: [headingTitleSlot],
  };
}

function quoteDefinition(input: {
  readonly componentId: string;
  readonly description: string;
  readonly name: string;
  readonly quoteType: "citation" | "standard" | "warning";
  readonly sample: string;
  readonly showQuotes: boolean;
  readonly source: string;
  readonly tokenMap: ComponentManifestV1_1["defaultTokenMap"];
  readonly variant: string;
}): OfficialComponentDefinition {
  return {
    adjustableProperties: [
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "color",
      "fontSize",
      "lineHeight",
      "paddingBottom",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
    ],
    category: "QUOTE",
    componentId: input.componentId,
    defaultSlots: { body: input.sample, source: input.source },
    defaultTokenMap: input.tokenMap,
    description: input.description,
    insertionPreset: {
      attributes: {
        quoteType: input.quoteType,
        showQuotes: input.showQuotes,
        showSource: true,
        variant: input.variant,
      },
      nodeType: "blockquote",
      slotBindings: [
        {
          slotId: "body",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
        { slotId: "source", target: { attribute: "source", kind: "root_attribute" } },
      ],
    },
    name: input.name,
    nodeType: "blockquote",
    preview: {
      categoryLabel: "引用",
      layoutKey: "quote",
      sample: { body: input.sample, source: input.source },
    },
    scenarios: ["longform", "opinion", "government"],
    semanticRoles: ["quote"],
    slots: [quoteBodySlot, quoteSourceSlot],
  };
}

function noticeDefinition(input: {
  readonly componentId: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly name: string;
  readonly sample: string;
  readonly title: string;
  readonly tokenMap: ComponentManifestV1_1["defaultTokenMap"];
  readonly variant: string;
}): OfficialComponentDefinition {
  return {
    adjustableProperties: [
      "backgroundColor",
      "borderColor",
      "borderRadius",
      "borderWidth",
      "color",
      "paddingBottom",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
    ],
    category: "NOTICE",
    componentId: input.componentId,
    defaultSlots: { body: input.sample, eyebrow: input.eyebrow, title: input.title },
    defaultTokenMap: input.tokenMap,
    description: input.description,
    insertionPreset: {
      attributes: { variant: input.variant },
      nodeType: "semanticCard",
      slotBindings: [
        { slotId: "eyebrow", target: { attribute: "eyebrow", kind: "root_attribute" } },
        { slotId: "title", target: { attribute: "title", kind: "root_attribute" } },
        {
          slotId: "body",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
      ],
    },
    name: input.name,
    nodeType: "semanticCard",
    preview: {
      categoryLabel: "提示",
      layoutKey: "notice",
      sample: { body: input.sample, eyebrow: input.eyebrow, title: input.title },
    },
    scenarios: ["notice", input.variant],
    semanticRoles: ["notice", `notice.${input.variant}`],
    slots: [
      slot("eyebrow", "语义标签", "text", "eyebrow", {
        maxLength: 24,
        recommendedMaxLength: 8,
      }),
      noticeTitleSlot,
      noticeBodySlot,
    ],
  };
}

function dataDefinition(input: {
  readonly componentId: string;
  readonly description: string;
  readonly name: string;
  readonly sample: OfficialComponentPreviewSample;
  readonly slots: readonly ComponentSlotSchema[];
  readonly defaultSlots: ComponentSlotValues;
  readonly bindings: ComponentInsertionPreset & { readonly nodeType: "semanticCard" };
  readonly tokenMap: ComponentManifestV1_1["defaultTokenMap"];
  readonly variant: string;
}): OfficialComponentDefinition {
  return {
    adjustableProperties: [
      "backgroundColor",
      "borderColor",
      "borderRadius",
      "borderWidth",
      "columns",
      "color",
      "fontSize",
      "fontWeight",
      "paddingBottom",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "textAlign",
    ],
    category: "DATA",
    componentId: input.componentId,
    defaultSlots: input.defaultSlots,
    defaultTokenMap: input.tokenMap,
    description: input.description,
    insertionPreset: input.bindings,
    name: input.name,
    nodeType: "semanticCard",
    preview: {
      categoryLabel: "数据卡",
      layoutKey: "data",
      sample: input.sample,
    },
    scenarios: ["data", input.variant],
    semanticRoles: ["data", `data.${input.variant}`],
    slots: input.slots,
  };
}

function imageDefinition(input: {
  readonly caption: string;
  readonly componentId: string;
  readonly description: string;
  readonly name: string;
  readonly preset: ComponentInsertionPreset & { readonly nodeType: "imageBlock" };
  readonly resourceId: string;
  readonly tokenMap: ComponentManifestV1_1["defaultTokenMap"];
  readonly variant: string;
}): OfficialComponentDefinition {
  const image = {
    alt: input.name,
    caption: input.caption,
    resourceId: input.resourceId,
  };
  return {
    adjustableProperties: [
      "borderColor",
      "borderRadius",
      "borderWidth",
      "boxShadow",
      "marginBottom",
      "marginTop",
    ],
    category: "IMAGE",
    componentId: input.componentId,
    defaultSlots: { image },
    defaultTokenMap: input.tokenMap,
    description: input.description,
    insertionPreset: input.preset,
    name: input.name,
    nodeType: "imageBlock",
    preview: {
      categoryLabel: "图片样式",
      layoutKey: "image",
      sample: { caption: input.caption, imageAlt: input.name },
    },
    scenarios: ["image", input.variant],
    semanticRoles: ["image", `image.${input.variant}`],
    slots: [imageSlot],
  };
}

function dividerDefinition(input: {
  readonly componentId: string;
  readonly description: string;
  readonly name: string;
  readonly preset: ComponentInsertionPreset & { readonly nodeType: "divider" };
  readonly tokenMap: ComponentManifestV1_1["defaultTokenMap"];
  readonly variant: string;
}): OfficialComponentDefinition {
  return {
    adjustableProperties: [
      "borderColor",
      "borderStyle",
      "borderWidth",
      "marginBottom",
      "marginTop",
    ],
    category: "DIVIDER",
    componentId: input.componentId,
    defaultSlots: {},
    defaultTokenMap: input.tokenMap,
    description: input.description,
    insertionPreset: input.preset,
    name: input.name,
    nodeType: "divider",
    preview: {
      categoryLabel: "分割线",
      layoutKey: "divider",
      sample: {},
    },
    scenarios: ["section", input.variant],
    semanticRoles: ["divider"],
    slots: [],
  };
}

const definitions: readonly OfficialComponentDefinition[] = [
  headingDefinition({
    componentId: "cmp_head_level1_leftbar_001",
    description: "以主色左线建立明确章节起点，长标题可自然换行。",
    level: 1,
    name: "左线主章标题",
    sample: "让真正重要的内容被看见",
    scenarios: ["longform", "government", "report"],
    tokenMap: {
      borderColor: "{colors.primary}",
      borderStyle: "solid",
      borderWidth: 4,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      lineHeight: "{typography.heading1LineHeight}",
      paddingLeft: "{spacing.md}",
      variant: "leftbar",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level1_numbered_002",
    description: "保留原文编号语义，用稳定字阶呈现正式章节。",
    level: 1,
    name: "编号章节标题",
    sample: "一、把工作做深做实",
    scenarios: ["government", "legal", "report"],
    tokenMap: {
      color: "{colors.primaryDark}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      letterSpacing: 0.5,
      lineHeight: "{typography.heading1LineHeight}",
      variant: "numbered",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level1_underlined_003",
    description: "以底线和留白强化一级层级，适合编辑与观点长文。",
    level: 1,
    name: "细线一级标题",
    sample: "阅读秩序比装饰更重要",
    scenarios: ["editorial", "opinion", "interview"],
    tokenMap: {
      borderColor: "{colors.borderStrong}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      lineHeight: "{typography.heading1LineHeight}",
      paddingBottom: "{spacing.sm}",
      variant: "underlined",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level1_centered_004",
    description: "居中的克制章节题，适合人物、文化与品牌内容。",
    level: 1,
    name: "居中留白标题",
    sample: "留白也是信息的一部分",
    scenarios: ["brand", "culture", "person"],
    tokenMap: {
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      letterSpacing: 1,
      lineHeight: "{typography.heading1LineHeight}",
      textAlign: "center",
      variant: "centered",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level2_dot_001",
    description: "用轻量强调点标记小节，不抢占一级标题层级。",
    level: 2,
    name: "强调点小节标题",
    sample: "以高质量执行回应发展要求",
    scenarios: ["government", "report", "summary"],
    tokenMap: {
      color: "{colors.primary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      lineHeight: "{typography.heading2LineHeight}",
      variant: "dot",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level2_leftbar_002",
    description: "细左线二级标题，适合高密度长文的连续分段。",
    level: 2,
    name: "轻左线小节标题",
    sample: "把信息分成清楚的小节",
    scenarios: ["longform", "legal", "guide"],
    tokenMap: {
      borderColor: "{colors.primary}",
      borderStyle: "solid",
      borderWidth: 2,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      lineHeight: "{typography.heading2LineHeight}",
      paddingLeft: "{spacing.sm}",
      variant: "leftbar",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level2_underlined_003",
    description: "用短底线表达小节起点，在简洁主题中保持节奏。",
    level: 2,
    name: "短线二级标题",
    sample: "每一次强调都要有明确含义",
    scenarios: ["editorial", "technology", "analysis"],
    tokenMap: {
      borderColor: "{colors.accent}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      paddingBottom: "{spacing.xs}",
      variant: "underlined",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level2_plain_004",
    description: "仅依靠字阶和间距的素净二级标题，长文阅读最稳定。",
    level: 2,
    name: "素净二级标题",
    sample: "让每一段都有明确的职责",
    scenarios: ["general", "longform", "documentation"],
    tokenMap: {
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      lineHeight: "{typography.heading2LineHeight}",
      variant: "plain",
    },
  }),
  quoteDefinition({
    componentId: "cmp_quote_standard_leftline_001",
    description: "浅底左线的安全引用，适合正式长段和文件摘录。",
    name: "左线标准引用",
    quoteType: "standard",
    sample: "重点信息应该清晰，而不是喧闹。",
    showQuotes: false,
    source: "文章摘要",
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.primary}",
      borderStyle: "solid",
      borderWidth: 3,
      color: "{colors.textSecondary}",
      compatibilityLevel: "safe",
      lineHeight: "{typography.bodyLineHeight}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "leftline",
    },
    variant: "leftline",
  }),
  quoteDefinition({
    componentId: "cmp_quote_citation_marks_002",
    description: "显示引号与来源，用于人物讲述和访谈摘录。",
    name: "引号人物引语",
    quoteType: "citation",
    sample: "我们要把复杂的事情讲清楚，把清楚的事情做到位。",
    showQuotes: true,
    source: "人物访谈",
    tokenMap: {
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.quoteSize}",
      fontWeight: 500,
      lineHeight: "{typography.bodyLineHeight}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.xl}",
      variant: "quotation",
    },
    variant: "quotation",
  }),
  quoteDefinition({
    componentId: "cmp_quote_conclusion_card_003",
    description: "以轻卡片承载核心结论，在长段中建立可扫读锥点。",
    name: "重点结论引用",
    quoteType: "standard",
    sample: "最终要解决的不是样式多少，而是信息是否被准确理解。",
    showQuotes: false,
    source: "核心结论",
    tokenMap: {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.border}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontWeight: 600,
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "conclusion",
    },
    variant: "conclusion",
  }),
  quoteDefinition({
    componentId: "cmp_quote_document_source_004",
    description: "面向政策、法条和原文摘录，突出来源且保持长段可读。",
    name: "文件原文引用",
    quoteType: "citation",
    sample: "应当依照规定程序开展工作，确保事实清楚、依据充分、程序规范。",
    showQuotes: false,
    source: "文件原文",
    tokenMap: {
      backgroundColor: "{colors.surfaceStrong}",
      borderColor: "{colors.borderStrong}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textSecondary}",
      compatibilityLevel: "safe",
      lineHeight: "{typography.bodyLineHeight}",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "document",
    },
    variant: "document",
  }),
  noticeDefinition({
    componentId: "cmp_notice_info_blue_001",
    description: "用文字标签与浅色底呈现一般信息，不只依赖颜色传达语义。",
    eyebrow: "信息",
    name: "信息提示",
    sample: "这里放置需要读者提前了解的背景信息。",
    title: "阅读前请了解",
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.secondary}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "info",
    },
    variant: "info",
  }),
  noticeDefinition({
    componentId: "cmp_notice_success_green_002",
    description: "将完成状态与后续行动放在同一安全卡片中。",
    eyebrow: "已完成",
    name: "完成提示",
    sample: "已保存当前版本，可继续预览并执行兼容检查。",
    title: "当前步骤已完成",
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.success}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "success",
    },
    variant: "success",
  }),
  noticeDefinition({
    componentId: "cmp_notice_warning_amber_003",
    description: "明确标注注意事项，适合发布前检查和条件性说明。",
    eyebrow: "注意",
    name: "注意提示",
    sample: "发布前请核对图片、链接与文末账号信息。",
    title: "请完成最终预览",
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.warning}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 2,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "warning",
    },
    variant: "warning",
  }),
  noticeDefinition({
    componentId: "cmp_notice_risk_red_004",
    description: "同时使用风险文字和边线强调，保证黑白环境也能识别。",
    eyebrow: "风险",
    name: "风险警示",
    sample: "未完成兼容检查时，不建议直接复制到微信后台。",
    title: "当前内容存在发布风险",
    tokenMap: {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.danger}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 2,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "risk",
    },
    variant: "risk",
  }),
  dataDefinition({
    bindings: {
      attributes: { variant: "single_metric" },
      nodeType: "semanticCard",
      slotBindings: [
        { slotId: "title", target: { attribute: "title", kind: "root_attribute" } },
        {
          slotId: "value",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
        { slotId: "unit", target: { attribute: "footer", kind: "root_attribute" } },
      ],
    },
    componentId: "cmp_data_single_metric_001",
    defaultSlots: { title: "重点任务完成率", unit: "%", value: 96 },
    description: "以单个大数据为中心，单位与指标名称始终可见。",
    name: "单指标数据卡",
    sample: { title: "重点任务完成率", unit: "%", value: "96" },
    slots: [
      slot("title", "指标名称", "text", "title", { maxLength: 80 }),
      slot("value", "指标数值", "number", "content"),
      slot("unit", "单位", "text", "footer", { maxLength: 20 }),
    ],
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.border}",
      borderRadius: "{radius.md}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.primary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.dataSize}",
      fontWeight: 700,
      paddingBottom: "{spacing.xl}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.xl}",
      paddingTop: "{spacing.xl}",
      textAlign: "center",
      variant: "single_metric",
    },
    variant: "single_metric",
  }),
  dataDefinition({
    bindings: {
      attributes: { variant: "double_compare" },
      nodeType: "semanticCard",
      slotBindings: [
        { slotId: "title", target: { attribute: "title", kind: "root_attribute" } },
        {
          slotId: "primaryValue",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
        {
          slotId: "secondaryValue",
          target: { index: 1, kind: "child_text", nodeType: "paragraph" },
        },
      ],
    },
    componentId: "cmp_data_double_compare_002",
    defaultSlots: { primaryValue: 128, secondaryValue: 96, title: "本期 / 上期" },
    description: "并列呈现两个数值，小屏可按原顺序纵向降级。",
    name: "双数据对比卡",
    sample: { body: "本期 128 · 上期 96", title: "本期 / 上期", value: "128" },
    slots: [
      slot("title", "对比标题", "text", "title", { maxLength: 80 }),
      slot("primaryValue", "主数值", "number", "content"),
      slot("secondaryValue", "对比数值", "number", "content"),
    ],
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.border}",
      borderRadius: "{radius.md}",
      borderStyle: "solid",
      borderWidth: 1,
      columns: 2,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.dataSize}",
      fontWeight: 700,
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "double_compare",
    },
    variant: "double_compare",
  }),
  dataDefinition({
    bindings: {
      attributes: { variant: "progress" },
      nodeType: "semanticCard",
      slotBindings: [
        { slotId: "title", target: { attribute: "title", kind: "root_attribute" } },
        {
          slotId: "value",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
        { slotId: "unit", target: { attribute: "footer", kind: "root_attribute" } },
      ],
    },
    componentId: "cmp_data_progress_metric_003",
    defaultSlots: { title: "项目进度", unit: "%", value: 72 },
    description: "以数值文字表达进度，不依赖动画或仅靠色彩的进度条。",
    name: "进度指标卡",
    sample: { title: "项目进度", unit: "%", value: "72" },
    slots: [
      slot("title", "进度名称", "text", "title", { maxLength: 80 }),
      slot("value", "进度数值", "number", "content"),
      slot("unit", "单位", "text", "footer", { maxLength: 20 }),
    ],
    tokenMap: {
      backgroundColor: "{colors.surfaceStrong}",
      borderColor: "{colors.primary}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 2,
      color: "{colors.primary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.dataSize}",
      fontWeight: 700,
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "progress",
    },
    variant: "progress",
  }),
  dataDefinition({
    bindings: {
      attributes: { variant: "time_metric" },
      nodeType: "semanticCard",
      slotBindings: [
        { slotId: "title", target: { attribute: "title", kind: "root_attribute" } },
        {
          slotId: "value",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
        { slotId: "unit", target: { attribute: "footer", kind: "root_attribute" } },
      ],
    },
    componentId: "cmp_data_time_metric_004",
    defaultSlots: { title: "平均处理时长", unit: "分钟", value: 18 },
    description: "将时间数值与单位绑定展示，适合效率和节点数据。",
    name: "时间数据卡",
    sample: { title: "平均处理时长", unit: "分钟", value: "18" },
    slots: [
      slot("title", "时间指标", "text", "title", { maxLength: 80 }),
      slot("value", "时间数值", "number", "content"),
      slot("unit", "时间单位", "text", "footer", { maxLength: 20 }),
    ],
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.md}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.dataSize}",
      fontWeight: 700,
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "time_metric",
    },
    variant: "time_metric",
  }),
  imageDefinition({
    caption: "全宽图片示例",
    componentId: "cmp_image_fullwidth_clean_001",
    description: "宽度自适应正文容器，不输出超出容器的固定宽度。",
    name: "全宽素净图片",
    preset: {
      attributes: { objectFit: "contain", widthMode: "full" },
      nodeType: "imageBlock",
      slotBindings: [{ slotId: "image", target: { kind: "root_image" } }],
    },
    resourceId: "component_slot_image_pending",
    tokenMap: {
      borderRadius: 0,
      compatibilityLevel: "safe",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "fullwidth",
    },
    variant: "fullwidth",
  }),
  imageDefinition({
    caption: "图注应该简短并补充图片信息",
    componentId: "cmp_image_rounded_caption_002",
    description: "使用主题圆角与左对齐图注，适合产品和场景图。",
    name: "圆角图注图片",
    preset: {
      attributes: { objectFit: "cover", widthMode: "full" },
      nodeType: "imageBlock",
      slotBindings: [{ slotId: "image", target: { kind: "root_image" } }],
    },
    resourceId: "component_slot_image_pending",
    tokenMap: {
      borderRadius: "{image.defaultRadius}",
      compatibilityLevel: "safe",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "rounded_caption",
    },
    variant: "rounded_caption",
  }),
  imageDefinition({
    caption: "现场纪实图片",
    componentId: "cmp_image_border_documentary_003",
    description: "以细边框建立照片边界，适合政务、会议和纪实场景。",
    name: "纪实边框图片",
    preset: {
      attributes: { objectFit: "contain", widthMode: "full" },
      nodeType: "imageBlock",
      slotBindings: [{ slotId: "image", target: { kind: "root_image" } }],
    },
    resourceId: "component_slot_image_pending",
    tokenMap: {
      borderColor: "{colors.borderStrong}",
      borderRadius: 0,
      borderStyle: "solid",
      borderWidth: 1,
      compatibilityLevel: "safe",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "documentary",
    },
    variant: "documentary",
  }),
  imageDefinition({
    caption: "图 1　关键流程示意",
    componentId: "cmp_image_centered_numbered_004",
    description: "居中显示带编号图注的图片，适合报告和说明文档。",
    name: "居中编号图片",
    preset: {
      attributes: { objectFit: "contain", widthMode: "percent", widthPercent: 86 },
      nodeType: "imageBlock",
      slotBindings: [{ slotId: "image", target: { kind: "root_image" } }],
    },
    resourceId: "component_slot_image_pending",
    tokenMap: {
      borderRadius: "{image.defaultRadius}",
      compatibilityLevel: "safe",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "centered_numbered",
    },
    variant: "centered_numbered",
  }),
  dividerDefinition({
    componentId: "cmp_divider_solid_clean_001",
    description: "使用一像素实线与稳定留白分隔章节。",
    name: "细实线分割",
    preset: {
      attributes: {
        align: "center",
        spacingAfter: 24,
        spacingBefore: 24,
        variant: "solid",
        widthPercent: 100,
      },
      nodeType: "divider",
      slotBindings: [],
    },
    tokenMap: {
      borderColor: "{colors.border}",
      borderStyle: "solid",
      borderWidth: 1,
      compatibilityLevel: "safe",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      variant: "solid",
    },
    variant: "solid",
  }),
  dividerDefinition({
    componentId: "cmp_divider_dashed_subtle_002",
    description: "轻量虚线适合区分同一章节内的并列内容。",
    name: "轻虚线分割",
    preset: {
      attributes: {
        align: "center",
        spacingAfter: 20,
        spacingBefore: 20,
        variant: "dashed",
        widthPercent: 100,
      },
      nodeType: "divider",
      slotBindings: [],
    },
    tokenMap: {
      borderColor: "{colors.borderStrong}",
      borderStyle: "dashed",
      borderWidth: 1,
      compatibilityLevel: "safe",
      marginBottom: "{spacing.lg}",
      marginTop: "{spacing.lg}",
      variant: "dashed",
    },
    variant: "dashed",
  }),
  dividerDefinition({
    componentId: "cmp_divider_ornament_center_003",
    description: "用可见文字符号作为中心装饰，静态降级后仍可识别。",
    name: "居中装饰分割",
    preset: {
      attributes: {
        align: "center",
        icon: "◆",
        spacingAfter: 24,
        spacingBefore: 24,
        variant: "ornament",
        widthPercent: 42,
      },
      nodeType: "divider",
      slotBindings: [],
    },
    tokenMap: {
      borderColor: "{colors.accent}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.accent}",
      compatibilityLevel: "safe",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      textAlign: "center",
      variant: "ornament",
    },
    variant: "ornament",
  }),
  {
    adjustableProperties: [
      "borderColor",
      "color",
      "fontSize",
      "lineHeight",
      "marginTop",
      "paddingTop",
      "textAlign",
    ],
    category: "FOOTER",
    componentId: "cmp_footer_minimal_brand_001",
    defaultSlots: { body: "让内容保持安静而清晰的力量" },
    defaultTokenMap: {
      borderColor: "{colors.border}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textMuted}",
      compatibilityLevel: "safe",
      fontSize: "{typography.captionSize}",
      lineHeight: "{typography.captionLineHeight}",
      marginTop: "{spacing.section}",
      paddingTop: "{spacing.xl}",
      textAlign: "center",
      variant: "minimal_brand",
    },
    description: "用品牌口号收束全文；未绑定公众号时以冻结占位状态插入。",
    insertionPreset: {
      attributes: {
        accountId: "account_pending",
        autoUpdate: false,
        frozenVersion: "1.0.0",
        mode: "frozen",
        templateId: "official_footer_minimal_brand",
      },
      nodeType: "brandFooter",
      slotBindings: [
        {
          slotId: "body",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
      ],
    },
    name: "极简品牌文末",
    nodeType: "brandFooter",
    preview: {
      categoryLabel: "文末",
      layoutKey: "footer",
      sample: { footer: "让内容保持安静而清晰的力量" },
    },
    scenarios: ["brand", "longform"],
    semanticRoles: ["footer", "footer.brand"],
    slots: [footerBodySlot],
  },
  {
    adjustableProperties: [
      "backgroundColor",
      "borderRadius",
      "color",
      "fontSize",
      "lineHeight",
      "marginTop",
      "paddingBottom",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "textAlign",
    ],
    category: "FOOTER",
    componentId: "cmp_footer_qrcode_follow_002",
    defaultSlots: {
      body: "长按识别二维码，关注我们获取更多内容",
      image: {
        alt: "公众号二维码",
        caption: "长按识别二维码",
        resourceId: "component_slot_qrcode_pending",
      },
    },
    defaultTokenMap: {
      backgroundColor: "{colors.surface}",
      borderRadius: "{radius.md}",
      color: "{colors.textSecondary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.captionSize}",
      lineHeight: "{typography.captionLineHeight}",
      marginTop: "{spacing.section}",
      paddingBottom: "{spacing.xl}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.xl}",
      paddingTop: "{spacing.xl}",
      textAlign: "center",
      variant: "qrcode_follow",
    },
    description: "文字关注引导与二维码的组合文末；默认保留待选择二维码占位。",
    insertionPreset: {
      attributes: {
        accountId: "account_pending",
        autoUpdate: false,
        frozenVersion: "1.0.0",
        mode: "frozen",
        templateId: "official_footer_qrcode_follow",
      },
      nodeType: "brandFooter",
      slotBindings: [
        {
          slotId: "body",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
        { slotId: "image", target: { index: 1, kind: "child_image" } },
      ],
    },
    name: "二维码关注文末",
    nodeType: "brandFooter",
    preview: {
      categoryLabel: "文末",
      layoutKey: "footer",
      sample: {
        body: "长按识别二维码，关注我们获取更多内容",
        imageAlt: "公众号二维码",
      },
    },
    scenarios: ["brand", "follow", "qrcode"],
    semanticRoles: ["footer", "footer.qrcode"],
    slots: [footerBodySlot, imageSlot],
  },
  headingDefinition({
    componentId: "cmp_head_level1_ribbon_005",
    description: "用全幅色块建立强封面感章节，适合科技、活动和产品内容。",
    level: 1,
    name: "色块章标题",
    sample: "把创新写进下一个章节",
    scenarios: ["technology", "event", "product"],
    tokenMap: {
      backgroundColor: "{colors.primary}",
      borderRadius: "{radius.sm}",
      color: "{colors.background}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      lineHeight: "{typography.heading1LineHeight}",
      paddingBottom: "{spacing.md}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.md}",
      variant: "ribbon",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level1_frame_006",
    description: "细框与居中字阶形成仪式感，适合节日、文化与人物专题。",
    level: 1,
    name: "居中框选标题",
    sample: "山水有清音",
    scenarios: ["culture", "festival", "portrait"],
    tokenMap: {
      borderColor: "{colors.accent}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.primaryDark}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading1Size}",
      fontWeight: "{typography.heading1Weight}",
      letterSpacing: 1.2,
      paddingBottom: "{spacing.md}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.md}",
      textAlign: "center",
      variant: "framed",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level2_pill_005",
    description: "圆角标签式小节题，适合清单、指南和轻快活动文。",
    level: 2,
    name: "胶囊小节标题",
    sample: "活动亮点",
    scenarios: ["guide", "campus", "event"],
    tokenMap: {
      backgroundColor: "{colors.primaryLight}",
      borderRadius: "{radius.pill}",
      color: "{colors.primary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      paddingBottom: "{spacing.xs}",
      paddingLeft: "{spacing.md}",
      paddingRight: "{spacing.md}",
      paddingTop: "{spacing.xs}",
      variant: "pill",
    },
  }),
  headingDefinition({
    componentId: "cmp_head_level2_marker_006",
    description: "小号数字与标题并排，适合步骤、方法和清单式内容。",
    level: 2,
    name: "步骤序号标题",
    sample: "01 / 确定主题与读者",
    scenarios: ["tutorial", "process", "summary"],
    tokenMap: {
      borderColor: "{colors.accent}",
      borderStyle: "solid",
      borderWidth: 2,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading2Size}",
      fontWeight: "{typography.heading2Weight}",
      paddingBottom: "{spacing.xs}",
      variant: "marker",
    },
  }),
  quoteDefinition({
    componentId: "cmp_quote_postcard_warm_005",
    description: "暖色卡片式引用，适合旅行、美食、人物与生活方式内容。",
    name: "明信片引用",
    quoteType: "citation",
    sample: "去看没有天花板的地方，去记住风的形状。",
    showQuotes: true,
    source: "旅行手记",
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.md}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textSecondary}",
      compatibilityLevel: "safe",
      lineHeight: "{typography.bodyLineHeight}",
      paddingBottom: "{spacing.xl}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.xl}",
      paddingTop: "{spacing.xl}",
      textAlign: "center",
      variant: "postcard",
    },
    variant: "postcard",
  }),
  quoteDefinition({
    componentId: "cmp_quote_highlight_center_006",
    description: "大字结论引用，用于文章中部或结尾的核心观点。",
    name: "金句大字引用",
    quoteType: "standard",
    sample: "真正吸引人的不是装饰，而是被看见的价值。",
    showQuotes: true,
    source: "编辑手记",
    tokenMap: {
      borderColor: "{colors.primary}",
      borderStyle: "solid",
      borderWidth: 2,
      color: "{colors.primaryDark}",
      compatibilityLevel: "safe",
      fontSize: "{typography.heading2Size}",
      fontWeight: 700,
      lineHeight: "{typography.heading1LineHeight}",
      paddingBottom: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      textAlign: "center",
      variant: "highlight",
    },
    variant: "highlight",
  }),
  noticeDefinition({
    componentId: "cmp_notice_checklist_action_005",
    description: "将需要执行的要点放入清单式卡片，适合教程、通知和发布检查。",
    eyebrow: "CHECKLIST",
    name: "行动清单卡",
    sample: "核对标题、图片、链接与文末信息，再完成发布。",
    title: "发布前的四项检查",
    tokenMap: {
      backgroundColor: "{colors.surface}",
      borderColor: "{colors.success}",
      borderRadius: "{radius.md}",
      borderStyle: "dashed",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.lg}",
      paddingRight: "{spacing.lg}",
      paddingTop: "{spacing.lg}",
      variant: "checklist",
    },
    variant: "checklist",
  }),
  noticeDefinition({
    componentId: "cmp_notice_story_intro_006",
    description: "用轻量导语承载背景故事，适合专访、品牌和活动回顾。",
    eyebrow: "STORY",
    name: "故事导语卡",
    sample: "一切始于一个很小的问题：如何让好内容被更多人轻松看见？",
    title: "故事从这里开始",
    tokenMap: {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textPrimary}",
      compatibilityLevel: "safe",
      paddingBottom: "{spacing.xl}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.xl}",
      paddingTop: "{spacing.xl}",
      variant: "story",
    },
    variant: "story",
  }),
  dataDefinition({
    bindings: {
      attributes: { variant: "badge_metric" },
      nodeType: "semanticCard",
      slotBindings: [
        { slotId: "title", target: { attribute: "title", kind: "root_attribute" } },
        { slotId: "value", target: { index: 0, kind: "child_text", nodeType: "paragraph" } },
        { slotId: "unit", target: { attribute: "footer", kind: "root_attribute" } },
      ],
    },
    componentId: "cmp_data_badge_metric_005",
    defaultSlots: { title: "本期亮点", unit: "个精选案例", value: 12 },
    description: "紧凑的徽章型数据卡，适合活动亮点、推荐数量与阅读成绩。",
    name: "徽章数据卡",
    sample: { title: "本期亮点", unit: "个精选案例", value: "12" },
    slots: [
      slot("title", "数据标签", "text", "title", { maxLength: 80 }),
      slot("value", "数据值", "number", "content"),
      slot("unit", "单位说明", "text", "footer", { maxLength: 30 }),
    ],
    tokenMap: {
      backgroundColor: "{colors.primaryLight}",
      borderColor: "{colors.accent}",
      borderRadius: "{radius.pill}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.primary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.dataSize}",
      fontWeight: 700,
      paddingBottom: "{spacing.lg}",
      paddingLeft: "{spacing.xl}",
      paddingRight: "{spacing.xl}",
      paddingTop: "{spacing.lg}",
      textAlign: "center",
      variant: "badge_metric",
    },
    variant: "badge_metric",
  }),
  imageDefinition({
    caption: "今日画面 / PHOTO STORY",
    componentId: "cmp_image_polaroid_caption_005",
    description: "白边与底部图注营造即时摄影感，适合旅行、人物和活动回顾。",
    name: "拍立得图片",
    preset: {
      attributes: { objectFit: "cover", widthMode: "percent", widthPercent: 92 },
      nodeType: "imageBlock",
      slotBindings: [{ slotId: "image", target: { kind: "root_image" } }],
    },
    resourceId: "component_slot_image_pending",
    tokenMap: {
      backgroundColor: "{colors.background}",
      borderColor: "{colors.border}",
      borderRadius: "{radius.sm}",
      borderStyle: "solid",
      borderWidth: 8,
      compatibilityLevel: "safe",
      marginBottom: "{image.defaultMarginBottom}",
      marginTop: "{image.defaultMarginTop}",
      variant: "polaroid",
    },
    variant: "polaroid",
  }),
  dividerDefinition({
    componentId: "cmp_divider_ornament_dots_004",
    description: "三点装饰分隔适合散文、旅行和人物内容，静态复制依然稳定。",
    name: "三点留白分隔",
    preset: {
      attributes: {
        align: "center",
        icon: "• • •",
        spacingAfter: 28,
        spacingBefore: 28,
        variant: "ornament",
        widthPercent: 24,
      },
      nodeType: "divider",
      slotBindings: [],
    },
    tokenMap: {
      borderColor: "{colors.accent}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.accent}",
      compatibilityLevel: "safe",
      marginBottom: "{spacing.xl}",
      marginTop: "{spacing.xl}",
      textAlign: "center",
      variant: "ornament",
    },
    variant: "ornament",
  }),
  {
    adjustableProperties: [
      "backgroundColor",
      "borderColor",
      "color",
      "fontSize",
      "lineHeight",
      "marginTop",
      "paddingBottom",
      "paddingTop",
      "textAlign",
    ],
    category: "FOOTER",
    componentId: "cmp_footer_signature_brand_003",
    defaultSlots: { body: "感谢阅读\n愿好内容在每一次相遇里继续生长" },
    defaultTokenMap: {
      borderColor: "{colors.accent}",
      borderStyle: "solid",
      borderWidth: 1,
      color: "{colors.textSecondary}",
      compatibilityLevel: "safe",
      fontSize: "{typography.captionSize}",
      lineHeight: "{typography.captionLineHeight}",
      marginTop: "{spacing.section}",
      paddingTop: "{spacing.xl}",
      textAlign: "center",
      variant: "signature",
    },
    description: "签名式文末收束全文，适合专栏、个人品牌和故事内容。",
    insertionPreset: {
      attributes: {
        accountId: "account_pending",
        autoUpdate: false,
        frozenVersion: "1.0.0",
        mode: "frozen",
        templateId: "official_footer_signature",
      },
      nodeType: "brandFooter",
      slotBindings: [
        { slotId: "body", target: { index: 0, kind: "child_text", nodeType: "paragraph" } },
      ],
    },
    name: "签名式文末",
    nodeType: "brandFooter",
    preview: {
      categoryLabel: "文末",
      layoutKey: "footer",
      sample: { footer: "感谢阅读 · 愿好内容继续生长" },
    },
    scenarios: ["column", "personal_brand", "story"],
    semanticRoles: ["footer", "footer.signature"],
    slots: [footerBodySlot],
  },
];

export const OFFICIAL_COMPONENT_ASSETS: readonly OfficialComponentAsset[] = deepFreeze(
  definitions.map(defineAsset),
);

export const OFFICIAL_COMPONENT_MANIFESTS: readonly ComponentManifestV1_1[] = deepFreeze(
  OFFICIAL_COMPONENT_ASSETS.map((asset) => asset.manifest),
);

export function createOfficialComponentRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  OFFICIAL_COMPONENT_MANIFESTS.forEach((manifest) => registry.register(manifest));
  return registry;
}
