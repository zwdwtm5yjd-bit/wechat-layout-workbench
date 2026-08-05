import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountClientError,
  createAccount,
  getAccountDeleteImpact,
  listAccounts,
  permanentlyDeleteAccount,
} from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("account client", () => {
  it("builds encoded account filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listAccounts({ search: "巡察 & 发布", status: "active" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/accounts?");
    expect(url).toContain("status=active");
    expect(url).toContain("search=%E5%B7%A1%E5%AF%9F+%26+%E5%8F%91%E5%B8%83");
    expect(init.credentials).toBe("include");
  });

  it("uses CSRF for create and confirmed permanent deletion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { csrfToken: "csrf-create" } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: "account-created" } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { csrfToken: "csrf-delete" } }))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accountId: "account-created", deleted: true } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createAccount({
      name: "测试公众号",
      contentTypes: ["general"],
      accountType: "unknown",
      verificationStatus: "unknown",
      isDefault: false,
    });
    await permanentlyDeleteAccount("account-created");

    const [, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const [, deleteInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(createInit).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-Token": "csrf-create" }),
    });
    expect(deleteInit).toMatchObject({
      method: "DELETE",
      headers: expect.objectContaining({ "X-CSRF-Token": "csrf-delete" }),
    });
    expect(deleteInit.body).toBe('{"confirmationText":"DELETE"}');
  });

  it("reads deletion impact and surfaces stable failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            articleCount: 2,
            activeArticleCount: 1,
            canPermanentlyDelete: false,
            blockingReasons: ["仍有 2 篇文章关联该公众号"],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: { code: "ACCOUNT_DELETE_BLOCKED", message: "公众号仍有关联文章" },
          },
          409,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAccountDeleteImpact("account-1")).resolves.toMatchObject({
      articleCount: 2,
      canPermanentlyDelete: false,
    });
    await expect(listAccounts({})).rejects.toEqual(
      expect.objectContaining<AccountClientError>({
        name: "AccountClientError",
        status: 409,
        code: "ACCOUNT_DELETE_BLOCKED",
        message: "公众号仍有关联文章",
      }),
    );
  });
});
