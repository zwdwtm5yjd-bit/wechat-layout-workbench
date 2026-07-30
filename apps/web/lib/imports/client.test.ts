import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmImportStructure,
  createPasteImport,
  getImportStructure,
  ImportClientError,
} from "./client";

const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462611";
const transactionId = "019c0fb5-7d53-7f66-bfb7-f70c0e462612";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("import client", () => {
  it("creates a paste import with HTML/plain text and CSRF protection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { csrfToken: "csrf-token" } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { articleId } }));
    vi.stubGlobal("fetch", fetchMock);

    await createPasteImport({
      html: "<h1>标题</h1>",
      plainText: "标题",
      cleaningMode: "preserve_structure",
      detectedSourceHint: "word",
      contentType: "general",
      layoutStrength: "standard",
    });

    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/v1/imports/paste");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "X-CSRF-Token": "csrf-token",
      }),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual(
      expect.objectContaining({
        html: "<h1>标题</h1>",
        plainText: "标题",
        detectedSourceHint: "word",
      }),
    );
  });

  it("loads refresh-safe structure state without CSRF", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { articleId, blocks: [] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getImportStructure(articleId);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/imports/${articleId}/structure`),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("confirms the full role set with a document version and transaction ID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { csrfToken: "csrf-token" } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { documentVersion: 2 } }));
    vi.stubGlobal("fetch", fetchMock);

    await confirmImportStructure({
      articleId,
      title: "确认标题",
      baseVersion: 1,
      lastTransactionId: transactionId,
      blocks: [{ sourceBlockId: "source_0001_abcdef", role: "title" }],
    });

    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        title: "确认标题",
        baseVersion: 1,
        lastTransactionId: transactionId,
        blocks: [{ sourceBlockId: "source_0001_abcdef", role: "title" }],
      }),
    });
  });

  it("preserves structured conflict details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            success: false,
            error: {
              code: "ARTICLE_VERSION_CONFLICT",
              message: "文章已更新",
              details: { currentVersion: 2, submittedVersion: 1 },
              retryable: false,
            },
          },
          409,
        ),
      ),
    );

    const error = await getImportStructure(articleId).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ImportClientError);
    expect(error).toMatchObject({
      status: 409,
      code: "ARTICLE_VERSION_CONFLICT",
      details: { currentVersion: 2, submittedVersion: 1 },
      retryable: false,
    });
  });
});
