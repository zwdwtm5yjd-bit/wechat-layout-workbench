import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { parseRuntimeEnvironment } from "@wechat-layout/config";

import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const environment = parseRuntimeEnvironment(process.env);
  const application = await NestFactory.create(AppModule);

  await application.listen(environment.API_PORT);
}

void bootstrap();
