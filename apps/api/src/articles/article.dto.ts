import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ApiMetaOpenApiModel } from "../common/http/openapi-models.js";
import {
  ARTICLE_STATUSES,
  type ArticleCompatibilityStatus,
  type ArticleLayoutStrength,
  type ArticleListStatus,
  type ArticleSort,
  type ArticleStatus,
} from "./article.types.js";

const listStatuses = [...ARTICLE_STATUSES, "trash"] as const;
const compatibilityStatuses = ["excellent", "usable", "risk"] as const;
const layoutStrengths = ["light", "standard", "strong"] as const;
const articleSorts = ["updated_desc", "updated_asc", "created_desc", "title_asc"] as const;
const editableStatuses = [
  "pending_layout",
  "layout_editing",
  "pending_check",
  "published",
] as const;

function optionalBoolean(value: unknown): unknown {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

export class ArticleListQueryDto {
  @ApiPropertyOptional({ format: "uuid", type: String })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ enum: listStatuses, type: String })
  @IsOptional()
  @IsEnum(listStatuses)
  status?: ArticleListStatus;

  @ApiPropertyOptional({ example: "inspection", maxLength: 50, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  contentType?: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  @IsOptional()
  @IsUUID()
  themeId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  hasSvg?: boolean;

  @ApiPropertyOptional({ enum: compatibilityStatuses, type: String })
  @IsOptional()
  @IsEnum(compatibilityStatuses)
  compatibilityStatus?: ArticleCompatibilityStatus;

  @ApiPropertyOptional({ maxLength: 200, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  search?: string;

  @ApiPropertyOptional({ default: "updated_desc", enum: articleSorts, type: String })
  @IsOptional()
  @IsEnum(articleSorts)
  sort: ArticleSort = "updated_desc";

  @ApiPropertyOptional({ default: 1, maximum: 10_000, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class CreateArticleDto {
  @ApiProperty({ example: "未命名文章", maxLength: 500, type: String })
  @IsString()
  @Length(1, 500)
  title!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @ApiPropertyOptional({ default: "general", example: "inspection", maxLength: 50, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  contentType = "general";

  @ApiPropertyOptional({ default: "blank", enum: ["blank"], type: String })
  @IsOptional()
  @IsEnum(["blank"])
  sourceType = "blank" as const;

  @ApiPropertyOptional({ default: "standard", enum: layoutStrengths, type: String })
  @IsOptional()
  @IsEnum(layoutStrengths)
  layoutStrength: ArticleLayoutStrength = "standard";
}

export class UpdateArticleDto {
  @ApiPropertyOptional({ maxLength: 500, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  subtitle?: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @ApiPropertyOptional({ example: "inspection", maxLength: 50, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  contentType?: string;

  @ApiPropertyOptional({ enum: layoutStrengths, type: String })
  @IsOptional()
  @IsEnum(layoutStrengths)
  layoutStrength?: ArticleLayoutStrength;

  @ApiPropertyOptional({
    description: "仅允许用户驱动的编辑阶段与发布状态",
    enum: editableStatuses,
    type: String,
  })
  @IsOptional()
  @IsEnum(editableStatuses)
  status?: ArticleStatus;

  @ApiPropertyOptional({
    description: "发布标记的便捷写法；不能与 status 同时提交",
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class DuplicateArticleDto {
  @ApiPropertyOptional({ maxLength: 500, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  targetAccountId?: string | null;

  @ApiPropertyOptional({ default: "full", enum: ["full"], type: String })
  @IsOptional()
  @IsEnum(["full"])
  copyMode = "full" as const;

  @ApiPropertyOptional({
    default: "same_group",
    enum: ["same_group", "independent"],
    type: String,
  })
  @IsOptional()
  @IsEnum(["same_group", "independent"])
  contentGroupMode: "same_group" | "independent" = "same_group";
}

export class ArticleDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  contentGroupId!: string | null;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  subtitle!: string | null;

  @ApiProperty({ type: String })
  contentType!: string;

  @ApiProperty({ enum: ["docx", "paste", "web", "blank", "copy"], type: String })
  sourceType!: string;

  @ApiProperty({ enum: ARTICLE_STATUSES, type: String })
  status!: ArticleStatus;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  themeId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  themeVersion!: string | null;

  @ApiProperty({ enum: layoutStrengths, type: String })
  layoutStrength!: ArticleLayoutStrength;

  @ApiProperty({ type: Boolean })
  textLocked!: boolean;

  @ApiProperty({ minimum: 0, type: Number })
  wordCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  imageCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  svgCount!: number;

  @ApiProperty({ maximum: 100, minimum: 0, nullable: true, type: Number })
  compatibilityScore!: number | null;

  @ApiProperty({ enum: compatibilityStatuses, nullable: true, type: String })
  compatibilityStatus!: ArticleCompatibilityStatus | null;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  publishedAt!: string | null;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  archivedAt!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  updatedAt!: string;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  deletedAt!: string | null;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  deletePurgeAfter!: string | null;
}

export class ArticleDetailDto extends ArticleDto {
  @ApiProperty({ minimum: 1, nullable: true, type: Number })
  documentVersion!: number | null;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  lastSavedAt!: string | null;
}

export class ArticlePaginationDto {
  @ApiProperty({ minimum: 1, type: Number })
  page!: number;

  @ApiProperty({ minimum: 1, type: Number })
  pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  total!: number;

  @ApiProperty({ minimum: 0, type: Number })
  totalPages!: number;
}

export class ArticleListResultDto {
  @ApiProperty({ isArray: true, type: () => ArticleDto })
  items!: ArticleDto[];

  @ApiProperty({ type: () => ArticlePaginationDto })
  pagination!: ArticlePaginationDto;
}

export class ArticleStatusHistoryDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ enum: ARTICLE_STATUSES, nullable: true, type: String })
  fromStatus!: ArticleStatus | null;

  @ApiProperty({ enum: ARTICLE_STATUSES, type: String })
  toStatus!: ArticleStatus;

  @ApiProperty({ type: String })
  reason!: string;

  @ApiProperty({ enum: ["user", "system", "import", "copy", "restore"], type: String })
  source!: string;

  @ApiProperty({ format: "uuid", type: String })
  createdBy!: string;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;
}

export class ArticleStatusHistoryResultDto {
  @ApiProperty({ isArray: true, type: () => ArticleStatusHistoryDto })
  items!: ArticleStatusHistoryDto[];
}

export class ArticleResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ArticleDetailDto })
  data!: ArticleDetailDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ArticleListResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ArticleListResultDto })
  data!: ArticleListResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ArticleStatusHistoryResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ArticleStatusHistoryResultDto })
  data!: ArticleStatusHistoryResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
