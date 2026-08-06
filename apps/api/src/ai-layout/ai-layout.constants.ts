export const AI_LAYOUT_OPTIONS = Symbol("AI_LAYOUT_OPTIONS");
export const AI_LAYOUT_FETCH = Symbol("AI_LAYOUT_FETCH");

export interface AiLayoutRuntimeOptions {
  readonly apiKey: string | null;
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs: number;
}
