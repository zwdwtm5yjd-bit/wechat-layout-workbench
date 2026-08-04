import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { request as requestHttp, type RequestOptions } from "node:http";
import { request as requestHttps } from "node:https";
import type { Readable } from "node:stream";

import { WebpageImportError } from "./errors.js";
import {
  createPinnedLookup,
  resolvePublicWebUrl,
  systemHostResolver,
  type HostResolver,
  type ResolvedAddress,
} from "./url-policy.js";
import type { SafeFetchResult } from "./types.js";

export interface SafeFetchOptions {
  readonly url: string;
  readonly maximumBytes: number;
  readonly timeoutMs: number;
  readonly maximumRedirects?: number;
  readonly acceptedContentTypes?: readonly string[];
  readonly resolver?: HostResolver;
  readonly signal?: AbortSignal;
  readonly userAgent?: string;
  readonly request?: SafeHttpRequester;
}

export interface SafeHttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly bytes: Uint8Array;
}

export type SafeHttpRequester = (input: {
  readonly url: URL;
  readonly addresses: readonly ResolvedAddress[];
  readonly maximumBytes: number;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly userAgent: string;
}) => Promise<SafeHttpResponse>;

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function contentType(headers: Readonly<Record<string, string | string[] | undefined>>): string {
  const value = headers["content-type"];
  return (Array.isArray(value) ? value[0] : value)?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function accepted(actual: string, expected: readonly string[] | undefined): boolean {
  return (
    expected === undefined ||
    expected.some((item) => actual === item || actual.startsWith(`${item}/`))
  );
}

function decodedStream(stream: Readable, encodingHeader: string | string[] | undefined): Readable {
  const encoding = (Array.isArray(encodingHeader) ? encodingHeader[0] : encodingHeader)
    ?.trim()
    .toLowerCase();
  if (encoding === undefined || encoding === "" || encoding === "identity") return stream;
  if (encoding === "gzip" || encoding === "x-gzip") return stream.pipe(createGunzip());
  if (encoding === "deflate") return stream.pipe(createInflate());
  if (encoding === "br") return stream.pipe(createBrotliDecompress());
  throw new WebpageImportError(
    "WEBPAGE_CONTENT_ENCODING_UNSUPPORTED",
    "网页使用了不支持的压缩格式",
    false,
  );
}

async function readBounded(stream: Readable, maximumBytes: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const value of stream) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
      size += chunk.byteLength;
      if (size > maximumBytes) {
        stream.destroy();
        throw new WebpageImportError("WEBPAGE_RESPONSE_TOO_LARGE", "网页响应超过大小限制", false);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof WebpageImportError) throw error;
    throw new WebpageImportError("WEBPAGE_RESPONSE_READ_FAILED", "读取网页响应失败", true);
  }
  return Buffer.concat(chunks, size);
}

