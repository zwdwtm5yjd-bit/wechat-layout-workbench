import { afterEach, describe, expect, it, vi } from "vitest";

import { ArticleClientError, createArticle, listArticles, trashArticle } from "./client";

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

describe("article client", () => {
  it("builds encoded list filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listArticles({
      search: "巡察 & 工作",
      status: "pending_layout",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/articles?");
    expect(url).toContain("status=pending_layout");
    expect(url).toContain("search=%E5%B7%A1%E5%AF%9F+%26+%E5%B7%A5%E4%BD%9C");
    expect(init.credentials).toBe("include");
  });

  it("obtains CSRF before create and delete writes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { csrfToken: "csrf-for-create" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { id: "article-created", title: "测试文章" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { csrfToken: "csrf-for-delete" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { id: "article-created", deletedAt: new Date().toISOString() },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createArticle({
      title: "测试文章",
      contentType: "general",
      layoutStrength: "standard",
    });
    await trashArticle("article-created");

    const [, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const [, trashInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(createInit).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "X-CSRF-Token": "csrf-for-create",
      }),
    });
    expect(createInit.body).toContain('"sourceType":"blank"');
    expect(trashInit).toMatchObject({
      method: "DELETE",
      headers: expect.objectContaining({
        "X-CSRF-Token": "csrf-for-delete",
      }),
    });
  });

  it("surfaces stable API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            success: false,
            error: {
              code: "ARTICLE_NOT_FOUND",
              message: "文章不存在",
            },
          },
          404,
        ),
      ),
    );

    await expect(listArticles({})).rejects.toEqual(
      expect.objectContaining<ArticleClientError>({
        name: "ArticleClientError",
        status: 404,
        code: "ARTICLE_NOT_FOUND",
        message: "文章不存在",
      }),
    );
  });
});
