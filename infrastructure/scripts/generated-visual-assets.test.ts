import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  OFFICIAL_DYNAMIC_VISUAL_ASSETS,
  findOfficialVisualAsset,
} from "../../packages/component-registry/src/visual-assets.js";
import { describe, expect, it } from "vitest";

const libraryRoot = resolve(process.cwd(), "apps/web/public/visual-assets/library");

function readAsset(group: "dynamic" | "static", filename: string): string {
  return readFileSync(resolve(libraryRoot, group, filename), "utf8");
}

function geometrySignature(svg: string): string {
  return svg
    .replaceAll(/#[\da-f]{6}/giu, "#COLOR")
    .replaceAll(/(?:g|fade|dots|soft)\d+/gu, "TOKEN")
    .replaceAll(/素材 \d+/gu, "素材")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function svgAspectRatio(svg: string): number {
  const viewBox = svg.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/u);
  if (viewBox?.[1] === undefined || viewBox[2] === undefined) {
    throw new Error("SVG viewBox is required");
  }
  return Number(viewBox[1]) / Number(viewBox[2]);
}

describe("generated visual asset library", () => {
  it("keeps generated files aligned with the public catalog", () => {
    expect(
      readdirSync(resolve(libraryRoot, "static")).filter((file) => file.endsWith(".svg")),
    ).toHaveLength(180);
    expect(
      readdirSync(resolve(libraryRoot, "dynamic")).filter((file) => file.endsWith(".svg")),
    ).toHaveLength(100);
  });

  it("renders free-position base assets as transparent square artwork", () => {
    for (let styleIndex = 0; styleIndex < 10; styleIndex += 1) {
      for (const offset of [6, 7, 10]) {
        const filename = `static-${String(styleIndex * 10 + offset).padStart(3, "0")}.svg`;
        const svg = readAsset("static", filename);
        expect(svg).toContain('viewBox="0 0 480 480"');
        expect(svg).not.toContain('<rect width="1200" height="480"');
      }
    }
  });

  it("gives every advanced module and motion variant a distinct structural signature", () => {
    const advanced = Array.from({ length: 50 }, (_, index) =>
      geometrySignature(readAsset("static", `static-${String(index + 131).padStart(3, "0")}.svg`)),
    );
    const dynamic = Array.from({ length: 100 }, (_, index) =>
      geometrySignature(readAsset("dynamic", `dynamic-${String(index + 1).padStart(3, "0")}.svg`)),
    );

    expect(new Set(advanced).size).toBe(50);
    expect(new Set(dynamic).size).toBe(100);
  });

  it("keeps every dynamic asset and its publishing fallback at the same aspect ratio", () => {
    OFFICIAL_DYNAMIC_VISUAL_ASSETS.forEach((asset) => {
      const fallback = findOfficialVisualAsset(asset.fallbackResourceId ?? "");
      expect(fallback).toBeDefined();
      if (fallback === undefined) return;
      const dynamicSvg = readFileSync(
        resolve(process.cwd(), "apps/web/public", asset.previewPath.slice(1)),
        "utf8",
      );
      const fallbackSvg = readFileSync(
        resolve(process.cwd(), "apps/web/public", fallback.previewPath.slice(1)),
        "utf8",
      );
      expect(svgAspectRatio(dynamicSvg)).toBe(svgAspectRatio(fallbackSvg));
    });
  });

  it("keeps motion accessible and self-contained", () => {
    for (const filename of readdirSync(resolve(libraryRoot, "dynamic"))) {
      const svg = readAsset("dynamic", filename);
      expect(svg).toContain("prefers-reduced-motion:reduce");
      expect(svg).not.toMatch(/(?:href|src)=["']https?:\/\//u);
      expect(svg).not.toMatch(/\son\w+=/u);
    }
  });
});
