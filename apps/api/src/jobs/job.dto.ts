import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  JOB_EVENT_TYPES,
  JOB_STATUSES,
  type JobEventType,
  type JobStatus,
} from "@wechat-layout/job-runtime";

export class JobListQueryDto {
  @ApiPropertyOptional({ enum: JOB_STATUSES, type: String })
  @IsOptional()
  @IsEnum(JOB_STATUSES)
  status?: JobStatus;

  @ApiPropertyOptional({ maxLength: 100, type: String })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  jobType?: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  @IsOptional()
  @IsUUID()
  articleId?: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  @IsOptional()
  @IsUUID()
  accountId?: string;

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

export class JobResultDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  queueName!: string;

  @ApiProperty({ type: String })
  jobType!: string;

  @ApiProperty({ enum: JOB_STATUSES, type: String })
  status!: JobStatus;

  @ApiProperty({ minimum: 0, maximum: 100, type: Number })
  progress!: number;

  @ApiProperty({ minimum: 0, type: Number })
  attemptCount!: number;

  @ApiProperty({ minimum: 1, type: Number })
  maxAttempts!: number;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  articleId!: string | null;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  resultRef!: string | null;

  @ApiProperty({ additionalProperties: true, type: Object })
  resultSummary!: Readonly<Record<string, unknown>>;

  @ApiProperty({ nullable: true, type: String })
  errorCode!: string | null;

  @ApiProperty({ nullable: true, type: String })
  errorMessage!: string | null;

  @ApiProperty({ nullable: true, type: String })
  latestMessage!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  updatedAt!: string;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  completedAt!: string | null;
}

export class JobListResultDto {
  @ApiProperty({ isArray: true, type: () => JobResultDto })
  items!: JobResultDto[];

  @ApiProperty({ minimum: 1, type: Number })
  page!: number;

  @ApiProperty({ minimum: 1, type: Number })
  pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  total!: number;
}

export class JobEventResultDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ format: "uuid", type: String })
  jobId!: string;

  @ApiProperty({ enum: JOB_EVENT_TYPES, type: String })
  eventType!: JobEventType;

  @ApiProperty({ maximum: 100, minimum: 0, nullable: true, type: Number })
  progress!: number | null;

  @ApiProperty({ nullable: true, type: String })
  message!: string | null;

  @ApiProperty({ additionalProperties: true, type: Object })
  metadata!: Readonly<Record<string, unknown>>;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;
}
