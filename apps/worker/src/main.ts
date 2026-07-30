import { loadServerEnvironment } from "@wechat-layout/config/server";

try {
  const configuration = loadServerEnvironment();

  process.stdout.write(
    `Worker skeleton ready (${configuration.application.environment}, concurrency=${configuration.application.workerConcurrency}).\n`,
  );
  setInterval(() => undefined, 60_000);
} catch (error) {
  const message = error instanceof Error ? error.message : "未知启动错误";
  process.stderr.write(`Worker 启动失败：${message}\n`);
  process.exitCode = 1;
}
