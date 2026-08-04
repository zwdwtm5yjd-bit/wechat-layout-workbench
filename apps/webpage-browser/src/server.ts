import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { isWebpageImportError } from "@wechat-layout/webpage-import";

import type { BrowserRenderer } from "./renderer.js";

const maximumRequestBytes = 32 * 1024;

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
    size += chunk.byteLength;
    if (size > maximumRequestBytes) throw new Error("请求体过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
}

function json(response: ServerResponse, status: number, value: unknown): void {
  const bytes = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": String(bytes.byteLength),
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(bytes);
}

export async function renderBrowserRequest(
  renderer: BrowserRenderer,
  parsed: unknown,
): Promise<{ readonly status: number; readonly value: unknown }> {
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("url" in parsed) ||
    typeof parsed.url !== "string"
  ) {
    return { status: 400, value: { error: { code: "INVALID_REQUEST", retryable: false } } };
  }
  try {
    return { status: 200, value: await renderer.render(parsed.url) };
  } catch (error) {
    if (isWebpageImportError(error)) {
      return {
        status: error.retryable ? 503 : 422,
        value: { error: { code: error.code, message: error.message, retryable: error.retryable } },
      };
    }
    return {
      status: 503,
      value: {
        error: {
          code: "BROWSER_RENDER_FAILED",
          message: "浏览器渲染失败",
          retryable: true,
        },
      },
    };
  }
}

export function createBrowserHttpServer(input: {
  readonly renderer: BrowserRenderer;
  readonly maximumConcurrency: number;
}) {
  let active = 0;
  return createServer((request, response) => {
    void (async () => {
      if (request.method === "GET" && request.url === "/health/live") {
        json(response, input.renderer.isConnected() ? 200 : 503, {
          status: input.renderer.isConnected() ? "ok" : "unavailable",
        });
        return;
      }
      if (request.method !== "POST" || request.url !== "/render") {
        json(response, 404, { error: { code: "NOT_FOUND" } });
        return;
      }
      if (active >= input.maximumConcurrency) {
        json(response, 429, { error: { code: "BROWSER_BUSY", retryable: true } });
        return;
      }
      const parsed = await body(request);
      active += 1;
      try {
        const result = await renderBrowserRequest(input.renderer, parsed);
        json(response, result.status, result.value);
      } finally {
        active -= 1;
      }
    })().catch(() => {
      json(response, 503, {
        error: { code: "BROWSER_RENDER_FAILED", message: "浏览器渲染失败", retryable: true },
      });
    });
  });
}
