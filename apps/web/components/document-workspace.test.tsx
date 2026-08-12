// @vitest-environment jsdom

import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleDocument } from "../lib/documents/client";
import type { LocalDocumentDraft } from "../lib/documents/draft-store";
import { getArticleDocument, saveArticleDocument } from "../lib/documents/client";
import { DocumentWorkspace } from "./document-workspace";

const draftStore = vi.hoisted(() => ({
  draft: null as unknown,
  delete: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { readonly children: ReactNode; readonly href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../lib/documents/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/documents/client")>("../lib/documents/client");
  return {
    ...actual,
    getArticleDocument: vi.fn(),
    saveArticleDocument: vi.fn(),
  };
});

vi.mock("../lib/documents/draft-store", async () => {
  const actual = await vi.importActual<typeof import("../lib/documents/draft-store")>(
    "../lib/documents/draft-store",
  );
  return {
    ...actual,
    IndexedDbDocumentDraftStore: class {
      get = draftStore.get;
      put = draftStore.put;
      delete = draftStore.delete;
    },
  };
});

vi.mock("../lib/themes/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/themes/client")>("../lib/themes/client");
  return {
    ...actual,
    listThemes: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 }),
  };
});

vi.mock("./article-editor", () => ({
  ArticleEditor: ({
    document,
    onChange,
  }: {
    readonly document: DocumentV1;
    readonly onChange: (document: DocumentV1, transactionOrigin: string) => void;
  }) => {
    const [containsLateEdit, setContainsLateEdit] = useState(() =>
      document.content.content.some((node) => node.attrs.blockId === "block_late_edit"),
    );
    useEffect(() => {
      setContainsLateEdit(
        document.content.content.some((node) => node.attrs.blockId === "block_late_edit"),
      );
    }, [document]);
    return (
      <div>
        <p aria-label="当前编辑器内容">
          {containsLateEdit ? "当前编辑器保留晚到编辑" : "当前编辑器尚无晚到编辑"}
        </p>
        <button
          aria-label="模拟保存响应前的晚到编辑"
          onClick={() => {
            const changed = structuredClone(document);
            changed.content.content.push({
              type: "paragraph",
              attrs: { blockId: "block_late_edit", locked: false },
              content: [{ type: "text", text: "保存期间的新修改" }],
            });
            setContainsLateEdit(true);
            onChange(changed, "editor.input");
          }}
          type="button"
        >
          模拟晚到编辑
        </button>
      </div>
    );
  },
}));

vi.mock("./creation-progress", () => ({ CreationProgress: () => null }));
vi.mock("./document-save-status", () => ({ DocumentSaveStatus: () => null }));
vi.mock("./editor-delivery-actions", () => ({ EditorDeliveryActions: () => null }));
vi.mock("./snapshot-panel", () => ({ SnapshotPanel: () => null }));

function articleDocument(document: DocumentV1, version = 1): ArticleDocument {
  return {
    articleId: document.articleId,
    currentTextHash: null,
    document: document as unknown as ArticleDocument["document"],
    documentId: document.documentId,
    documentVersion: version,
    lastSavedAt: `2026-08-12T10:00:0${String(version)}.000Z`,
    lastSavedBy: "user_fixture",
    lastTransactionId: version === 1 ? null : "transaction-saved-layout",
    originalTextHash: null,
    schemaVersion: "1.0.0",
    sourceBlocks: [],
    textLocked: true,
  };
}

function Providers({ children }: { readonly children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  const recoveredDocument = structuredClone(documentV1Fixture);
  const recovered: LocalDocumentDraft = {
    articleId: recoveredDocument.articleId,
    baseVersion: 1,
    document: recoveredDocument as unknown as LocalDocumentDraft["document"],
    lastTransactionId: "transaction-manual-draft",
    saveMode: "manual",
    savedAt: "2026-08-12T10:00:00.000Z",
    schemaVersion: "1.0.0",
    transactionOrigin: "layout.ai.draft",
  };
  draftStore.draft = recovered;
  draftStore.get.mockImplementation(() => Promise.resolve(structuredClone(draftStore.draft)));
  draftStore.put.mockImplementation((draft: LocalDocumentDraft) => {
    draftStore.draft = structuredClone(draft);
    return Promise.resolve();
  });
  draftStore.delete.mockImplementation(() => {
    draftStore.draft = null;
    return Promise.resolve();
  });
});

afterEach(() => {
  cleanup();
  vi.mocked(getArticleDocument).mockReset();
  vi.mocked(saveArticleDocument).mockReset();
  draftStore.get.mockReset();
  draftStore.put.mockReset();
  draftStore.delete.mockReset();
});

describe("DocumentWorkspace layout draft save", () => {
  it("keeps edits emitted after the saved snapshot while the persisted document is loading", async () => {
    const initial = articleDocument(structuredClone(documentV1Fixture));
    const persisted = articleDocument(structuredClone(documentV1Fixture), 2);
    let resolvePersisted: ((value: ArticleDocument) => void) | undefined;
    const persistedRequest = new Promise<ArticleDocument>((resolve) => {
      resolvePersisted = resolve;
    });
    vi.mocked(getArticleDocument)
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => persistedRequest);
    vi.mocked(saveArticleDocument).mockResolvedValue({
      documentVersion: 2,
      lastSavedAt: persisted.lastSavedAt,
      lastTransactionId: "transaction-saved-layout",
      replayed: false,
    });

    render(<DocumentWorkspace articleId={initial.articleId} />, { wrapper: Providers });

    fireEvent.click(await screen.findByRole("button", { name: "手动保存成稿" }));

    await waitFor(() => expect(getArticleDocument).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "模拟保存响应前的晚到编辑" }));
    expect(await screen.findByText("当前编辑器保留晚到编辑")).not.toBeNull();
    resolvePersisted?.(persisted);

    expect(
      await screen.findByText(
        /\u521a\u624d\u7684\u7248\u672c\u5df2\u4fdd\u5b58\uff0c\u65b0\u8c03\u6574\u4ecd\u4fdd\u7559\u5728\u672c\u673a/u,
      ),
    ).not.toBeNull();
    expect(screen.getByText("当前编辑器保留晚到编辑")).not.toBeNull();
    expect(screen.getByRole("button", { name: "手动保存成稿" })).not.toBeNull();
    await waitFor(() => {
      const stored = draftStore.draft as LocalDocumentDraft | null;
      const content = stored?.document.content as
        | { readonly content?: readonly { readonly attrs?: { readonly blockId?: string } }[] }
        | undefined;
      expect(content?.content?.some((node) => node.attrs?.blockId === "block_late_edit")).toBe(
        true,
      );
    });
  });
});
