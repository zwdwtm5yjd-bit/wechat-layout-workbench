// 此文件由 pnpm api:generate 自动生成，请勿手工编辑。
export interface paths {
  "/api/v1/auth/csrf": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取与当前会话绑定的 CSRF Token */
    get: operations["AuthController_csrf"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/login": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 使用用户名或邮箱登录 */
    post: operations["AuthController_login"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/logout": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 退出当前会话 */
    post: operations["AuthController_logout"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/me": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取当前用户与会话 */
    get: operations["AuthController_me"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/sessions/{sessionId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** 撤销自己的指定会话 */
    delete: operations["AuthController_revokeSession"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
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
    AuthUserDto: {
      /** Format: uuid */
      avatarResourceId: string | null;
      displayName: string;
      /** Format: email */
      email: string;
      /** Format: uuid */
      id: string;
      locale: string;
      /** @enum {string} */
      role: "owner" | "editor" | "publisher" | "viewer";
      timezone: string;
      username: string | null;
    };
    CsrfResponseDto: {
      data: components["schemas"]["CsrfResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    CsrfResultDto: {
      /** @description 通过 X-CSRF-Token 请求头回传 */
      csrfToken: string;
    };
    CurrentUserResponseDto: {
      data: components["schemas"]["CurrentUserResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    CurrentUserResultDto: {
      /** Format: date-time */
      expiresAt: string;
      /** Format: uuid */
      sessionId: string;
      user: components["schemas"]["AuthUserDto"];
    };
    LoginDto: {
      /** @example owner@example.com */
      identifier: string;
      /** Format: password */
      password: string;
      /** @default false */
      rememberDevice: boolean;
    };
    LoginResponseDto: {
      data: components["schemas"]["LoginResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    LoginResultDto: {
      /** @description 后续写请求必须通过 X-CSRF-Token 请求头回传 */
      csrfToken: string;
      /** Format: date-time */
      expiresAt: string;
      /** Format: uuid */
      sessionId: string;
      user: components["schemas"]["AuthUserDto"];
    };
    LogoutResponseDto: {
      data: components["schemas"]["LogoutResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    LogoutResultDto: {
      /** @example true */
      revoked: boolean;
    };
    SessionRevocationResponseDto: {
      data: components["schemas"]["SessionRevocationResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    SessionRevocationResultDto: {
      /** @example true */
      revoked: boolean;
      /** Format: uuid */
      sessionId: string;
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
  AuthController_csrf: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CsrfResponseDto"];
        };
      };
    };
  };
  AuthController_login: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["LoginDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["LoginResponseDto"];
        };
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 登录失败次数过多 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AuthController_logout: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["LogoutResponseDto"];
        };
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AuthController_me: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CurrentUserResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AuthController_revokeSession: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SessionRevocationResponseDto"];
        };
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
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
