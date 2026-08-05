// @vitest-environment jsdom

import {
  OFFICIAL_COMPONENT_ASSETS,
  type OfficialComponentAsset,
  type OfficialComponentPreviewLayout,
} from "@wechat-layout/component-registry";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { V0_COMPONENT_PREVIEWS } from "../lib/v0-catalog";
import { ComponentCatalog } from "./component-catalog";

afterEach(() => {
  cleanup();
});

const expectedGroupCounts = {
  高级模块: 7,
  SVG装饰: 3,
  图集模块: 2,
  一级标题: 6,
  二级标题: 6,
  引用: 6,
  提示: 6,
  数据卡: 5,
  图片样式: 5,
  分割线: 4,
  文末: 3,
} as const;

function expectedPreviewContract(asset: OfficialComponentAsset): {
  readonly categoryLabel: keyof typeof expectedGroupCounts;
  readonly layoutKey: OfficialComponentPreviewLayout;
} {
  if (asset.preview.layoutKey === "visual") {
    return {
      categoryLabel: asset.preview.categoryLabel as keyof typeof expectedGroupCounts,
      layoutKey: "visual",
    };
  }
  switch (asset.manifest.category) {
    case "HEAD":
      if (asset.manifest.insertionPreset.nodeType !== "heading") {
        throw new Error(`${asset.manifest.componentId} 的标题插入预设无效`);
      }
      return {
        categoryLabel:
          asset.manifest.insertionPreset.attributes.level === 1 ? "一级标题" : "二级标题",
        layoutKey: "heading",
      };
    case "QUOTE":
      return { categoryLabel: "引用", layoutKey: "quote" };
    case "NOTICE":
      return { categoryLabel: "提示", layoutKey: "notice" };
    case "DATA":
      return { categoryLabel: "数据卡", layoutKey: "data" };
    case "IMAGE":
      return { categoryLabel: "图片样式", layoutKey: "image" };
    case "DIVIDER":
      return { categoryLabel: "分割线", layoutKey: "divider" };
    case "FOOTER":
      return { categoryLabel: "文末", layoutKey: "footer" };
    default:
      throw new Error(`${asset.manifest.componentId} 不属于首批组件分类`);
  }
}

function expectRequiredPreviewSample(asset: OfficialComponentAsset): void {
  const { layoutKey, sample } = asset.preview;
  const message = asset.manifest.componentId;
  switch (layoutKey) {
    case "heading":
      expect(sample.title?.trim(), message).toBeTruthy();
      break;
    case "quote":
      expect(sample.body?.trim(), message).toBeTruthy();
      expect(sample.source?.trim(), message).toBeTruthy();
      break;
    case "notice":
      expect(sample.eyebrow?.trim(), message).toBeTruthy();
      expect(sample.title?.trim(), message).toBeTruthy();
      expect(sample.body?.trim(), message).toBeTruthy();
      break;
    case "data":
      expect(sample.title?.trim(), message).toBeTruthy();
      expect(sample.value?.trim(), message).toBeTruthy();
      break;
    case "image":
      expect(sample.imageAlt?.trim(), message).toBeTruthy();
      expect(sample.caption?.trim(), message).toBeTruthy();
      break;
    case "divider":
      break;
    case "footer":
      expect((sample.footer ?? sample.body)?.trim(), message).toBeTruthy();
      break;
    case "visual":
      expect(sample.assetPath?.trim(), message).toBeTruthy();
      expect(sample.assetKind, message).toMatch(/^(png|svg)$/u);
      expect(sample.title?.trim(), message).toBeTruthy();
      expect(sample.body?.trim(), message).toBeTruthy();
      break;
  }
}

describe("ComponentCatalog", () => {
  it("derives the complete 53-item catalog from the official registry assets", () => {
    expect(OFFICIAL_COMPONENT_ASSETS).toHaveLength(53);
    expect(V0_COMPONENT_PREVIEWS).toHaveLength(53);
    expect(V0_COMPONENT_PREVIEWS.map((component) => component.id)).toEqual(
      OFFICIAL_COMPONENT_ASSETS.map((asset) => asset.manifest.componentId),
    );
    expect(new Set(V0_COMPONENT_PREVIEWS.map((component) => component.id)).size).toBe(53);

    const actualGroupCounts = Object.fromEntries(
      Object.keys(expectedGroupCounts).map((group) => [
        group,
        V0_COMPONENT_PREVIEWS.filter((component) => component.category === group).length,
      ]),
    );
    expect(actualGroupCounts).toEqual(expectedGroupCounts);
    V0_COMPONENT_PREVIEWS.forEach((component, index) => {
      expect(component.asset).toBe(OFFICIAL_COMPONENT_ASSETS[index]);
      expect(component.version).toBe(component.asset.manifest.version);
      const contract = expectedPreviewContract(component.asset);
      expect(component.asset.preview.categoryLabel, component.id).toBe(contract.categoryLabel);
      expect(component.asset.preview.layoutKey, component.id).toBe(contract.layoutKey);
      expect(component.category, component.id).toBe(contract.categoryLabel);
      expect(component.layoutKey, component.id).toBe(contract.layoutKey);
      expectRequiredPreviewSample(component.asset);
    });
  });

  it("filters every official group and renders previews by layout key", async () => {
    const user = userEvent.setup();
    const { container } = render(<ComponentCatalog />);

    expect(screen.getByText("53 个正式组件")).not.toBeNull();
    for (const [group, count] of Object.entries(expectedGroupCounts)) {
      await user.click(screen.getByRole("tab", { name: new RegExp(`^${group}`) }));
      expect(container.querySelectorAll("[data-component-card]")).toHaveLength(count);
    }

    await user.click(screen.getByRole("tab", { name: /^全部/ }));
    V0_COMPONENT_PREVIEWS.forEach((component) => {
      const card = container.querySelector(`[data-component-card="${component.id}"]`);
      expect(card, component.id).not.toBeNull();
      expect(
        card?.querySelector(`[data-layout-key="${component.asset.preview.layoutKey}"]`),
        component.id,
      ).not.toBeNull();
    });
  });

  it("searches by component ID and shows real manifest details", async () => {
    const user = userEvent.setup();
    const { container } = render(<ComponentCatalog />);
    const selected = V0_COMPONENT_PREVIEWS.find((component) => component.category === "数据卡");
    expect(selected).toBeDefined();
    if (selected === undefined) return;

    await user.type(screen.getByRole("textbox", { name: "搜索组件" }), selected.id);
    expect(container.querySelectorAll("[data-component-card]")).toHaveLength(1);

    const card = container.querySelector(`[data-component-card="${selected.id}"]`);
    expect(card).not.toBeNull();
    if (card === null) return;
    await user.click(card as HTMLElement);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(selected.id)).not.toBeNull();
    expect(within(dialog).getByText(selected.version)).not.toBeNull();
    expect(
      within(dialog).getByText(
        {
          compatible: "微信兼容",
          conditional: "条件兼容",
          risky: "高风险",
          safe: "微信安全",
        }[selected.asset.manifest.compatibilityLevel],
      ),
    ).not.toBeNull();
    expect(dialog.querySelector('[data-layout-key="data"]')).not.toBeNull();
    expect(within(dialog).getByText(/组件中心不持有当前文章上下文/)).not.toBeNull();
    expect(within(dialog).getByRole("link", { name: "新建文章后使用" }).getAttribute("href")).toBe(
      "/workspace/articles?new=1",
    );
  });
});
