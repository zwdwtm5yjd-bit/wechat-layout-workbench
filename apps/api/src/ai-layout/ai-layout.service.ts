import {
  AI_LAYOUT_COMPONENT_IDS,
  AI_LAYOUT_DESIGN_LANGUAGE_IDS,
  AI_LAYOUT_DIVIDER_COMPONENT_IDS,
  AI_LAYOUT_HEADING1_COMPONENT_IDS,
  AI_LAYOUT_HEADING2_COMPONENT_IDS,
  AI_LAYOUT_HERO_COMPONENT_IDS,
  AI_LAYOUT_IMAGE_COMPONENT_IDS,
  AI_LAYOUT_NOTICE_COMPONENT_IDS,
  AI_LAYOUT_QUOTE_COMPONENT_IDS,
  AI_LAYOUT_RHYTHMS,
  AI_LAYOUT_TREATMENTS,
  AI_LAYOUT_VISUAL_INTENSITIES,
  type AiLayoutBlockDecision,
  type AiLayoutComponentId,
  type AiLayoutDecision,
  type AiLayoutStatus,
  type AiLayoutTreatment,
  type GenerateAiLayoutInput,
  type GenerateAiLayoutResult,
} from "@wechat-layout/api-contracts";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { parseDocument, type DocNode, type DocumentV1 } from "@wechat-layout/document-schema";
import { z } from "zod";

import { ApiException } from "../common/http/api.exception.js";
import { DocumentService } from "../documents/document.service.js";
import {
  AI_LAYOUT_FETCH,
  AI_LAYOUT_OPTIONS,
  type AiLayoutRuntimeOptions,
} from "./ai-layout.constants.js";

type Fetcher = typeof globalThis.fetch;
type TopLevelBlock = DocNode["content"][number];

const blockDecisionSchema = z.strictObject({
  blockId: z.string().min(1).max(160),
  componentId: z.enum(AI_LAYOUT_COMPONENT_IDS).nullable(),
  reason: z.string().min(1).max(120),
  treatment: z.enum(AI_LAYOUT_TREATMENTS),
});

const decisionSchema = z.strictObject({
  blocks: z.array(blockDecisionSchema).max(160),
  concept: z.string().min(2).max(240),
  designName: z.string().min(2).max(50),
  dividerComponentId: z.enum(AI_LAYOUT_DIVIDER_COMPONENT_IDS),
  dividerAfterBlockIds: z.array(z.string().min(1).max(160)).max(8),
  footer: z.strictObject({
    componentId: z.enum(AI_LAYOUT_NOTICE_COMPONENT_IDS),
    text: z.string().min(1).max(80),
    title: z.string().min(1).max(40),
  }),
  hero: z.strictObject({
    componentId: z.enum(AI_LAYOUT_HERO_COMPONENT_IDS),
    eyebrow: z.string().min(1).max(36),
    footer: z.string().min(1).max(80),
    title: z.string().min(1).max(56),
  }),
  languageId: z.enum(AI_LAYOUT_DESIGN_LANGUAGE_IDS),
  rhythm: z.enum(AI_LAYOUT_RHYTHMS),
  variantSeed: z.number().int().min(0).max(9_999),
  visualIntensity: z.enum(AI_LAYOUT_VISUAL_INTENSITIES),
});

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "blocks",
    "concept",
    "designName",
    "dividerComponentId",
    "dividerAfterBlockIds",
    "footer",
    "hero",
    "languageId",
    "rhythm",
    "variantSeed",
    "visualIntensity",
  ],
  properties: {
    blocks: {
      type: "array",
      maxItems: 160,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["blockId", "componentId", "reason", "treatment"],
        properties: {
          blockId: { type: "string", minLength: 1, maxLength: 160 },
          componentId: {
            anyOf: [{ type: "string", enum: AI_LAYOUT_COMPONENT_IDS }, { type: "null" }],
          },
          reason: { type: "string", minLength: 1, maxLength: 120 },
          treatment: { type: "string", enum: AI_LAYOUT_TREATMENTS },
        },
      },
    },
    concept: { type: "string", minLength: 2, maxLength: 240 },
    designName: { type: "string", minLength: 2, maxLength: 50 },
    dividerComponentId: { type: "string", enum: AI_LAYOUT_DIVIDER_COMPONENT_IDS },
    dividerAfterBlockIds: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 160 },
    },
    footer: {
      type: "object",
      additionalProperties: false,
      required: ["componentId", "text", "title"],
      properties: {
        componentId: { type: "string", enum: AI_LAYOUT_NOTICE_COMPONENT_IDS },
        text: { type: "string", minLength: 1, maxLength: 80 },
        title: { type: "string", minLength: 1, maxLength: 40 },
      },
    },
    hero: {
      type: "object",
      additionalProperties: false,
      required: ["componentId", "eyebrow", "footer", "title"],
      properties: {
        componentId: { type: "string", enum: AI_LAYOUT_HERO_COMPONENT_IDS },
        eyebrow: { type: "string", minLength: 1, maxLength: 36 },
        footer: { type: "string", minLength: 1, maxLength: 80 },
        title: { type: "string", minLength: 1, maxLength: 56 },
      },
    },
    languageId: { type: "string", enum: AI_LAYOUT_DESIGN_LANGUAGE_IDS },
    rhythm: { type: "string", enum: AI_LAYOUT_RHYTHMS },
    variantSeed: { type: "integer", minimum: 0, maximum: 9_999 },
    visualIntensity: { type: "string", enum: AI_LAYOUT_VISUAL_INTENSITIES },
  },
} as const;

