// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createManualSnapshot,
  listSnapshots,
  previewSnapshot,
  restoreSnapshot,
  type SnapshotDetail,
  type SnapshotSummary,
} from "../lib/snapshots/client";
import { SnapshotPanel } from "./snapshot-panel";
import { AppToastProvider } from "./ui/app-toast";

vi.mock("../lib/snapshots/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/snapshots/client")>("../lib/snapshots/client");
  return {
    ...actual,
    createManualSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    previewSnapshot: vi.fn(),
    restoreSnapshot: vi.fn(),
  };
});

const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462611";
const snapshotId = "019c0fb5-7d53-7f66-bfb7-f70c0e462612";

function summary(overrides: Partial<SnapshotSummary> = {}): SnapshotSummary {
  return {
    id: snapshotId,
    articleId,
    snapshotNumber: 3,
    reason: "after_import",
    documentSchemaVersion: "1.0.0",
    themeId: null,
    themeVersion: null,
    brandVersionId: null,
    compatibilityScore: null,
    note: "导入完成",
    resourceCount: 0,
    packageCount: 0,
    createdBy: "019c0fb5-7d53-7f66-bfb7-f70c0e462613",
    createdAt: "2026-07-30T10:00:00.000Z",
    isCurrent: true,
    ...overrides,
  };
}

function detail(overrides: Partial<SnapshotDetail> = {}): SnapshotDetail {
  return {
    ...summary(),
    document: {
      schemaVersion: "1.0.0",
      articleId,
      content: { type: "doc", content: [] },
    },
    resourceManifest: [],
    packageManifest: [],
    textHash: null,
    compatibilityRuleVersion: null,
    rendererVersion: null,
    htmlHash: null,
    ...overrides,
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

afterEach(() => {
  cleanup();
  vi.mocked(createManualSnapshot).mockReset();
  vi.mocked(listSnapshots).mockReset();
  vi.mocked(previewSnapshot).mockReset();
  vi.mocked(restoreSnapshot).mockReset();
});

describe("SnapshotPanel", () => {
  it("disables snapshot mutations until the document is saved", async () => {
    vi.mocked(listSnapshots).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    });

    render(
      <SnapshotPanel
        articleId={articleId}
        documentVersion={2}
        onRestored={vi.fn()}
        saveStatus="local_saved"
      />,
      { wrapper: Providers },
    );

    expect(await screen.findByText("尚无历史版本")).toBeTruthy();
    expect(screen.getByRole("button", { name: "创建快照" }).hasAttribute("disabled")).toBe(true);
  });

  it("loads a read-only preview and marks the current version as non-restorable", async () => {
    const current = summary();
    vi.mocked(listSnapshots).mockResolvedValue({
      items: [current],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
    vi.mocked(previewSnapshot).mockResolvedValue(detail());

    render(
      <SnapshotPanel
        articleId={articleId}
        documentVersion={2}
        onRestored={vi.fn()}
        saveStatus="saved"
      />,
      { wrapper: Providers },
    );

    await userEvent.click(await screen.findByRole("button", { name: /#3 · 导入后/ }));

    expect(await screen.findByText("查看完整只读 JSON")).toBeTruthy();
    expect(screen.getByRole("button", { name: "当前版本" }).hasAttribute("disabled")).toBe(true);
    expect(previewSnapshot).toHaveBeenCalledWith(articleId, snapshotId);
  });
});
