import {
  AI_LAYOUT_DESIGN_LANGUAGE_IDS,
  AI_LAYOUT_MODES,
  AI_LAYOUT_PROVIDER_IDS,
  type AiLayoutDesignLanguageId,
  type AiLayoutMode,
  type AiLayoutProviderId,
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
  @ApiProperty({ type: Object })
  decision!: Readonly<Record<string, unknown>>;
}
