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

function options(apiKey: string | null): AiLayoutRuntimeOptions {
  return {
    apiKey,
    baseUrl: "https://api.example.test/v1",
    model: "layout-model",
    timeoutMs: 10_000,
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
      hero: { eyebrow: "INSPECTION REPORT", title: "稳中提质", footer: "体系化 · 标准化" },
      footer: { title: "回看重点", text: "让监督成果落到行动" },
      dividerAfterBlockIds: ["block_paragraph", "unknown"],
      blocks: [
        { blockId: "block_heading", treatment: "title", reason: "全文标题" },
        { blockId: "block_paragraph", treatment: "lead", reason: "开篇导语" },
      ],
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            { content: [{ type: "output_text", text: JSON.stringify(modelDecision) }] },
          ],
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
});
