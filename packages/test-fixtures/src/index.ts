import type { BlockNode, DocumentSourceType, DocumentV1 } from "@wechat-layout/document-schema";

const fixtureTimestamp = "2026-07-31T12:00:00+08:00";
const lockedSourceHash = `sha256:${"b".repeat(64)}`;

type TopLevelBlock = Exclude<BlockNode, { readonly type: "listItem" }>;

export interface StandardArticleFixture {
  readonly id: "ai_technology" | "extreme" | "legal" | "party_inspection";
  readonly name: string;
  readonly document: DocumentV1;
  readonly expectedFeatures: readonly string[];
}

export interface PasteSourceFixture {
  readonly detectedSourceHint: "auto" | "html" | "markdown" | "plain_text" | "word";
  readonly html: string;
  readonly plainText: string;
}

function attrs(blockId: string, semanticRole: string, locked = true) {
  return {
    blockId,
    locked,
    semanticRole,
    ...(locked
      ? {
          sourceBlockId: `source_${blockId}`,
          sourceTextHash: lockedSourceHash,
        }
      : {}),
  };
}

function text(value: string) {
  return {
    text: value,
    type: "text" as const,
  };
}

function paragraph(blockId: string, value: string, semanticRole = "body"): TopLevelBlock {
  return {
    attrs: attrs(blockId, semanticRole),
    content: [text(value)],
    type: "paragraph",
  };
}

function heading(
  blockId: string,
  value: string,
  level: 1 | 2 | 3,
  numbering?: string,
): TopLevelBlock {
  return {
    attrs: {
      ...attrs(blockId, level === 1 ? "section_heading" : "subsection_heading"),
      level,
      ...(numbering === undefined ? {} : { numbering }),
    },
    content: [text(value)],
    type: "heading",
  };
}

function quote(
  blockId: string,
  value: string,
  source: string,
  quoteType: "citation" | "standard" | "warning" = "citation",
): TopLevelBlock {
  return {
    attrs: {
      ...attrs(blockId, quoteType === "warning" ? "risk_warning" : "citation"),
      quoteType,
      showQuotes: true,
      showSource: true,
      source,
    },
    content: [
      {
        attrs: attrs(`${blockId}_body`, "body"),
        content: [text(value)],
        type: "paragraph",
      },
    ],
    type: "blockquote",
  };
}

function card(
  blockId: string,
  eyebrow: string,
  title: string,
  body: string,
  semanticRole: string,
): TopLevelBlock {
  return {
    attrs: {
      ...attrs(blockId, semanticRole, false),
      compatibilityLevel: "safe",
      componentId: `fixture_${semanticRole}`,
      componentVersion: "1.0.0",
      eyebrow,
      title,
      variant: "line-left",
    },
    content: [
      {
        attrs: attrs(`${blockId}_body`, "body", false),
        content: [text(body)],
        type: "paragraph",
      },
    ],
    type: "semanticCard",
  };
}

function image(blockId: string, index: number, caption: string): TopLevelBlock {
  return {
    attrs: {
      ...attrs(blockId, "illustration", false),
      alt: `测试图片 ${String(index)}`,
      caption,
      compatibilityLevel: "safe",
      objectFit: "cover",
      resourceId: `fixture_resource_${String(index).padStart(2, "0")}`,
      widthMode: "full",
      widthPercent: 100,
    },
    type: "imageBlock",
  };
}

function orderedSteps(blockId: string, labels: readonly string[], indentLevel = 0): TopLevelBlock {
  return {
    attrs: {
      ...attrs(blockId, "steps"),
      indentLevel,
      numberingStyle: "chinese",
      preserveOriginalNumbering: true,
      start: 1,
    },
    content: labels.map((label, index) => ({
      attrs: {
        ...attrs(`${blockId}_item_${String(index + 1)}`, "list_item"),
        originalNumberText: `${String(index + 1)}.`,
      },
      content: [
        {
          attrs: attrs(`${blockId}_paragraph_${String(index + 1)}`, "body"),
          content: [text(label)],
          type: "paragraph" as const,
        },
      ],
      type: "listItem" as const,
    })),
    type: "orderedList",
  };
}

