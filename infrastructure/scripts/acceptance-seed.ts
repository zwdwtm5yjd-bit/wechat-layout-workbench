import { randomUUID } from "node:crypto";
import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import process from "node:process";

import { OFFICIAL_THEME_IDS } from "../../packages/design-tokens/src/index.js";
import { createUuidV7 } from "../../packages/database/src/index.js";
import {
  legalArticleFixture,
  materializeAcceptanceFixture,
  type StandardArticleFixture,
} from "../../packages/test-fixtures/src/index.js";
import { sanitizeWechatUrl } from "../../packages/wechat-renderer/src/url-sanitizer.js";
import {
  buildAcceptanceFixturePlans,
  htmlImageSources,
  isPublicIpAddress,
  type AcceptanceFixturePlan,
  type AcceptanceImagePlan,
} from "./acceptance-seed-support.js";

type Method = "GET" | "POST" | "PUT";
type Scope = "safari" | "wechat";

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
  readonly snapshotId: string;
  readonly status: string;
}

interface Resource {
  readonly id: string;
  readonly mimeType: string;
  readonly sha256: string;
  readonly status: string;
}

interface ResourceUploadResult {
  readonly expiresAt: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly resource: Resource | null;
  readonly status: "deduplicated" | "upload_required";
  readonly uploadId: string | null;
  readonly uploadUrl: string | null;
}

interface ResourceRunState {
  readonly blockId: string;
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly fixtureId: StandardArticleFixture["id"];
  readonly placeholderResourceId: string;
  readonly sha256: string;
  resourceId?: string;
  state: "completed" | "deduplicated" | "planned" | "session_created" | "uploaded";
  uploadId?: string;
}

interface ArticleRunState {
  readonly fixtureId: StandardArticleFixture["id"];
  readonly id: string;
  readonly title: string;
  documentVersion?: number;
  outputs: Array<{
    readonly imageCount: number;
    readonly mode: "standard" | "wechat_safe";
    readonly renderOutputId: string;
    readonly snapshotId: string;
    readonly theme: string;
  }>;
  state: "created" | "document_saved" | "ready" | "rendering";
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

const requestedScope = required("ACCEPTANCE_SCOPE");
if (requestedScope !== "safari" && requestedScope !== "wechat") {
  throw new Error("ACCEPTANCE_SCOPE 只能是 safari 或 wechat");
}
const scope: Scope = requestedScope;
const apiBase = httpUrl("ACCEPTANCE_API_BASE_URL", "http://127.0.0.1:3001");
const webBase = httpUrl("ACCEPTANCE_WEB_BASE_URL", "http://127.0.0.1:3000");
const runLabel = `v0.1-${scope}-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomUUID().slice(0, 8)}`;

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
let wechatPublicStorageEndpoint: URL | null = null;
const verifiedWechatStorageObjects = new Set<string>();
const articleStates: ArticleRunState[] = [];
const resourceStates: ResourceRunState[] = [];
let themeApplications = 0;

async function request<T>(
  path: string,
  method: Method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`${apiBase}/api/v1${path}`, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
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
    throw new Error(`${method} ${path} 返回 ${String(response.status)}`);
  }
  return payload.data as T;
}

function storageEndpointContains(endpoint: URL, value: URL): boolean {
  const basePath = endpoint.pathname.replace(/\/+$/, "");
  return value.origin === endpoint.origin && value.pathname.startsWith(`${basePath}/`);
}

function requireWechatStorageUrl(value: string, context: string): string {
  const checked = sanitizeWechatUrl(value, "image");
  if (!checked.success) {
    throw new Error(`${context} 不是可发布图片地址：${checked.reason}`);
  }
  if (
    wechatPublicStorageEndpoint === null ||
    !storageEndpointContains(wechatPublicStorageEndpoint, new URL(checked.normalized))
  ) {
    throw new Error(`${context} 与本次 S3_PUBLIC_ENDPOINT 不一致，请同步 API 配置并重启服务`);
  }
  return checked.normalized;
}

async function verifyWechatImageAccessible(value: string, context: string): Promise<void> {
  const normalized = requireWechatStorageUrl(value, context);
  const parsed = new URL(normalized);
  const objectKey = `${parsed.origin}${parsed.pathname}`;
  if (verifiedWechatStorageObjects.has(objectKey)) {
    return;
  }
  let response: Response;
  try {
    response = await fetch(normalized, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`${context} 无法从当前执行机读取`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`${context} 读取失败或未返回图片内容（${String(response.status)}）`);
  }
  verifiedWechatStorageObjects.add(objectKey);
}

