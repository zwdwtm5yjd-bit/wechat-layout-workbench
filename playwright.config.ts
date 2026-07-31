import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  outputDir: "test-results/playwright",
  projects: [
    {
      name: "chromium-1366",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1" ? { channel: "chrome" } : {}),
        viewport: { height: 900, width: 1366 },
      },
    },
    {
      name: "webkit-1920",
      use: {
        ...devices["Desktop Safari"],
        viewport: { height: 1080, width: 1920 },
      },
    },
  ],
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  retries: process.env.CI === undefined ? 0 : 1,
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  workers: 1,
});