const requestOnce: SafeHttpRequester = async (input) => {
  if (input.signal?.aborted === true) {
    throw new WebpageImportError("WEBPAGE_FETCH_CANCELLED", "网页抓取已取消", false);
  }
  const pinned = input.addresses[0];
  if (pinned === undefined) {
    throw new WebpageImportError("WEBPAGE_DNS_FAILED", "网页域名没有可用地址", true);
  }
  const options: RequestOptions = {
    protocol: input.url.protocol,
    hostname: input.url.hostname.startsWith("[")
      ? input.url.hostname.slice(1, -1)
      : input.url.hostname,
    port: input.url.port === "" ? undefined : Number(input.url.port),
    method: "GET",
    path: `${input.url.pathname}${input.url.search}`,
    agent: false,
    headers: {
      accept:
        "text/html,application/xhtml+xml,image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
      "accept-encoding": "gzip, deflate, br",
      "user-agent": input.userAgent,
      host: input.url.host,
    },
    lookup: createPinnedLookup(pinned),
  };
  return new Promise((resolve, reject) => {
    const requester = input.url.protocol === "https:" ? requestHttps : requestHttp;
    const request = requester(options, (response) => {
      const status = response.statusCode ?? 0;
      const length = Number(response.headers["content-length"] ?? "0");
      if (Number.isFinite(length) && length > input.maximumBytes) {
        response.destroy();
        reject(new WebpageImportError("WEBPAGE_RESPONSE_TOO_LARGE", "网页响应超过大小限制", false));
        return;
      }
      let stream: Readable;
      try {
        stream = decodedStream(response, response.headers["content-encoding"]);
      } catch (error) {
        response.destroy();
        reject(error);
        return;
      }
      void readBounded(stream, input.maximumBytes).then(
        (bytes) => resolve({ status, headers: response.headers, bytes }),
        reject,
      );
    });
    const onAbort = () => request.destroy(new Error("aborted"));
    input.signal?.addEventListener("abort", onAbort, { once: true });
    request.setTimeout(input.timeoutMs, () => request.destroy(new Error("timeout")));
    request.once("error", (error) => {
      input.signal?.removeEventListener("abort", onAbort);
      reject(
        new WebpageImportError(
          input.signal?.aborted === true ? "WEBPAGE_FETCH_CANCELLED" : "WEBPAGE_FETCH_FAILED",
          input.signal?.aborted === true ? "网页抓取已取消" : `网页请求失败：${error.message}`,
          input.signal?.aborted !== true,
        ),
      );
    });
    request.once("close", () => input.signal?.removeEventListener("abort", onAbort));
    request.end();
  });
};

export async function safeFetch(options: SafeFetchOptions): Promise<SafeFetchResult> {
  if (!Number.isInteger(options.maximumBytes) || options.maximumBytes <= 0) {
    throw new Error("maximumBytes 必须是正整数");
  }
  const resolver = options.resolver ?? systemHostResolver;
  const maximumRedirects = options.maximumRedirects ?? 5;
  const requestedUrl = options.url;
  let current = options.url;
  const redirects: string[] = [];
  for (let redirectIndex = 0; redirectIndex <= maximumRedirects; redirectIndex += 1) {
    const resolved = await resolvePublicWebUrl(current, resolver);
    const response = await (options.request ?? requestOnce)({
      url: resolved.url,
      addresses: resolved.addresses,
      maximumBytes: options.maximumBytes,
      timeoutMs: options.timeoutMs,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      userAgent:
        options.userAgent ??
        "Mozilla/5.0 (compatible; WechatLayoutImporter/1.0; +https://github.com/zwdwtm5yjd-bit/wechat-layout-workbench)",
    });
    if (redirectStatuses.has(response.status)) {
      const location = response.headers.location;
      const target = Array.isArray(location) ? location[0] : location;
      if (!target) {
        throw new WebpageImportError("WEBPAGE_REDIRECT_INVALID", "网页重定向缺少目标地址", false);
      }
      if (redirectIndex === maximumRedirects) {
        throw new WebpageImportError("WEBPAGE_REDIRECT_LIMIT", "网页重定向次数超过限制", false);
      }
      current = new URL(target, resolved.url).href;
      redirects.push(current);
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new WebpageImportError(
        "WEBPAGE_HTTP_ERROR",
        `网页返回 HTTP ${String(response.status)}`,
        response.status === 408 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500,
      );
    }
    const actualContentType = contentType(response.headers);
    if (!accepted(actualContentType, options.acceptedContentTypes)) {
      throw new WebpageImportError("WEBPAGE_CONTENT_TYPE_INVALID", "网页响应类型不受支持", false);
    }
    return {
      requestedUrl,
      finalUrl: resolved.url.href,
      status: response.status,
      contentType: actualContentType,
      bytes: response.bytes,
      redirects,
    };
  }
  throw new WebpageImportError("WEBPAGE_REDIRECT_LIMIT", "网页重定向次数超过限制", false);
}