const componentIdsByTreatment: Readonly<
  Partial<Record<AiLayoutTreatment, ReadonlySet<AiLayoutComponentId>>>
> = {
  title: new Set(AI_LAYOUT_HEADING1_COMPONENT_IDS),
  section: new Set(AI_LAYOUT_HEADING2_COMPONENT_IDS),
  quote: new Set(AI_LAYOUT_QUOTE_COMPONENT_IDS),
  data: new Set(AI_LAYOUT_NOTICE_COMPONENT_IDS),
  callout: new Set(AI_LAYOUT_NOTICE_COMPONENT_IDS),
  image: new Set(AI_LAYOUT_IMAGE_COMPONENT_IDS),
};

function compatibleComponentId(
  treatment: AiLayoutTreatment,
  componentId: AiLayoutComponentId | null,
): AiLayoutComponentId | null {
  if (componentId === null) return null;
  return componentIdsByTreatment[treatment]?.has(componentId) === true ? componentId : null;
}

function textFromNode(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  const record = node as { readonly content?: readonly unknown[]; readonly text?: unknown };
  return `${typeof record.text === "string" ? record.text : ""}${
    record.content?.map(textFromNode).join("") ?? ""
  }`;
}

function originalTopLevelBlocks(document: DocumentV1): readonly TopLevelBlock[] {
  return document.content.content.flatMap((node): readonly TopLevelBlock[] => {
    if (node.attrs.semanticRole?.startsWith("layout_plan_generated") === true) {
      if (node.type === "semanticCard" && node.content !== undefined) {
        return node.content.flatMap((child) =>
          originalTopLevelBlocks({
            ...document,
            content: { type: "doc", content: [child] },
          }),
        );
      }
      return [];
    }
    if (
      node.type === "blockquote" &&
      node.attrs.semanticRole === "layout_plan_emphasis" &&
      node.content.length === 1 &&
      node.content[0]?.type === "paragraph"
    ) {
      return [node.content[0]];
    }
    return [node];
  });
}

function outputText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const output = (payload as { readonly output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { readonly content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const record = part as { readonly text?: unknown; readonly type?: unknown };
      if (record.type === "output_text" && typeof record.text === "string") return record.text;
    }
  }
  return null;
}

function chatCompletionText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { readonly choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  for (const choice of choices) {
    if (typeof choice !== "object" || choice === null) continue;
    const message = (choice as { readonly message?: unknown }).message;
    if (typeof message !== "object" || message === null) continue;
    const content = (message as { readonly content?: unknown }).content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) continue;
    const combined = content
      .flatMap((part): readonly string[] => {
        if (typeof part !== "object" || part === null) return [];
        const text = (part as { readonly text?: unknown }).text;
        return typeof text === "string" ? [text] : [];
      })
      .join("");
    if (combined.length > 0) return combined;
  }
  return null;
}

function modelJsonText(serialized: string): string {
  const trimmed = serialized.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}

function compatibleTreatment(node: TopLevelBlock, treatment: AiLayoutTreatment): AiLayoutTreatment {
  if (node.type === "paragraph") {
    const length = textFromNode(node).trim().length;
    if ((treatment === "title" || treatment === "section") && length > 80) return "body";
    return treatment === "image" || treatment === "list" ? "body" : treatment;
  }
  if (node.type === "heading")
    return treatment === "title" || treatment === "section" ? treatment : "body";
  if (node.type === "imageBlock") return treatment === "image" ? treatment : "body";
  if (node.type === "bulletList" || node.type === "orderedList")
    return treatment === "list" ? treatment : "body";
  if (node.type === "blockquote") return treatment === "quote" ? treatment : "body";
  return "body";
}

