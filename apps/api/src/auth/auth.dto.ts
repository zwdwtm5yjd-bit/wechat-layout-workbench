import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

import { ApiMetaOpenApiModel } from "../common/http/openapi-models.js";
import type { AuthUserRole } from "./auth.types.js";

export class LoginDto {
  @ApiProperty({ example: "owner@example.com", maxLength: 320, type: String })
  @IsString()
  @Length(1, 320)
  identifier!: string;

  @ApiProperty({
    format: "password",
    maxLength: 256,
    minLength: 8,
    type: String,
    writeOnly: true,
  })
  @IsString()
  @Length(8, 256)
  password!: string;

  @ApiPropertyOptional({ default: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  rememberDevice?: boolean;
}

export class AuthUserDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ format: "email", type: String })
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  username!: string | null;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ enum: ["owner", "editor", "publisher", "viewer"], type: String })
  role!: AuthUserRole;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: String })
  locale!: string;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  avatarResourceId!: string | null;
}

export class LoginResultDto {
  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ format: "uuid", type: String })
  sessionId!: string;

  @ApiProperty({ format: "date-time", type: String })
  expiresAt!: string;

  @ApiProperty({
    description: "后续写请求必须通过 X-CSRF-Token 请求头回传",
    type: String,
  })
  csrfToken!: string;
}

export class CurrentUserResultDto {
  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ format: "uuid", type: String })
  sessionId!: string;

  @ApiProperty({ format: "date-time", type: String })
  expiresAt!: string;
}

export class CsrfResultDto {
  @ApiProperty({ description: "通过 X-CSRF-Token 请求头回传", type: String })
  csrfToken!: string;
}

export class LogoutResultDto {
  @ApiProperty({ example: true, type: Boolean })
  revoked!: boolean;
}

export class SessionRevocationResultDto {
  @ApiProperty({ format: "uuid", type: String })
  sessionId!: string;

  @ApiProperty({ example: true, type: Boolean })
  revoked!: boolean;
}

export class CsrfResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => CsrfResultDto })
  data!: CsrfResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class LoginResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => LoginResultDto })
  data!: LoginResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class CurrentUserResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => CurrentUserResultDto })
  data!: CurrentUserResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => LogoutResultDto })
  data!: LogoutResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}

export class SessionRevocationResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ type: () => SessionRevocationResultDto })
  data!: SessionRevocationResultDto;

  @ApiProperty({ type: () => ApiMetaOpenApiModel })
  meta!: ApiMetaOpenApiModel;
}
