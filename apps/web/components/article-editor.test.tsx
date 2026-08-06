// @vitest-environment jsdom

import type { DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import {
  OFFICIAL_COMPONENT_ASSETS,
  OFFICIAL_STATIC_VISUAL_ASSETS,
} from "@wechat-layout/component-registry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render as testingRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OfficialTheme } from "../lib/themes/client";
import { ArticleEditor } from "./article-editor";

function render(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return testingRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const modernCivicTheme = {
  manifest: {
    themeId: "0198f8e1-7a01-7000-8000-000000000102",
    familyId: "family_government_modern",
    version: "1.0.0",
    name: "现代政务红",
    description: "正式政务主题",
    categories: ["government"],
    recommendedContentTypes: ["meeting"],
    defaultPaletteId: "0198f8e1-7a01-7000-8000-000000000202",
    supportedPalettes: ["0198f8e1-7a01-7000-8000-000000000202"],
    compatibilityLevel: "safe",
    isDefault: false,
    status: "published",
  },
  preview: {
    accentColors: ["#9F1D24", "#FFF8F2", "#2F2525"],
    heading1: "标题",
    heading2: "二级标题",
    heading3: "三级标题",
    body: "正文",
    quote: "引用",
    dataLabel: "数据",
    dataValue: "96%",
    footer: "文末",
    mobileViewportWidth: 375,
    wechatContentWidth: 677,
  },
  componentRefs: ["paragraph.default"],
  installed: true,
} as const satisfies OfficialTheme;

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

  it("inserts a versioned official component without changing existing blocks", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const asset = OFFICIAL_COMPONENT_ASSETS.find(
      (candidate) => candidate.manifest.componentId === "cmp_notice_info_blue_001",
    );
    expect(asset).toBeDefined();

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

    await screen.findByRole("textbox", { name: "文章编辑画布" });
    await user.click(screen.getByRole("tab", { name: "组件" }));
    await user.click(screen.getByRole("button", { name: new RegExp(asset!.preview.name, "u") }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const titleInput = await screen.findByRole("textbox", { name: "卡片标题" });
    expect((titleInput as HTMLInputElement).value).toBe("阅读前请了解");
    await user.clear(titleInput);
    await user.type(titleInput, "用户填写的正式标题");
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as DocumentV1;
      expect(
        latest.content.content.find(
          (block) => block.attrs.componentId === asset!.manifest.componentId,
        ),
      ).toMatchObject({ attrs: { title: "用户填写的正式标题" } });
    });

    const emitted = onChange.mock.lastCall?.[0] as DocumentV1;
    const inserted = emitted.content.content.find(
      (block) => block.attrs.componentId === asset!.manifest.componentId,
    );
    expect(inserted).toMatchObject({
      type: "semanticCard",
      attrs: {
        componentId: asset!.manifest.componentId,
        componentVersion: asset!.manifest.version,
        title: "用户填写的正式标题",
      },
      content: [expect.objectContaining({ attrs: expect.objectContaining({ locked: false }) })],
    });
    documentV1Fixture.content.content.forEach((original) => {
      expect(
        emitted.content.content.find((block) => block.attrs.blockId === original.attrs.blockId),
      ).toEqual(original);
    });
  });

  it("organizes components by Xiumi-style type, subtype, and scene filters", async () => {
    const user = userEvent.setup();

    render(
      <ArticleEditor
        document={structuredClone(documentV1Fixture)}
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
    await user.click(screen.getByRole("tab", { name: "组件" }));

    const typeNavigation = screen.getByRole("navigation", { name: "组件类型" });
    expect(within(typeNavigation).getByRole("button", { name: /标题\s*12/u })).not.toBeNull();
    expect(within(typeNavigation).getByRole("button", { name: /卡片\s*17/u })).not.toBeNull();
    expect(within(typeNavigation).getByRole("button", { name: /图片\s*7/u })).not.toBeNull();
    expect(within(typeNavigation).getByRole("button", { name: /布局\s*7/u })).not.toBeNull();
    expect(within(typeNavigation).getByRole("button", { name: /SVG\s*3/u })).not.toBeNull();

    await user.click(within(typeNavigation).getByRole("button", { name: /卡片\s*17/u }));
    expect(screen.getByLabelText("卡片子分类")).not.toBeNull();
    expect(screen.getByRole("button", { name: "提示卡" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "按使用场景筛选组件" })).not.toBeNull();
  });

  it("shows static and dynamic materials with visible type and style filters", async () => {
    const user = userEvent.setup();

    render(
      <ArticleEditor
        document={structuredClone(documentV1Fixture)}
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
    await user.click(screen.getByRole("tab", { name: "素材" }));

    expect(screen.getByRole("button", { name: "静态素材 · 130" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "动态素材 · 50" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "主视觉" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "边框" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "图集" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "按视觉风格筛选素材" })).not.toBeNull();
  });

  it("offers text formatting and inserts editable frames plus draggable stickers", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const frame = OFFICIAL_STATIC_VISUAL_ASSETS.find((asset) => asset.function === "frame")!;
    const sticker = OFFICIAL_STATIC_VISUAL_ASSETS.find(
      (asset) => asset.resourceId === "builtin_visual_static_101",
    )!;

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

    await screen.findByRole("textbox", { name: "文章编辑画布" });
    expect(screen.getByRole("combobox", { name: "字体" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "字号" })).not.toBeNull();
    expect(screen.getByLabelText("选择文字颜色")).not.toBeNull();

    await user.click(screen.getByRole("tab", { name: "素材" }));
    await user.click(screen.getByRole("button", { name: "边框" }));
    await user.click(screen.getByRole("button", { name: new RegExp(frame.name, "u") }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as DocumentV1;
      expect(
        latest.content.content.some(
          (block) =>
            block.type === "decorativeContainer" && block.attrs.resourceId === frame.resourceId,
        ),
      ).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "贴纸" }));
    expect(screen.getByText("40 个结果")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: new RegExp(sticker.name, "u") }));
    await waitFor(() => {
      const latest = onChange.mock.lastCall?.[0] as DocumentV1;
      expect(
        latest.content.content.some(
          (block) =>
            block.type === "imageBlock" &&
            block.attrs.resourceId === sticker.resourceId &&
            block.attrs.freePosition === true,
        ),
      ).toBe(true);
    });
    expect(screen.getByRole("button", { name: "可拖动" })).not.toBeNull();
    expect(screen.getByText("可直接在画布中拖动；也可用下面的数值精确调整。")).not.toBeNull();
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

  it("separates temporary theme try-on from formal application", async () => {
    const onApplyTheme = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ArticleEditor
        currentThemeId={null}
        document={structuredClone(documentV1Fixture)}
        editable
        lockActionsEnabled
        onApplyTheme={onApplyTheme}
        onChange={vi.fn()}
        onError={vi.fn()}
        onLockChange={vi.fn().mockResolvedValue(true)}
        sourceBlocks={[]}
        textLocked={false}
        themes={[modernCivicTheme]}
      />,
    );

    await screen.findByRole("textbox", { name: "文章编辑画布" });
    await user.click(screen.getByRole("tab", { name: "主题" }));
    const canvas = document.querySelector<HTMLElement>("[data-preview-theme]");
    expect(canvas?.dataset.previewTheme).toBe("default");

    await user.click(screen.getByRole("button", { name: "试穿" }));
    expect(canvas?.dataset.previewTheme).toBe("modern-civic");
    expect(onApplyTheme).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "正式应用" }));
    await waitFor(() => expect(onApplyTheme).toHaveBeenCalledWith(modernCivicTheme));
    await waitFor(() => expect(canvas?.dataset.previewTheme).toBe("default"));
  });
});
