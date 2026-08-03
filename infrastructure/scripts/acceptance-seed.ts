import process from "node:process";
import { randomUUID } from "node:crypto";

import { createUuidV7 } from "../../packages/database/src/index.js";
import {
  legalArticleFixture,
  materializeAcceptanceFixture,
} from "../../packages/test-fixtures/src/index.js";
import { sanitizeWechatUrl } from "../../packages/wechat-renderer/src/url-sanitizer.js";

type Method = "GET" | "POST" | "PUT";

interface Login {
  readonly csrfToken: string;
  readonly user: { readonly email: string; readonly id: string; readonly role: string };
}

interface Article {
  readonly id: string;
}

interface CurrentDocument {
  readonly document: { readonly meta: { readonly textLocked: boolean } };
  readonly documentId: string;
  readonly documentVersion: number;
  readonly schemaVersion: string;
}

interface Theme {
  readonly installed: boolean;
  readonly manifest: {
    readonly defaultPaletteId: string;
    readonly name: string;
    readonly themeId: string;
    readonly version: string;
  };
}

interface RenderOutput {
  readonly canCopy: boolean;
  readonly id: string;
  readonly outputMode: "standard" | "wechat_safe";
  readonly status: string;
}

const scope = required("ACCEPTANCE_SCOPE");
if (scope !== "safari" && scope !== "wechat") {
  throw new Error("ACCEPTANCE_SCOPE 只能是 safari 或 wechat");
}
if (scope === "wechat") {
  const endpoint = process.env.S3_PUBLIC_ENDPOINT?.trim();
  const checked = sanitizeWechatUrl(
    `${endpoint?.replace(/\/$/, "") ?? ""}/acceptance-seed-check.png`,
    "image",
  );
  if (!checked.success) {
    throw new Error(`wechat scope 拒绝 S3_PUBLIC_ENDPOINT：${checked.reason}`);
  }
  throw new Error("wechat scope 的四篇含图种子尚未实现；未写入任何数据");
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少必填环境变量 ${name}`);
  return value;
}

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`缺少必填环境变量 ${name}`);
  }
  return value;
}

function httpUrl(name: string, fallback: string): string {
  const parsed = new URL(process.env[name]?.trim() || fallback);
  if (
    !/^https?:$/.test(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${name} 必须是不含凭据的 HTTP(S) URL`);
  }
  const loopback =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "[::1]";
  if (parsed.protocol === "http:" && !loopback) {
    throw new Error(`${name} 仅允许回环地址使用 HTTP，远程地址必须使用 HTTPS`);
  }
  return parsed.toString().replace(/\/$/, "");
}

const email = required("ACCEPTANCE_OWNER_EMAIL");
const password = requiredSecret("ACCEPTANCE_OWNER_PASSWORD");
const apiBase = httpUrl("ACCEPTANCE_API_BASE_URL", "http://127.0.0.1:3001");
const webBase = httpUrl("ACCEPTANCE_WEB_BASE_URL", "http://127.0.0.1:3000");
const runLabel = `v0.1-safari-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomUUID().slice(0, 8)}`;

class Cookies {
  readonly values = new Map<string, string>();

