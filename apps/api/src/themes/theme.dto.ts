import { Type } from "class-transformer";
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

const compatibilityLevels = ["safe", "compatible", "conditional"] as const;
const themeScopes = ["full"] as const;
const brandModes = ["off", "soft"] as const;

export class ThemeListQueryDto {
  @ApiPropertyOptional({ maxLength: 64, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  category?: string;

  @ApiPropertyOptional({ maxLength: 64, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  contentType?: string;

  @ApiPropertyOptional({ enum: compatibilityLevels, type: String })
  @IsOptional()
  @IsEnum(compatibilityLevels)
  compatibilityLevel?: (typeof compatibilityLevels)[number];

  @ApiPropertyOptional({ maxLength: 100, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ default: 1, maximum: 1000, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class ThemePreviewRequestDto {
  @ApiPropertyOptional({ example: "1.0.0", type: String })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/)
  themeVersion?: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  @IsOptional()
  @IsUUID("7")
  paletteId?: string;

  @ApiPropertyOptional({ default: "full", enum: themeScopes, type: String })
  @IsOptional()
  @IsEnum(themeScopes)
  scope = "full" as const;

  @ApiPropertyOptional({ default: "soft", enum: brandModes, type: String })
  @IsOptional()
  @IsEnum(brandModes)
  brandMode: "off" | "soft" = "soft";
}

export class ApplyThemeRequestDto extends ThemePreviewRequestDto {
  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseDocumentVersion!: number;

  @ApiPropertyOptional({ default: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  preserveLockedBlocks = true;
}

export class ThemeManifestDto {
  @ApiProperty({ format: "uuid", type: String })
  themeId!: string;

  @ApiProperty({ type: String })
  familyId!: string;

  @ApiProperty({ type: String })
  componentSetId!: string;

  @ApiProperty({ example: "1.0.0", type: String })
  version!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ isArray: true, type: String })
  categories!: string[];

  @ApiProperty({ isArray: true, type: String })
  recommendedContentTypes!: string[];

  @ApiProperty({ format: "uuid", type: String })
  defaultPaletteId!: string;

  @ApiProperty({ isArray: true, type: String })
  supportedPalettes!: string[];

  @ApiProperty({ enum: compatibilityLevels, type: String })
  compatibilityLevel!: (typeof compatibilityLevels)[number];

  @ApiProperty({ type: Boolean })
  isDefault!: boolean;

  @ApiProperty({ enum: ["published"], type: String })
  status!: "published";

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;
}

export class ThemePreviewAssetDto {
  @ApiProperty({ isArray: true, type: String })
  accentColors!: string[];

  @ApiProperty({ type: String })
  heading1!: string;

  @ApiProperty({ type: String })
  heading2!: string;

  @ApiProperty({ type: String })
  heading3!: string;

  @ApiProperty({ type: String })
  body!: string;

  @ApiProperty({ type: String })
  quote!: string;

  @ApiProperty({ type: String })
  imageAlt!: string;

  @ApiProperty({ type: String })
  dataLabel!: string;

  @ApiProperty({ type: String })
  dataValue!: string;

  @ApiProperty({ type: String })
  footer!: string;

  @ApiProperty({ type: Number })
  mobileViewportWidth!: number;

  @ApiProperty({ type: Number })
  wechatContentWidth!: number;
}

export class ThemeDto {
  @ApiProperty({ type: () => ThemeManifestDto })
  manifest!: ThemeManifestDto;

  @ApiProperty({ type: () => ThemePreviewAssetDto })
  preview!: ThemePreviewAssetDto;

  @ApiProperty({ isArray: true, type: String })
  componentRefs!: string[];

  @ApiProperty({ additionalProperties: true, type: Object })
  tokens!: Readonly<Record<string, unknown>>;

  @ApiProperty({ additionalProperties: true, type: Object })
  compatibility!: Readonly<Record<string, unknown>>;

  @ApiProperty({ isArray: true, type: Object })
  variants!: Readonly<Record<string, unknown>>[];

  @ApiProperty({ type: Boolean })
  installed!: boolean;
}

export class ThemePaginationDto {
  @ApiProperty({ minimum: 1, type: Number })
  page!: number;

  @ApiProperty({ minimum: 1, type: Number })
  pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  total!: number;

  @ApiProperty({ minimum: 0, type: Number })
  totalPages!: number;
}

export class ThemeListResultDto {
  @ApiProperty({ isArray: true, type: () => ThemeDto })
  items!: ThemeDto[];

  @ApiProperty({ type: () => ThemePaginationDto })
  pagination!: ThemePaginationDto;
}

export class ThemeVersionsResultDto {
  @ApiProperty({ isArray: true, type: () => ThemeDto })
  items!: ThemeDto[];

  @ApiProperty({ minimum: 1, type: Number })
  total!: number;
}

export class ThemeRenderPreviewDto {
  @ApiProperty({ format: "uuid", type: String })
  articleId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  documentVersion!: number;

  @ApiProperty({ format: "uuid", type: String })
  themeId!: string;

  @ApiProperty({ type: String })
  themeVersion!: string;

  @ApiProperty({ format: "uuid", type: String })
  paletteId!: string;

  @ApiProperty({ type: String })
  html!: string;

  @ApiProperty({ type: String })
  outputHash!: string;

  @ApiProperty({ additionalProperties: true, type: Object })
  compatibilityReport!: Readonly<Record<string, unknown>>;

  @ApiProperty({ additionalProperties: true, type: Object })
  textIntegrity!: Readonly<Record<string, unknown>>;
}

export class ApplyThemeResultDto {
  @ApiProperty({ format: "uuid", type: String })
  articleId!: string;

  @ApiProperty({ format: "uuid", type: String })
  themeId!: string;

  @ApiProperty({ type: String })
  themeVersion!: string;

  @ApiProperty({ format: "uuid", type: String })
  paletteId!: string;

  @ApiProperty({ minimum: 2, type: Number })
  documentVersion!: number;

  @ApiProperty({ format: "uuid", type: String })
  lastTransactionId!: string;

  @ApiProperty({ format: "uuid", type: String })
  safetySnapshotId!: string;

  @ApiProperty({ type: Boolean })
  originalTextUnchanged!: true;

  @ApiProperty({ format: "date-time", type: String })
  appliedAt!: string;
}

export class ThemeResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: true;

  @ApiProperty({ type: () => ThemeDto })
  data!: ThemeDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ThemeListResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: true;

  @ApiProperty({ type: () => ThemeListResultDto })
  data!: ThemeListResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ThemeVersionsResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: true;

  @ApiProperty({ type: () => ThemeVersionsResultDto })
  data!: ThemeVersionsResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ThemePreviewResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: true;

  @ApiProperty({ type: () => ThemeRenderPreviewDto })
  data!: ThemeRenderPreviewDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ApplyThemeResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: true;

  @ApiProperty({ type: () => ApplyThemeResultDto })
  data!: ApplyThemeResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
