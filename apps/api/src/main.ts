import "reflect-metadata";
import "./instrumentation.js";

import { NestFactory } from "@nestjs/core";
import { loadServerEnvironment } from "@wechat-layout/config/server";

import { configureApplication } from "./configure-application.js";
import { RuntimeModule } from "./runtime.module.js";

async function bootstrap(): Promise<void> {
  const configuration = loadServerEnvironment();
  const application = await NestFactory.create(RuntimeModule);

  configureApplication(
    application,
    configuration.application.environment,
    configuration.application.publicWebUrl,
  );
  application.enableShutdownHooks();
  await application.listen(configuration.application.apiPort);
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知启动错误";
  process.stderr.write(`API 启动失败：${message}\n`);
  process.exitCode = 1;
});
