import {
  AI_LAYOUT_CANDIDATE_PROFILE_IDS,
  AI_LAYOUT_DESIGN_LANGUAGE_IDS,
  AI_LAYOUT_MODES,
  AI_LAYOUT_PROVIDER_IDS,
  AI_LAYOUT_RHYTHMS,
  AI_LAYOUT_STRUCTURE_STRATEGY_IDS,
  AI_LAYOUT_TEMPLATE_CATALOG_CATEGORY_IDS,
  AI_LAYOUT_TEMPLATE_CONTENT_CLASSES,
  AI_LAYOUT_TEMPLATE_IMAGE_POLICIES,
  AI_LAYOUT_VISUAL_INTENSITIES,
  type AiLayoutCandidateProfileId,
  type AiLayoutDesignLanguageId,
  type AiLayoutMode,
  type AiLayoutProviderId,
  type AiLayoutRhythm,
  type AiLayoutStructureStrategyId,
  type AiLayoutTemplateCatalogCategoryId,
  type AiLayoutTemplateContentClass,
  type AiLayoutTemplateImagePolicy,
  type AiLayoutVisualIntensity,
} from "@wechat-layout/api-contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class GenerateAiLayoutDto {
  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseDocumentVersion!: number;

  @ApiProperty({ enum: AI_LAYOUT_MODES, type: String })
  @IsEnum(AI_LAYOUT_MODES)
  mode!: AiLayoutMode;

  @ApiPropertyOptional({ enum: AI_LAYOUT_DESIGN_LANGUAGE_IDS, type: String })
  @IsOptional()
  @IsEnum(AI_LAYOUT_DESIGN_LANGUAGE_IDS)
  preferredLanguageId?: AiLayoutDesignLanguageId;

  @ApiPropertyOptional({ maxLength: 80, type: String })
  @IsOptional()
  @IsString()
  @Length(3, 80)
  preferredTemplateId?: string;

  @ApiPropertyOptional({ enum: AI_LAYOUT_PROVIDER_IDS, type: String })
  @IsOptional()
  @IsEnum(AI_LAYOUT_PROVIDER_IDS)
  providerId?: AiLayoutProviderId;

  @ApiPropertyOptional({ maxLength: 300, type: String })
  @IsOptional()
  @IsString()
  @Length(3, 300)
  styleBrief?: string;
}

export class AiLayoutModelOptionDto {
  @ApiProperty({ type: Boolean })
  available!: boolean;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ enum: ["deepseek", "qwen", "kimi"], type: String })
  id!: "deepseek" | "qwen" | "kimi";

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  model!: string;
}

export class AiLayoutStatusDto {
  @ApiProperty({ type: Boolean })
  available!: boolean;

  @ApiProperty({ enum: AI_LAYOUT_PROVIDER_IDS, type: String })
  defaultProviderId!: AiLayoutProviderId;

  @ApiProperty({ type: String })
  model!: string;

  @ApiProperty({ isArray: true, type: () => AiLayoutModelOptionDto })
  models!: AiLayoutModelOptionDto[];

  @ApiProperty({ enum: AI_LAYOUT_PROVIDER_IDS, type: String })
  provider!: AiLayoutProviderId;
}

export class GenerateAiLayoutResponseDto extends AiLayoutStatusDto {
  @ApiProperty({ isArray: true, type: () => AiLayoutCandidateResponseDto })
  candidates!: AiLayoutCandidateResponseDto[];

  @ApiProperty({ type: Object })
  decision!: Readonly<Record<string, unknown>>;
}

export class AiLayoutCandidateResponseDto {
  @ApiProperty({ type: String })
  candidateId!: string;

  @ApiProperty({ type: Object })
  decision!: Readonly<Record<string, unknown>>;

  @ApiProperty({ isArray: true, type: String })
  differenceHighlights!: string[];

  @ApiProperty({ enum: AI_LAYOUT_CANDIDATE_PROFILE_IDS, type: String })
  profileId!: AiLayoutCandidateProfileId;

  @ApiProperty({ type: Boolean })
  recommended!: boolean;

  @ApiProperty({ type: String })
  structureFingerprint!: string;

  @ApiProperty({ type: String })
  structureLabel!: string;

  @ApiProperty({ type: String })
  templateId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  templateVersion!: number;
}

export class AiLayoutTemplateSummaryDto {
  @ApiProperty({ enum: AI_LAYOUT_TEMPLATE_CATALOG_CATEGORY_IDS, type: String })
  catalogCategoryId!: AiLayoutTemplateCatalogCategoryId;

  @ApiProperty({ type: String })
  categoryLabel!: string;

  @ApiProperty({ enum: AI_LAYOUT_TEMPLATE_CONTENT_CLASSES, isArray: true })
  contentClasses!: AiLayoutTemplateContentClass[];

  @ApiProperty({ enum: AI_LAYOUT_DESIGN_LANGUAGE_IDS, type: String })
  defaultLanguageId!: AiLayoutDesignLanguageId;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ enum: AI_LAYOUT_TEMPLATE_IMAGE_POLICIES, type: String })
  imagePolicy!: AiLayoutTemplateImagePolicy;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ minimum: 0, type: Number })
  minimumSourceImages!: number;

  @ApiProperty({ enum: AI_LAYOUT_DESIGN_LANGUAGE_IDS, isArray: true })
  preferredLanguageIds!: AiLayoutDesignLanguageId[];

  @ApiProperty({ type: String })
  previewKey!: string;

  @ApiProperty({
    enum: [
      "editorial-index",
      "briefing-cards",
      "evidence-led",
      "minimal-longread",
      "documentary-visual",
      "action-roadmap",
    ],
    type: String,
  })
  profileId!: AiLayoutCandidateProfileId;

  @ApiProperty({ enum: AI_LAYOUT_RHYTHMS, type: String })
  rhythm!: AiLayoutRhythm;

  @ApiProperty({ enum: ["text-first"], type: String })
  sourceImageFallback!: "text-first";

  @ApiProperty({ enum: AI_LAYOUT_STRUCTURE_STRATEGY_IDS, type: String })
  strategyId!: AiLayoutStructureStrategyId;

  @ApiProperty({ type: String })
  structureLabel!: string;

  @ApiProperty({ isArray: true, type: String })
  tags!: string[];

  @ApiProperty({ type: String })
  templateId!: string;

  @ApiProperty({ type: Number })
  version!: number;

  @ApiProperty({ enum: AI_LAYOUT_VISUAL_INTENSITIES, type: String })
  visualIntensity!: AiLayoutVisualIntensity;
}

export class AiLayoutTemplateCatalogResponseDto {
  @ApiProperty({ type: String })
  catalogVersion!: string;

  @ApiProperty({ isArray: true, type: () => AiLayoutTemplateSummaryDto })
  templates!: AiLayoutTemplateSummaryDto[];
}
