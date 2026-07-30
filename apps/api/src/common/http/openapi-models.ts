import { ApiProperty } from "@nestjs/swagger";

export class ApiMetaOpenApiModel {
  @ApiProperty({ example: "req_019xyz", type: String })
  requestId!: string;

  @ApiProperty({ example: "trace_019xyz", type: String })
  traceId!: string;

  @ApiProperty({
    example: "2026-07-30T09:00:00.000Z",
    format: "date-time",
    type: String,
  })
  timestamp!: string;
}

export class ApiErrorOpenApiModel {
  @ApiProperty({ example: "VALIDATION_FAILED", type: String })
  code!: string;

  @ApiProperty({ example: "提交内容存在错误", type: String })
  message!: string;

  @ApiProperty({
    additionalProperties: true,
    required: false,
    type: Object,
  })
  details?: Readonly<Record<string, unknown>>;

  @ApiProperty({ example: false, type: Boolean })
  retryable!: boolean;
}

export class ApiErrorResponseOpenApiModel {
  @ApiProperty({ example: false, type: Boolean })
  success!: false;

  @ApiProperty({ type: () => ApiErrorOpenApiModel })
  error!: ApiErrorOpenApiModel;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class ApiSuccessResponseOpenApiModel {
  @ApiProperty({ example: true, type: Boolean })
  success!: true;

  @ApiProperty({
    additionalProperties: true,
    type: Object,
  })
  data!: Readonly<Record<string, unknown>>;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
