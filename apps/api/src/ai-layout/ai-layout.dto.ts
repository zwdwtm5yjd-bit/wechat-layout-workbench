import {
  AI_LAYOUT_DESIGN_LANGUAGE_IDS,
  AI_LAYOUT_MODES,
  type AiLayoutDesignLanguageId,
  type AiLayoutMode,
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

  @ApiPropertyOptional({ maxLength: 300, type: String })
  @IsOptional()
  @IsString()
  @Length(3, 300)
  styleBrief?: string;
}

export class AiLayoutStatusDto {
  @ApiProperty({ type: Boolean })
  available!: boolean;

  @ApiProperty({ type: String })
  model!: string;

  @ApiProperty({ enum: ["openai-compatible"], type: String })
  provider!: "openai-compatible";
}

export class GenerateAiLayoutResponseDto extends AiLayoutStatusDto {
  @ApiProperty({ type: Object })
  decision!: Readonly<Record<string, unknown>>;
}
