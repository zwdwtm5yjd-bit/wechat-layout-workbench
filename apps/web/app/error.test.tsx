// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ApplicationError from "./error";

describe("application error boundary", () => {
  it("shows a recoverable fallback and invokes reset", () => {
    const reset = vi.fn();

    render(<ApplicationError error={new Error("private failure")} reset={reset} />);
    expect(screen.getByRole("heading", { name: "这部分没有正常加载" })).toBeTruthy();
    expect(screen.queryByText("private failure")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "重新尝试" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
