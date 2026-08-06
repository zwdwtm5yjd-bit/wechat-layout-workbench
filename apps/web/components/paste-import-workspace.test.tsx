// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPasteImport, type ImportStructure } from "../lib/imports/client";
import { uploadResource } from "../lib/resources/client";
import { PasteImportWorkspace } from "./paste-import-workspace";
import { AppToastProvider } from "./ui/app-toast";

const push = vi.fn();
const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462611";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../lib/imports/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/imports/client")>("../lib/imports/client");
  return {
    ...actual,
    createPasteImport: vi.fn(),
  };
});

vi.mock("../lib/resources/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/resources/client")>("../lib/resources/client");
  return {
    ...actual,
    uploadResource: vi.fn(),
  };
});

function structure(): ImportStructure {
  return {
    articleId,
    sourceDocumentId: "019c0fb5-7d53-7f66-bfb7-f70c0e462612",
    title: "剪贴板标题",
    accountId: null,
    status: "pending_recognition",
    documentId: "019c0fb5-7d53-7f66-bfb7-f70c0e462613",
    documentVersion: 1,
    lastTransactionId: null,
    lastSavedAt: "2026-07-30T10:00:00.000Z",
    detectedSource: "word",
    cleaningMode: "preserve_structure",
    originalText: "剪贴板标题\n正文",
    blocks: [
      {
        sourceBlockId: "source_0001_abcdef",
        role: "title",
        text: "剪贴板标题",
        orderIndex: 0,
        originalTag: "h1",
        relation: {},
      },
    ],
    warnings: [],
    statistics: {
      wordCount: 2,
      characterCount: 8,
      blockCount: 1,
      headingCount: 1,
      imageCount: 0,
      tableCount: 0,
      removedStyleCount: 2,
      removedSecurityNodeCount: 0,
      removedHiddenNodeCount: 0,
      removedUnsafeLinkCount: 0,
    },
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
  push.mockReset();
  vi.mocked(createPasteImport).mockReset();
  vi.mocked(uploadResource).mockReset();
});

describe("PasteImportWorkspace", () => {
  it("captures structured clipboard data and opens the structure review", async () => {
    vi.mocked(createPasteImport).mockResolvedValue(structure());
    render(<PasteImportWorkspace />, { wrapper: Providers });

    const textarea = screen.getByRole("textbox", { name: "粘贴文章内容" });
    const html = '<h1 class="MsoTitle">剪贴板标题</h1><p>正文</p>';
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? html : "剪贴板标题\n正文"),
      },
    });

    expect((textarea as HTMLTextAreaElement).value).toBe("剪贴板标题\n正文");
    await userEvent.click(screen.getByRole("radio", { name: /兼容优先/ }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "内容来源" }), "word");
    await userEvent.click(screen.getByRole("button", { name: /识别文章结构/ }));

    await waitFor(() => {
      expect(createPasteImport).toHaveBeenCalled();
    });
    expect(vi.mocked(createPasteImport).mock.calls[0]?.[0]).toEqual({
      html,
      plainText: "剪贴板标题\n正文",
      cleaningMode: "preserve_compatible",
      detectedSourceHint: "word",
      contentType: "general",
      layoutStrength: "standard",
    });
    expect(push).toHaveBeenCalledWith(`/workspace/imports/${articleId}/structure`);
  });

  it("drops stale clipboard HTML after the user edits the text", async () => {
    vi.mocked(createPasteImport).mockResolvedValue(structure());
    render(<PasteImportWorkspace />, { wrapper: Providers });

    const textarea = screen.getByRole("textbox", { name: "粘贴文章内容" });
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? "<h1>旧标题</h1>" : "旧标题"),
      },
    });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "手工修改后的正文");
    await userEvent.click(screen.getByRole("button", { name: /识别文章结构/ }));

    await waitFor(() => {
      expect(createPasteImport).toHaveBeenCalled();
    });
    const submitted = vi.mocked(createPasteImport).mock.calls[0]?.[0];
    expect(submitted).toEqual(expect.objectContaining({ plainText: "手工修改后的正文" }));
    expect(submitted).not.toHaveProperty("html");
  });

  it("uploads selected images and sends their placement into structure recognition", async () => {
    const resourceId = "019c0fb5-7d53-7f66-bfb7-f70c0e462699";
    vi.mocked(uploadResource).mockResolvedValue({ id: resourceId } as never);
    vi.mocked(createPasteImport).mockResolvedValue({
      ...structure(),
      statistics: { ...structure().statistics, imageCount: 1 },
    });
    render(<PasteImportWorkspace />, { wrapper: Providers });
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: "粘贴文章内容" }), "活动回顾\n正文内容");
    const image = new File(["image-bytes"], "现场照片.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/添加图片/), image);
    await user.selectOptions(screen.getByRole("combobox", { name: "图片 1 插入位置" }), "1");
    await user.type(screen.getByRole("textbox", { name: "图片 1 说明" }), "活动现场合影");
    await user.click(screen.getByRole("button", { name: /识别文章结构/ }));

    await waitFor(() => expect(uploadResource).toHaveBeenCalledWith(image));
    await waitFor(() => expect(createPasteImport).toHaveBeenCalled());
    expect(vi.mocked(createPasteImport).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        plainText: "活动回顾\n正文内容",
        images: [
          {
            resourceId,
            placementIndex: 1,
            alt: "现场照片.jpg",
            caption: "活动现场合影",
          },
        ],
      }),
    );
  });
});
