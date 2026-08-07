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
  AI_LAYOUT_TITLE_ALIGNS,
  AI_LAYOUT_TREATMENTS,
  AI_LAYOUT_VISUAL_INTENSITIES,
  type AiLayoutBlockDecision,
  type AiLayoutComponentId,
  type AiLayoutConcreteProviderId,
  type AiLayoutDecision,
  type AiLayoutDesignLanguageId,
  type AiLayoutDesignTokens,
  type AiLayoutProviderId,
  type AiLayoutStatus,
  type AiLayoutTreatment,
  type GenerateAiLayoutInput,
  type GenerateAiLayoutResult,
} from "@wechat-layout/api-contracts";
import { OFFICIAL_COMPONENT_ASSETS } from "@wechat-layout/component-registry";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { parseDocument, type DocNode, type DocumentV1 } from "@wechat-layout/document-schema";
import { z } from "zod";

import { ApiException } from "../common/http/api.exception.js";
import { DocumentService } from "../documents/document.service.js";
import {
  AI_LAYOUT_FETCH,
  AI_LAYOUT_OPTIONS,
  type AiLayoutProviderRuntimeOptions,
  type AiLayoutRuntimeOptions,
} from "./ai-layout.constants.js";

type Fetcher = typeof globalThis.fetch;
type TopLevelBlock = DocNode["content"][number];

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/u);

const designTokensSchema = z.strictObject({
  accentColor: hexColor,
  bodyFontSize: z.number().int().min(14).max(16),
  bodyLineHeight: z.number().min(1.75).max(2),
  cardRadius: z.number().int().min(0).max(24),
  mutedColor: hexColor,
  primaryColor: hexColor,
  sectionSpacing: z.number().int().min(28).max(56),
  surfaceAltColor: hexColor,
  surfaceColor: hexColor,
  textColor: hexColor,
  titleAlign: z.enum(AI_LAYOUT_TITLE_ALIGNS),
});

const blockDecisionSchema = z.strictObject({
  blockId: z.string().min(1).max(160),
  componentId: z.enum(AI_LAYOUT_COMPONENT_IDS).nullable(),
  reason: z.string().min(1).max(120),
  treatment: z.enum(AI_LAYOUT_TREATMENTS),
});

