import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { type E2eOwnerMetadata, ownerMetadataPath } from "./compose";

const ownerPassword = "correct-password-secret-marker";

async function login(page: Page): Promise<void> {
  const metadata = JSON.parse(readFileSync(ownerMetadataPath, "utf8")) as E2eOwnerMetadata;
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("邮箱或用户名").fill(metadata.email);
  await page.locator("#password").fill(ownerPassword);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("button", { name: "打开用户菜单" })).toContainText(metadata.email);
}

test.describe("anonymous boundary", () => {
  test("redirects protected pages and keeps authentication errors explicit", async ({ page }) => {
    await page.goto("/workspace", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login\?next=%2Fworkspace$/);
    await expect(page.getByRole("heading", { name: "登录你的工作台" })).toBeVisible();

    await page.getByLabel("邮箱或用户名").fill("missing@example.invalid");
    await page.locator("#password").fill("not-a-real-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();

    await expect(page.locator('p[role="alert"]')).toContainText(
      /账号或密码不正确|登录尝试过于频繁/,
    );
  });
});

test("completes the authenticated create, autosave, preview, and copy-gate flow", async ({
  page,
}, testInfo) => {
  const title = `Playwright 基线文章 · ${testInfo.project.name}`;

  await login(page);
  await expect(page.getByRole("heading", { name: "欢迎回来，继续完成今天的排版" })).toBeVisible();

  await page.getByRole("link", { name: "文章", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/articles$/);
  await page.getByRole("button", { name: "新建空白文章" }).click();
  await page.getByLabel("文章标题").fill(title);
  await page.getByRole("button", { name: "创建文章" }).click();
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();

  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "文章编辑画布" })).toBeVisible();
  await expect(page.locator("summary").filter({ hasText: "已保存" })).toBeVisible();

  await page.getByRole("tab", { name: "组件" }).click();
  await page.getByRole("button", { name: /留白分割/ }).click();
  await expect(page.locator("summary").filter({ hasText: "已保存" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /^预览/ }).click();
  await expect(page).toHaveURL(/\/workspace\/articles\/[^/]+\/preview$/);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "手机预览" }).click();
  await expect(page.getByRole("button", { name: "手机预览" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const pageWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);

  await page.getByRole("link", { name: "返回编辑器" }).click();
  if (testInfo.project.name.startsWith("chromium")) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:3000",
    });
  }
  await page.getByRole("button", { name: "一键复制" }).click();
  const copyDialog = page.getByRole("dialog");
  await expect(copyDialog).toBeVisible();
  await copyDialog.getByRole("button", { name: "生成正式内容" }).click();
  await expect(copyDialog.getByRole("status")).toContainText(
    "正式内容已生成。请再次点击“写入剪贴板”完成复制。",
  );
  await expect(copyDialog.getByText("100/100", { exact: true })).toBeVisible();
  await copyDialog.getByRole("button", { name: "写入剪贴板" }).click();
  if (testInfo.project.name.startsWith("chromium")) {
    await expect(copyDialog.getByRole("status")).toContainText("内容已写入剪贴板");
  } else {
    await expect(copyDialog.getByRole("status")).toContainText(
      /内容已写入剪贴板|请使用下方手动复制/,
    );
  }
});
