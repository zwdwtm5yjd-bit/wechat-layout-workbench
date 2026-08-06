import { Module } from "@nestjs/common";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";

import { DocumentModule } from "../documents/document.module.js";
import { AI_LAYOUT_FETCH, AI_LAYOUT_OPTIONS } from "./ai-layout.constants.js";
import { AiLayoutController } from "./ai-layout.controller.js";
import { AiLayoutService } from "./ai-layout.service.js";

@Module({
  imports: [DocumentModule],
  controllers: [AiLayoutController],
  providers: [
    AiLayoutService,
    {
      provide: AI_LAYOUT_OPTIONS,
      useFactory: () => {
        const configuration = loadServerEnvironment().aiLayout;
        return {
          apiKey: configuration.apiKey === null ? null : revealSecret(configuration.apiKey),
          baseUrl: configuration.baseUrl,
          model: configuration.model,
          timeoutMs: configuration.timeoutMs,
        };
      },
    },
    {
      provide: AI_LAYOUT_FETCH,
      useValue: globalThis.fetch.bind(globalThis),
    },
  ],
})
export class AiLayoutModule {}
