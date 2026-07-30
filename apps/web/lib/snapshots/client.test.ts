import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createManualSnapshot,
  listSnapshots,
  previewSnapshot,
  restoreSnapshot,
  SnapshotClientError,
} from "./client";

const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462611";
const snapshotId = "019c0fb5-7d53-7f66-bfb7-f70c0e462612";
const transactionId = "019c0fb5-7d53-7f66-bfb7-f70c0e462613";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snapshot client", () => {
  it("lists snapshots with credentials and stable pagination", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          items: [],
          pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSnapshots(articleId)).resolves.toMatchObject({
      pagination: { page: 1, pageSize: 50 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/articles/${articleId}/snapshots?page=1&pageSize=50`),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("creates and previews snapshots with CSRF protection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: snapshotId } }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: snapshotId } }));
    vi.stubGlobal("fetch", fetchMock);

    await createManualSnapshot(articleId, "第一轮");
    await previewSnapshot(articleId, snapshotId);

    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "X-CSRF-Token": "csrf-token",
      }),
      body: JSON.stringify({ reason: "manual", note: "第一轮" }),
    });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
    });
  });

  it("restores with the current document version and a transaction ID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            restoredFromSnapshotId: snapshotId,
            documentVersion: 4,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await restoreSnapshot({
      articleId,
      snapshotId,
      baseVersion: 3,
      lastTransactionId: transactionId,
    });

    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        mode: "replace_current",
        baseVersion: 3,
        lastTransactionId: transactionId,
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
              details: { currentVersion: 5, submittedVersion: 4 },
              retryable: false,
            },
          },
          409,
        ),
      ),
    );

    const error = await listSnapshots(articleId).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(SnapshotClientError);
    expect(error).toMatchObject({
      status: 409,
      code: "ARTICLE_VERSION_CONFLICT",
      details: { currentVersion: 5, submittedVersion: 4 },
      retryable: false,
    });
  });
});
