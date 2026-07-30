import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ApiMetaOpenApiModel } from "../common/http/openapi-models.js";
import { SNAPSHOT_REASONS } from "./snapshot.constants.js";
import type { SnapshotReason } from "./snapshot.types.js";

export class SnapshotListQueryDto {
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

export class CreateSnapshotDto {
  @ApiProperty({ enum: ["manual"], type: String })
  @IsEnum(["manual"])
  reason!: "manual";

  @ApiPropertyOptional({ maxLength: 500, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string | null;
}

export class RestoreSnapshotDto {
  @ApiProperty({ enum: ["replace_current"], type: String })
  @IsEnum(["replace_current"])
  mode!: "replace_current";

  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseVersion!: number;

  @ApiProperty({ format: "uuid", type: String })
  @IsUUID()
  lastTransactionId!: string;
}

export class SnapshotResourceReferenceDto {
  @ApiProperty({ type: String })
  blockId!: string;

  @ApiProperty({ type: String })
  usageType!: string;
}

export class SnapshotResourceManifestEntryDto {
  @ApiProperty({ type: String })
  resourceId!: string;

  @ApiProperty({ isArray: true, type: () => SnapshotResourceReferenceDto })
  references!: SnapshotResourceReferenceDto[];
}

export class SnapshotPackageManifestEntryDto {
  @ApiProperty({
    enum: ["theme", "brand", "component", "brand_footer", "svg"],
    type: String,
  })
  kind!: "theme" | "brand" | "component" | "brand_footer" | "svg";

  @ApiProperty({ type: String })
  packageId!: string;

  @ApiProperty({ nullable: true, type: String })
  version!: string | null;
}

export class SnapshotSummaryDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ format: "uuid", type: String })
  articleId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  snapshotNumber!: number;

  @ApiProperty({ enum: SNAPSHOT_REASONS, type: String })
  reason!: SnapshotReason;

  @ApiProperty({ type: String })
  documentSchemaVersion!: string;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  themeId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  themeVersion!: string | null;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  brandVersionId!: string | null;

  @ApiProperty({ maximum: 100, minimum: 0, nullable: true, type: Number })
  compatibilityScore!: number | null;

  @ApiProperty({ nullable: true, type: String })
  note!: string | null;

  @ApiProperty({ minimum: 0, type: Number })
  resourceCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  packageCount!: number;

  @ApiProperty({ format: "uuid", type: String })
  createdBy!: string;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ type: Boolean })
  isCurrent!: boolean;
}

export class SnapshotDetailDto extends SnapshotSummaryDto {
  @ApiProperty({ additionalProperties: true, type: Object })
  document!: Readonly<Record<string, unknown>>;

  @ApiProperty({ isArray: true, type: () => SnapshotResourceManifestEntryDto })
  resourceManifest!: SnapshotResourceManifestEntryDto[];

  @ApiProperty({ isArray: true, type: () => SnapshotPackageManifestEntryDto })
  packageManifest!: SnapshotPackageManifestEntryDto[];

  @ApiProperty({ nullable: true, type: String })
  textHash!: string | null;

  @ApiProperty({ nullable: true, type: String })
  compatibilityRuleVersion!: string | null;

  @ApiProperty({ nullable: true, type: String })
  rendererVersion!: string | null;

  @ApiProperty({ nullable: true, type: String })
  htmlHash!: string | null;
}

export class SnapshotPaginationDto {
  @ApiProperty({ minimum: 1, type: Number })
  page!: number;

  @ApiProperty({ minimum: 1, type: Number })
  pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  total!: number;

  @ApiProperty({ minimum: 0, type: Number })
  totalPages!: number;
}

export class SnapshotListResultDto {
  @ApiProperty({ isArray: true, type: () => SnapshotSummaryDto })
  items!: SnapshotSummaryDto[];

  @ApiProperty({ type: () => SnapshotPaginationDto })
  pagination!: SnapshotPaginationDto;
}

export class RestoreSnapshotResultDto {
  @ApiProperty({ format: "uuid", type: String })
  restoredFromSnapshotId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  documentVersion!: number;

  @ApiProperty({ format: "uuid", type: String })
  lastTransactionId!: string;

  @ApiProperty({ format: "date-time", type: String })
  lastSavedAt!: string;

  @ApiProperty({ type: () => SnapshotSummaryDto })
  safetySnapshot!: SnapshotSummaryDto;

  @ApiProperty({ type: () => SnapshotSummaryDto })
  restoredSnapshot!: SnapshotSummaryDto;
}

export class SnapshotResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => SnapshotDetailDto })
  data!: SnapshotDetailDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class SnapshotListResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => SnapshotListResultDto })
  data!: SnapshotListResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class RestoreSnapshotResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => RestoreSnapshotResultDto })
  data!: RestoreSnapshotResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
