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

export const AI_LAYOUT_RHYTHMS = ["compact", "balanced", "airy"] as const;
export type AiLayoutRhythm = (typeof AI_LAYOUT_RHYTHMS)[number];

export const AI_LAYOUT_VISUAL_INTENSITIES = ["restrained", "balanced", "bold"] as const;
export type AiLayoutVisualIntensity = (typeof AI_LAYOUT_VISUAL_INTENSITIES)[number];

export const AI_LAYOUT_HEADING1_COMPONENT_IDS = [
  "cmp_head_level1_leftbar_001",
  "cmp_head_level1_numbered_002",
  "cmp_head_level1_underlined_003",
  "cmp_head_level1_centered_004",
  "cmp_head_level1_ribbon_005",
  "cmp_head_level1_frame_006",
  "cmp_head_mist_mountains_007",
] as const;

export const AI_LAYOUT_HEADING2_COMPONENT_IDS = [
  "cmp_head_level2_dot_001",
  "cmp_head_level2_leftbar_002",
  "cmp_head_level2_underlined_003",
  "cmp_head_level2_plain_004",
  "cmp_head_level2_pill_005",
  "cmp_head_level2_marker_006",
  "cmp_head_cloud_scroll_008",
] as const;

export const AI_LAYOUT_QUOTE_COMPONENT_IDS = [
  "cmp_quote_standard_leftline_001",
  "cmp_quote_citation_marks_002",
  "cmp_quote_conclusion_card_003",
  "cmp_quote_document_source_004",
  "cmp_quote_postcard_warm_005",
  "cmp_quote_highlight_center_006",
] as const;

export const AI_LAYOUT_NOTICE_COMPONENT_IDS = [
  "cmp_notice_info_blue_001",
  "cmp_notice_success_green_002",
  "cmp_notice_warning_amber_003",
  "cmp_notice_risk_red_004",
  "cmp_notice_checklist_action_005",
  "cmp_notice_story_intro_006",
] as const;

export const AI_LAYOUT_IMAGE_COMPONENT_IDS = [
  "cmp_image_fullwidth_clean_001",
  "cmp_image_rounded_caption_002",
  "cmp_image_border_documentary_003",
  "cmp_image_centered_numbered_004",
  "cmp_image_polaroid_caption_005",
] as const;

export const AI_LAYOUT_DIVIDER_COMPONENT_IDS = [
  "cmp_divider_solid_clean_001",
  "cmp_divider_dashed_subtle_002",
  "cmp_divider_ornament_center_003",
  "cmp_divider_ornament_dots_004",
] as const;

export const AI_LAYOUT_HERO_COMPONENT_IDS = [
  "cmp_hero_ink_mountain_001",
  "cmp_intro_autumn_persimmon_001",
  "cmp_intro_bamboo_note_002",
  "cmp_gov_red_gold_banner_001",
  "cmp_tech_orbit_hero_001",
  "cmp_intro_leaf_story_003",
  "cmp_hero_festival_lantern_002",
] as const;

export const AI_LAYOUT_COMPONENT_IDS = [
  ...AI_LAYOUT_HEADING1_COMPONENT_IDS,
  ...AI_LAYOUT_HEADING2_COMPONENT_IDS,
  ...AI_LAYOUT_QUOTE_COMPONENT_IDS,
  ...AI_LAYOUT_NOTICE_COMPONENT_IDS,
  ...AI_LAYOUT_IMAGE_COMPONENT_IDS,
  ...AI_LAYOUT_DIVIDER_COMPONENT_IDS,
  ...AI_LAYOUT_HERO_COMPONENT_IDS,
] as const;

export type AiLayoutComponentId = (typeof AI_LAYOUT_COMPONENT_IDS)[number];

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
  readonly componentId: AiLayoutComponentId | null;
  readonly reason: string;
  readonly treatment: AiLayoutTreatment;
}

export interface AiLayoutDecision {
  readonly blocks: readonly AiLayoutBlockDecision[];
  readonly concept: string;
  readonly designName: string;
  readonly dividerComponentId: (typeof AI_LAYOUT_DIVIDER_COMPONENT_IDS)[number];
  readonly dividerAfterBlockIds: readonly string[];
  readonly footer: Readonly<{
    componentId: (typeof AI_LAYOUT_NOTICE_COMPONENT_IDS)[number];
    text: string;
    title: string;
  }>;
  readonly hero: Readonly<{
    componentId: (typeof AI_LAYOUT_HERO_COMPONENT_IDS)[number];
    eyebrow: string;
    footer: string;
    title: string;
  }>;
  readonly languageId: AiLayoutDesignLanguageId;
  readonly rhythm: AiLayoutRhythm;
  readonly variantSeed: number;
  readonly visualIntensity: AiLayoutVisualIntensity;
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
