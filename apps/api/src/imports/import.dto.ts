import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ApiMetaOpenApiModel } from "../common/http/openapi-models.js";
import {
  IMPORT_BLOCK_ROLES,
  IMPORT_CLEANING_MODES,
  IMPORT_MAX_CONTENT_CHARACTERS,
  IMPORT_SOURCE_HINTS,
  IMPORT_WARNING_CODES,
} from "./import.constants.js";
import type {
  DetectedImportSource,
  ImportBlockRole,
  ImportCleaningMode,
  ImportSourceHint,
  ImportWarningCode,
} from "./import.types.js";

const layoutStrengths = ["light", "standard", "strong"] as const;

export class PasteImportDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @ApiPropertyOptional({
    description: "剪贴板提供的 HTML；服务端只保存清洗后的结构和标准化纯文本",
    maxLength: IMPORT_MAX_CONTENT_CHARACTERS,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(1, IMPORT_MAX_CONTENT_CHARACTERS)
  html?: string;

  @ApiPropertyOptional({
    description: "剪贴板纯文本回退，也是原文追踪的优先来源",
    maxLength: IMPORT_MAX_CONTENT_CHARACTERS,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(1, IMPORT_MAX_CONTENT_CHARACTERS)
  plainText?: string;

  @ApiPropertyOptional({
    default: "preserve_structure",
    enum: IMPORT_CLEANING_MODES,
    type: String,
  })
  @IsOptional()
  @IsEnum(IMPORT_CLEANING_MODES)
  cleaningMode: ImportCleaningMode = "preserve_structure";

  @ApiPropertyOptional({ default: "auto", enum: IMPORT_SOURCE_HINTS, type: String })
  @IsOptional()
  @IsEnum(IMPORT_SOURCE_HINTS)
  detectedSourceHint: ImportSourceHint = "auto";

  @ApiPropertyOptional({ default: "general", maxLength: 50, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  contentType = "general";

  @ApiPropertyOptional({ default: "standard", enum: layoutStrengths, type: String })
  @IsOptional()
  @IsEnum(layoutStrengths)
  layoutStrength: "light" | "standard" | "strong" = "standard";
}

export class DocxImportDto {
  @ApiProperty({ format: "uuid", type: String })
  @IsUUID()
  resourceId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @ApiPropertyOptional({ default: "preserve_structure", enum: IMPORT_CLEANING_MODES, type: String })
  @IsOptional()
  @IsEnum(IMPORT_CLEANING_MODES)
  cleaningMode: ImportCleaningMode = "preserve_structure";

  @ApiPropertyOptional({ default: "general", maxLength: 50, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  contentType = "general";

  @ApiPropertyOptional({ default: "standard", enum: layoutStrengths, type: String })
  @IsOptional()
  @IsEnum(layoutStrengths)
  layoutStrength: "light" | "standard" | "strong" = "standard";
}

export class DocxImportJobDto {
  @ApiProperty({ format: "uuid", type: String })
  jobId!: string;

  @ApiProperty({ format: "uuid", type: String })
  articleId!: string;
}

export class DocxImportJobResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => DocxImportJobDto })
  data!: DocxImportJobDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ConfirmImportBlockDto {
  @ApiProperty({ maxLength: 100, type: String })
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  sourceBlockId!: string;

  @ApiProperty({ enum: IMPORT_BLOCK_ROLES, type: String })
  @IsEnum(IMPORT_BLOCK_ROLES)
  role!: ImportBlockRole;
}

export class ConfirmImportStructureDto {
  @ApiPropertyOptional({ maxLength: 500, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseVersion!: number;

  @ApiProperty({ format: "uuid", type: String })
  @IsUUID()
  lastTransactionId!: string;

  @ApiProperty({ isArray: true, type: () => ConfirmImportBlockDto })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2_000)
  @ValidateNested({ each: true })
  @Type(() => ConfirmImportBlockDto)
  blocks!: ConfirmImportBlockDto[];
}

export class ImportWarningDto {
  @ApiProperty({ enum: IMPORT_WARNING_CODES, type: String })
  code!: ImportWarningCode;

  @ApiProperty({ enum: ["info", "warning"], type: String })
  severity!: "info" | "warning";

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ minimum: 1, type: Number })
  count!: number;
}

export class ImportStatisticsDto {
  @ApiProperty({ minimum: 0, type: Number })
  wordCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  characterCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  blockCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  headingCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  imageCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  tableCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  removedStyleCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  removedSecurityNodeCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  removedHiddenNodeCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  removedUnsafeLinkCount!: number;
}

export class ImportBlockRelationDto {
  @ApiPropertyOptional({ minimum: 0, type: Number })
  listDepth?: number;

  @ApiPropertyOptional({ minimum: 1, type: Number })
  listStart?: number;

  @ApiPropertyOptional({ type: String })
  originalNumberText?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  sourceUrl?: string | null;

  @ApiPropertyOptional({ type: String })
  alt?: string;

  @ApiPropertyOptional({ isArray: true, type: String })
  tableCells?: string[];
}

export class ImportStructureBlockDto {
  @ApiProperty({ type: String })
  sourceBlockId!: string;

  @ApiProperty({ enum: IMPORT_BLOCK_ROLES, type: String })
  role!: ImportBlockRole;

  @ApiProperty({ type: String })
  text!: string;

  @ApiProperty({ minimum: 0, type: Number })
  orderIndex!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  originalTag!: string | null;

  @ApiProperty({ type: () => ImportBlockRelationDto })
  relation!: ImportBlockRelationDto;
}

export class ImportStructureDto {
  @ApiProperty({ format: "uuid", type: String })
  articleId!: string;

  @ApiProperty({ format: "uuid", type: String })
  sourceDocumentId!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ enum: ["pending_recognition", "pending_layout"], type: String })
  status!: string;

  @ApiProperty({ format: "uuid", type: String })
  documentId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  documentVersion!: number;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  lastTransactionId!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  lastSavedAt!: string;

  @ApiProperty({
    enum: IMPORT_SOURCE_HINTS.filter((source) => source !== "auto"),
    type: String,
  })
  detectedSource!: DetectedImportSource;

  @ApiProperty({ enum: IMPORT_CLEANING_MODES, type: String })
  cleaningMode!: ImportCleaningMode;

  @ApiProperty({ description: "标准化原文，不包含原始 HTML", type: String })
  originalText!: string;

  @ApiProperty({ isArray: true, type: () => ImportStructureBlockDto })
  blocks!: ImportStructureBlockDto[];

  @ApiProperty({ isArray: true, type: () => ImportWarningDto })
  warnings!: ImportWarningDto[];

  @ApiProperty({ type: () => ImportStatisticsDto })
  statistics!: ImportStatisticsDto;
}

export class ConfirmImportResultDto extends ImportStructureDto {
  @ApiProperty({ format: "uuid", type: String })
  snapshotId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  snapshotNumber!: number;

  @ApiProperty({ type: String })
  editorUrl!: string;
}

export class ImportStructureResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ImportStructureDto })
  data!: ImportStructureDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ConfirmImportResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ConfirmImportResultDto })
  data!: ConfirmImportResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
