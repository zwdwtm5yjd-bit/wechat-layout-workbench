import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
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
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ACCOUNT_VERIFICATION_STATUSES,
  type AccountStatus,
  type AccountType,
  type AccountVerificationStatus,
} from "./account.types.js";

function optionalBoolean(value: unknown): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export class AccountListQueryDto {
  @ApiPropertyOptional({ enum: ACCOUNT_STATUSES, type: String })
  @IsOptional()
  @IsEnum(ACCOUNT_STATUSES)
  status?: AccountStatus;

  @ApiPropertyOptional({ example: "inspection", maxLength: 50, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  contentType?: string;

  @ApiPropertyOptional({ maxLength: 200, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  search?: string;

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

export class CreateAccountDto {
  @ApiProperty({ example: "清风巡察", maxLength: 200, type: String })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  shortName?: string | null;

  @ApiPropertyOptional({ maxLength: 2_000, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 2_000)
  description?: string | null;

  @ApiProperty({ example: ["inspection", "government"], isArray: true, type: String })
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  @Matches(/^[a-z][a-z0-9_-]*$/, { each: true })
  contentTypes!: string[];

  @ApiPropertyOptional({ default: "unknown", enum: ACCOUNT_TYPES, type: String })
  @IsOptional()
  @IsEnum(ACCOUNT_TYPES)
  accountType: AccountType = "unknown";

  @ApiPropertyOptional({
    default: "unknown",
    enum: ACCOUNT_VERIFICATION_STATUSES,
    type: String,
  })
  @IsOptional()
  @IsEnum(ACCOUNT_VERIFICATION_STATUSES)
  verificationStatus: AccountVerificationStatus = "unknown";

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  defaultThemeId?: string | null;

  @ApiPropertyOptional({ default: false, type: Boolean })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  isDefault = false;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ maxLength: 200, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  shortName?: string | null;

  @ApiPropertyOptional({ maxLength: 2_000, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Length(0, 2_000)
  description?: string | null;

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  @Matches(/^[a-z][a-z0-9_-]*$/, { each: true })
  contentTypes?: string[];

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES, type: String })
  @IsOptional()
  @IsEnum(ACCOUNT_TYPES)
  accountType?: AccountType;

  @ApiPropertyOptional({ enum: ACCOUNT_VERIFICATION_STATUSES, type: String })
  @IsOptional()
  @IsEnum(ACCOUNT_VERIFICATION_STATUSES)
  verificationStatus?: AccountVerificationStatus;

  @ApiPropertyOptional({ format: "uuid", nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  defaultThemeId?: string | null;
}

export class DeleteAccountDto {
  @ApiProperty({ description: "永久删除确认词", example: "DELETE", type: String })
  @IsString()
  @Matches(/^DELETE$/)
  confirmationText!: string;
}

export class AccountDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  shortName!: string | null;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ isArray: true, type: String })
  contentTypes!: string[];

  @ApiProperty({ enum: ACCOUNT_TYPES, type: String })
  accountType!: AccountType;

  @ApiProperty({ enum: ACCOUNT_VERIFICATION_STATUSES, type: String })
  verificationStatus!: AccountVerificationStatus;

  @ApiProperty({ enum: ACCOUNT_STATUSES, type: String })
  status!: AccountStatus;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  defaultThemeId!: string | null;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  defaultPaletteId!: string | null;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  currentBrandVersionId!: string | null;

  @ApiProperty({ type: Boolean })
  isDefault!: boolean;

  @ApiProperty({ minimum: 0, type: Number })
  articleCount!: number;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  archivedAt!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  updatedAt!: string;
}

export class AccountPaginationDto {
  @ApiProperty({ minimum: 1, type: Number })
  page!: number;

  @ApiProperty({ minimum: 1, type: Number })
  pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  total!: number;

  @ApiProperty({ minimum: 0, type: Number })
  totalPages!: number;
}

export class AccountListResultDto {
  @ApiProperty({ isArray: true, type: () => AccountDto })
  items!: AccountDto[];

  @ApiProperty({ type: () => AccountPaginationDto })
  pagination!: AccountPaginationDto;
}

export class AccountDeleteImpactDto {
  @ApiProperty({ minimum: 0, type: Number })
  articleCount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  activeArticleCount!: number;

  @ApiProperty({ type: Boolean })
  canPermanentlyDelete!: boolean;

  @ApiProperty({ isArray: true, type: String })
  blockingReasons!: string[];
}

export class AccountDeleteResultDto {
  @ApiProperty({ example: true, type: Boolean })
  deleted!: true;

  @ApiProperty({ format: "uuid", type: String })
  accountId!: string;
}

export class AccountResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => AccountDto })
  data!: AccountDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class AccountListResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => AccountListResultDto })
  data!: AccountListResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class AccountDeleteImpactResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => AccountDeleteImpactDto })
  data!: AccountDeleteImpactDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class AccountDeleteResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => AccountDeleteResultDto })
  data!: AccountDeleteResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
