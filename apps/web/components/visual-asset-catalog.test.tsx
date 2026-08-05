// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { VisualAssetCatalog } from "./visual-asset-catalog";

afterEach(() => cleanup());

describe("VisualAssetCatalog", () => {
  it("separates 100 static assets from 50 dynamic assets and supports faceted filtering", async () => {
    const user = userEvent.setup();
    render(<VisualAssetCatalog />);

    expect(screen.getByText("当前显示 100 个静态素材")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "动态素材 · 50" }));
    expect(screen.getByText("当前显示 50 个动态素材")).not.toBeNull();

    await user.selectOptions(screen.getByLabelText("按动效筛选"), "orbit");
    expect(screen.getByText("当前显示 5 个动态素材")).not.toBeNull();
    expect(screen.getAllByRole("img", { name: /环绕运行/u })).toHaveLength(5);
  });
});