function document(
  id: StandardArticleFixture["id"],
  sourceType: DocumentSourceType,
  content: readonly TopLevelBlock[],
): DocumentV1 {
  return {
    articleId: `article_fixture_${id}`,
    content: {
      content: [...content],
      type: "doc",
    },
    documentId: `document_fixture_${id}`,
    meta: {
      createdAt: fixtureTimestamp,
      originalTextHash: lockedSourceHash,
      sourceType,
      textLocked: true,
      updatedAt: fixtureTimestamp,
    },
    schemaVersion: "1.0.0",
  };
}

export const partyInspectionArticleFixture: StandardArticleFixture = {
  document: document("party_inspection", "docx", [
    heading("party_title", "关于开展年度巡察工作的情况报告", 1),
    heading("party_section_1", "一、工作开展情况", 2, "一、"),
    paragraph("party_body_1", "巡察组坚持问题导向，围绕责任落实、作风建设和整改成效开展监督检查。"),
    heading("party_section_1_1", "（一）压实主体责任", 3, "（一）"),
    orderedSteps("party_steps", [
      "完成谈话走访 36 人次",
      "查阅制度材料 128 份",
      "形成问题清单 12 项",
    ]),
    card("party_data", "关键数据", "整改完成率 92%", "本轮巡察已完成阶段性问题整改。", "data"),
    quote("party_quote", "发现问题不是终点，推动解决问题才是巡察工作的落脚点。", "巡察工作组"),
    image("party_image", 1, "巡察工作现场"),
    {
      attrs: {
        ...attrs("party_divider", "decoration", false),
        spacingAfter: 16,
        spacingBefore: 16,
        variant: "solid",
        widthPercent: 100,
      },
      type: "divider",
    },
    paragraph("party_footer", "中共示例单位委员会\n2026年7月31日", "ending"),
  ]),
  expectedFeatures: ["主标题", "一级标题", "二级标题", "编号", "数据", "引用", "图片", "文末"],
  id: "party_inspection",
  name: "党政巡察文章",
};

export const legalArticleFixture: StandardArticleFixture = {
  document: document("legal", "docx", [
    heading("legal_title", "合同解除争议的裁判要点与风险提示", 1),
    card(
      "legal_case",
      "基本案情",
      "服务合同履行争议",
      "双方就履约标准及解除条件产生分歧。",
      "case",
    ),
    heading("legal_focus_title", "一、争议焦点", 2, "一、"),
    card(
      "legal_focus",
      "争议焦点",
      "解除通知是否生效",
      "需要结合违约程度、催告事实与送达证据综合判断。",
      "legal_issue",
    ),
    quote("legal_statute", "依法成立的合同，对当事人具有法律约束力。", "《中华人民共和国民法典》"),
    heading("legal_opinion_title", "二、裁判观点", 2, "二、"),
    paragraph("legal_opinion", "法院认为，解除权的行使应当满足约定或者法定条件，并完成有效通知。"),
    quote(
      "legal_warning",
      "业务沟通记录、催告函件和送达凭证应当形成完整证据链。",
      "风险提示",
      "warning",
    ),
    paragraph(
      "legal_disclaimer",
      "免责声明：本文仅作一般信息交流，不构成针对具体事项的法律意见。",
      "disclaimer",
    ),
  ]),
  expectedFeatures: ["案情", "法条", "争议焦点", "裁判观点", "风险提示", "免责声明"],
  id: "legal",
  name: "法律文章",
};