function sanitizeDecision(
  raw: AiLayoutDecision,
  blocks: readonly TopLevelBlock[],
): AiLayoutDecision {
  const byId = new Map(blocks.map((node) => [node.attrs.blockId, node]));
  const submitted = new Map<string, AiLayoutBlockDecision>();
  let titleCount = 0;
  let leadCount = 0;
  let quoteCount = 0;
  let calloutCount = 0;

  for (const decision of raw.blocks) {
    const node = byId.get(decision.blockId);
    if (node === undefined || submitted.has(decision.blockId)) continue;
    let treatment = compatibleTreatment(node, decision.treatment);
    if (treatment === "title" && titleCount >= 1) treatment = "section";
    if (treatment === "lead" && leadCount >= 1) treatment = "body";
    if (treatment === "quote" && quoteCount >= 3) treatment = "body";
    if ((treatment === "data" || treatment === "callout") && calloutCount >= 3) treatment = "body";
    if (treatment === "title") titleCount += 1;
    if (treatment === "lead") leadCount += 1;
    if (treatment === "quote") quoteCount += 1;
    if (treatment === "data" || treatment === "callout") calloutCount += 1;
    submitted.set(decision.blockId, {
      ...decision,
      componentId: compatibleComponentId(treatment, decision.componentId),
      treatment,
    });
  }

  return {
    ...raw,
    blocks: blocks.map(
      (node): AiLayoutBlockDecision =>
        submitted.get(node.attrs.blockId) ?? {
          blockId: node.attrs.blockId,
          componentId: node.type === "imageBlock" ? AI_LAYOUT_IMAGE_COMPONENT_IDS[0] : null,
          reason: "保留为连续正文",
          treatment: node.type === "imageBlock" ? "image" : "body",
        },
    ),
    dividerAfterBlockIds: [...new Set(raw.dividerAfterBlockIds)]
      .filter((blockId) => byId.has(blockId))
      .slice(0, 5),
  };
}

function providerFailure(status: number): ApiException {
  if (status === 401 || status === 403) {
    return new ApiException(HttpStatus.BAD_GATEWAY, {
      code: "AI_LAYOUT_PROVIDER_AUTH_FAILED",
      message: "AI 排版模型凭据无效或已失效，请更新后重试",
      retryable: false,
    });
  }
  if (status === 402) {
    return new ApiException(HttpStatus.BAD_GATEWAY, {
      code: "AI_LAYOUT_PROVIDER_QUOTA_UNAVAILABLE",
      message: "Kimi Code 会员权益或调用额度暂时不可用",
      retryable: false,
    });
  }
  if (status === 429) {
    return new ApiException(HttpStatus.TOO_MANY_REQUESTS, {
      code: "AI_LAYOUT_RATE_LIMITED",
      message: "AI 排版请求较多，请稍后再试",
      retryable: true,
    });
  }
  return new ApiException(HttpStatus.BAD_GATEWAY, {
    code: "AI_LAYOUT_PROVIDER_FAILED",
    message: "AI 排版服务暂时没有返回有效方案",
    retryable: status >= 500,
  });
}

@Injectable()
export class AiLayoutService {
  constructor(
    @Inject(AI_LAYOUT_OPTIONS) private readonly options: AiLayoutRuntimeOptions,
    @Inject(AI_LAYOUT_FETCH) private readonly fetcher: Fetcher,
    @Inject(DocumentService) private readonly documents: DocumentService,
  ) {}

  status(): AiLayoutStatus {
    return {
      available: this.options.apiKey !== null,
      model: this.options.model,
      provider: this.options.provider,
    };
  }

