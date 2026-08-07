import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DOCUMENT_SCHEMA_VERSION } from "@wechat-layout/document-schema";

import { ApiMetaOpenApiModel } from "../common/http/openapi-models.js";

export class SaveDocumentAppearanceDto {
  @ApiProperty({ format: "uuid", type: String })
  @IsUUID("7")
  themeId!: string;

  @ApiProperty({ example: "1.0.0", type: String })
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/)
  themeVersion!: string;

  @ApiProperty({ format: "uuid", type: String })
  @IsUUID("7")
  paletteId!: string;
}

export class SaveArticleDocumentDto {
  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseVersion!: number;

  @ApiProperty({ enum: [DOCUMENT_SCHEMA_VERSION], type: String })
  @IsString()
  @IsIn([DOCUMENT_SCHEMA_VERSION])
  schemaVersion!: string;

  @ApiProperty({
    additionalProperties: true,
    description: "符合 Document Schema V1 的完整文档 JSON",
    type: Object,
  })
  @IsObject()
  document!: Readonly<Record<string, unknown>>;

  @ApiProperty({ format: "uuid", type: String })
  @IsUUID()
  lastTransactionId!: string;

  @ApiProperty({ example: "user_style_change", maxLength: 100, type: String })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z][a-z0-9_.-]*$/)
  transactionOrigin!: string;

  @ApiPropertyOptional({ type: () => SaveDocumentAppearanceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveDocumentAppearanceDto)
  appearance?: SaveDocumentAppearanceDto;
}

export class ArticleDocumentSourceBlockDto {
  @ApiProperty({ type: String })
  blockType!: string;

  @ApiProperty({ minimum: 0, type: Number })
  orderIndex!: number;

  @ApiProperty({ type: String })
  sourceBlockId!: string;

  @ApiProperty({ type: String })
  text!: string;

  @ApiProperty({ nullable: true, type: String })
  textHash!: string | null;
}

export class ArticleDocumentDto {
  @ApiProperty({ format: "uuid", type: String })
  documentId!: string;

  @ApiProperty({ format: "uuid", type: String })
  articleId!: string;

  @ApiProperty({ enum: [DOCUMENT_SCHEMA_VERSION], type: String })
  schemaVersion!: string;

  @ApiProperty({ isArray: true, type: () => ArticleDocumentSourceBlockDto })
  sourceBlocks!: ArticleDocumentSourceBlockDto[];

  @ApiProperty({ minimum: 1, type: Number })
  documentVersion!: number;

  @ApiProperty({ additionalProperties: true, type: Object })
  document!: Readonly<Record<string, unknown>>;

  @ApiProperty({ type: Boolean })
  textLocked!: boolean;

  @ApiProperty({ nullable: true, type: String })
  originalTextHash!: string | null;

  @ApiProperty({ nullable: true, type: String })
  currentTextHash!: string | null;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  lastTransactionId!: string | null;

  @ApiProperty({ format: "uuid", type: String })
  lastSavedBy!: string;

  @ApiProperty({ format: "date-time", type: String })
  lastSavedAt!: string;
}

export class SaveArticleDocumentResultDto {
  @ApiProperty({ minimum: 1, type: Number })
  documentVersion!: number;

  @ApiProperty({ format: "uuid", type: String })
  lastTransactionId!: string;

  @ApiProperty({ format: "date-time", type: String })
  lastSavedAt!: string;

  @ApiProperty({
    description: "同一事务因网络恢复而安全重放时为 true",
    type: Boolean,
  })
  replayed!: boolean;
}

export class ArticleDocumentResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ArticleDocumentDto })
  data!: ArticleDocumentDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class SaveArticleDocumentResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => SaveArticleDocumentResultDto })
  data!: SaveArticleDocumentResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
