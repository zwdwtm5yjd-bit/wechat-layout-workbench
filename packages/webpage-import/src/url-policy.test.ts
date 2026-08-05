import { describe, expect, it, vi } from "vitest";

import { WebpageImportError } from "./errors.js";
import {
  createPinnedLookup,
  isPublicIpAddress,
  normalizeWebUrl,
  resolvePublicWebUrl,
} from "./url-policy.js";

describe("webpage URL policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it("rejects localhost and credentials before DNS", () => {
    expect(() => normalizeWebUrl("http://localhost/article")).toThrow(WebpageImportError);
    expect(() => normalizeWebUrl("http://[::1]/article")).toThrow(WebpageImportError);
    expect(() => normalizeWebUrl("http://[fc00::1]/article")).toThrow(WebpageImportError);
    expect(() => normalizeWebUrl("https://user:secret@example.com/article")).toThrow(/HTTP\(S\)/);
  });

  it("blocks a hostname when any DNS answer is private", async () => {
    await expect(
      resolvePublicWebUrl("https://news.example/article", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.8", family: 4 },
      ]),
    ).rejects.toMatchObject({ code: "WEBPAGE_URL_BLOCKED", retryable: false });
  });

  it("returns the pinned address in Node 24 all-address lookup mode", () => {
    const callback = vi.fn();
    createPinnedLookup({ address: "93.184.216.34", family: 4 })(
      "news.example",
      { all: true },
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });
});
