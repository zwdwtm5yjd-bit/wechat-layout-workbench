import { createHash } from "node:crypto";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { RESOURCE_IMAGE_MAX_PIXELS, RESOURCE_THUMBNAIL_WIDTH } from "./resource.constants.js";
import type { InspectedImage, ResourceImageMimeType } from "./resource.types.js";

const imageFormats = {
  "image/gif": { extension: "gif", sharpFormat: "gif" },
  "image/jpeg": { extension: "jpg", sharpFormat: "jpeg" },
  "image/png": { extension: "png", sharpFormat: "png" },
  "image/webp": { extension: "webp", sharpFormat: "webp" },
} as const satisfies Readonly<
  Record<ResourceImageMimeType, { readonly extension: string; readonly sharpFormat: string }>
>;

export class ImageInspectionError extends Error {
  override readonly name = "ImageInspectionError";

  constructor(
    readonly code: "RESOURCE_IMAGE_INVALID" | "RESOURCE_MIME_MISMATCH",
    message: string,
  ) {
    super(message);
  }
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function orientedDimensions(
  width: number,
  height: number,
  orientation: number | undefined,
): { readonly width: number; readonly height: number } {
  return orientation !== undefined && orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

export async function inspectImage(
  bytes: Uint8Array,
  declaredMimeType: ResourceImageMimeType,
): Promise<InspectedImage> {
  const detected = await fileTypeFromBuffer(bytes);
  if (
    detected === undefined ||
    !(
      detected.mime === "image/png" ||
      detected.mime === "image/jpeg" ||
      detected.mime === "image/webp" ||
      detected.mime === "image/gif"
    )
  ) {
    throw new ImageInspectionError("RESOURCE_IMAGE_INVALID", "文件不是受支持的有效图片");
  }
  const detectedMimeType = detected.mime;
  const format = imageFormats[detectedMimeType];
  if (detectedMimeType !== declaredMimeType) {
    throw new ImageInspectionError("RESOURCE_MIME_MISMATCH", "文件内容与声明的 MIME 类型不一致");
  }
  try {
    const input = sharp(bytes, {
      animated: true,
      failOn: "error",
      limitInputPixels: RESOURCE_IMAGE_MAX_PIXELS,
    });
    const metadata = await input.metadata();
    if (
      metadata.width === undefined ||
      metadata.height === undefined ||
      metadata.format !== format.sharpFormat
    ) {
      throw new Error("图片元数据不完整");
    }

    const thumbnailResult = await input
      .clone()
      .autoOrient()
      .resize({
        width: RESOURCE_THUMBNAIL_WIDTH,
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const dimensions = orientedDimensions(metadata.width, metadata.height, metadata.orientation);
    return {
      mimeType: detectedMimeType,
      extension: format.extension,
      width: dimensions.width,
      height: dimensions.height,
      pages: metadata.pages,
      thumbnail: {
        bytes: thumbnailResult.data,
        width: thumbnailResult.info.width,
        height: thumbnailResult.info.height,
        sha256: digest(thumbnailResult.data),
      },
    };
  } catch (error) {
    if (error instanceof ImageInspectionError) {
      throw error;
    }
    throw new ImageInspectionError("RESOURCE_IMAGE_INVALID", "图片无法被安全解码");
  }
}
