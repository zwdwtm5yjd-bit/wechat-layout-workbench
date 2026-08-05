import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { deflateSync } from "node:zlib";

import { collectDocumentEntries } from "../../packages/document-schema/src/index.js";
import {
  standardArticleFixtures,
  type StandardArticleFixture,
} from "../../packages/test-fixtures/src/index.js";

export interface AcceptanceImagePlan {
  readonly blockId: string;
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly key: string;
  readonly placeholderResourceId: string;
  readonly sha256: string;
}

export interface AcceptanceFixturePlan {
  readonly fixture: StandardArticleFixture;
  readonly images: readonly AcceptanceImagePlan[];
}

const expectedImageCounts = new Map<StandardArticleFixture["id"], number>([
  ["party_inspection", 1],
  ["legal", 0],
  ["ai_technology", 1],
  ["extreme", 50],
]);

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = Buffer.from(data);
  const chunk = Buffer.alloc(12 + payload.byteLength);
  chunk.writeUInt32BE(payload.byteLength, 0);
  typeBytes.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, payload])), 8 + payload.byteLength);
  return chunk;
}

export function deterministicAcceptancePng(key: string): Uint8Array {
  const seed = createHash("sha256").update(key).digest();
  const width = 96;
  const height = 54;
  const rowBytes = width * 4 + 1;
  const pixels = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowBytes;
    pixels[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      const stripe = (Math.floor(x / 8) + Math.floor(y / 6)) % 2;
      const seedOffset = (x + y * 3) % seed.byteLength;
      pixels[offset] = (seed[seedOffset] ?? 0) ^ (stripe === 0 ? 0x22 : 0x88);
      pixels[offset + 1] =
        (seed[(seedOffset + 7) % seed.byteLength] ?? 0) ^ (stripe === 0 ? 0x55 : 0xaa);
      pixels[offset + 2] =
        (seed[(seedOffset + 13) % seed.byteLength] ?? 0) ^ (stripe === 0 ? 0x77 : 0xcc);
      pixels[offset + 3] = 0xff;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function buildAcceptanceFixturePlans(): readonly AcceptanceFixturePlan[] {
  const plans = standardArticleFixtures.map((fixture) => {
    const images = collectDocumentEntries(fixture.document.content)
      .blocks.filter(({ node }) => node.type === "imageBlock")
      .map(({ node }) => {
        if (node.type !== "imageBlock") {
          throw new Error("Fixture image narrowing failed");
        }
        const key = `acceptance-image-v1:${fixture.id}:${node.attrs.blockId}`;
        const bytes = deterministicAcceptancePng(key);
        return {
          blockId: node.attrs.blockId,
          bytes,
          filename: `${fixture.id}-${node.attrs.blockId}.png`,
          key,
          placeholderResourceId: node.attrs.resourceId,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      });
    const expected = expectedImageCounts.get(fixture.id);
    if (expected === undefined || images.length !== expected) {
      throw new Error(
        `验收 Fixture ${fixture.id} 图片数量应为 ${String(expected)}，实际为 ${String(images.length)}`,
      );
    }
    return { fixture, images };
  });
  const allImages = plans.flatMap(({ images }) => images);
  if (plans.length !== 4 || allImages.length !== 52) {
    throw new Error(
      `验收范围必须是 4 篇 / 52 图，实际为 ${String(plans.length)} 篇 / ${String(allImages.length)} 图`,
    );
  }
  if (new Set(allImages.map(({ sha256 }) => sha256)).size !== allImages.length) {
    throw new Error("验收图片摘要必须 52 个全部唯一");
  }
  return plans;
}

function publicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) return false;
  const [first = 0, second = 0, third = 0] = parts;
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function publicIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%", 1)[0] ?? "";
  if (normalized.startsWith("::ffff:")) {
    return publicIpv4(normalized.slice("::ffff:".length));
  }
  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("2001:db8:") ||
    normalized === "2001:db8::" ||
    normalized.startsWith("ff")
  );
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  return version === 4 ? publicIpv4(address) : version === 6 ? publicIpv6(address) : false;
}

export function htmlImageSources(html: string): readonly string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi)].map((match) =>
    (match[1] ?? match[2] ?? "")
      .replaceAll("&amp;", "&")
      .replaceAll("&#38;", "&")
      .replaceAll("&#x26;", "&"),
  );
}
