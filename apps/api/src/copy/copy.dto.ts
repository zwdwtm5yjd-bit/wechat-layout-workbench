import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WECHAT_OUTPUT_MODES } from "@wechat-layout/wechat-renderer";
import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateWechatRenderDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  documentVersion!: number;

  @ApiProperty({ enum: WECHAT_OUTPUT_MODES, type: String })
  @IsIn(WECHAT_OUTPUT_MODES)
  outputMode!: (typeof WECHAT_OUTPUT_MODES)[number];
}

export class CopyPayloadRequestDto {
  @ApiProperty({ format: "uuid", type: String })
  @IsString()
  renderOutputId!: string;
}

export class CreateCopyRecordDto {
  @ApiProperty({ format: "uuid", type: String })
  @IsString()
  renderOutputId!: string;

  @ApiProperty({ enum: ["success", "failed"], type: String })
  @IsIn(["success", "failed"])
  status!: "failed" | "success";

  @ApiProperty({ additionalProperties: { type: "string" }, type: Object })
  @IsObject()
  browserInfo!: Record<string, string>;

  @ApiPropertyOptional({ maxLength: 500, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;
}

export class RenderOutputResponseDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ format: "uuid", type: String })
  snapshotId!: string;

  @ApiProperty({ enum: ["ready", "blocked", "failed"], type: String })
  status!: "blocked" | "failed" | "ready";

  @ApiProperty({ enum: WECHAT_OUTPUT_MODES, type: String })
  outputMode!: (typeof WECHAT_OUTPUT_MODES)[number];

  @ApiProperty({ type: String })
  rendererVersion!: string;

  @ApiProperty({ type: String })
  compatibilityRuleVersion!: string;

  @ApiProperty({ nullable: true, type: String })
  outputHash!: string | null;

  @ApiProperty({ type: Boolean })
  canCopy!: boolean;

  @ApiProperty({ additionalProperties: true, type: Object })
  compatibilityReport!: Readonly<Record<string, unknown>>;

  @ApiProperty({ format: "date-time", type: String })
  generatedAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  expiresAt!: string;
}

export class CopyPayloadResponseDto {
  @ApiProperty({ format: "uuid", type: String })
  renderOutputId!: string;

  @ApiProperty({ type: String })
  html!: string;

  @ApiProperty({ type: String })
  plainText!: string;

  @ApiProperty({ format: "date-time", type: String })
  expiresAt!: string;
}

export class CopyRecordResponseDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ format: "uuid", type: String })
  renderOutputId!: string;

  @ApiProperty({ enum: ["success", "failed"], type: String })
  status!: "failed" | "success";

  @ApiProperty({ format: "date-time", type: String })
  copiedAt!: string;
}
