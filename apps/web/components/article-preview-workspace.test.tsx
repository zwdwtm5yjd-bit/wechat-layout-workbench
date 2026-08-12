// @vitest-environment jsdom

import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import type { DocumentV1, SemanticCardNode } from "@wechat-layout/document-schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getArticle } from "../lib/articles/client";
import { getArticleDocument, type ArticleDocument } from "../lib/documents/client";
import { createResourceAccessUrl } from "../lib/resources/client";
import { ArticlePreviewWorkspace } from "./article-preview-workspace";

vi.mock("next/link", () => ({
  default: ({ children, href }: { readonly children: ReactNode; readonly href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../lib/articles/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/articles/client")>("../lib/articles/client");
  return { ...actual, getArticle: vi.fn() };
});

vi.mock("../lib/documents/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/documents/client")>("../lib/documents/client");
  return { ...actual, getArticleDocument: vi.fn() };
});

vi.mock("../lib/resources/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/resources/client")>("../lib/resources/client");
  return { ...actual, createResourceAccessUrl: vi.fn() };
});

const nestedResourceId = "resource_nested_private_image";
const builtInResourceId = "builtin_visual_static_005";

function documentWithNestedPrivateImage(): DocumentV1 {
  const document = structuredClone(documentV1Fixture) as DocumentV1;
  const card = document.content.content.find(
    (node): node is SemanticCardNode => node.type === "semanticCard",
  );
  if (card === undefined) throw new Error("fixture semantic card is required");
  card.content = [
    ...(card.content ?? []),
    {
      type: "imageBlock",
      attrs: {
        alt: "嵌套私有图片",
        blockId: "block_nested_private_image",
        locked: false,
        resourceId: nestedResourceId,
      },
    },
  ];
  document.content.content.push({
    type: "imageBlock",
    attrs: {
      alt: "内置图片",
      blockId: "block_builtin_image",
      locked: false,
      resourceId: builtInResourceId,
    },
  });
  return document;
}

function articleDocument(document: DocumentV1): ArticleDocument {
  return {
    articleId: document.articleId,
    currentTextHash: null,
    document: document as unknown as ArticleDocument["document"],
    documentId: document.documentId,
    documentVersion: 3,
    lastSavedAt: "2026-08-12T10:00:00.000Z",
    lastSavedBy: "user_fixture",
    lastTransactionId: "transaction_preview_fixture",
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
  vi.mocked(getArticle).mockResolvedValue({
    compatibilityScore: null,
    title: "私有图片预览文章",
  } as never);
  vi.mocked(getArticleDocument).mockResolvedValue(
    articleDocument(documentWithNestedPrivateImage()),
  );
});

afterEach(() => {
  cleanup();
  vi.mocked(getArticle).mockReset();
  vi.mocked(getArticleDocument).mockReset();
  vi.mocked(createResourceAccessUrl).mockReset();
});

describe("ArticlePreviewWorkspace private image resolution", () => {
  it("recursively signs private image blocks without signing built-in images", async () => {
    vi.mocked(createResourceAccessUrl).mockImplementation(
      async (resourceId) =>
        ({
          url: `https://cdn.example.com/${resourceId}.png`,
        }) as never,
    );

    render(<ArticlePreviewWorkspace articleId={documentV1Fixture.articleId} />, {
      wrapper: Providers,
    });

    const topLevelImage = await screen.findByRole("img", { name: "测试图片" });
    const nestedImage = await screen.findByRole("img", { name: "嵌套私有图片" });
    expect(topLevelImage.getAttribute("src")).toBe("https://cdn.example.com/resource_image.png");
    expect(nestedImage.getAttribute("src")).toBe(`https://cdn.example.com/${nestedResourceId}.png`);

    await waitFor(() => expect(createResourceAccessUrl).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createResourceAccessUrl).mock.calls.map(([resourceId]) => resourceId)).toEqual(
      ["resource_image", nestedResourceId],
    );
    expect(screen.getByRole("img", { name: "内置图片" }).getAttribute("src")).toContain(
      "/visual-assets/",
    );
  });

  it("keeps the page usable when signing or loading one private image fails", async () => {
    vi.mocked(createResourceAccessUrl).mockImplementation(async (resourceId) => {
      if (resourceId === "resource_image") throw new Error("signing failed");
      return { url: `https://cdn.example.com/${resourceId}.png` } as never;
    });

    render(<ArticlePreviewWorkspace articleId={documentV1Fixture.articleId} />, {
      wrapper: Providers,
    });

    const nestedImage = await screen.findByRole("img", { name: "嵌套私有图片" });
    expect(screen.getByText("图片资源 · resource_image")).toBeTruthy();
    expect(screen.getAllByText("私有图片预览文章")).toHaveLength(2);
    expect(screen.queryByText("无法打开预览")).toBeNull();

    fireEvent.error(nestedImage);
    expect(screen.getByText(`图片资源 · ${nestedResourceId}`)).toBeTruthy();
    expect(screen.getByRole("img", { name: "内置图片" })).toBeTruthy();
  });
});
