import type { AiLayoutDesignLanguageId } from "@wechat-layout/api-contracts";
import type {
  DocumentV1,
  HeadingNode,
  ImageBlockNode,
  ParagraphNode,
} from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { describe, expect, it, vi } from "vitest";

import type { DocumentService } from "../documents/document.service.js";
import type { ResourceService } from "../resources/resource.service.js";
import type { AiLayoutRuntimeOptions } from "./ai-layout.constants.js";
import { AiLayoutService } from "./ai-layout.service.js";

const articleId = "0198f8e1-7a01-7000-8000-000000000301";
const ownerUserId = "0198f8e1-7a01-7000-8000-000000000302";
const designTokens = {
  accentColor: "#D29A54",
  bodyFontSize: 15,
  bodyLineHeight: 1.85,
  cardRadius: 8,
  mutedColor: "#756A64",
  primaryColor: "#B4232C",
  sectionSpacing: 42,
  surfaceAltColor: "#FEF2F2",
  surfaceColor: "#FFFFFF",
  textColor: "#2A221F",
  titleAlign: "center",
} as const;

function documents(
  document: DocumentV1 = { ...structuredClone(documentV1Fixture), articleId },
): DocumentService {
  return {
    get: vi.fn().mockResolvedValue({
      articleId,
      document,
      documentVersion: 7,
    }),
  } as unknown as DocumentService;
}

function documentWithBodyText(text: string): DocumentV1 {
  const document: DocumentV1 = { ...structuredClone(documentV1Fixture), articleId };
  const paragraph = document.content.content.find((node) => node.type === "paragraph");
  if (paragraph?.type !== "paragraph") throw new Error("fixture paragraph is required");
  paragraph.content = [{ type: "text", text }];
  return document;
}

function resourceService(filenames: Readonly<Record<string, string>> = {}): ResourceService {
  return {
    get: vi.fn().mockImplementation((_ownerUserId: string, resourceId: string) =>
      Promise.resolve({
        id: resourceId,
        displayName: null,
        originalFilename: filenames[resourceId] ?? null,
        resourceType: "image",
        status: "active",
      }),
    ),
  } as unknown as ResourceService;
}

function sourceImageResourceId(index: number): string {
  return `019c0000-0000-7000-8000-${String(index).padStart(12, "0")}`;
}

function imageDirectorDocument(): {
  readonly document: DocumentV1;
  readonly filenames: Readonly<Record<string, string>>;
  readonly imageBlockIds: readonly string[];
  readonly resourceIds: readonly string[];
} {
  const document: DocumentV1 = { ...structuredClone(documentV1Fixture), articleId };
  const paragraphTemplate = documentV1Fixture.content.content.find(
    (node) => node.type === "paragraph",
  );
  const imageTemplate = documentV1Fixture.content.content.find(
    (node) => node.type === "imageBlock",
  );
  const headingTemplate = documentV1Fixture.content.content.find((node) => node.type === "heading");
  if (
    paragraphTemplate?.type !== "paragraph" ||
    imageTemplate?.type !== "imageBlock" ||
    headingTemplate?.type !== "heading"
  ) {
    throw new Error("image director fixtures are required");
  }
  const imageAfterParagraphs = new Set([5, 20, 40, 60, 80, 100, 120, 125, 130, 135]);
  const content: DocumentV1["content"]["content"] = [];
  const heading: HeadingNode = structuredClone(headingTemplate);
  heading.attrs = { ...heading.attrs, blockId: "director_heading" };
  heading.content = [{ type: "text", text: "现场故事与成果回顾" }];
  content.push(heading);
  const imageBlockIds: string[] = [];
  const resourceIds: string[] = [];
  const filenames: Record<string, string> = {};
  let imageIndex = 0;
  for (let index = 0; index < 140; index += 1) {
    const paragraph: ParagraphNode = structuredClone(paragraphTemplate);
    paragraph.attrs = {
      blockId: `director_text_${String(index).padStart(3, "0")}`,
      locked: false,
      semanticRole: "body",
    };
    paragraph.content = [{ type: "text", text: `第 ${String(index)} 段现场文字与工作进展。` }];
    content.push(paragraph);
    if (!imageAfterParagraphs.has(index)) continue;
    imageIndex += 1;
    const resourceId = sourceImageResourceId(imageIndex);
    const imageBlockId = `director_image_${String(imageIndex).padStart(2, "0")}`;
    const image: ImageBlockNode = structuredClone(imageTemplate);
    image.attrs = {
      ...image.attrs,
      alt: `现场照片 ${String(imageIndex)}`,
      blockId: imageBlockId,
      caption: `原始图注 ${String(imageIndex)}`,
      elementKind: "image",
      resourceId,
    };
    delete image.attrs.originalResourceId;
    content.push(image);
    imageBlockIds.push(imageBlockId);
    resourceIds.push(resourceId);
    filenames[resourceId] = `photo-${String(imageIndex).padStart(2, "0")}.jpg`;
  }
  document.content = { type: "doc", content };
  return { document, filenames, imageBlockIds, resourceIds };
}

