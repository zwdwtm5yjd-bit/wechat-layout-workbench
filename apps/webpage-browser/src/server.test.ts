import { describe, expect, it, vi } from "vitest";

import type { BrowserRenderer } from "./renderer.js";
import { renderBrowserRequest } from "./server.js";

describe("browser HTTP service", () => {
  it("renders a validated request without exposing implementation details", async () => {
    const renderer: BrowserRenderer = {
      render: vi.fn(async () => ({
        finalUrl: "https://news.example/story",
        html: "<main>story</main>",
      })),
      close: vi.fn(async () => undefined),
      isConnected: () => true,
    };
    await expect(
      renderBrowserRequest(renderer, { url: "https://news.example/story" }),
    ).resolves.toEqual({
      status: 200,
      value: { finalUrl: "https://news.example/story", html: "<main>story</main>" },
    });
  });

  it("rejects malformed requests", async () => {
    const renderer: BrowserRenderer = {
      render: vi.fn(async () => ({ finalUrl: "", html: "" })),
      close: vi.fn(async () => undefined),
      isConnected: () => true,
    };
    await expect(renderBrowserRequest(renderer, {})).resolves.toMatchObject({ status: 400 });
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
