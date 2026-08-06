export const AI_LAYOUT_DESIGN_LANGUAGE_IDS = [
  "minimal-blue",
  "warm-paper",
  "night-cyan",
  "forest-green",
  "crimson-editorial",
  "ink-gold",
] as const;

export type AiLayoutDesignLanguageId = (typeof AI_LAYOUT_DESIGN_LANGUAGE_IDS)[number];

export const AI_LAYOUT_MODES = ["described", "original"] as const;
export type AiLayoutMode = (typeof AI_LAYOUT_MODES)[number];

export const AI_LAYOUT_TREATMENTS = [
  "title",
  "section",
  "lead",
  "body",
  "quote",
  "data",
  "callout",
  "image",
  "list",
] as const;

export type AiLayoutTreatment = (typeof AI_LAYOUT_TREATMENTS)[number];

export interface AiLayoutBlockDecision {
  readonly blockId: string;
  readonly reason: string;
  readonly treatment: AiLayoutTreatment;
}

export interface AiLayoutDecision {
  readonly blocks: readonly AiLayoutBlockDecision[];
  readonly concept: string;
  readonly designName: string;
  readonly dividerAfterBlockIds: readonly string[];
  readonly footer: Readonly<{
    text: string;
    title: string;
  }>;
  readonly hero: Readonly<{
    eyebrow: string;
    footer: string;
    title: string;
  }>;
  readonly languageId: AiLayoutDesignLanguageId;
}

export interface AiLayoutStatus {
  readonly available: boolean;
  readonly model: string;
  readonly provider: "kimi-code" | "openai-compatible";
}

export interface GenerateAiLayoutInput {
  readonly baseDocumentVersion: number;
  readonly mode: AiLayoutMode;
  readonly preferredLanguageId?: AiLayoutDesignLanguageId;
  readonly styleBrief?: string;
}

export interface GenerateAiLayoutResult extends AiLayoutStatus {
  readonly decision: AiLayoutDecision;
}
