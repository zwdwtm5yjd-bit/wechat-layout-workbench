// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { VisualAssetCatalog } from "./visual-asset-catalog";

afterEach(() => cleanup());

describe("VisualAssetCatalog", () => {
  it("progressively renders the large catalog instead of mounting every card at once", async () => {
    const user = userEvent.setup();
    render(<VisualAssetCatalog />);

    expect(screen.getAllByRole("img")).toHaveLength(24);
    expect(screen.getAllByRole("img")[0]?.getAttribute("alt")).toBe("高级商务 · 图文批注框");
    await user.click(screen.getByRole("button", { name: "再显示 24 个" }));
    expect(screen.getAllByRole("img")).toHaveLength(48);
  });

  it("separates static and dynamic variants and supports task plus effect filtering", async () => {
    const user = userEvent.setup();
    render(<VisualAssetCatalog />);

    expect(screen.getByText("当前显示 180 个静态素材")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "动态素材 · 100" }));
    expect(screen.getByText("当前显示 100 个动态素材")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /贴纸与点缀/u }));
    expect(screen.getByText("当前显示 10 个动态素材")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "查看全部" }));

    await user.selectOptions(screen.getByLabelText("按动效筛选"), "orbit");
    expect(screen.getByText("当前显示 10 个动态素材")).not.toBeNull();
    expect(screen.getAllByRole("img", { name: /环绕运行/u })).toHaveLength(10);
  });
});
