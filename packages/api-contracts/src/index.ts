export const AI_LAYOUT_DESIGN_LANGUAGE_IDS = [
  "minimal-blue",
  "warm-paper",
  "night-cyan",
  "forest-green",
  "crimson-editorial",
  "ink-gold",
  "civic-blue",
  "news-editorial",
  "annual-report",
  "data-dashboard",
  "monochrome-finance",
  "future-purple",
  "cyber-neon",
  "jade-oriental",
  "seasonal-poetry",
  "academic-journal",
  "playful-notebook",
  "event-poster",
] as const;

export type AiLayoutDesignLanguageId = (typeof AI_LAYOUT_DESIGN_LANGUAGE_IDS)[number];

export const AI_LAYOUT_MODES = ["described", "original"] as const;
export type AiLayoutMode = (typeof AI_LAYOUT_MODES)[number];

export const AI_LAYOUT_PROVIDER_IDS = ["auto", "deepseek", "qwen", "kimi"] as const;
export type AiLayoutProviderId = (typeof AI_LAYOUT_PROVIDER_IDS)[number];
export type AiLayoutConcreteProviderId = Exclude<AiLayoutProviderId, "auto">;

export const AI_LAYOUT_RHYTHMS = ["compact", "balanced", "airy"] as const;
export type AiLayoutRhythm = (typeof AI_LAYOUT_RHYTHMS)[number];

export const AI_LAYOUT_VISUAL_INTENSITIES = ["restrained", "balanced", "bold"] as const;
export type AiLayoutVisualIntensity = (typeof AI_LAYOUT_VISUAL_INTENSITIES)[number];

export const AI_LAYOUT_TITLE_ALIGNS = ["left", "center"] as const;
export type AiLayoutTitleAlign = (typeof AI_LAYOUT_TITLE_ALIGNS)[number];

export interface AiLayoutDesignTokens {
  readonly accentColor: string;
  readonly bodyFontSize: number;
  readonly bodyLineHeight: number;
  readonly cardRadius: number;
  readonly mutedColor: string;
  readonly primaryColor: string;
  readonly sectionSpacing: number;
  readonly surfaceAltColor: string;
  readonly surfaceColor: string;
  readonly textColor: string;
  readonly titleAlign: AiLayoutTitleAlign;
}

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

export interface AiLayoutVisualAssetDecision {
  readonly afterBlockId: string;
  readonly reason: string;
  readonly resourceId: string;
}

export const AI_LAYOUT_IMAGE_PLACEMENT_MODES = ["keep-original", "after-text"] as const;
export type AiLayoutImagePlacementMode = (typeof AI_LAYOUT_IMAGE_PLACEMENT_MODES)[number];

/**
 * A safe placement instruction for an image that already exists in the source article.
 * `afterBlockId` is null when the image must remain at its original location.
 */
export interface AiLayoutImagePlacementDecision {
  readonly afterBlockId: string | null;
  readonly imageBlockId: string;
  readonly mode: AiLayoutImagePlacementMode;
  readonly reason: string;
  readonly resourceId: string;
}

export interface AiLayoutDecision {
  readonly blocks: readonly AiLayoutBlockDecision[];
  readonly concept: string;
  readonly designTokens: AiLayoutDesignTokens;
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
  /** Optional for backward compatibility with AI decisions created before image direction. */
  readonly imagePlacements?: readonly AiLayoutImagePlacementDecision[];
  readonly languageId: AiLayoutDesignLanguageId;
  readonly rhythm: AiLayoutRhythm;
  readonly variantSeed: number;
  readonly visualAssets: readonly AiLayoutVisualAssetDecision[];
  readonly visualIntensity: AiLayoutVisualIntensity;
}

export const AI_LAYOUT_CANDIDATE_PROFILE_IDS = [
  "editorial-index",
  "briefing-cards",
  "evidence-led",
  "minimal-longread",
  "documentary-visual",
  "action-roadmap",
] as const;

export type AiLayoutCandidateProfileId = (typeof AI_LAYOUT_CANDIDATE_PROFILE_IDS)[number];

/**
 * Stable catalog identifier. The server validates IDs against the active catalog so new
 * templates can be published without expanding a client-side string-literal union.
 */
export type AiLayoutTemplateId = string;

