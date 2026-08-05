import { describe, expect, it, vi } from "vitest";

import { safeFetch, type SafeHttpRequester } from "./safe-fetch.js";
import type { HostResolver } from "./url-policy.js";

const publicResolver: HostResolver = async () => [{ address: "93.184.216.34", family: 4 }];

describe("safeFetch", () => {
  it("revalidates every redirect target and blocks a private redirect", async () => {
    const request: SafeHttpRequester = vi.fn(async () => ({
      status: 302,
      headers: { location: "http://127.0.0.1/admin" },
      bytes: new Uint8Array(),
    }));
    await expect(
      safeFetch({
        url: "https://news.example/article",
        maximumBytes: 1024,
        timeoutMs: 1000,
        resolver: publicResolver,
        request,
      }),
    ).rejects.toMatchObject({ code: "WEBPAGE_URL_BLOCKED", retryable: false });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("returns a bounded supported response after a public redirect", async () => {
    const request: SafeHttpRequester = vi
      .fn<SafeHttpRequester>()
      .mockResolvedValueOnce({
        status: 301,
        headers: { location: "https://cdn.example/story" },
        bytes: new Uint8Array(),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        bytes: new TextEncoder().encode("<p>story</p>"),
      });
    const result = await safeFetch({
      url: "https://news.example/article",
      maximumBytes: 1024,
      timeoutMs: 1000,
      resolver: publicResolver,
      request,
      acceptedContentTypes: ["text/html"],
    });
    expect(result.finalUrl).toBe("https://cdn.example/story");
    expect(result.redirects).toEqual(["https://cdn.example/story"]);
  });
});