export const aiTechnologyArticleFixture: StandardArticleFixture = {
  document: document("ai_technology", "html", [
    heading("ai_title", "端侧多模态模型：能力、边界与选型", 1),
    paragraph("ai_intro", "该产品将文字、图像理解与结构化输出能力部署在本地设备。", "introduction"),
    card(
      "ai_pros",
      "优势",
      "低延迟与数据本地化",
      "离线场景可用，敏感数据无需离开设备。",
      "advantage",
    ),
    card(
      "ai_cons",
      "限制",
      "算力和上下文受限",
      "复杂推理速度及模型容量仍受终端硬件约束。",
      "limitation",
    ),
    card(
      "ai_specs",
      "核心参数",
      "8B 参数 · 32K 上下文",
      "量化精度 INT4，峰值内存约 6 GB。",
      "parameter",
    ),
    orderedSteps("ai_comparison", [
      "云端模型：能力上限高",
      "端侧模型：隐私与时延更优",
      "混合架构：按任务分流",
    ]),
    image("ai_image", 2, "端云协同架构示意图"),
    heading("ai_summary_title", "总结", 2),
    paragraph("ai_summary", "优先根据隐私、时延、成本和能力上限选择部署形态。", "summary"),
  ]),
  expectedFeatures: ["产品介绍", "优缺点", "参数", "数据对比", "图片", "总结"],
  id: "ai_technology",
  name: "AI 科技文章",
};

const extremeBody = "极端样稿用于验证长文自动保存、渲染与复制稳定性。".repeat(500).slice(0, 10_000);
const extremeImages = Array.from({ length: 50 }, (_, index) =>
  image(`extreme_image_${String(index + 1)}`, index + 1, `连续图片 ${String(index + 1)}`),
);

export const extremeArticleFixture: StandardArticleFixture = {
  document: document("extreme", "html", [
    heading(
      "extreme_title",
      "这是一个用于验证超长标题在公众号窄屏、桌面预览和安全渲染模式下均不会突破内容边界的固定测试标题",
      1,
    ),
    paragraph("extreme_body", extremeBody),
    orderedSteps("extreme_numbering", [
      "第一层编号",
      "第二层编号包含（一）与 1.1 的原始表达",
      "第三层编号包含特殊字符：& < > \" ' © ™ 🚀",
    ]),
    paragraph(
      "extreme_table_fallback",
      "指标\t第一季度\t第二季度\t第三季度\t第四季度\t年度合计\n访问量\t12000\t18000\t26000\t31000\t87000",
      "data_table_fallback",
    ),
    ...extremeImages,
  ]),
  expectedFeatures: [
    "10000字",
    "50张图片",
    "超长标题",
    "多级编号",
    "宽表格",
    "特殊字符",
    "恶意HTML",
    "错误链接",
  ],
  id: "extreme",
  name: "极端样稿",
};

export const standardArticleFixtures = [
  partyInspectionArticleFixture,
  legalArticleFixture,
  aiTechnologyArticleFixture,
  extremeArticleFixture,
] as const satisfies readonly StandardArticleFixture[];

export const pasteSourceFixtures = {
  maliciousHtml: {
    detectedSourceHint: "html",
    html: [
      '<h1 style="position:fixed">极端导入</h1>',
      "<script>globalThis.__fixture_attack = true</script>",
      "<p hidden>不可见内容</p>",
      '<a href="javascript:alert(1)">错误链接</a>',
      '<img src="http://127.0.0.1/private.png" alt="内网图片">',
    ].join(""),
    plainText: "极端导入\n错误链接\n内网图片",
  },
  word: {
    detectedSourceHint: "word",
    html: [
      '<html><head><meta name="Generator" content="Microsoft Word 16"></head><body>',
      '<h1 class="MsoTitle">Word/WPS 固定样稿</h1>',
      '<p class="MsoNormal">保留兼容正文和<strong>重点</strong>。</p>',
      "<ol><li>编号内容</li></ol>",
      "</body></html>",
    ].join(""),
    plainText: "Word/WPS 固定样稿\n保留兼容正文和重点。\n1. 编号内容",
  },
} as const satisfies Readonly<Record<string, PasteSourceFixture>>;