export const AI_LAYOUT_TEMPLATE_CONTENT_CLASSES = [
  "government",
  "technical",
  "data",
  "narrative",
] as const;

export type AiLayoutTemplateContentClass = (typeof AI_LAYOUT_TEMPLATE_CONTENT_CLASSES)[number];

export const AI_LAYOUT_TEMPLATE_IMAGE_POLICIES = [
  "source-priority",
  "optional",
  "text-first",
] as const;

export type AiLayoutTemplateImagePolicy = (typeof AI_LAYOUT_TEMPLATE_IMAGE_POLICIES)[number];

export const AI_LAYOUT_TEMPLATE_CATALOG_CATEGORY_IDS = [
  "official-report",
  "data-business",
  "knowledge-guide",
  "story-people",
  "brand-event",
] as const;

export type AiLayoutTemplateCatalogCategoryId =
  (typeof AI_LAYOUT_TEMPLATE_CATALOG_CATEGORY_IDS)[number];

export const AI_LAYOUT_STRUCTURE_STRATEGY_IDS = [
  "editorial-index",
  "briefing-cards",
  "evidence-led",
  "minimal-longread",
  "documentary-visual",
  "action-roadmap",
  "timeline-milestones",
  "quote-led",
  "chapter-magazine",
  "checklist-guide",
] as const;

export type AiLayoutStructureStrategyId = (typeof AI_LAYOUT_STRUCTURE_STRATEGY_IDS)[number];

export interface AiLayoutTemplateSummary {
  readonly catalogCategoryId: AiLayoutTemplateCatalogCategoryId;
  readonly categoryLabel: string;
  readonly contentClasses: readonly AiLayoutTemplateContentClass[];
  readonly defaultLanguageId: AiLayoutDesignLanguageId;
  readonly description: string;
  readonly imagePolicy: AiLayoutTemplateImagePolicy;
  readonly minimumSourceImages: number;
  readonly name: string;
  readonly preferredLanguageIds: readonly AiLayoutDesignLanguageId[];
  readonly previewKey: string;
  readonly profileId: AiLayoutCandidateProfileId;
  readonly rhythm: AiLayoutRhythm;
  readonly sourceImageFallback: "text-first";
  readonly strategyId: AiLayoutStructureStrategyId;
  readonly structureLabel: string;
  readonly tags: readonly string[];
  readonly templateId: AiLayoutTemplateId;
  readonly version: number;
  readonly visualIntensity: AiLayoutVisualIntensity;
}

export interface AiLayoutTemplateCatalogResult {
  readonly catalogVersion: string;
  readonly templates: readonly AiLayoutTemplateSummary[];
}

export interface AiLayoutCandidate {
  readonly candidateId: string;
  readonly decision: AiLayoutDecision;
  readonly differenceHighlights: readonly string[];
  readonly profileId: AiLayoutCandidateProfileId;
  readonly recommended: boolean;
  /** Optional while older stored/generated candidates remain readable. */
  readonly structureFingerprint?: string;
  readonly structureLabel: string;
  /** Optional while older stored/generated candidates remain readable. */
  readonly templateId?: AiLayoutTemplateId;
  /** Optional while older stored/generated candidates remain readable. */
  readonly templateVersion?: number;
}

export interface AiLayoutStatus {
  readonly available: boolean;
  readonly defaultProviderId: AiLayoutProviderId;
  readonly model: string;
  readonly models: readonly Readonly<{
    available: boolean;
    description: string;
    id: AiLayoutConcreteProviderId;
    label: string;
    model: string;
  }>[];
  readonly provider: AiLayoutProviderId;
}

export interface GenerateAiLayoutInput {
  readonly baseDocumentVersion: number;
  readonly mode: AiLayoutMode;
  readonly preferredLanguageId?: AiLayoutDesignLanguageId;
  readonly preferredTemplateId?: AiLayoutTemplateId;
  readonly providerId?: AiLayoutProviderId;
  readonly styleBrief?: string;
}

export interface GenerateAiLayoutResult extends AiLayoutStatus {
  /** Backward-compatible default candidate. Prefer `candidates` in new clients. */
  readonly decision: AiLayoutDecision;
  readonly candidates: readonly AiLayoutCandidate[];
}
