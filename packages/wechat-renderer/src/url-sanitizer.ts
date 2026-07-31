export type WechatUrlKind = "image" | "link";

export interface SanitizedWechatUrl {
  readonly normalized: string;
  readonly success: true;
}

export interface BlockedWechatUrl {
  readonly reason: string;
  readonly success: false;
}

export type WechatUrlSanitizationResult = BlockedWechatUrl | SanitizedWechatUrl;

const MAXIMUM_URL_LENGTH = 2_048;

function privateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [first = 0, second = 0] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function privateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function blockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    privateIpv4(normalized) ||
    privateIpv6(normalized)
  );
}

export function sanitizeWechatUrl(
  value: unknown,
  kind: WechatUrlKind,
): WechatUrlSanitizationResult {
  if (typeof value !== "string" || value.length === 0 || value.length > MAXIMUM_URL_LENGTH) {
    return { success: false, reason: "URL 为空或长度超限" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { success: false, reason: "URL 格式不合法" };
  }

  if (parsed.protocol !== "https:") {
    return { success: false, reason: "微信正文只允许 HTTPS URL" };
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return { success: false, reason: "URL 不能包含用户凭据" };
  }
  if (blockedHostname(parsed.hostname)) {
    return { success: false, reason: "URL 不能指向本机或私网地址" };
  }
  if (kind === "image" && parsed.hash !== "") {
    parsed.hash = "";
  }

  return { success: true, normalized: parsed.toString() };
}
