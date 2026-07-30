import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentClientError, type DocumentJson } from "./client";
import { DocumentAutosaveController, type OnlineSource } from "./autosave";
import type { DocumentDraftStore, LocalDocumentDraft } from "./draft-store";

const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462611";
const document: DocumentJson = {
  schemaVersion: "1.0.0",
  documentId: "019c0fb5-7d53-7f66-bfb7-f70c0e462612",
  articleId,
  content: { type: "doc", content: [] },
  meta: {
    sourceType: "manual",
    textLocked: true,
    createdAt: "2026-07-30T08:00:00.000Z",
    updatedAt: "2026-07-30T08:00:00.000Z",
  },
};

class MemoryDraftStore implements DocumentDraftStore {
  draft: LocalDocumentDraft | null = null;

  get(articleIdToGet: string): Promise<LocalDocumentDraft | null> {
    return Promise.resolve(this.draft?.articleId === articleIdToGet ? this.draft : null);
  }

  put(draft: LocalDocumentDraft): Promise<void> {
    this.draft = structuredClone(draft);
    return Promise.resolve();
  }

  delete(articleIdToDelete: string): Promise<void> {
    if (this.draft?.articleId === articleIdToDelete) {
      this.draft = null;
    }
    return Promise.resolve();
  }
}

class MutableOnlineSource implements OnlineSource {
  online: boolean;
  readonly listeners = new Set<() => void>();

  constructor(online: boolean) {
    this.online = online;
  }

  isOnline(): boolean {
    return this.online;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setOnline(online: boolean): void {
    this.online = online;
    if (online) {
      this.listeners.forEach((listener) => {
        listener();
      });
    }
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("document autosave", () => {
  it("stores offline edits locally and submits them after the network recovers", async () => {
    const store = new MemoryDraftStore();
    const online = new MutableOnlineSource(false);
    const save = vi.fn().mockResolvedValue({
      documentVersion: 2,
      lastTransactionId: "transaction-offline",
      lastSavedAt: "2026-07-30T08:00:02.000Z",
      replayed: false,
    });
    const controller = new DocumentAutosaveController({
      articleId,
      initialVersion: 1,
      draftStore: store,
      save,
      onlineSource: online,
      createTransactionId: () => "transaction-offline",
    });

    await controller.queue(document, "1.0.0");

    expect(controller.getSnapshot()).toMatchObject({
      status: "local_saved",
      documentVersion: 1,
    });
    expect(store.draft).toMatchObject({
      articleId,
      baseVersion: 1,
      lastTransactionId: "transaction-offline",
    });
    expect(save).not.toHaveBeenCalled();

    online.setOnline(true);
    await vi.waitFor(() => {
      expect(controller.getSnapshot().status).toBe("saved");
    });
    expect(save).toHaveBeenCalledOnce();
    expect(store.draft).toBeNull();
    expect(controller.getSnapshot().documentVersion).toBe(2);
    controller.destroy();
  });

  it("debounces saves and preserves the local draft on a 409 conflict", async () => {
    vi.useFakeTimers();
    const store = new MemoryDraftStore();
    const online = new MutableOnlineSource(true);
    const save = vi
      .fn()
      .mockRejectedValue(
        new DocumentClientError(
          409,
          "ARTICLE_VERSION_CONFLICT",
          "文章已在其他标签页更新",
          { currentVersion: 4, submittedVersion: 3 },
          false,
        ),
      );
    const controller = new DocumentAutosaveController({
      articleId,
      initialVersion: 3,
      draftStore: store,
      save,
      onlineSource: online,
      debounceMs: 200,
      createTransactionId: () => "transaction-conflict",
    });

    await controller.queue(document, "1.0.0");
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);

    expect(controller.getSnapshot()).toMatchObject({
      status: "conflict",
      documentVersion: 3,
      conflict: {
        submittedVersion: 3,
        currentVersion: 4,
      },
    });
    expect(store.draft?.lastTransactionId).toBe("transaction-conflict");
    controller.destroy();
  });

  it("retries a network failure without generating a new transaction", async () => {
    vi.useFakeTimers();
    const store = new MemoryDraftStore();
    const online = new MutableOnlineSource(true);
    const save = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        documentVersion: 2,
        lastTransactionId: "transaction-retry",
        lastSavedAt: "2026-07-30T08:00:03.000Z",
        replayed: true,
      });
    const controller = new DocumentAutosaveController({
      articleId,
      initialVersion: 1,
      draftStore: store,
      save,
      onlineSource: online,
      debounceMs: 10,
      retryMs: 100,
      createTransactionId: () => "transaction-retry",
    });

    await controller.queue(document, "1.0.0");
    await vi.advanceTimersByTimeAsync(10);
    expect(controller.getSnapshot().status).toBe("local_saved");
    expect(store.draft).not.toBeNull();

    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[0].lastTransactionId).toBe("transaction-retry");
    expect(save.mock.calls[1]?.[0].lastTransactionId).toBe("transaction-retry");
    expect(controller.getSnapshot()).toMatchObject({
      status: "saved",
      documentVersion: 2,
    });
    expect(store.draft).toBeNull();
    controller.destroy();
  });

  it("does not auto-submit a restored draft based on an older server version", async () => {
    const store = new MemoryDraftStore();
    store.draft = {
      articleId,
      baseVersion: 1,
      schemaVersion: "1.0.0",
      document,
      lastTransactionId: "transaction-stale-local",
      transactionOrigin: "autosave",
      savedAt: "2026-07-30T08:00:00.000Z",
    };
    const save = vi.fn();
    const controller = new DocumentAutosaveController({
      articleId,
      initialVersion: 2,
      draftStore: store,
      save,
      onlineSource: new MutableOnlineSource(true),
    });

    const restored = await controller.initialize();

    expect(restored).toEqual(store.draft);
    expect(controller.getSnapshot()).toMatchObject({
      status: "conflict",
      conflict: {
        submittedVersion: 1,
        currentVersion: 2,
      },
    });
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("clears a restored draft when its transaction is already committed", async () => {
    const store = new MemoryDraftStore();
    store.draft = {
      articleId,
      baseVersion: 1,
      schemaVersion: "1.0.0",
      document,
      lastTransactionId: "transaction-already-committed",
      transactionOrigin: "autosave",
      savedAt: "2026-07-30T08:00:00.000Z",
    };
    const save = vi.fn();
    const controller = new DocumentAutosaveController({
      articleId,
      initialVersion: 2,
      initialLastTransactionId: "transaction-already-committed",
      draftStore: store,
      save,
      onlineSource: new MutableOnlineSource(true),
    });

    const restored = await controller.initialize();

    expect(restored).toBeNull();
    expect(store.draft).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({
      status: "saved",
      documentVersion: 2,
    });
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });
});
