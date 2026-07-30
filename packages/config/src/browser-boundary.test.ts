import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const sensitiveKeyPattern =
  /DATABASE_URL|REDIS_URL|SESSION_SECRET|CSRF_SECRET|FIELD_ENCRYPTION_KEY|S3_SECRET_ACCESS_KEY/;

async function bundleForBrowser(source: string): Promise<string> {
  const result = await build({
    absWorkingDir: process.cwd(),
    bundle: true,
    charset: "utf8",
    conditions: ["browser"],
    format: "esm",
    platform: "browser",
    stdin: {
      contents: source,
      loader: "js",
      resolveDir: process.cwd(),
    },
    write: false,
  });

  return result.outputFiles[0]?.text ?? "";
}

describe("browser package boundary", () => {
  it("keeps the default entry point free of server configuration", async () => {
    const output = await bundleForBrowser(
      'import { parsePublicEnvironment } from "@wechat-layout/config"; parsePublicEnvironment({});',
    );

    expect(output).not.toMatch(sensitiveKeyPattern);
  });

  it("replaces the server entry point with an explicit browser blocker", async () => {
    const output = await bundleForBrowser('import "@wechat-layout/config/server";');

    expect(output).toContain("只能在服务端使用");
    expect(output).not.toMatch(sensitiveKeyPattern);
  });
});
