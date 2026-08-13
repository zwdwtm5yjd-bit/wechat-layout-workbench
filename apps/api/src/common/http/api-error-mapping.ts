import { HttpException, HttpStatus } from "@nestjs/common";

import type { ApiError } from "./api-contract.js";
import { ApiException } from "./api.exception.js";

const defaultErrorsByStatus: Readonly<Record<number, ApiError>> = {
  [HttpStatus.BAD_REQUEST]: {
    code: "VALIDATION_FAILED",
    message: "请求参数无效",
    retryable: false,
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: "AUTH_REQUIRED",
    message: "需要登录后继续",
    retryable: false,
  },
  [HttpStatus.FORBIDDEN]: {
    code: "PERMISSION_DENIED",
    message: "没有执行此操作的权限",
    retryable: false,
  },
  [HttpStatus.NOT_FOUND]: {
    code: "RESOURCE_NOT_FOUND",
    message: "请求的资源不存在",
    retryable: false,
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: "RATE_LIMITED",
    message: "请求过于频繁",
    retryable: true,
  },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: "PAYLOAD_TOO_LARGE",
    message: "内容过大，无法保存",
    retryable: false,
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: "SERVICE_UNAVAILABLE",
    message: "服务暂时不可用",
    retryable: true,
  },
};

const internalError: ApiError = {
  code: "INTERNAL_ERROR",
  message: "服务器内部错误",
  retryable: false,
};

export interface DescribedApiException {
  readonly statusCode: number;
  readonly error: ApiError;
}

function parserStatus(exception: unknown): number | null {
  if (typeof exception !== "object" || exception === null) {
    return null;
  }
  const candidate = exception as { readonly status?: unknown; readonly statusCode?: unknown };
  const status = typeof candidate.status === "number" ? candidate.status : candidate.statusCode;
  return typeof status === "number" && status >= 400 && status <= 599 ? status : null;
}

export function describeApiException(exception: unknown): DescribedApiException {
  const statusCode =
    exception instanceof HttpException
      ? exception.getStatus()
      : (parserStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR);

  return {
    statusCode,
    error:
      exception instanceof ApiException
        ? exception.apiError
        : (defaultErrorsByStatus[statusCode] ?? internalError),
  };
}
