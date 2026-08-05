import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildAcceptanceFixturePlans,
  deterministicAcceptancePng,
  htmlImageSources,
  isPublicIpAddress,
} from "./acceptance-seed-support.js";

describe("acceptance seed support", () => {
  it("plans the four standard fixtures with 52 stable unique PNG images", () => {
    const first = buildAcceptanceFixturePlans();
    const second = buildAcceptanceFixturePlans();

    expect(first.map(({ fixture, images }) => [fixture.id, images.length])).toEqual([
      ["party_inspection", 1],
      ["legal", 0],
      ["ai_technology", 1],
      ["extreme", 50],
    ]);
    expect(first.flatMap(({ images }) => images)).toHaveLength(52);
    expect(new Set(first.flatMap(({ images }) => images.map(({ sha256 }) => sha256))).size).toBe(
      52,
    );
    expect(second).toEqual(first);
    const png = deterministicAcceptancePng("acceptance-image-v1:test:block");
    expect(Buffer.from(png.subarray(0, 8))).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash("sha256").update(png).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("distinguishes public addresses from loopback, private and link-local ranges", () => {
    expect(isPublicIpAddress("1.1.1.1")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("100.64.0.1")).toBe(false);
    expect(isPublicIpAddress("169.254.1.1")).toBe(false);
    expect(isPublicIpAddress("192.168.1.1")).toBe(false);
    expect(isPublicIpAddress("192.0.2.1")).toBe(false);
    expect(isPublicIpAddress("198.51.100.1")).toBe(false);
    expect(isPublicIpAddress("203.0.113.1")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fd00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isPublicIpAddress("2001:db8::1")).toBe(false);
  });

  it("extracts only quoted image sources from rendered HTML", () => {
    expect(
      htmlImageSources(
        '<p>正文</p><img src="https://cdn.example.com/a.png?a=1&amp;b=2"><img alt="b" src=\'https://cdn.example.com/b.png?c=3&#38;d=4\'>',
      ),
    ).toEqual(["https://cdn.example.com/a.png?a=1&b=2", "https://cdn.example.com/b.png?c=3&d=4"]);
  });
});