  capture(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair = "", ...attributes] = header.split(";");
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (!value || attributes.some((item) => /^\s*max-age=0\s*$/i.test(item))) {
        this.values.delete(name);
      } else {
        this.values.set(name, value);
      }
    }
  }

  header(): string {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

const cookies = new Cookies();
let csrf: string | null = null;
let createdArticle: { readonly id: string; readonly title: string } | null = null;

async function request<T>(
  path: string,
  method: Method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`${apiBase}/api/v1${path}`, {
    method,
    redirect: "error",
    headers: {
      ...(cookies.header() ? { cookie: cookies.header() } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { "x-csrf-token": token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  cookies.capture(response);
  const payload: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    typeof payload !== "object" ||
    payload === null ||
    !("success" in payload) ||
    payload.success !== true ||
    !("data" in payload)
  ) {
    throw new Error(`${method} ${path} 返回 ${response.status}`);
  }
  return payload.data as T;
}

async function main(): Promise<void> {
  const bootstrap = await request<{ readonly csrfToken: string }>("/auth/csrf");
  const login = await request<Login>(
    "/auth/login",
    "POST",
    { identifier: email, password, rememberDevice: false },
    bootstrap.csrfToken,
  );
  csrf = login.csrfToken;
  if (login.user.role !== "owner" || login.user.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("ACCEPTANCE_OWNER_EMAIL 必须是 Owner 邮箱");
  }

  const title = `[V0.1验收 ${runLabel}] ${legalArticleFixture.name}`;
  const article = await request<Article>(
    "/articles",
    "POST",
    { title, contentType: "legal", sourceType: "blank", layoutStrength: "standard" },
    csrf,
  );
  createdArticle = { id: article.id, title };
  const current = await request<CurrentDocument>(`/articles/${article.id}/document`);
  const now = new Date().toISOString();
  const fixture = materializeAcceptanceFixture({
    fixture: legalArticleFixture,
    articleId: article.id,
    documentId: current.documentId,
    createdAt: now,
    updatedAt: now,
    resourceIds: {},
  });
  const document = {
    ...fixture,
    meta: { ...fixture.meta, textLocked: current.document.meta.textLocked },
  };
  const saved = await request<{ readonly documentVersion: number }>(
    `/articles/${article.id}/document`,
    "PUT",
    {
      baseVersion: current.documentVersion,
      schemaVersion: current.schemaVersion,
      document,
      lastTransactionId: createUuidV7(),
      transactionOrigin: "v01_acceptance_seed",
    },
    csrf,
  );
  const catalog = await request<{ readonly items: readonly Theme[] }>(
    "/themes?page=1&pageSize=100",
  );
  const themes = catalog.items.filter((theme) => theme.installed).slice(0, 2);
  if (themes.length !== 2) throw new Error("验收需要两套已安装真实主题");
  let version = saved.documentVersion;
  const outputs = [];
  for (const theme of themes) {
    const applied = await request<{ readonly documentVersion: number }>(
      `/articles/${article.id}/themes/${theme.manifest.themeId}/apply`,
      "POST",
      {
        baseDocumentVersion: version,
        themeVersion: theme.manifest.version,
        paletteId: theme.manifest.defaultPaletteId,
        scope: "full",
        brandMode: "soft",
        preserveLockedBlocks: true,
      },
      csrf,
    );
    version = applied.documentVersion;
    for (const mode of ["standard", "wechat_safe"] as const) {
      const render = await request<RenderOutput>(
        `/articles/${article.id}/render-wechat`,
        "POST",
        { documentVersion: version, outputMode: mode },
        csrf,
      );
      if (render.status !== "ready" || !render.canCopy || render.outputMode !== mode) {
        throw new Error(`${theme.manifest.name} / ${mode} 未通过复制门禁`);
      }
      const payload = await request<{ readonly html: string; readonly plainText: string }>(
        `/articles/${article.id}/copy-payload`,
        "POST",
        { renderOutputId: render.id },
        csrf,
      );
      if (!payload.html || !payload.plainText) {
        throw new Error(`${theme.manifest.name} / ${mode} Copy Payload 为空`);
      }
      outputs.push({ theme: theme.manifest.name, mode, renderOutputId: render.id });
    }
  }
  process.stdout.write(
    `${JSON.stringify({ scope, runLabel, articleId: article.id, title, editorUrl: `${webBase}/workspace/articles/${article.id}`, themes: themes.map((theme) => theme.manifest.name), outputs, copyRecordWritten: false, published: false }, null, 2)}\n`,
  );
}

async function run(): Promise<void> {
  try {
    await main();
  } finally {
    if (csrf) {
      await request("/auth/logout", "POST", undefined, csrf).catch(() => {
        process.stderr.write("警告：验收会话退出失败。\n");
      });
    }
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`验收数据准备失败：${message}\n`);
  if (createdArticle !== null) {
    process.stderr.write(
      `已保留便于排查的新验收文章：${createdArticle.title} (${createdArticle.id})\n`,
    );
  }
  process.exitCode = 1;
});