async function preflightWechatPublicStorage(): Promise<URL> {
  const endpoint = new URL(required("S3_PUBLIC_ENDPOINT"));
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("wechat scope 的 S3_PUBLIC_ENDPOINT 不能包含凭据、查询参数或片段");
  }
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, "");
  const endpointText = endpoint.toString().replace(/\/$/, "");
  const checked = sanitizeWechatUrl(`${endpointText}/acceptance-seed-check.png`, "image");
  if (!checked.success) {
    throw new Error(`wechat scope 拒绝 S3_PUBLIC_ENDPOINT：${checked.reason}`);
  }
  const parsed = new URL(checked.normalized);
  let addresses: LookupAddress[];
  try {
    addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("wechat scope 无法解析 S3_PUBLIC_ENDPOINT 的公网域名");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error("wechat scope 拒绝解析到回环、私网或链路本地地址的 S3_PUBLIC_ENDPOINT");
  }
  let response: Response;
  try {
    response = await fetch(`${endpointText}/`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("wechat scope 无法从当前执行机访问 S3_PUBLIC_ENDPOINT");
  }
  await response.body?.cancel().catch(() => undefined);
  if (response.status >= 500) {
    throw new Error(`wechat scope 的 S3_PUBLIC_ENDPOINT 健康探测返回 ${String(response.status)}`);
  }
  return endpoint;
}

async function loginOwner(): Promise<void> {
  const email = required("ACCEPTANCE_OWNER_EMAIL");
  const password = requiredSecret("ACCEPTANCE_OWNER_PASSWORD");
  const bootstrap = await request<{ readonly csrfToken: string }>("/auth/csrf");
  const login = await request<Login>(
    "/auth/login",
    "POST",
    { identifier: email, password, rememberDevice: false },
    bootstrap.csrfToken,
  );
  csrf = login.csrfToken;
  if (login.user.role !== "owner" || login.user.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("ACCEPTANCE_OWNER_EMAIL 必须是 active Owner 邮箱");
  }
}

async function installedThemes(): Promise<readonly Theme[]> {
  const catalog = await request<{ readonly items: readonly Theme[] }>(
    "/themes?page=1&pageSize=100",
  );
  const byId = new Map(
    catalog.items
      .filter(({ installed }) => installed)
      .map((theme) => [theme.manifest.themeId, theme]),
  );
  const themes = [
    byId.get(OFFICIAL_THEME_IDS.editorialMinimal),
    byId.get(OFFICIAL_THEME_IDS.modernCivic),
  ];
  if (themes.some((theme) => theme === undefined)) {
    throw new Error("验收需要高级极简与现代政务红两套已安装官方主题");
  }
  return themes as readonly Theme[];
}

function uploadState(
  plan: AcceptanceImagePlan,
  fixtureId: StandardArticleFixture["id"],
): ResourceRunState {
  return {
    blockId: plan.blockId,
    bytes: plan.bytes,
    filename: plan.filename,
    fixtureId,
    placeholderResourceId: plan.placeholderResourceId,
    sha256: plan.sha256,
    state: "planned",
  };
}