function options(
  apiKey: string | null,
  overrides: Partial<AiLayoutRuntimeOptions> = {},
): AiLayoutRuntimeOptions {
  return {
    defaultProviderId: "auto",
    providers: [
      {
        apiKey,
        baseUrl: "https://api.example.test/v1",
        id: "deepseek",
        model: "layout-model",
        protocol: "responses",
      },
    ],
    timeoutMs: 10_000,
    ...overrides,
  };
}

const candidateLanguageCases = [
  {
    baseLanguageId: "crimson-editorial",
    expected: [
      "crimson-editorial",
      "civic-blue",
      "news-editorial",
      "annual-report",
      "jade-oriental",
      "minimal-blue",
    ],
    label: "government",
    text: "党委党建和纪检巡察监督工作要推动整改落实，服务国企高质量发展。",
  },
  {
    baseLanguageId: "future-purple",
    expected: [
      "future-purple",
      "minimal-blue",
      "data-dashboard",
      "cyber-neon",
      "civic-blue",
      "annual-report",
    ],
    label: "technical",
    text: "人工智能技术团队正在开发数字化产品系统，并持续优化核心算法。",
  },
  {
    baseLanguageId: "monochrome-finance",
    expected: [
      "monochrome-finance",
      "data-dashboard",
      "annual-report",
      "academic-journal",
      "civic-blue",
      "minimal-blue",
    ],
    label: "data",
    text: "数据报告显示：2024年营收100亿元，同比增长12%，用户达到300万人，完成项目45项，利润增长8%。",
  },
  {
    baseLanguageId: "event-poster",
    expected: [
      "event-poster",
      "warm-paper",
      "news-editorial",
      "seasonal-poetry",
      "forest-green",
      "jade-oriental",
    ],
    label: "narrative",
    text: "春日傍晚，我们沿着河岸慢慢走，看见风吹过树梢，也记下人与城市相遇的故事。",
  },
] as const satisfies readonly {
  readonly baseLanguageId: AiLayoutDesignLanguageId;
  readonly expected: readonly AiLayoutDesignLanguageId[];
  readonly label: string;
  readonly text: string;
}[];