  async generate(
    ownerUserId: string,
    articleId: string,
    input: GenerateAiLayoutInput,
  ): Promise<GenerateAiLayoutResult> {
    if (this.options.apiKey === null) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, {
        code: "AI_LAYOUT_NOT_CONFIGURED",
        message: "真实 AI 排版尚未连接模型，请先配置 AI_LAYOUT_API_KEY",
        retryable: false,
      });
    }

    const current = await this.documents.get(ownerUserId, articleId);
    if (current.documentVersion !== input.baseDocumentVersion) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: "ARTICLE_VERSION_CONFLICT",
        message: "文章刚刚发生变化，请保存后重新生成 AI 排版",
        retryable: false,
      });
    }
    const document = parseDocument(current.document);
    const blocks = originalTopLevelBlocks(document).slice(0, 120);
    const outline = blocks.map((node, index) => ({
      blockId: node.attrs.blockId,
      index,
      semanticRole: node.attrs.semanticRole ?? null,
      text: (node.type === "imageBlock"
        ? [node.attrs.alt, node.attrs.caption].filter(Boolean).join(" · ")
        : textFromNode(node)
      )
        .replaceAll(/\s+/gu, " ")
        .trim()
        .slice(0, 1_000),
      type: node.type,
    }));
    const preferred = input.preferredLanguageId ?? "由你根据全文判断";
    const brief = input.styleBrief?.trim() || "没有额外风格要求";
    const instructions = [
      "你是微信公众号文章的资深视觉编辑。你不是在挑模板，而是在阅读全文后设计这篇文章独有的阅读结构。",
      "必须保持原文事实与文字不变，只能通过 blockId 决定视觉角色；不要编造数据、图片、引用、人物或段落。",
      "title/section 只给真正承担标题作用的短文本；lead 只选一段；quote 最多 3 段；data/callout 合计最多 3 段。",
      "特殊模块要克制，连续正文仍是主体。不要生成占位图片、空图集、无关装饰或固定套话。",
      "hero 与 footer 文案可以概括文章气质，但不能新增事实。dividerAfterBlockIds 只放在真正的章节转折后。",
      "六种视觉语言：minimal-blue 理性极简；warm-paper 人文杂志；night-cyan 科技数据；forest-green 自然留白；crimson-editorial 政务编辑；ink-gold 经典深读。",
      "你还要为每个特殊区块选择具体 componentId，这些选择会真正改变排版，不要总是选每类的第一个。body/list/lead 的 componentId 必须为 null。",
      `一级标题候选：${AI_LAYOUT_HEADING1_COMPONENT_IDS.join("、")}。`,
      `二级标题候选：${AI_LAYOUT_HEADING2_COMPONENT_IDS.join("、")}。`,
      `引用/金句候选：${AI_LAYOUT_QUOTE_COMPONENT_IDS.join("、")}。`,
      `数据/提示候选：${AI_LAYOUT_NOTICE_COMPONENT_IDS.join("、")}。`,
      `图片候选：${AI_LAYOUT_IMAGE_COMPONENT_IDS.join("、")}。`,
      `章节分隔候选：${AI_LAYOUT_DIVIDER_COMPONENT_IDS.join("、")}。`,
      `导读首屏候选：${AI_LAYOUT_HERO_COMPONENT_IDS.join("、")}。`,
      "rhythm 决定全文呼吸感：compact 紧凑、balanced 均衡、airy 舒展。visualIntensity 决定装饰强度：restrained 克制、balanced 均衡、bold 鲜明。",
      "variantSeed 是 0–9999 的整数，同一文章重新生成时要主动变化它，并换一组合理的组件组合。",
      "每一个提供的 blockId 必须且只能在 blocks 中出现一次。输出必须严格符合 JSON Schema。",
    ].join("\n");
    const userInput = JSON.stringify({
      request: {
        mode: input.mode,
        preferredLanguageId: preferred,
        styleBrief: brief,
        variationCue: Math.floor(Math.random() * 10_000),
      },
      article: { articleId, blocks: outline },
    });

    const endpoint =
      this.options.protocol === "chat-completions"
        ? `${this.options.baseUrl}/chat/completions`
        : `${this.options.baseUrl}/responses`;
    const requestBody =
      this.options.protocol === "chat-completions"
        ? {
            model: this.options.model,
            messages: [
              {
                role: "system",
                content: [
                  instructions,
                  "只返回一个 JSON 对象，不要使用 Markdown 代码围栏，也不要输出解释文字。",
                  `返回对象必须符合这个 JSON Schema：${JSON.stringify(responseJsonSchema)}`,
                ].join("\n"),
              },
              { role: "user", content: userInput },
            ],
            response_format: { type: "json_object" },
            reasoning_effort: "high",
            max_tokens: 8_000,
            stream: false,
          }
        : {
            model: this.options.model,
            instructions,
            input: userInput,
            reasoning: { effort: "medium" },
            text: {
              format: {
                type: "json_schema",
                name: "wechat_article_layout_decision",
                strict: true,
                schema: responseJsonSchema,
              },
              verbosity: "low",
            },
            max_output_tokens: 8_000,
          };

    let response: Response;
    try {
      response = await this.fetcher(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "WeChatLayout/1.0",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch {
      throw new ApiException(HttpStatus.BAD_GATEWAY, {
        code: "AI_LAYOUT_PROVIDER_UNREACHABLE",
        message: "暂时无法连接 AI 排版服务，请稍后再试",
        retryable: true,
      });
    }

    if (!response.ok) throw providerFailure(response.status);
    const payload = (await response.json()) as unknown;
    const serialized =
      this.options.protocol === "chat-completions"
        ? chatCompletionText(payload)
        : outputText(payload);
    if (serialized === null) throw providerFailure(response.status);

    let parsed: unknown;
    try {
      parsed = JSON.parse(modelJsonText(serialized)) as unknown;
    } catch {
      throw providerFailure(response.status);
    }
    const validated = decisionSchema.safeParse(parsed);
    if (!validated.success) throw providerFailure(response.status);

    return {
      ...this.status(),
      decision: sanitizeDecision(validated.data, blocks),
    };
  }
}
