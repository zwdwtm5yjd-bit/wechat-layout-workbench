import { Module } from "@nestjs/common";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";

import { DocumentModule } from "../documents/document.module.js";
import {
  AI_LAYOUT_FETCH,
  AI_LAYOUT_OPTIONS,
  type AiLayoutProviderRuntimeOptions,
} from "./ai-layout.constants.js";
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
        const providers: AiLayoutProviderRuntimeOptions[] = [
          {
            apiKey:
              configuration.deepseek.apiKey === null
                ? null
                : revealSecret(configuration.deepseek.apiKey),
            baseUrl: configuration.deepseek.baseUrl,
            id: "deepseek" as const,
            model: configuration.deepseek.model,
            protocol: "chat-completions" as const,
          },
          {
            apiKey:
              configuration.qwen.apiKey === null ? null : revealSecret(configuration.qwen.apiKey),
            baseUrl: configuration.qwen.baseUrl,
            id: "qwen" as const,
            model: configuration.qwen.model,
            protocol: "chat-completions" as const,
          },
          {
            apiKey:
              configuration.kimi.apiKey === null ? null : revealSecret(configuration.kimi.apiKey),
            baseUrl: configuration.kimi.baseUrl,
            id: "kimi" as const,
            model: configuration.kimi.model,
            protocol: "chat-completions" as const,
          },
        ];
        if (
          providers.every((provider) => provider.apiKey === null) &&
          configuration.apiKey !== null
        ) {
          providers[2] = {
            apiKey: revealSecret(configuration.apiKey),
            baseUrl: configuration.baseUrl,
            id: "kimi",
            model: configuration.model,
            protocol: configuration.protocol,
          };
        }
        return {
          defaultProviderId: configuration.defaultProvider,
          providers,
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
