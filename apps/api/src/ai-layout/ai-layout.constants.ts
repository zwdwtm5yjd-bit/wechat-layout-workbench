import type { AiLayoutConcreteProviderId, AiLayoutProviderId } from "@wechat-layout/api-contracts";

export const AI_LAYOUT_OPTIONS = Symbol("AI_LAYOUT_OPTIONS");
export const AI_LAYOUT_FETCH = Symbol("AI_LAYOUT_FETCH");

export interface AiLayoutProviderRuntimeOptions {
  readonly apiKey: string | null;
  readonly baseUrl: string;
  readonly id: AiLayoutConcreteProviderId;
  readonly model: string;
  readonly protocol: "chat-completions" | "responses";
}

export interface AiLayoutRuntimeOptions {
  readonly defaultProviderId: AiLayoutProviderId;
  readonly providers: readonly AiLayoutProviderRuntimeOptions[];
  readonly timeoutMs: number;
}
