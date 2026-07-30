import { HttpException } from "@nestjs/common";

import type { ApiError } from "./api-contract.js";

export class ApiException extends HttpException {
  constructor(
    statusCode: number,
    readonly apiError: ApiError,
  ) {
    super(apiError.message, statusCode);
  }
}
