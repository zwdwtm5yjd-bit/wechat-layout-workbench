import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { ImageInspectionError, inspectImage } from "./image-inspector.js";

describe("inspectImage", () => {
  it("decodes an image and creates a bounded WebP thumbnail", async () => {
    const source = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 4,
        background: "#7c3aed",
      },
    })
      .png()
      .toBuffer();

    const inspected = await inspectImage(source, "image/png");

    expect(inspected).toMatchObject({
      mimeType: "image/png",
      extension: "png",
      width: 640,
      height: 480,
      thumbnail: {
        width: 320,
        height: 240,
      },
    });
    expect(inspected.thumbnail.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await sharp(inspected.thumbnail.bytes).metadata()).format).toBe("webp");
  });

  it("rejects a valid image whose declared MIME is wrong", async () => {
    const source = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();

    await expect(inspectImage(source, "image/jpeg")).rejects.toMatchObject({
      code: "RESOURCE_MIME_MISMATCH",
    } satisfies Partial<ImageInspectionError>);
  });

  it("rejects bytes that merely claim to be an image", async () => {
    await expect(
      inspectImage(new TextEncoder().encode("not a real png"), "image/png"),
    ).rejects.toMatchObject({
      code: "RESOURCE_IMAGE_INVALID",
    } satisfies Partial<ImageInspectionError>);
  });
});
