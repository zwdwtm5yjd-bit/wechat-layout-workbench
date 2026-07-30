// 此文件由 pnpm api:generate 自动生成，请勿手工编辑。
export interface paths {
  "/health/live": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 进程存活检查 */
    get: operations["HealthController_live"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/health/ready": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 服务就绪检查 */
    get: operations["HealthController_ready"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    ApiErrorOpenApiModel: {
      /** @example VALIDATION_FAILED */
      code: string;
      details?: {
        [key: string]: unknown;
      };
      /** @example 提交内容存在错误 */
      message: string;
      /** @example false */
      retryable: boolean;
    };
    ApiErrorResponseOpenApiModel: {
      error: components["schemas"]["ApiErrorOpenApiModel"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example false */
      success: boolean;
    };
    ApiMetaOpenApiModel: {
      /** @example req_019xyz */
      requestId: string;
      /**
       * Format: date-time
       * @example 2026-07-30T09:00:00.000Z
       */
      timestamp: string;
      /** @example trace_019xyz */
      traceId: string;
    };
    ApiSuccessResponseOpenApiModel: {
      data: {
        [key: string]: unknown;
      };
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  HealthController_live: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /**
       * @description API 进程正在运行
       *
       *     The Health Check is successful
       */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            details?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            };
            /** @example {} */
            error?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            info?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /** @example ok */
            status?: string;
          };
        };
      };
      /** @description The Health Check is not successful */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       },
             *       "redis": {
             *         "status": "down",
             *         "message": "Could not connect"
             *       }
             *     }
             */
            details?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            };
            /**
             * @example {
             *       "redis": {
             *         "status": "down",
             *         "message": "Could not connect"
             *       }
             *     }
             */
            error?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            info?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /** @example error */
            status?: string;
          };
        };
      };
    };
  };
  HealthController_ready: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /**
       * @description 全部已注册依赖探针通过
       *
       *     The Health Check is successful
       */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            details?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            };
            /** @example {} */
            error?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            info?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /** @example ok */
            status?: string;
          };
        };
      };
      /** @description The Health Check is not successful */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       },
             *       "redis": {
             *         "status": "down",
             *         "message": "Could not connect"
             *       }
             *     }
             */
            details?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            };
            /**
             * @example {
             *       "redis": {
             *         "status": "down",
             *         "message": "Could not connect"
             *       }
             *     }
             */
            error?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            info?: {
              [key: string]: {
                status: string;
              } & {
                [key: string]: unknown;
              };
            } | null;
            /** @example error */
            status?: string;
          };
        };
      };
    };
  };
}
