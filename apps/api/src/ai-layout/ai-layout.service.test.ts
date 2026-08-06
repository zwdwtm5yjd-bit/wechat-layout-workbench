import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { describe, expect, it, vi } from "vitest";

import type { DocumentService } from "../documents/document.service.js";
import type { AiLayoutRuntimeOptions } from "./ai-layout.constants.js";
import { AiLayoutService } from "./ai-layout.service.js";

const articleId = "0198f8e1-7a01-7000-8000-000000000301";
const ownerUserId = "0198f8e1-7a01-7000-8000-000000000302";

function documents(): DocumentService {
  return {
    get: vi.fn().mockResolvedValue({
      articleId,
      document: { ...structuredClone(documentV1Fixture), articleId },
      documentVersion: 7,
    }),
  } as unknown as DocumentService;
}

function options(
  apiKey: string | null,
  overrides: Partial<AiLayoutRuntimeOptions> = {},
): AiLayoutRuntimeOptions {
  return {
    apiKey,
    baseUrl: "https://api.example.test/v1",
    model: "layout-model",
    protocol: "responses",
    provider: "openai-compatible",
    timeoutMs: 10_000,
    ...overrides,
  };
}

describe("AiLayoutService", () => {
  it("reports an unavailable model and refuses to fake AI output", async () => {
    const fetcher = vi.fn();
    const service = new AiLayoutService(options(null), fetcher, documents());

    expect(service.status()).toEqual({
      available: false,
      model: "layout-model",
      provider: "openai-compatible",
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
      rhythm: "compact",
      variantSeed: 2187,
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
    const service = new AiLayoutService(options("secret-key"), fetcher, documents());
    const result = await service.generate(ownerUserId, articleId, {
      baseDocumentVersion: 7,
      mode: "original",
      preferredLanguageId: "minimal-blue",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/v1/responses",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({ Authorization: "Bearer secret-key" });
    expect(String(request.body)).toContain("wechat_article_layout_decision");
    expect(result.decision.languageId).toBe("crimson-editorial");
    expect(result.decision.blocks).toHaveLength(documentV1Fixture.content.content.length);
    expect(result.decision.dividerAfterBlockIds).toEqual(["block_paragraph"]);
  });

  it("uses Kimi-compatible chat completions and accepts fenced JSON safely", async () => {
    const modelDecision = {
      languageId: "warm-paper",
      designName: "纸上脉络",
      concept: "用杂志留白和少量信息锚点组织阅读节奏。",
      rhythm: "airy",
      variantSeed: 7301,
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
        protocol: "chat-completions",
        provider: "kimi-code",
      }),
      fetcher,
      documents(),
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
    expect(result.provider).toBe("kimi-code");
    expect(result.decision.designName).toBe("纸上脉络");
  });
});
