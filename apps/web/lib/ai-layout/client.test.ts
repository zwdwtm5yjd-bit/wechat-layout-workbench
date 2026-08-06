import { afterEach, describe, expect, it, vi } from "vitest";

import * as authClient from "../auth/client";
import { generateAiLayout, getAiLayoutStatus } from "./client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AI layout client", () => {
  it("reads truthful model availability", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            available: false,
            defaultProviderId: "auto",
            model: "deepseek-v4-flash",
            models: [],
            provider: "auto",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(getAiLayoutStatus()).resolves.toMatchObject({ available: false });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/ai-layout/status",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("submits an authenticated model planning request", async () => {
    vi.spyOn(authClient, "getCsrfToken").mockResolvedValue("csrf-ai");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            available: true,
            defaultProviderId: "auto",
            model: "deepseek-v4-flash",
            models: [],
            provider: "deepseek",
            decision: {},
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await generateAiLayout("article", {
      baseDocumentVersion: 7,
      mode: "described",
      providerId: "deepseek",
      styleBrief: "克制的政务杂志感",
    });
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({ "X-CSRF-Token": "csrf-ai" });
    expect(JSON.parse(String(request.body))).toMatchObject({
      baseDocumentVersion: 7,
      mode: "described",
      providerId: "deepseek",
      styleBrief: "克制的政务杂志感",
    });
  });
});
