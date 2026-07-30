// @vitest-environment jsdom

import type { DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArticleEditor } from "./article-editor";

afterEach(() => {
  cleanup();
});

describe("ArticleEditor", () => {
  it("renders the three-column editor and emits valid documents for block insertion", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ArticleEditor
        document={structuredClone(documentV1Fixture)}
        editable
        onChange={onChange}
        onError={vi.fn()}
      />,
    );

    expect(await screen.findByRole("textbox", { name: "文章编辑画布" })).not.toBeNull();
    expect(screen.getByText("文章结构")).not.toBeNull();
    expect(screen.getByText("区块属性")).not.toBeNull();

    const insertPanel = screen.getByText("插入区块").parentElement!;
    await user.click(within(insertPanel).getByRole("button", { name: "二级标题" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emittedDocument = onChange.mock.lastCall?.[0] as DocumentV1;
    const emittedBlocks = emittedDocument.content.content;
    expect(emittedBlocks).toHaveLength(documentV1Fixture.content.content.length + 1);
    expect(
      emittedBlocks.some(
        (block) =>
          block.type === "heading" && block.attrs.level === 2 && block.attrs.locked === false,
      ),
    ).toBe(true);
  });

  it("supports the duplicate-block shortcut and restores the emitted JSON after remount", async () => {
    const onChange = vi.fn();
    const firstRender = render(
      <ArticleEditor
        document={structuredClone(documentV1Fixture)}
        editable
        onChange={onChange}
        onError={vi.fn()}
      />,
    );

    const canvas = await screen.findByRole("textbox", { name: "文章编辑画布" });
    fireEvent.keyDown(canvas, { key: "d", metaKey: true, shiftKey: true });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const savedDocument = onChange.mock.lastCall?.[0] as DocumentV1;

    firstRender.unmount();
    render(
      <ArticleEditor document={savedDocument} editable onChange={vi.fn()} onError={vi.fn()} />,
    );

    await screen.findByRole("textbox", { name: "文章编辑画布" });
    expect(screen.getAllByText(/Document Schema V1/).length).toBeGreaterThanOrEqual(2);
  });
});
