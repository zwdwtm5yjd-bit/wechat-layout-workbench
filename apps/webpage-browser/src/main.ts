import { createBrowserRenderer } from "./renderer.js";
import { createBrowserHttpServer } from "./server.js";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("浏览器服务数值配置无效");
  return parsed;
}

async function bootstrap(): Promise<void> {
  const port = positiveInteger(process.env.PORT, 3010);
  const renderer = await createBrowserRenderer({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
    timeoutMs: positiveInteger(process.env.WEBPAGE_BROWSER_TIMEOUT_MS, 30_000),
    maximumHtmlBytes: positiveInteger(process.env.MAX_WEBPAGE_HTML_BYTES, 5 * 1024 * 1024),
  });
  const server = createBrowserHttpServer({ renderer, maximumConcurrency: 2 });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
  let closing = false;
  const close = async (signal: string) => {
    if (closing) return;
    closing = true;
    process.stdout.write(`Webpage browser 收到 ${signal}，正在退出。\n`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await renderer.close();
  };
  process.once("SIGINT", () => void close("SIGINT"));
  process.once("SIGTERM", () => void close("SIGTERM"));
  process.stdout.write(`Webpage browser ready (port=${String(port)}).\n`);
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `Webpage browser 启动失败：${error instanceof Error ? error.message : "未知错误"}\n`,
  );
  process.exitCode = 1;
});