const decisionSchema = z.strictObject({
  blocks: z.array(blockDecisionSchema).max(160),
  concept: z.string().min(2).max(240),
  designTokens: designTokensSchema,
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
    "designTokens",
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
    designTokens: {
      type: "object",
      additionalProperties: false,
      required: [
        "accentColor",
        "bodyFontSize",
        "bodyLineHeight",
        "cardRadius",
        "mutedColor",
        "primaryColor",
        "sectionSpacing",
        "surfaceAltColor",
        "surfaceColor",
        "textColor",
        "titleAlign",
      ],
      properties: {
        accentColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        bodyFontSize: { type: "integer", minimum: 14, maximum: 16 },
        bodyLineHeight: { type: "number", minimum: 1.75, maximum: 2 },
        cardRadius: { type: "integer", minimum: 0, maximum: 24 },
        mutedColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        primaryColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        sectionSpacing: { type: "integer", minimum: 28, maximum: 56 },
        surfaceAltColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        surfaceColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        textColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        titleAlign: { type: "string", enum: AI_LAYOUT_TITLE_ALIGNS },
      },
    },
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

const defaultDesignTokens: Readonly<Record<AiLayoutDesignLanguageId, AiLayoutDesignTokens>> = {
  "minimal-blue": {
    accentColor: "#5B7CFA",
    bodyFontSize: 14,
    bodyLineHeight: 1.85,
    cardRadius: 8,
    mutedColor: "#667085",
    primaryColor: "#3157D5",
    sectionSpacing: 36,
    surfaceAltColor: "#F3F6FF",
    surfaceColor: "#FFFFFF",
    textColor: "#273142",
    titleAlign: "left",
  },
  "warm-paper": {
    accentColor: "#B86B43",
    bodyFontSize: 15,
    bodyLineHeight: 1.9,
    cardRadius: 6,
    mutedColor: "#7B6B61",
    primaryColor: "#8C4B2F",
    sectionSpacing: 40,
    surfaceAltColor: "#F7F0E7",
    surfaceColor: "#FFFDF8",
    textColor: "#3F332C",
    titleAlign: "center",
  },
  "night-cyan": {
    accentColor: "#F5C95B",
    bodyFontSize: 14,
    bodyLineHeight: 1.82,
    cardRadius: 10,
    mutedColor: "#9FB8C4",
    primaryColor: "#18B7C9",
    sectionSpacing: 34,
    surfaceAltColor: "#153B4A",
    surfaceColor: "#0C2732",
    textColor: "#F1F7F9",
    titleAlign: "left",
  },
  "forest-green": {
    accentColor: "#A26E3D",
    bodyFontSize: 15,
    bodyLineHeight: 1.92,
    cardRadius: 4,
    mutedColor: "#647266",
    primaryColor: "#315A46",
    sectionSpacing: 44,
    surfaceAltColor: "#EEF3EC",
    surfaceColor: "#FBFCF8",
    textColor: "#334139",
    titleAlign: "center",
  },
  "crimson-editorial": {
    accentColor: "#D29A54",
    bodyFontSize: 15,
    bodyLineHeight: 1.85,
    cardRadius: 6,
    mutedColor: "#756A64",
    primaryColor: "#B4232C",
    sectionSpacing: 42,
    surfaceAltColor: "#FEF2F2",
    surfaceColor: "#FFFFFF",
    textColor: "#2A221F",
    titleAlign: "center",
  },
  "ink-gold": {
    accentColor: "#D0A45D",
    bodyFontSize: 15,
    bodyLineHeight: 1.92,
    cardRadius: 3,
    mutedColor: "#A6A09A",
    primaryColor: "#A9813E",
    sectionSpacing: 40,
    surfaceAltColor: "#262626",
    surfaceColor: "#171717",
    textColor: "#F2EFE9",
    titleAlign: "center",
  },
};

function channelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const value = color.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

function contrastRatio(first: string, second: string): number {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function accessibleDesignTokens(
  tokens: AiLayoutDesignTokens,
  languageId: AiLayoutDesignLanguageId,
): AiLayoutDesignTokens {
  const fallback = defaultDesignTokens[languageId];
  return {
    ...tokens,
    mutedColor:
      contrastRatio(tokens.mutedColor, tokens.surfaceColor) >= 3
        ? tokens.mutedColor.toUpperCase()
        : fallback.mutedColor,
    textColor:
      contrastRatio(tokens.textColor, tokens.surfaceColor) >= 4.5
        ? tokens.textColor.toUpperCase()
        : fallback.textColor,
    accentColor: tokens.accentColor.toUpperCase(),
    primaryColor: tokens.primaryColor.toUpperCase(),
    surfaceAltColor: tokens.surfaceAltColor.toUpperCase(),
    surfaceColor: tokens.surfaceColor.toUpperCase(),
  };
}

function promotedDecision(
  decision: AiLayoutBlockDecision,
  treatment: AiLayoutTreatment,
): AiLayoutBlockDecision {
  return {
    ...decision,
    componentId: compatibleComponentId(treatment, decision.componentId),
    reason: `${decision.reason}；由结构保障器补足完整阅读路径`.slice(0, 120),
    treatment,
  };
}

function headingSignal(text: string): boolean {
  return /^(?:[一二三四五六七八九十]+[、.．]|[（(]?[一二三四五六七八九十0-9]+[）).、])/u.test(text);
}

function ensureVisibleStructure(
  decisions: readonly AiLayoutBlockDecision[],
  blocks: readonly TopLevelBlock[],
): readonly AiLayoutBlockDecision[] {
  const normalized = decisions.map((decision) => ({ ...decision }));
  const blockIndex = new Map(blocks.map((node, index) => [node.attrs.blockId, index]));
  const decisionFor = (index: number) => normalized[index];
  const textAt = (index: number) => textFromNode(blocks[index]).replaceAll(/\s+/gu, " ").trim();

  if (!normalized.some((decision) => decision.treatment === "title")) {
    const index = blocks.findIndex(
      (node, candidateIndex) =>
        node.type === "paragraph" &&
        node.attrs.semanticRole !== "unresolved_image" &&
        textAt(candidateIndex).length > 3 &&
        textAt(candidateIndex).length <= 60,
    );
    const decision = decisionFor(index);
    if (decision !== undefined) normalized[index] = promotedDecision(decision, "title");
  }

  if (blocks.length >= 8) {
    const sectionCount = normalized.filter((decision) => decision.treatment === "section").length;
    if (sectionCount < 2) {
      const candidates = blocks
        .map((node, index) => ({ index, node, text: textAt(index) }))
        .filter(
          ({ index, node, text }) =>
            node.type === "paragraph" &&
            text.length >= 4 &&
            text.length <= 80 &&
            headingSignal(text) &&
            decisionFor(index)?.treatment !== "title",
        )
        .slice(0, 4);
      for (const { index } of candidates) {
        const decision = decisionFor(index);
        if (decision === undefined) continue;
        normalized[index] = promotedDecision(decision, "section");
      }
    }
  }

  if (!normalized.some((decision) => decision.treatment === "lead")) {
    const index = blocks.findIndex((node, candidateIndex) => {
      const treatment = decisionFor(candidateIndex)?.treatment;
      const text = textAt(candidateIndex);
      return (
        node.type === "paragraph" &&
        node.attrs.semanticRole !== "unresolved_image" &&
        treatment !== "title" &&
        treatment !== "section" &&
        text.length >= 12 &&
        text.length <= 180
      );
    });
    const decision = decisionFor(index);
    if (decision !== undefined) normalized[index] = promotedDecision(decision, "lead");
  }

  if (!normalized.some((decision) => decision.treatment === "data")) {
    const index = blocks.findIndex((node, candidateIndex) => {
      if (node.type !== "paragraph") return false;
      const text = textAt(candidateIndex);
      const numbers = text.match(/\d+(?:\.\d+)?(?:%|万|亿|倍|年|个|项|人|件)?/gu) ?? [];
      return text.length >= 18 && text.length <= 420 && numbers.length >= 2;
    });
    const decision = decisionFor(index);
    if (decision !== undefined && decision.treatment === "body") {
      normalized[index] = promotedDecision(decision, "data");
    }
  }

  return normalized.toSorted(
    (left, right) =>
      (blockIndex.get(left.blockId) ?? Number.MAX_SAFE_INTEGER) -
      (blockIndex.get(right.blockId) ?? Number.MAX_SAFE_INTEGER),
  );
}

const componentCatalog = OFFICIAL_COMPONENT_ASSETS.filter((asset) =>
  (AI_LAYOUT_COMPONENT_IDS as readonly string[]).includes(asset.manifest.componentId),
).map((asset) => ({
  description: asset.preview.description,
  id: asset.manifest.componentId,
  layout: asset.preview.layoutKey,
  name: asset.preview.name,
  sample: asset.preview.sample,
}));

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

  const normalizedBlocks = blocks.map(
    (node): AiLayoutBlockDecision =>
      submitted.get(node.attrs.blockId) ?? {
        blockId: node.attrs.blockId,
        componentId: node.type === "imageBlock" ? AI_LAYOUT_IMAGE_COMPONENT_IDS[0] : null,
        reason: "保留为连续正文",
        treatment: node.type === "imageBlock" ? "image" : "body",
      },
  );

  return {
    ...raw,
    blocks: ensureVisibleStructure(normalizedBlocks, blocks),
    designTokens: accessibleDesignTokens(raw.designTokens, raw.languageId),
    dividerAfterBlockIds: [...new Set(raw.dividerAfterBlockIds)]
      .filter((blockId) => byId.has(blockId))
      .slice(0, 5),
  };
}

const providerProfiles: Readonly<
  Record<AiLayoutConcreteProviderId, Readonly<{ description: string; label: string }>>
> = {
  deepseek: { description: "速度快、成本低，适合日常排版", label: "DeepSeek" },
  qwen: { description: "中文结构稳定，适合政务和长文", label: "通义千问" },
  kimi: { description: "长文理解强，作为质量兜底", label: "Kimi" },
};

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
      message: "所选 AI 模型的调用额度暂时不可用",
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
    const availableProviders = this.options.providers.filter(
      (provider) => provider.apiKey !== null,
    );
    const preferredProvider =
      this.options.defaultProviderId === "auto"
        ? availableProviders[0]
        : availableProviders.find((provider) => provider.id === this.options.defaultProviderId);
    return {
      available: availableProviders.length > 0,
      defaultProviderId: this.options.defaultProviderId,
      model: preferredProvider?.model ?? this.options.providers[0]?.model ?? "未配置",
      models: this.options.providers.map((provider) => ({
        available: provider.apiKey !== null,
        description: providerProfiles[provider.id].description,
        id: provider.id,
        label: providerProfiles[provider.id].label,
        model: provider.model,
      })),
      provider: this.options.defaultProviderId,
    };
  }

  private providerStatus(provider: AiLayoutProviderRuntimeOptions): AiLayoutStatus {
    return {
      ...this.status(),
      model: provider.model,
      provider: provider.id,
    };
  }

  private providersFor(requested: AiLayoutProviderId): readonly AiLayoutProviderRuntimeOptions[] {
    const configured = this.options.providers.filter((provider) => provider.apiKey !== null);
    if (requested === "auto") return configured;
    const selected = configured.find((provider) => provider.id === requested);
    if (selected !== undefined) return [selected];
    throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, {
      code: "AI_LAYOUT_PROVIDER_NOT_CONFIGURED",
      message: `${providerProfiles[requested].label} 尚未配置，请选择其他模型或自动选择`,
      retryable: false,
    });
  }

  private async requestDecision(
    provider: AiLayoutProviderRuntimeOptions,
    instructions: string,
    userInput: string,
  ): Promise<unknown> {
    if (provider.apiKey === null) throw providerFailure(HttpStatus.SERVICE_UNAVAILABLE);
    const endpoint =
      provider.protocol === "chat-completions"
        ? `${provider.baseUrl}/chat/completions`
        : `${provider.baseUrl}/responses`;
    const requestBody =
      provider.protocol === "chat-completions"
        ? {
            model: provider.model,
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
            max_tokens: 8_000,
            stream: false,
            ...(provider.id === "qwen"
              ? { enable_thinking: false }
              : provider.id === "deepseek" || provider.baseUrl.includes("moonshot")
                ? { thinking: { type: "disabled" } }
                : {}),
          }
        : {
            model: provider.model,
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
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "WeChatLayout/1.0",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch {
      throw new ApiException(HttpStatus.BAD_GATEWAY, {
        code: "AI_LAYOUT_PROVIDER_UNREACHABLE",
        message: `${providerProfiles[provider.id].label} 暂时无法连接`,
        retryable: true,
      });
    }

    if (!response.ok) throw providerFailure(response.status);
    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw providerFailure(response.status);
    }
    const serialized =
      provider.protocol === "chat-completions" ? chatCompletionText(payload) : outputText(payload);
    if (serialized === null) throw providerFailure(response.status);

    let parsed: unknown;
    try {
      parsed = JSON.parse(modelJsonText(serialized)) as unknown;
    } catch {
      throw providerFailure(response.status);
    }
    const validated = decisionSchema.safeParse(parsed);
    if (!validated.success) throw providerFailure(response.status);
    return validated.data;
  }

  async generate(
    ownerUserId: string,
    articleId: string,
    input: GenerateAiLayoutInput,
  ): Promise<GenerateAiLayoutResult> {
    const requestedProvider = input.providerId ?? this.options.defaultProviderId;
    const providers = this.providersFor(requestedProvider);
    if (providers.length === 0) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, {
        code: "AI_LAYOUT_NOT_CONFIGURED",
        message: "真实 AI 排版尚未连接可用模型",
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
      "长文必须建立完整阅读路径：选 2–4 个真正的主章节为 section；每章之间保留连续正文，不要把普通段落都做成卡片。系统会用这些 section 自动生成“本文看点”导航。",
      "lead 应优先选择能概括全文立场的开篇判断或金句；章节后的短句可作为 quote；包含两个以上有意义数字的段落优先作为 data。",
      "特殊模块要克制，连续正文仍是主体。不要生成占位图片、空图集、无关装饰或固定套话。",
      "hero 与 footer 文案可以概括文章气质，但不能新增事实。dividerAfterBlockIds 只放在真正的章节转折后。",
      "六种视觉语言：minimal-blue 理性极简；warm-paper 人文杂志；night-cyan 科技数据；forest-green 自然留白；crimson-editorial 政务编辑；ink-gold 经典深读。",
      "选择 crimson-editorial 时，目标是红白报刊编辑效果：引言金句、本文看点、编号章节、左线小标题、浅红关键词标记、数据三联卡和克制结尾；不是红金横幅堆叠。",
      "你必须定义 designTokens，让本篇文章拥有自己的主色、强调色、底色、字色、正文尺寸、行距、圆角和章节间距；textColor 与 surfaceColor 对比度至少 4.5:1。",
      "视觉结果必须在第一屏就能辨认：主标题、导读首屏、至少两个章节锚点；长文还要尽量包含一个数据卡或金句卡。不能只改变加粗和段落间距。",
      "你还要为每个特殊区块选择具体 componentId，这些选择会真正改变排版，不要总是选每类的第一个。body/list/lead 的 componentId 必须为 null。",
      `组件视觉说明（名称、用途、预览文案）：${JSON.stringify(componentCatalog)}。`,
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

    let lastError: unknown = null;
    for (const provider of providers) {
      try {
        const decision = await this.requestDecision(provider, instructions, userInput);
        return {
          ...this.providerStatus(provider),
          decision: sanitizeDecision(decision as AiLayoutDecision, blocks),
        };
      } catch (error) {
        lastError = error;
        if (requestedProvider !== "auto") throw error;
      }
    }
    if (lastError instanceof ApiException) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, {
        code: "AI_LAYOUT_ALL_PROVIDERS_FAILED",
        message: "可用 AI 模型均未返回有效排版，稍后再试或手动指定模型",
        retryable: true,
      });
    }
    throw providerFailure(HttpStatus.BAD_GATEWAY);
  }
}
