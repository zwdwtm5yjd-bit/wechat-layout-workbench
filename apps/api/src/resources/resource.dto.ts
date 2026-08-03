import { Type } from "class-transformer";
import {
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
  RESOURCE_ACCESS_MAX_SECONDS,
  RESOURCE_ACCESS_MIN_SECONDS,
  RESOURCE_ACCESS_PURPOSES,
  RESOURCE_ACCESS_VARIANTS,
  RESOURCE_UPLOAD_MIME_TYPES,
} from "./resource.constants.js";
import type {
  ResourceAccessPurpose,
  ResourceAccessVariant,
  ResourceUploadMimeType,
} from "./resource.types.js";

export class CreateResourceUploadDto {
  @ApiProperty({ maxLength: 255, type: String })
  @IsString()
  @Length(1, 255)
  filename!: string;

  @ApiProperty({ enum: RESOURCE_UPLOAD_MIME_TYPES, type: String })
  @IsEnum(RESOURCE_UPLOAD_MIME_TYPES)
  mimeType!: ResourceUploadMimeType;

  @ApiProperty({ maximum: 1_073_741_824, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_073_741_824)
  fileSize!: number;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  sha256!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;
}

export class CompleteResourceUploadDto {
  @ApiProperty({ maxLength: 200, type: String })
  @IsString()
  @Length(1, 200)
  etag!: string;
}

export class CreateResourceAccessUrlDto {
  @ApiProperty({ enum: RESOURCE_ACCESS_PURPOSES, type: String })
  @IsEnum(RESOURCE_ACCESS_PURPOSES)
  purpose!: ResourceAccessPurpose;

  @ApiPropertyOptional({
    default: "original",
    enum: RESOURCE_ACCESS_VARIANTS,
    type: String,
  })
  @IsOptional()
  @IsEnum(RESOURCE_ACCESS_VARIANTS)
  variant: ResourceAccessVariant = "original";

  @ApiPropertyOptional({
    default: 300,
    maximum: RESOURCE_ACCESS_MAX_SECONDS,
    minimum: RESOURCE_ACCESS_MIN_SECONDS,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(RESOURCE_ACCESS_MIN_SECONDS)
  @Max(RESOURCE_ACCESS_MAX_SECONDS)
  expiresInSeconds = 300;
}

export class ResourceThumbnailDto {
  @ApiProperty({ type: Boolean })
  available!: boolean;

  @ApiProperty({ type: String })
  mimeType!: string;

  @ApiProperty({ minimum: 1, type: Number })
  fileSize!: number;

  @ApiProperty({ minimum: 1, type: Number })
  width!: number;

  @ApiProperty({ minimum: 1, type: Number })
  height!: number;
}

export class ResourceDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ type: String })
  resourceType!: string;

  @ApiProperty({ type: String })
  sourceType!: string;

  @ApiProperty({ nullable: true, type: String })
  originalFilename!: string | null;

  @ApiProperty({ enum: RESOURCE_UPLOAD_MIME_TYPES, type: String })
  mimeType!: string;

  @ApiProperty({ nullable: true, type: String })
  fileExtension!: string | null;

  @ApiProperty({ minimum: 1, type: Number })
  fileSize!: number;

  @ApiProperty({ minimum: 1, nullable: true, type: Number })
  width!: number | null;

  @ApiProperty({ minimum: 1, nullable: true, type: Number })
  height!: number | null;

  @ApiProperty({ type: String })
  sha256!: string;

  @ApiProperty({ enum: ["active", "trash"], type: String })
  status!: string;

  @ApiProperty({ type: Boolean })
  isPrivate!: boolean;

  @ApiProperty({ nullable: true, type: () => ResourceThumbnailDto })
  thumbnail!: ResourceThumbnailDto | null;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  updatedAt!: string;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  deletedAt!: string | null;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  purgeAfter!: string | null;
}

export class ResourceUploadResultDto {
  @ApiProperty({ enum: ["upload_required", "deduplicated"], type: String })
  status!: "upload_required" | "deduplicated";

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  uploadId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  uploadUrl!: string | null;

  @ApiProperty({ additionalProperties: { type: "string" }, type: "object" })
  headers!: Record<string, string>;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  expiresAt!: string | null;

  @ApiProperty({ nullable: true, type: () => ResourceDto })
  resource!: ResourceDto | null;
}

export class ResourceAccessUrlDto {
  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ additionalProperties: { type: "string" }, type: "object" })
  headers!: Record<string, string>;

  @ApiProperty({ format: "date-time", type: String })
  expiresAt!: string;
}

export class ResourceReferenceDto {
  @ApiProperty({
    enum: ["article", "source_document", "avatar", "derived_resource"],
    type: String,
  })
  kind!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ nullable: true, type: String })
  usageType!: string | null;

  @ApiProperty({ nullable: true, type: String })
  blockId!: string | null;
}

export class ResourceReferencesDto {
  @ApiProperty({ minimum: 0, type: Number })
  total!: number;

  @ApiProperty({ isArray: true, type: () => ResourceReferenceDto })
  items!: ResourceReferenceDto[];
}

export class ResourceResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ResourceDto })
  data!: ResourceDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ResourceUploadResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ResourceUploadResultDto })
  data!: ResourceUploadResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ResourceAccessUrlResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ResourceAccessUrlDto })
  data!: ResourceAccessUrlDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ResourceReferencesResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => ResourceReferencesDto })
  data!: ResourceReferencesDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
