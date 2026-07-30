// @vitest-environment jsdom

import type { DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArticleEditor } from "./article-editor";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top: 0,
    width: 0,
    x: 0,
    y: 0,
  });
});

describe("ArticleEditor", () => {
  it("renders the three-column editor and emits valid documents for block insertion", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ArticleEditor
        document={structuredClone(documentV1Fixture)}
        editable
        lockActionsEnabled
        onChange={onChange}
        onError={vi.fn()}
        onLockChange={vi.fn().mockResolvedValue(true)}
        sourceBlocks={[]}
        textLocked={false}
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
        lockActionsEnabled
        onChange={onChange}
        onError={vi.fn()}
        onLockChange={vi.fn().mockResolvedValue(true)}
        sourceBlocks={[]}
        textLocked={false}
      />,
    );

    const canvas = await screen.findByRole("textbox", { name: "文章编辑画布" });
    fireEvent.keyDown(canvas, { key: "d", metaKey: true, shiftKey: true });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const savedDocument = onChange.mock.lastCall?.[0] as DocumentV1;

    firstRender.unmount();
    render(
      <ArticleEditor
        document={savedDocument}
        editable
        lockActionsEnabled
        onChange={vi.fn()}
        onError={vi.fn()}
        onLockChange={vi.fn().mockResolvedValue(true)}
        sourceBlocks={[]}
        textLocked={false}
      />,
    );

    await screen.findByRole("textbox", { name: "文章编辑画布" });
    expect(screen.getAllByText(/Document Schema V1/).length).toBeGreaterThanOrEqual(2);
  });

  it("blocks text input in a locked Source Block while keeping visual formatting available", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ArticleEditor
        document={structuredClone(documentV1Fixture)}
        editable
        lockActionsEnabled
        onChange={onChange}
        onError={vi.fn()}
        onLockChange={vi.fn().mockResolvedValue(true)}
        sourceBlocks={[]}
        textLocked
      />,
    );

    await screen.findByRole("textbox", { name: "文章编辑画布" });
    await user.click(screen.getByRole("button", { name: "复制" }));
    expect(await screen.findByText("原文已锁定。请先解锁当前区块，再修改文字。")).not.toBeNull();
    if (onChange.mock.lastCall !== undefined) {
      const blockedDocument = onChange.mock.lastCall[0] as DocumentV1;
      expect(blockedDocument.content.content[0]).toMatchObject({
        content: [{ text: "Document Schema V1", type: "text" }],
      });
    }

    await user.click(screen.getAllByRole("button", { name: "二级标题" })[1]!);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "宽松段间距" }));
    const styled = onChange.mock.lastCall?.[0] as DocumentV1;
    expect(styled.content.content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2, styleOverrides: { marginBottom: 32 } },
    });
    expect(screen.getByText("文字一致")).not.toBeNull();
  });

  it("saves an explicit block unlock before allowing its text to change", async () => {
    const onChange = vi.fn();
    const onLockChange = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <ArticleEditor
        document={structuredClone(documentV1Fixture)}
        editable
        lockActionsEnabled
        onChange={onChange}
        onError={vi.fn()}
        onLockChange={onLockChange}
        sourceBlocks={[]}
        textLocked
      />,
    );

    await screen.findByRole("textbox", { name: "文章编辑画布" });
    await user.click(screen.getByRole("button", { name: "解锁当前区块" }));
    expect(screen.getByText(/当前版本会先保存/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "确认解锁" }));

    await waitFor(() => expect(onLockChange).toHaveBeenCalledOnce());
    const unlocked = onLockChange.mock.lastCall?.[0] as DocumentV1;
    expect(unlocked.content.content[0]?.attrs.locked).toBe(false);
    expect(screen.getByText("区块文字可编辑")).not.toBeNull();
  });
});