async function uploadResource(state: ResourceRunState): Promise<void> {
  if (csrf === null) throw new Error("资源上传前缺少登录会话");
  const session = await request<ResourceUploadResult>(
    "/resources/uploads",
    "POST",
    {
      filename: state.filename,
      mimeType: "image/png",
      fileSize: state.bytes.byteLength,
      sha256: state.sha256,
    },
    csrf,
  );
  if (session.status === "deduplicated") {
    if (
      session.resource === null ||
      session.resource.status !== "active" ||
      session.resource.mimeType !== "image/png" ||
      session.resource.sha256 !== state.sha256
    ) {
      throw new Error(`${state.fixtureId}/${state.blockId} 去重结果缺少 active Resource`);
    }
    state.resourceId = session.resource.id;
    state.state = "deduplicated";
    return;
  }
  if (session.uploadId === null || session.uploadUrl === null) {
    throw new Error(`${state.fixtureId}/${state.blockId} 上传会话不完整`);
  }
  requireWechatStorageUrl(session.uploadUrl, `${state.fixtureId}/${state.blockId} 上传 URL`);
  state.uploadId = session.uploadId;
  state.state = "session_created";
  let uploaded: Response;
  try {
    uploaded = await fetch(session.uploadUrl, {
      method: "PUT",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
      headers: { ...session.headers },
      body: Buffer.from(state.bytes),
    });
  } catch {
    throw new Error(`${state.fixtureId}/${state.blockId} 对象直传失败`);
  }
  if (uploaded.status < 200 || uploaded.status >= 300) {
    throw new Error(`${state.fixtureId}/${state.blockId} 对象直传返回 ${String(uploaded.status)}`);
  }
  const etag = uploaded.headers.get("etag");
  await uploaded.body?.cancel().catch(() => undefined);
  if (!etag) {
    throw new Error(`${state.fixtureId}/${state.blockId} 对象直传未返回 ETag`);
  }
  state.state = "uploaded";
  const resource = await request<Resource>(
    `/resources/uploads/${session.uploadId}/complete`,
    "POST",
    { etag },
    csrf,
  );
  if (
    resource.status !== "active" ||
    resource.mimeType !== "image/png" ||
    resource.sha256 !== state.sha256
  ) {
    throw new Error(`${state.fixtureId}/${state.blockId} 完成后的 Resource 元数据不一致`);
  }
  state.resourceId = resource.id;
  state.state = "completed";
}

async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  let firstError: unknown;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (firstError === undefined) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      try {
        await worker(item);
      } catch (error) {
        firstError = error;
      }
    }
  });
  await Promise.all(workers);
  if (firstError !== undefined) throw firstError;
}