describe("AiLayoutService", () => {
  it("reports an unavailable model and refuses to fake AI output", async () => {
    const fetcher = vi.fn();
    const service = new AiLayoutService(options(null), fetcher, documents(), resourceService());

    expect(service.status()).toMatchObject({
      available: false,
      defaultProviderId: "auto",
      model: "layout-model",
      provider: "auto",
    });
    await expect(
      service.generate(ownerUserId, articleId, {
        baseDocumentVersion: 7,
        mode: "original",
      }),
    ).rejects.toMatchObject({
      status: 503,
      apiError: { code: "AI_LAYOUT_NOT_CONFIGURED" },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the Responses API and fills missing block decisions safely", async () => {
    const modelDecision = {
      languageId: "crimson-editorial",
      designName: "纪律坐标",
      concept: "以克制的编辑标记突出体系化表达。",
      designTokens,
      rhythm: "compact",
      variantSeed: 2187,
      visualAssets: [
        {
          afterBlockId: "block_paragraph",
          reason: "在导语后建立政务视觉锚点",
          resourceId: "builtin_visual_static_022",
        },
      ],
      visualIntensity: "restrained",
      dividerComponentId: "cmp_divider_ornament_center_003",
      hero: {
        componentId: "cmp_gov_red_gold_banner_001",
        eyebrow: "INSPECTION REPORT",
        title: "稳中提质",
        footer: "体系化 · 标准化",
      },
      footer: {
        componentId: "cmp_notice_checklist_action_005",
        title: "回看重点",
        text: "让监督成果落到行动",
      },
      dividerAfterBlockIds: ["block_paragraph", "unknown"],
      blocks: [
        {
          blockId: "block_heading",
          componentId: "cmp_head_level1_numbered_002",
          treatment: "title",
          reason: "全文标题",
        },
        { blockId: "block_paragraph", componentId: null, treatment: "lead", reason: "开篇导语" },
      ],
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [{ content: [{ type: "output_text", text: JSON.stringify(modelDecision) }] }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const sourceDocument: DocumentV1 = { ...structuredClone(documentV1Fixture), articleId };
    const sourceImage = sourceDocument.content.content.find((block) => block.type === "imageBlock");
    if (sourceImage?.type !== "imageBlock") throw new Error("fixture image is required");
    const fixtureImageResourceId = sourceImageResourceId(99);
    sourceImage.attrs.resourceId = fixtureImageResourceId;
    const originalDocument = structuredClone(sourceDocument);
    const sourceBlockIds = sourceDocument.content.content.map((block) => block.attrs.blockId);
    const service = new AiLayoutService(
      options("secret-key"),
      fetcher,
      documents(sourceDocument),
      resourceService({ [fixtureImageResourceId]: "fixture-photo.jpg" }),
    );
    const result = await service.generate(ownerUserId, articleId, {
      baseDocumentVersion: 7,
      mode: "original",
      preferredLanguageId: "minimal-blue",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/v1/responses",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({ Authorization: "Bearer secret-key" });
    expect(String(request.body)).toContain("wechat_article_layout_decision");
    expect(String(request.body)).toContain("imagePlacements");
    expect(result.decision.languageId).toBe("crimson-editorial");
    expect(result.decision.imagePlacements).toEqual([
      {
        afterBlockId: null,
        imageBlockId: "block_image",
        mode: "keep-original",
        reason: "信息不足或锚点无效，保持原图位置",
        resourceId: fixtureImageResourceId,
      },
    ]);
    expect(result.decision.blocks).toHaveLength(documentV1Fixture.content.content.length);
    expect(result.decision.dividerAfterBlockIds).not.toContain("unknown");
    expect(result.candidates).toHaveLength(6);
    expect(result.candidates.map((candidate) => candidate.profileId)).toEqual([
      "editorial-index",
      "briefing-cards",
      "evidence-led",
      "minimal-longread",
      "documentary-visual",
      "action-roadmap",
    ]);
    expect(new Set(result.candidates.map((candidate) => candidate.decision.languageId)).size).toBe(
      6,
    );
    expect(
      new Set(result.candidates.map((candidate) => candidate.decision.hero.componentId)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(
      new Set(
        result.candidates.map((candidate) =>
          candidate.decision.blocks
            .filter((block) => block.treatment !== "body")
            .map((block) => `${block.treatment}:${block.componentId ?? "none"}`)
            .join("|"),
        ),
      ).size,
    ).toBe(6);
    expect(new Set(result.candidates.map((candidate) => candidate.candidateId)).size).toBe(6);
    const specialLimits = new Map([
      ["editorial-index", { cards: 2, data: 1, quotes: 2 }],
      ["briefing-cards", { cards: 3, data: 1, quotes: 2 }],
      ["evidence-led", { cards: 3, data: 3, quotes: 1 }],
      ["minimal-longread", { cards: 1, data: 1, quotes: 1 }],
      ["documentary-visual", { cards: 1, data: 1, quotes: 2 }],
      ["action-roadmap", { cards: 3, data: 1, quotes: 1 }],
    ]);
    for (const candidate of result.candidates) {
      expect(candidate.decision.blocks.map((block) => block.blockId)).toEqual(sourceBlockIds);
      const imageDecision = candidate.decision.blocks.find(
        (block) => block.blockId === "block_image",
      );
      expect(imageDecision).toMatchObject({ treatment: "image" });
      expect(imageDecision?.componentId).not.toBeNull();
      const limits = specialLimits.get(candidate.profileId);
      if (limits === undefined) throw new Error("candidate profile limit is required");
      const cards = candidate.decision.blocks.filter(
        (block) => block.treatment === "data" || block.treatment === "callout",
      );
      expect(cards.length).toBeLessThanOrEqual(limits.cards);
      expect(
        candidate.decision.blocks.filter((block) => block.treatment === "data").length,
      ).toBeLessThanOrEqual(limits.data);
      expect(
        candidate.decision.blocks.filter((block) => block.treatment === "quote").length,
      ).toBeLessThanOrEqual(limits.quotes);
    }
    expect(
      result.candidates.find((candidate) => candidate.profileId === "documentary-visual")?.decision
        .visualAssets,
    ).toEqual([]);
    expect(sourceDocument).toEqual(originalDocument);
    expect(result.decision).toEqual(result.candidates[0]?.decision);
  });

  it("directs up to eight real source images and rejects invented placements", async () => {
    const source = imageDirectorDocument();
    const originalDocument = structuredClone(source.document);
    const sampledImageBlockIds = [
      source.imageBlockIds[0],
      source.imageBlockIds[1],
      source.imageBlockIds[3],
      source.imageBlockIds[4],
      source.imageBlockIds[5],
      source.imageBlockIds[6],
      source.imageBlockIds[8],
      source.imageBlockIds[9],
    ] as const;
    const sampledResourceIds = [
      source.resourceIds[0],
      source.resourceIds[1],
      source.resourceIds[3],
      source.resourceIds[4],
      source.resourceIds[5],
      source.resourceIds[6],
      source.resourceIds[8],
      source.resourceIds[9],
    ] as const;
    const modelDecision = {
      languageId: "warm-paper",
      designName: "现场图文导演",
      concept: "依据原图的已有语义安排阅读节奏。",
      designTokens,
      rhythm: "airy",
      variantSeed: 6412,
      imagePlacements: [
        {
          afterBlockId: "director_text_010",
          imageBlockId: sampledImageBlockIds[0],
          mode: "after-text",
          reason: "放在对应的现场叙述之后",
          resourceId: sampledResourceIds[0],
        },
        {
          afterBlockId: "director_text_020",
          imageBlockId: sampledImageBlockIds[1],
          mode: "after-text",
          reason: "伪造了资源关系",
          resourceId: sampledResourceIds[2],
        },
        {
          afterBlockId: sampledImageBlockIds[0],
          imageBlockId: sampledImageBlockIds[2],
          mode: "after-text",
          reason: "错误地锚定到图片",
          resourceId: sampledResourceIds[2],
        },
        {
          afterBlockId: "invented_text_block",
          imageBlockId: sampledImageBlockIds[3],
          mode: "after-text",
          reason: "错误地锚定到未知区块",
          resourceId: sampledResourceIds[3],
        },
        {
          afterBlockId: null,
          imageBlockId: sampledImageBlockIds[4],
          mode: "keep-original",
          reason: "信息不足，保持原位",
          resourceId: sampledResourceIds[4],
        },
        {
          afterBlockId: "director_text_100",
          imageBlockId: sampledImageBlockIds[5],
          mode: "after-text",
          reason: "伪造为内置素材",
          resourceId: "builtin_visual_static_022",
        },
      ],
      visualAssets: [
        {
          afterBlockId: "director_text_001",
          reason: "在导语后建立装饰锚点",
          resourceId: "builtin_visual_static_022",
        },
      ],
      visualIntensity: "balanced",
      dividerComponentId: "cmp_divider_ornament_dots_004",
      hero: {
        componentId: "cmp_intro_leaf_story_003",
        eyebrow: "PHOTO STORY",
        title: "现场图文导演",
        footer: "原图 · 原文",
      },
      footer: {
        componentId: "cmp_notice_story_intro_006",
        title: "现场回看",
        text: "以原图和原文完成叙事",
      },
      dividerAfterBlockIds: [],
      blocks: [],
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [{ content: [{ type: "output_text", text: JSON.stringify(modelDecision) }] }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const resources = resourceService(source.filenames);
    const service = new AiLayoutService(
      options("secret-key"),
      fetcher,
      documents(source.document),
      resources,
    );

    const result = await service.generate(ownerUserId, articleId, {
      baseDocumentVersion: 7,
      mode: "original",
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    const requestBody = JSON.parse(String(request.body)) as { readonly input: string };
    const modelInput = JSON.parse(requestBody.input) as {
      readonly article: {
        readonly blocks: readonly Readonly<Record<string, unknown>>[];
        readonly sourceImages: readonly Readonly<Record<string, unknown>>[];
      };
    };
    expect(modelInput.article.blocks).toHaveLength(120);
    expect(modelInput.article.blocks.map((block) => block.blockId)).not.toContain(
      source.imageBlockIds[9],
    );
    expect(modelInput.article.sourceImages).toHaveLength(8);
    expect(modelInput.article.sourceImages.map((image) => image.imageBlockId)).toEqual(
      sampledImageBlockIds,
    );
    expect(modelInput.article.sourceImages.at(-1)).toMatchObject({
      alt: "现场照片 10",
      caption: "原始图注 10",
      filename: "photo-10.jpg",
      imageBlockId: source.imageBlockIds[9],
      resourceId: source.resourceIds[9],
    });
    expect(modelInput.article.sourceImages[0]).toMatchObject({
      followingText: expect.objectContaining({ blockId: "director_text_006" }),
      nearbyHeading: expect.objectContaining({ blockId: "director_heading" }),
      precedingText: expect.objectContaining({ blockId: "director_text_005" }),
    });
    expect(resources.get).toHaveBeenCalledTimes(8);

    const placements = result.decision.imagePlacements ?? [];
    expect(placements).toHaveLength(8);
    expect(placements.map((placement) => placement.imageBlockId)).toEqual(sampledImageBlockIds);
    expect(placements[0]).toMatchObject({
      afterBlockId: "director_text_010",
      mode: "after-text",
      resourceId: sampledResourceIds[0],
    });
    expect(placements[4]).toMatchObject({
      afterBlockId: null,
      mode: "keep-original",
      reason: "信息不足，保持原位",
    });
    for (const placement of placements.slice(1).filter((_, index) => index !== 3)) {
      expect(placement).toMatchObject({ afterBlockId: null, mode: "keep-original" });
    }
    expect(
      placements.every((placement) => !placement.resourceId.startsWith("builtin_visual_")),
    ).toBe(true);
    expect(placements[0]).not.toHaveProperty("caption");
    expect(source.document).toEqual(originalDocument);
    for (const candidate of result.candidates) {
      expect(candidate.decision.imagePlacements).toEqual(placements);
    }
  });

  it.each(candidateLanguageCases)(
    "keeps the model choice and orders $label candidate languages explicitly",
    async (testCase) => {
      const modelDecision = {
        languageId: testCase.baseLanguageId,
        designName: "内容语言测试",
        concept: "从内容类型派生六种明确的视觉语言。",
        designTokens,
        rhythm: "balanced",
        variantSeed: 3189,
        visualAssets: [
          {
            afterBlockId: "block_paragraph",
            reason: "在导语后建立视觉锚点",
            resourceId: "builtin_visual_static_022",
          },
        ],
        visualIntensity: "balanced",
        dividerComponentId: "cmp_divider_solid_clean_001",
        hero: {
          componentId: "cmp_intro_bamboo_note_002",
          eyebrow: "ARTICLE",
          title: "内容决定排版",
          footer: "阅读 · 结构",
        },
        footer: {
          componentId: "cmp_notice_story_intro_006",
          title: "阅读小结",
          text: "记住文章的核心判断",
        },
        dividerAfterBlockIds: [],
        blocks: [],
      };
      const fetcher = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            output: [{ content: [{ type: "output_text", text: JSON.stringify(modelDecision) }] }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const service = new AiLayoutService(
        options("secret-key"),
        fetcher,
        documents(documentWithBodyText(testCase.text)),
        resourceService(),
      );

      const result = await service.generate(ownerUserId, articleId, {
        baseDocumentVersion: 7,
        mode: "original",
      });

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result.candidates.map((candidate) => candidate.decision.languageId)).toEqual(
        testCase.expected,
      );
    },
  );

  it("uses Kimi-compatible chat completions and accepts fenced JSON safely", async () => {
    const modelDecision = {
      languageId: "warm-paper",
      designName: "纸上脉络",
      concept: "用杂志留白和少量信息锚点组织阅读节奏。",
      designTokens,
      rhythm: "airy",
      variantSeed: 7301,
      visualAssets: [
        {
          afterBlockId: "block_paragraph",
          reason: "在导语后加入暖色主视觉",
          resourceId: "builtin_visual_static_062",
        },
      ],
      visualIntensity: "balanced",
      dividerComponentId: "cmp_divider_ornament_dots_004",
      hero: {
        componentId: "cmp_intro_autumn_persimmon_001",
        eyebrow: "FIELD NOTES",
        title: "从内容长出结构",
        footer: "观察 · 提炼",
      },
      footer: {
        componentId: "cmp_notice_story_intro_006",
        title: "读到这里",
        text: "把关键判断带回工作中",
      },
      dividerAfterBlockIds: ["block_paragraph"],
      blocks: [
        {
          blockId: "block_heading",
          componentId: "cmp_head_level1_frame_006",
          treatment: "title",
          reason: "全文标题",
        },
        {
          blockId: "block_paragraph",
          componentId: "cmp_notice_story_intro_006",
          treatment: "callout",
          reason: "核心判断",
        },
      ],
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `\`\`\`json\n${JSON.stringify(modelDecision)}\n\`\`\``,
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const service = new AiLayoutService(
      options("kimi-secret", {
        providers: [
          {
            apiKey: "kimi-secret",
            baseUrl: "https://api.example.test/v1",
            id: "kimi",
            model: "layout-model",
            protocol: "chat-completions",
          },
        ],
      }),
      fetcher,
      documents(),
      resourceService(),
    );

    const result = await service.generate(ownerUserId, articleId, {
      baseDocumentVersion: 7,
      mode: "original",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({
      Authorization: "Bearer kimi-secret",
      "User-Agent": "WeChatLayout/1.0",
    });
    expect(request.body).toBeTypeOf("string");
    const requestBody = JSON.parse(String(request.body)) as {
      messages: readonly { readonly content: string }[];
      response_format: { readonly type: string };
    };
    expect(requestBody.response_format).toEqual({ type: "json_object" });
    expect(requestBody.messages[0]?.content).toContain("JSON Schema");
    expect(result.provider).toBe("kimi");
    expect(result.decision.designName).toContain("纸上脉络");
    expect(result.candidates).toHaveLength(6);
  });

  it("automatically falls back to the next configured model", async () => {
    const fallbackDecision = {
      languageId: "minimal-blue",
      designName: "清晰路径",
      concept: "用稳定结构组织全文。",
      designTokens,
      rhythm: "balanced",
      variantSeed: 1098,
      visualAssets: [
        {
          afterBlockId: "block_paragraph",
          reason: "用几何主视觉建立阅读起点",
          resourceId: "builtin_visual_static_072",
        },
      ],
      visualIntensity: "restrained",
      dividerComponentId: "cmp_divider_ornament_dots_004",
      hero: {
        componentId: "cmp_intro_autumn_persimmon_001",
        eyebrow: "ARTICLE",
        title: "内容路径",
        footer: "阅读 · 理解",
      },
      footer: {
        componentId: "cmp_notice_story_intro_006",
        title: "读到这里",
        text: "带走文章的核心判断",
      },
      dividerAfterBlockIds: [],
      blocks: [],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(fallbackDecision) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const service = new AiLayoutService(
      options(null, {
        providers: [
          {
            apiKey: "deepseek-secret",
            baseUrl: "https://deepseek.example/v1",
            id: "deepseek",
            model: "deepseek-v4-flash",
            protocol: "chat-completions",
          },
          {
            apiKey: "qwen-secret",
            baseUrl: "https://qwen.example/v1",
            id: "qwen",
            model: "qwen3.5-flash",
            protocol: "chat-completions",
          },
        ],
      }),
      fetcher,
      documents(),
      resourceService(),
    );

    const result = await service.generate(ownerUserId, articleId, {
      baseDocumentVersion: 7,
      mode: "original",
      providerId: "auto",
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://deepseek.example/v1/chat/completions");
    expect(fetcher.mock.calls[1]?.[0]).toBe("https://qwen.example/v1/chat/completions");
    expect(result.provider).toBe("qwen");
    expect(result.model).toBe("qwen3.5-flash");
  });
});
