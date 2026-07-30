import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";
import { AppToastProvider } from "./ui/app-toast";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect(): void {}
      observe(): void {}
      unobserve(): void {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it("falls back to POST so credentials never enter the URL before hydration", () => {
    const { container } = render(
      <AppToastProvider>
        <LoginForm />
      </AppToastProvider>,
    );

    expect(container.querySelector("form")?.getAttribute("method")).toBe("post");
    expect(screen.getByRole("button", { name: "登录" }).getAttribute("type")).toBe("submit");
  });
});
// @vitest-environment jsdom