async function createAndRenderArticle(
  fixture: StandardArticleFixture,
  resourceIds: Readonly<Record<string, string>>,
  themes: readonly Theme[],
  expectedImages: number,
): Promise<ArticleRunState> {
  if (csrf === null) throw new Error("文章创建前缺少登录会话");
  const title = `[V0.1验收 ${runLabel}] ${fixture.name}`;
  const article = await request<Article>(
    "/articles",
    "POST",
    {
      title,
      contentType: fixture.id,
      sourceType: "blank",
      layoutStrength: "standard",
    },
    csrf,
  );
  const state: ArticleRunState = {
    fixtureId: fixture.id,
    id: article.id,
    title,
    outputs: [],
    state: "created",
  };
  articleStates.push(state);
  const current = await request<CurrentDocument>(`/articles/${article.id}/document`);
  const now = new Date().toISOString();
  const fixtureDocument = materializeAcceptanceFixture({
    fixture,
    articleId: article.id,
    documentId: current.documentId,
    createdAt: now,
    updatedAt: now,
    resourceIds,
  });
  const document = {
    ...fixtureDocument,
    meta: { ...fixtureDocument.meta, textLocked: current.document.meta.textLocked },
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
  state.documentVersion = saved.documentVersion;
  state.state = "document_saved";
  let version = saved.documentVersion;
  for (const theme of themes) {
    state.state = "rendering";
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
    themeApplications += 1;
    state.documentVersion = version;
    for (const mode of ["standard", "wechat_safe"] as const) {
      const render = await request<RenderOutput>(
        `/articles/${article.id}/render-wechat`,
        "POST",
        { documentVersion: version, outputMode: mode },
        csrf,
      );
      if (render.status !== "ready" || !render.canCopy || render.outputMode !== mode) {
        throw new Error(`${fixture.id} / ${theme.manifest.name} / ${mode} 未通过复制门禁`);
      }
      const payload = await request<{ readonly html: string; readonly plainText: string }>(
        `/articles/${article.id}/copy-payload`,
        "POST",
        { renderOutputId: render.id },
        csrf,
      );
      if (!payload.html.trim() || !payload.plainText.trim()) {
        throw new Error(`${fixture.id} / ${theme.manifest.name} / ${mode} Copy Payload 为空`);
      }
      const imageSources = htmlImageSources(payload.html);
      if (imageSources.length !== expectedImages) {
        throw new Error(
          `${fixture.id} / ${theme.manifest.name} / ${mode} 应渲染 ${String(expectedImages)} 张图片，实际为 ${String(imageSources.length)}`,
        );
      }
      for (const source of imageSources) {
        await verifyWechatImageAccessible(
          source,
          `${fixture.id} / ${theme.manifest.name} / ${mode} Copy Payload 图片`,
        );
      }
      state.outputs.push({
        imageCount: imageSources.length,
        mode,
        renderOutputId: render.id,
        snapshotId: render.snapshotId,
        theme: theme.manifest.name,
      });
    }
  }
  state.state = "ready";
  return state;
}

function resourceMap(plan: AcceptanceFixturePlan): Readonly<Record<string, string>> {
  const matching = resourceStates.filter(({ fixtureId }) => fixtureId === plan.fixture.id);
  const entries = matching.map((state) => {
    if (state.resourceId === undefined) {
      throw new Error(`${state.fixtureId}/${state.blockId} 尚未完成资源登记`);
    }
    return [state.placeholderResourceId, state.resourceId] as const;
  });
  if (new Map(entries).size !== plan.images.length) {
    throw new Error(`${plan.fixture.id} 的 Fixture Resource 映射发生碰撞`);
  }
  return Object.fromEntries(entries);
}

async function runSafari(themes: readonly Theme[]): Promise<void> {
  const article = await createAndRenderArticle(legalArticleFixture, {}, themes, 0);
  process.stdout.write(
    `${JSON.stringify(
      {
        scope,
        runLabel,
        articleId: article.id,
        title: article.title,
        editorUrl: `${webBase}/workspace/articles/${article.id}`,
        themes: themes.map((theme) => theme.manifest.name),
        outputs: article.outputs,
        copyRecordWritten: false,
        published: false,
      },
      null,
      2,
    )}\n`,
  );
}

async function runWechat(plans: readonly AcceptanceFixturePlan[], themes: readonly Theme[]) {
  plans.forEach((plan) => {
    plan.images.forEach((image) => resourceStates.push(uploadState(image, plan.fixture.id)));
  });
  await runPool(resourceStates, 4, uploadResource);
  for (const plan of plans) {
    await createAndRenderArticle(plan.fixture, resourceMap(plan), themes, plan.images.length);
  }
  const completed = resourceStates.filter(({ state }) => state === "completed").length;
  const deduplicated = resourceStates.filter(({ state }) => state === "deduplicated").length;
  const renderOutputs = articleStates.reduce((total, article) => total + article.outputs.length, 0);
  if (
    resourceStates.length !== 52 ||
    articleStates.length !== 4 ||
    themeApplications !== 8 ||
    renderOutputs !== 16
  ) {
    throw new Error(
      `验收副作用计数应为资源/文章/主题应用/输出=52/4/8/16，实际为 ${String(resourceStates.length)}/${String(articleStates.length)}/${String(themeApplications)}/${String(renderOutputs)}`,
    );
  }
  if (verifiedWechatStorageObjects.size !== 52) {
    throw new Error(
      `实际公网图片对象应验证 52 个，实际为 ${String(verifiedWechatStorageObjects.size)} 个`,
    );
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        scope,
        runLabel,
        publicEndpointVerified: true,
        publicImageObjectsVerified: verifiedWechatStorageObjects.size,
        fixtures: plans.map(({ fixture, images }) => ({
          fixtureId: fixture.id,
          imageCount: images.length,
        })),
        resources: { total: resourceStates.length, uploaded: completed, deduplicated },
        articles: articleStates.map((article) => ({
          fixtureId: article.fixtureId,
          articleId: article.id,
          title: article.title,
          editorUrl: `${webBase}/workspace/articles/${article.id}`,
          documentVersion: article.documentVersion,
          outputs: article.outputs,
        })),
        themeApplications,
        renderOutputs,
        copyRecordWritten: false,
        published: false,
      },
      null,
      2,
    )}\n`,
  );
}

async function main(): Promise<void> {
  const plans = scope === "wechat" ? buildAcceptanceFixturePlans() : [];
  if (scope === "wechat") {
    wechatPublicStorageEndpoint = await preflightWechatPublicStorage();
  }
  await loginOwner();
  const themes = await installedThemes();
  if (scope === "safari") {
    await runSafari(themes);
  } else {
    await runWechat(plans, themes);
  }
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
  if (articleStates.length > 0 || resourceStates.length > 0) {
    process.stderr.write(
      `${JSON.stringify(
        {
          runLabel,
          scope,
          resources: resourceStates.map((resource) => ({
            blockId: resource.blockId,
            filename: resource.filename,
            fixtureId: resource.fixtureId,
            placeholderResourceId: resource.placeholderResourceId,
            sha256: resource.sha256,
            resourceId: resource.resourceId,
            state: resource.state,
            uploadId: resource.uploadId,
          })),
          articles: articleStates,
        },
        null,
        2,
      )}\n`,
    );
  }
  process.exitCode = 1;
});
