import {
  type ArgumentMetadata,
  HttpStatus,
  Injectable,
  type PipeTransform,
  ValidationPipe,
} from "@nestjs/common";
import type { Type } from "@nestjs/common";
import type { ValidationError } from "class-validator";
import { z } from "zod";

import type { ValidationFieldError } from "./api-contract.js";
import { ApiException } from "./api.exception.js";

interface ZodDtoClass<TOutput> extends Type<TOutput> {
  readonly schema: z.ZodType<TOutput>;
}

export function createZodDto<TOutput>(schema: z.ZodType<TOutput>): ZodDtoClass<TOutput> {
  class GeneratedZodDto {
    static readonly schema = schema;
  }

  return GeneratedZodDto as unknown as ZodDtoClass<TOutput>;
}

function validationException(fields: readonly ValidationFieldError[]): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, {
    code: "VALIDATION_FAILED",
    message: "提交内容存在错误",
    details: { fields },
    retryable: false,
  });
}

function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = "",
): ValidationFieldError[] {
  return errors.flatMap((error) => {
    const path = parentPath === "" ? error.property : `${parentPath}.${error.property}`;
    const ownErrors = Object.values(error.constraints ?? {}).map((message) => ({
      path,
      message,
    }));

    return [...ownErrors, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

function zodSchemaFromMetadata(metadata: ArgumentMetadata): z.ZodType | undefined {
  if (metadata.metatype === undefined) {
    return undefined;
  }

  const candidate = (metadata.metatype as unknown as { schema?: unknown }).schema;

  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "safeParse" in candidate &&
    typeof candidate.safeParse === "function"
  ) {
    return candidate as z.ZodType;
  }

  return undefined;
}

@Injectable()
export class ApiValidationPipe implements PipeTransform {
  readonly #dtoValidationPipe = new ValidationPipe({
    exceptionFactory: (errors) => validationException(flattenValidationErrors(errors)),
    forbidNonWhitelisted: true,
    transform: true,
    validationError: {
      target: false,
      value: false,
    },
    whitelist: true,
  });

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const schema = zodSchemaFromMetadata(metadata);

    if (schema === undefined) {
      return this.#dtoValidationPipe.transform(value, metadata);
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      throw validationException(
        result.error.issues.map((issue) => ({
          path: issue.path.map((segment) => String(segment)).join("."),
          message: issue.message,
        })),
      );
    }

    return result.data;
  }
}
