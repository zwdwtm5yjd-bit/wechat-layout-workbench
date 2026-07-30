import { loadServerEnvironment } from "@wechat-layout/config/server";

try {
  const configuration = loadServerEnvironment();

  process.stdout.write(
    `Scheduler skeleton ready (${configuration.application.environment}, interval=${configuration.application.schedulerIntervalSeconds}s).\n`,
  );
  setInterval(() => undefined, 60_000);
} catch (error) {
  const message = error instanceof Error ? error.message : "未知启动错误";
  process.stderr.write(`Scheduler 启动失败：${message}\n`);
  process.exitCode = 1;
}
