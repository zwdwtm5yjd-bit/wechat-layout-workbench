import {
  AI_LAYOUT_DESIGN_LANGUAGE_IDS,
  AI_LAYOUT_TREATMENTS,
  type AiLayoutBlockDecision,
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
import { AI_LAYOUT_FETCH, AI_LAYOUT_OPTIONS, type AiLayoutRuntimeOptions } from "./ai-layout.constants.js";

type Fetcher = typeof globalThis.fetch;
type TopLevelBlock = DocNode["content"][number];

const blockDecisionSchema = z.strictObject({
  blockId: z.string().min(1).max(160),
  reason: z.string().min(1).max(120),
  treatment: z.enum(AI_LAYOUT_TREATMENTS),
});

const decisionSchema = z.strictObject({
  blocks: z.array(blockDecisionSchema).max(160),
  concept: z.string().min(2).max(240),
  designName: z.string().min(2).max(50),
  dividerAfterBlockIds: z.array(z.string().min(1).max(160)).max(8),
  footer: z.strictObject({
    text: z.string().min(1).max(80),
    title: z.string().min(1).max(40),
  }),
  hero: z.strictObject({
    eyebrow: z.string().min(1).max(36),
    footer: z.string().min(1).max(80),
    title: z.string().min(1).max(56),
  }),
  languageId: z.enum(AI_LAYOUT_DESIGN_LANGUAGE_IDS),
});

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "blocks",
    "concept",
    "designName",
    "dividerAfterBlockIds",
    "footer",
    "hero",
    "languageId",
  ],
  properties: {
    blocks: {
      type: "array",
      maxItems: 160,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["blockId", "reason", "treatment"],
        properties: {
          blockId: { type: "string", minLength: 1, maxLength: 160 },
          reason: { type: "string", minLength: 1, maxLength: 120 },
          treatment: { type: "string", enum: AI_LAYOUT_TREATMENTS },
        },
      },
    },
    concept: { type: "string", minLength: 2, maxLength: 240 },
    designName: { type: "string", minLength: 2, maxLength: 50 },
    dividerAfterBlockIds: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 160 },
    },
    footer: {
      type: "object",
      additionalProperties: false,
      required: ["text", "title"],
      properties: {
        text: { type: "string", minLength: 1, maxLength: 80 },
        title: { type: "string", minLength: 1, maxLength: 40 },
      },
    },
    hero: {
      type: "object",
      additionalProperties: false,
      required: ["eyebrow", "footer", "title"],
      properties: {
        eyebrow: { type: "string", minLength: 1, maxLength: 36 },
        footer: { type: "string", minLength: 1, maxLength: 80 },
        title: { type: "string", minLength: 1, maxLength: 56 },
      },
    },
    languageId: { type: "string", enum: AI_LAYOUT_DESIGN_LANGUAGE_IDS },
  },
} as const;

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
        return node.content.flatMap((child) => originalTopLevelBlocks({
          ...document,
          content: { type: "doc", content: [child] },
        }));
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

function compatibleTreatment(node: TopLevelBlock, treatment: AiLayoutTreatment): AiLayoutTreatment {
  if (node.type === "paragraph") {
    const length = textFromNode(node).trim().length;
    if ((treatment === "title" || treatment === "section") && length > 80) return "body";
    return treatment === "image" || treatment === "list" ? "body" : treatment;
  }
  if (node.type === "heading") return treatment === "title" || treatment === "section" ? treatment : "body";
  if (node.type === "imageBlock") return treatment === "image" ? treatment : "body";
  if (node.type === "bulletList" || node.type === "orderedList") return treatment === "list" ? treatment : "body";
  if (node.type === "blockquote") return treatment === "quote" ? treatment : "body";
  return "body";
}

function sanitizeDecision(raw: AiLayoutDecision, blocks: readonly TopLevelBlock[]): AiLayoutDecision {
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
    submitted.set(decision.blockId, { ...decision, treatment });
  }

  return {
    ...raw,
    blocks: blocks.map(
      (node): AiLayoutBlockDecision =>
        submitted.get(node.attrs.blockId) ?? {
          blockId: node.attrs.blockId,
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
      provider: "openai-compatible",
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
      text: textFromNode(node).replaceAll(/\s+/gu, " ").trim().slice(0, 1_000),
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
      "每一个提供的 blockId 必须且只能在 blocks 中出现一次。输出必须严格符合 JSON Schema。",
    ].join("\n");
    const userInput = JSON.stringify({
      request: {
        mode: input.mode,
        preferredLanguageId: preferred,
        styleBrief: brief,
      },
      article: { articleId, blocks: outline },
    });

    let response: Response;
    try {
      response = await this.fetcher(`${this.options.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
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
    const serialized = outputText(payload);
    if (serialized === null) throw providerFailure(response.status);

    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized) as unknown;
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
