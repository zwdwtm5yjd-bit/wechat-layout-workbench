import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DocumentClientError,
  getArticleDocument,
  saveArticleDocument,
  type DocumentJson,
} from "./client";

const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462601";
const transactionId = "019c0fb5-7d53-7f66-bfb7-f70c0e462602";
const document: DocumentJson = {
  schemaVersion: "1.0.0",
  documentId: "019c0fb5-7d53-7f66-bfb7-f70c0e462603",
  articleId,
  content: { type: "doc", content: [] },
  meta: {
    sourceType: "manual",
    textLocked: true,
    createdAt: "2026-07-30T08:00:00.000Z",
    updatedAt: "2026-07-30T08:00:00.000Z",
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("document client", () => {
  it("reads a credentialed document without caching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          articleId,
          documentId: document.documentId,
          schemaVersion: "1.0.0",
          documentVersion: 1,
          document,
          textLocked: true,
          originalTextHash: null,
          currentTextHash: null,
          lastTransactionId: null,
          lastSavedBy: "019c0fb5-7d53-7f66-bfb7-f70c0e462604",
          lastSavedAt: "2026-07-30T08:00:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getArticleDocument(articleId);

    expect(result.documentVersion).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/articles/${articleId}/document`),
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );
  });

  it("obtains CSRF and sends the complete optimistic-lock save contract", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { csrfToken: "csrf-for-document" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            documentVersion: 2,
            lastTransactionId: transactionId,
            lastSavedAt: "2026-07-30T08:00:01.000Z",
            replayed: false,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveArticleDocument({
      articleId,
      baseVersion: 1,
      schemaVersion: "1.0.0",
      document,
      lastTransactionId: transactionId,
      transactionOrigin: "autosave",
    });

    expect(result.documentVersion).toBe(2);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain(`/api/v1/articles/${articleId}/document`);
    expect(init).toMatchObject({
      method: "PUT",
      credentials: "include",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "X-CSRF-Token": "csrf-for-document",
      }),
    });
    expect(JSON.parse(String(init.body))).toEqual({
      baseVersion: 1,
      schemaVersion: "1.0.0",
      document,
      lastTransactionId: transactionId,
      transactionOrigin: "autosave",
    });
  });

  it("preserves conflict details for the autosave controller", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            success: true,
            data: { csrfToken: "csrf-for-document" },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              success: false,
              error: {
                code: "ARTICLE_VERSION_CONFLICT",
                message: "文章已在其他标签页更新",
                details: {
                  currentVersion: 3,
                  submittedVersion: 2,
                },
                retryable: false,
              },
            },
            409,
          ),
        ),
    );

    await expect(
      saveArticleDocument({
        articleId,
        baseVersion: 2,
        schemaVersion: "1.0.0",
        document,
        lastTransactionId: transactionId,
        transactionOrigin: "autosave",
      }),
    ).rejects.toEqual(
      expect.objectContaining<DocumentClientError>({
        name: "DocumentClientError",
        status: 409,
        code: "ARTICLE_VERSION_CONFLICT",
        message: "文章已在其他标签页更新",
        details: {
          currentVersion: 3,
          submittedVersion: 2,
        },
        retryable: false,
      }),
    );
  });
});
