import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { loadServerEnvironment } from "@wechat-layout/config/server";

import { AppModule } from "./app.module.js";
import { configureApplication } from "./configure-application.js";

async function bootstrap(): Promise<void> {
  const configuration = loadServerEnvironment();
  const application = await NestFactory.create(AppModule);

  configureApplication(application, configuration.application.environment);
  application.enableShutdownHooks();
  await application.listen(configuration.application.apiPort);
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "未知启动错误";
  process.stderr.write(`API 启动失败：${message}\n`);
  process.exitCode = 1;
});
