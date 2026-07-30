// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmImportStructure,
  getImportStructure,
  type ConfirmImportResult,
  type ImportStructure,
} from "../lib/imports/client";
import { ImportStructureWorkspace } from "./import-structure-workspace";
import { AppToastProvider } from "./ui/app-toast";

const push = vi.fn();
const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462611";
const transactionId = "019c0fb5-7d53-7f66-bfb7-f70c0e462699";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../lib/imports/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/imports/client")>("../lib/imports/client");
  return {
    ...actual,
    confirmImportStructure: vi.fn(),
    getImportStructure: vi.fn(),
  };
});

function structure(overrides: Partial<ImportStructure> = {}): ImportStructure {
  return {
    articleId,
    sourceDocumentId: "019c0fb5-7d53-7f66-bfb7-f70c0e462612",
    title: "识别标题",
    accountId: null,
    status: "pending_recognition",
    documentId: "019c0fb5-7d53-7f66-bfb7-f70c0e462613",
    documentVersion: 1,
    lastTransactionId: null,
    lastSavedAt: "2026-07-30T10:00:00.000Z",
    detectedSource: "web",
    cleaningMode: "preserve_structure",
    originalText: "识别标题\n第一段\n第二段",
    blocks: [
      {
        sourceBlockId: "source_0001_abcdef",
        role: "title",
        text: "识别标题",
        orderIndex: 0,
        originalTag: "h1",
        relation: {},
      },
      {
        sourceBlockId: "source_0002_bcdefa",
        role: "paragraph",
        text: "第一段",
        orderIndex: 1,
        originalTag: "p",
        relation: {},
      },
      {
        sourceBlockId: "source_0003_cdefab",
        role: "paragraph",
        text: "第二段",
        orderIndex: 2,
        originalTag: "p",
        relation: {},
      },
    ],
    warnings: [
      {
        code: "STYLE_CLEANED",
        severity: "info",
        message: "已清理不兼容样式",
        count: 2,
      },
    ],
    statistics: {
      wordCount: 3,
      characterCount: 11,
      blockCount: 3,
      headingCount: 1,
      imageCount: 0,
      tableCount: 0,
      removedStyleCount: 2,
      removedSecurityNodeCount: 0,
      removedHiddenNodeCount: 0,
      removedUnsafeLinkCount: 0,
    },
    ...overrides,
  };
}

function confirmed(): ConfirmImportResult {
  return {
    ...structure({ status: "pending_layout", documentVersion: 2 }),
    snapshotId: "019c0fb5-7d53-7f66-bfb7-f70c0e462614",
    snapshotNumber: 1,
    editorUrl: `/workspace/articles/${articleId}`,
  };
}

function Providers({ children }: { readonly children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AppToastProvider>{children}</AppToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(transactionId);
});

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.restoreAllMocks();
  vi.mocked(confirmImportStructure).mockReset();
  vi.mocked(getImportStructure).mockReset();
});

describe("ImportStructureWorkspace", () => {
  it("submits the full role set, base version, title, and transaction ID", async () => {
    vi.mocked(getImportStructure).mockResolvedValue(structure());
    vi.mocked(confirmImportStructure).mockResolvedValue(confirmed());
    render(<ImportStructureWorkspace articleId={articleId} />, { wrapper: Providers });

    expect(await screen.findByText("第一段")).toBeTruthy();
    expect(screen.getByText("已清理不兼容样式 × 2")).toBeTruthy();

    const titleInput = screen.getByRole("textbox", { name: "文章标题" });
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "确认后的标题");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "内容块 2 的角色" }),
      "quote",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "选择内容块 3" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "批量角色" }), "excluded");
    await userEvent.click(screen.getByRole("button", { name: "应用到 1 项" }));
    await userEvent.click(screen.getByRole("button", { name: "确认并进入排版" }));

    await waitFor(() => {
      expect(confirmImportStructure).toHaveBeenCalledWith({
        articleId,
        title: "确认后的标题",
        baseVersion: 1,
        lastTransactionId: transactionId,
        blocks: [
          { sourceBlockId: "source_0001_abcdef", role: "title" },
          { sourceBlockId: "source_0002_bcdefa", role: "quote" },
          { sourceBlockId: "source_0003_cdefab", role: "excluded" },
        ],
      });
    });
    expect(push).toHaveBeenCalledWith(`/workspace/articles/${articleId}`);
  });

  it("renders an already confirmed import as read-only and keeps the editor entry", async () => {
    vi.mocked(getImportStructure).mockResolvedValue(structure({ status: "pending_layout" }));
    render(<ImportStructureWorkspace articleId={articleId} />, { wrapper: Providers });

    expect(await screen.findByRole("link", { name: /已确认，进入编辑器/ })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "内容块 1 的角色" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.queryByRole("button", { name: "确认并进入排版" })).toBeNull();
  });
});
