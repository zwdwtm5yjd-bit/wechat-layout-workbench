import { chromium, type Browser } from "playwright-core";

import {
  normalizeWebUrl,
  resolvePublicWebUrl,
  WebpageImportError,
} from "@wechat-layout/webpage-import";

import { startSafeProxy, type SafeProxy } from "./safe-proxy.js";

export interface BrowserRenderResult {
  readonly finalUrl: string;
  readonly html: string;
}

export interface BrowserRenderer {
  render(url: string): Promise<BrowserRenderResult>;
  close(): Promise<void>;
  isConnected(): boolean;
}

export async function createBrowserRenderer(input: {
  readonly executablePath: string;
  readonly timeoutMs: number;
  readonly maximumHtmlBytes: number;
}): Promise<BrowserRenderer> {
  const proxy: SafeProxy = await startSafeProxy();
  let browser: Browser;
  try {
    browser = await chromium.launch({
      executablePath: input.executablePath,
      headless: true,
      proxy: { server: proxy.url },
      args: [
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });
  } catch (error) {
    await proxy.close();
    throw error;
  }

  return {
    isConnected: () => browser.isConnected(),
    render: async (rawUrl) => {
      const normalized = normalizeWebUrl(rawUrl);
      await resolvePublicWebUrl(normalized);
      const context = await browser.newContext({
        acceptDownloads: false,
        bypassCSP: false,
        ignoreHTTPSErrors: false,
        javaScriptEnabled: true,
        serviceWorkers: "block",
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 WechatLayoutImporter/1.0",
      });
      try {
        const checkedHosts = new Set<string>();
        const page = await context.newPage();
        await page.route("**/*", async (route) => {
          const request = route.request();
          const requestUrl = request.url();
          if (request.resourceType() === "media" || request.resourceType() === "font") {
            await route.abort("blockedbyclient");
            return;
          }
          let candidate: URL;
          try {
            candidate = normalizeWebUrl(requestUrl);
          } catch {
            await route.abort("blockedbyclient");
            return;
          }
          if (!checkedHosts.has(candidate.hostname)) {
            try {
              await resolvePublicWebUrl(candidate);
              checkedHosts.add(candidate.hostname);
            } catch {
              await route.abort("blockedbyclient");
              return;
            }
          }
          await route.continue();
        });
        const response = await page.goto(normalized.href, {
          timeout: input.timeoutMs,
          waitUntil: "domcontentloaded",
        });
        if (response !== null && response.status() >= 400) {
          throw new WebpageImportError(
            "WEBPAGE_BROWSER_HTTP_ERROR",
            `浏览器回退返回 HTTP ${String(response.status())}`,
            response.status() === 408 || response.status() === 429 || response.status() >= 500,
          );
        }
        await page.waitForLoadState("networkidle", { timeout: 2_500 }).catch(() => undefined);
        const finalUrl = normalizeWebUrl(page.url()).href;
        await resolvePublicWebUrl(finalUrl);
        const html = await page.content();
        if (Buffer.byteLength(html) > input.maximumHtmlBytes) {
          throw new WebpageImportError(
            "WEBPAGE_BROWSER_RESPONSE_TOO_LARGE",
            "浏览器渲染结果超过大小限制",
            false,
          );
        }
        return { finalUrl, html };
      } finally {
        await context.close();
      }
    },
    close: async () => {
      await browser.close();
      await proxy.close();
    },
  };
}
