// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ComponentCatalog } from "./component-catalog";

afterEach(() => {
  cleanup();
});

describe("ComponentCatalog", () => {
  it("filters native components and explains the article context boundary", async () => {
    const user = userEvent.setup();
    render(<ComponentCatalog />);

    await user.click(screen.getByRole("tab", { name: "分割线" }));
    expect(screen.getByRole("button", { name: /留白分割/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /重点引用/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /留白分割/ }));
    expect(await screen.findByText(/组件中心不持有当前文章上下文/)).not.toBeNull();
    expect(
      (screen.getByRole("button", { name: "需要先打开一篇文章" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
