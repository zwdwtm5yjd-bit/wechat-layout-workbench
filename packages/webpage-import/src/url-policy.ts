import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";

import { WebpageImportError } from "./errors.js";

export interface ResolvedAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

export type HostResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export function createPinnedLookup(pinned: ResolvedAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all === true) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}

function ipv4Bytes(address: string): readonly number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map(Number);
  return bytes.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? bytes : null;
}

function ipv6Bytes(address: string): readonly number[] | null {
  const zoneIndex = address.indexOf("%");
  const withoutZone = zoneIndex === -1 ? address : address.slice(0, zoneIndex);
  let normalized = withoutZone.toLowerCase();
  const lastColon = normalized.lastIndexOf(":");
  if (normalized.includes(".") && lastColon !== -1) {
    const embedded = ipv4Bytes(normalized.slice(lastColon + 1));
    if (embedded === null) return null;
    normalized = `${normalized.slice(0, lastColon)}:${((embedded[0] ?? 0) * 256 + (embedded[1] ?? 0)).toString(16)}:${((embedded[2] ?? 0) * 256 + (embedded[3] ?? 0)).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] === "" ? [] : (halves[0]?.split(":") ?? []);
  const right = halves.length === 1 || halves[1] === "" ? [] : (halves[1]?.split(":") ?? []);
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (missing < 0) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[a-f0-9]{1,4}$/.test(group))) return null;
  return groups.flatMap((group) => {
    const value = Number.parseInt(group, 16);
    return [value >> 8, value & 0xff];
  });
}

function isPublicIpv4(address: string): boolean {
  const bytes = ipv4Bytes(address);
  if (bytes === null) return false;
  const [a = 0, b = 0, c = 0] = bytes;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPublicIpv6(address: string): boolean {
  const bytes = ipv6Bytes(address);
  if (bytes === null) return false;
  if (bytes.every((byte) => byte === 0)) return false;
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) return false;
  if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isPublicIpv4(bytes.slice(12).join("."));
  }
  const first = bytes[0] ?? 0;
  const second = bytes[1] ?? 0;
  return !(
    (first & 0xfe) === 0xfc ||
    (first === 0xfe && (second & 0xc0) === 0x80) ||
    first === 0xff ||
    (first === 0x20 && second === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) ||
    (first === 0x20 && second === 0x01 && bytes[2] === 0x00 && (bytes[3] ?? 0) < 0x20)
  );
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
}

export function normalizeWebUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebpageImportError("WEBPAGE_URL_INVALID", "网页地址格式无效", false);
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new WebpageImportError(
      "WEBPAGE_URL_INVALID",
      "网页地址仅允许不含凭据的 HTTP(S) URL",
      false,
    );
  }
  const rawHostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new WebpageImportError("WEBPAGE_URL_BLOCKED", "网页地址指向本机或私有网络", false);
  }
  if (isIP(hostname) !== 0 && !isPublicIpAddress(hostname)) {
    throw new WebpageImportError("WEBPAGE_URL_BLOCKED", "网页地址指向本机或私有网络", false);
  }
  if (isIP(hostname) !== 6) url.hostname = hostname;
  url.hash = "";
  return url;
}

export const systemHostResolver: HostResolver = async (hostname) => {
  if (isIP(hostname) === 4) return [{ address: hostname, family: 4 }];
  if (isIP(hostname) === 6) return [{ address: hostname, family: 6 }];
  try {
    const results = await lookup(hostname, { all: true, verbatim: true });
    return results.map(({ address, family }) => ({ address, family: family === 6 ? 6 : 4 }));
  } catch {
    throw new WebpageImportError("WEBPAGE_DNS_FAILED", "网页域名解析失败", true);
  }
};

export async function resolvePublicWebUrl(
  raw: string | URL,
  resolver: HostResolver = systemHostResolver,
): Promise<{ readonly url: URL; readonly addresses: readonly ResolvedAddress[] }> {
  const url = normalizeWebUrl(raw instanceof URL ? raw.href : raw);
  const hostname = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  const addresses = await resolver(hostname);
  if (
    addresses.length === 0 ||
    addresses.some(
      ({ address, family }) => (family !== 4 && family !== 6) || !isPublicIpAddress(address),
    )
  ) {
    throw new WebpageImportError("WEBPAGE_URL_BLOCKED", "网页域名解析到本机或私有网络", false);
  }
  return { url, addresses };
}
