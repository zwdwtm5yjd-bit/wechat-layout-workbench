// 此文件由 pnpm api:generate 自动生成，请勿手工编辑。
export interface paths {
  "/api/v1/articles": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 列出当前用户的文章 */
    get: operations["ArticleController_list"];
    put?: never;
    /** 新建空白文章和独立 Document Schema 文档 */
    post: operations["ArticleController_create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取文章详情 */
    get: operations["ArticleController_get"];
    put?: never;
    post?: never;
    /** 将文章移入保留 30 天的回收站 */
    delete: operations["ArticleController_trash"];
    options?: never;
    head?: never;
    /** 更新文章元数据或用户可控状态 */
    patch: operations["ArticleController_update"];
    trace?: never;
  };
  "/api/v1/articles/{articleId}/archive": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 归档文章 */
    post: operations["ArticleController_archive"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/document": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取文章的当前权威文档 */
    get: operations["DocumentController_get"];
    /** 使用 documentVersion 乐观锁保存文章文档 */
    put: operations["DocumentController_save"];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/duplicate": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 复制文章并创建独立文档 */
    post: operations["ArticleController_duplicate"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/restore": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 从回收站恢复文章 */
    post: operations["ArticleController_restore"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/snapshots": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 按时间倒序列出文章的不可变快照 */
    get: operations["SnapshotController_list"];
    put?: never;
    /** 为当前权威文档创建手动快照 */
    post: operations["SnapshotController_create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/snapshots/{snapshotId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取不可变快照详情 */
    get: operations["SnapshotController_get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/snapshots/{snapshotId}/preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 读取快照的只读预览数据 */
    post: operations["SnapshotController_preview"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/snapshots/{snapshotId}/restore": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 创建安全快照后恢复目标版本 */
    post: operations["SnapshotController_restore"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/status-history": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取文章状态历史 */
    get: operations["ArticleController_history"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/unarchive": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 恢复归档文章原状态 */
    post: operations["ArticleController_unarchive"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
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
    ArticleDetailDto: {
      /** Format: uuid */
      accountId: string | null;
      /** Format: date-time */
      archivedAt: string | null;
      compatibilityScore: number | null;
      /** @enum {string|null} */
      compatibilityStatus: "excellent" | "usable" | "risk" | null;
      /** Format: uuid */
      contentGroupId: string | null;
      contentType: string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      deletedAt: string | null;
      /** Format: date-time */
      deletePurgeAfter: string | null;
      documentVersion: number | null;
      /** Format: uuid */
      id: string;
      imageCount: number;
      /** Format: date-time */
      lastSavedAt: string | null;
      /** @enum {string} */
      layoutStrength: "light" | "standard" | "strong";
      /** Format: date-time */
      publishedAt: string | null;
      /** @enum {string} */
      sourceType: "docx" | "paste" | "web" | "blank" | "copy";
      /** @enum {string} */
      status:
        | "pending_import"
        | "pending_recognition"
        | "pending_layout"
        | "layout_editing"
        | "pending_check"
        | "copied"
        | "synced"
        | "published"
        | "archived"
        | "import_failed"
        | "recognition_failed"
        | "save_failed"
        | "compatibility_failed"
        | "copy_failed"
        | "sync_failed";
      subtitle: string | null;
      svgCount: number;
      textLocked: boolean;
      /** Format: uuid */
      themeId: string | null;
      themeVersion: string | null;
      title: string;
      /** Format: date-time */
      updatedAt: string;
      wordCount: number;
    };
    ArticleDocumentDto: {
      /** Format: uuid */
      articleId: string;
      currentTextHash: string | null;
      document: {
        [key: string]: unknown;
      };
      /** Format: uuid */
      documentId: string;
      documentVersion: number;
      /** Format: date-time */
      lastSavedAt: string;
      /** Format: uuid */
      lastSavedBy: string;
      /** Format: uuid */
      lastTransactionId: string | null;
      originalTextHash: string | null;
      /** @enum {string} */
      schemaVersion: "1.0.0";
      textLocked: boolean;
    };
    ArticleDocumentResponseDto: {
      data: components["schemas"]["ArticleDocumentDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ArticleDto: {
      /** Format: uuid */
      accountId: string | null;
      /** Format: date-time */
      archivedAt: string | null;
      compatibilityScore: number | null;
      /** @enum {string|null} */
      compatibilityStatus: "excellent" | "usable" | "risk" | null;
      /** Format: uuid */
      contentGroupId: string | null;
      contentType: string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      deletedAt: string | null;
      /** Format: date-time */
      deletePurgeAfter: string | null;
      /** Format: uuid */
      id: string;
      imageCount: number;
      /** @enum {string} */
      layoutStrength: "light" | "standard" | "strong";
      /** Format: date-time */
      publishedAt: string | null;
      /** @enum {string} */
      sourceType: "docx" | "paste" | "web" | "blank" | "copy";
      /** @enum {string} */
      status:
        | "pending_import"
        | "pending_recognition"
        | "pending_layout"
        | "layout_editing"
        | "pending_check"
        | "copied"
        | "synced"
        | "published"
        | "archived"
        | "import_failed"
        | "recognition_failed"
        | "save_failed"
        | "compatibility_failed"
        | "copy_failed"
        | "sync_failed";
      subtitle: string | null;
      svgCount: number;
      textLocked: boolean;
      /** Format: uuid */
      themeId: string | null;
      themeVersion: string | null;
      title: string;
      /** Format: date-time */
      updatedAt: string;
      wordCount: number;
    };
    ArticleListResponseDto: {
      data: components["schemas"]["ArticleListResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ArticleListResultDto: {
      items: components["schemas"]["ArticleDto"][];
      pagination: components["schemas"]["ArticlePaginationDto"];
    };
    ArticlePaginationDto: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    ArticleResponseDto: {
      data: components["schemas"]["ArticleDetailDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ArticleStatusHistoryDto: {
      /** Format: date-time */
      createdAt: string;
      /** Format: uuid */
      createdBy: string;
      /** @enum {string|null} */
      fromStatus:
        | "pending_import"
        | "pending_recognition"
        | "pending_layout"
        | "layout_editing"
        | "pending_check"
        | "copied"
        | "synced"
        | "published"
        | "archived"
        | "import_failed"
        | "recognition_failed"
        | "save_failed"
        | "compatibility_failed"
        | "copy_failed"
        | "sync_failed"
        | null;
      /** Format: uuid */
      id: string;
      reason: string;
      /** @enum {string} */
      source: "user" | "system" | "import" | "copy" | "restore";
      /** @enum {string} */
      toStatus:
        | "pending_import"
        | "pending_recognition"
        | "pending_layout"
        | "layout_editing"
        | "pending_check"
        | "copied"
        | "synced"
        | "published"
        | "archived"
        | "import_failed"
        | "recognition_failed"
        | "save_failed"
        | "compatibility_failed"
        | "copy_failed"
        | "sync_failed";
    };
    ArticleStatusHistoryResponseDto: {
      data: components["schemas"]["ArticleStatusHistoryResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ArticleStatusHistoryResultDto: {
      items: components["schemas"]["ArticleStatusHistoryDto"][];
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
    CreateArticleDto: {
      /** Format: uuid */
      accountId?: string | null;
      /**
       * @default general
       * @example inspection
       */
      contentType: string;
      /**
       * @default standard
       * @enum {string}
       */
      layoutStrength: "light" | "standard" | "strong";
      /**
       * @default blank
       * @enum {string}
       */
      sourceType: "blank";
      /** @example 未命名文章 */
      title: string;
    };
    CreateSnapshotDto: {
      note?: string | null;
      /** @enum {string} */
      reason: "manual";
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
    DuplicateArticleDto: {
      /**
       * @default same_group
       * @enum {string}
       */
      contentGroupMode: "same_group" | "independent";
      /**
       * @default full
       * @enum {string}
       */
      copyMode: "full";
      /** Format: uuid */
      targetAccountId?: string | null;
      title?: string;
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
    RestoreSnapshotDto: {
      baseVersion: number;
      /** Format: uuid */
      lastTransactionId: string;
      /** @enum {string} */
      mode: "replace_current";
    };
    RestoreSnapshotResponseDto: {
      data: components["schemas"]["RestoreSnapshotResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    RestoreSnapshotResultDto: {
      documentVersion: number;
      /** Format: date-time */
      lastSavedAt: string;
      /** Format: uuid */
      lastTransactionId: string;
      /** Format: uuid */
      restoredFromSnapshotId: string;
      restoredSnapshot: components["schemas"]["SnapshotSummaryDto"];
      safetySnapshot: components["schemas"]["SnapshotSummaryDto"];
    };
    SaveArticleDocumentDto: {
      baseVersion: number;
      /** @description 符合 Document Schema V1 的完整文档 JSON */
      document: {
        [key: string]: unknown;
      };
      /** Format: uuid */
      lastTransactionId: string;
      /** @enum {string} */
      schemaVersion: "1.0.0";
      /** @example user_style_change */
      transactionOrigin: string;
    };
    SaveArticleDocumentResponseDto: {
      data: components["schemas"]["SaveArticleDocumentResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    SaveArticleDocumentResultDto: {
      documentVersion: number;
      /** Format: date-time */
      lastSavedAt: string;
      /** Format: uuid */
      lastTransactionId: string;
      /** @description 同一事务因网络恢复而安全重放时为 true */
      replayed: boolean;
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
    SnapshotDetailDto: {
      /** Format: uuid */
      articleId: string;
      /** Format: uuid */
      brandVersionId: string | null;
      compatibilityRuleVersion: string | null;
      compatibilityScore: number | null;
      /** Format: date-time */
      createdAt: string;
      /** Format: uuid */
      createdBy: string;
      document: {
        [key: string]: unknown;
      };
      documentSchemaVersion: string;
      htmlHash: string | null;
      /** Format: uuid */
      id: string;
      isCurrent: boolean;
      note: string | null;
      packageCount: number;
      packageManifest: components["schemas"]["SnapshotPackageManifestEntryDto"][];
      /** @enum {string} */
      reason:
        | "manual"
        | "after_import"
        | "before_theme_apply"
        | "before_copy"
        | "before_restore"
        | "restored";
      rendererVersion: string | null;
      resourceCount: number;
      resourceManifest: components["schemas"]["SnapshotResourceManifestEntryDto"][];
      snapshotNumber: number;
      textHash: string | null;
      /** Format: uuid */
      themeId: string | null;
      themeVersion: string | null;
    };
    SnapshotListResponseDto: {
      data: components["schemas"]["SnapshotListResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    SnapshotListResultDto: {
      items: components["schemas"]["SnapshotSummaryDto"][];
      pagination: components["schemas"]["SnapshotPaginationDto"];
    };
    SnapshotPackageManifestEntryDto: {
      /** @enum {string} */
      kind: "theme" | "brand" | "component" | "brand_footer" | "svg";
      packageId: string;
      version: string | null;
    };
    SnapshotPaginationDto: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    SnapshotResourceManifestEntryDto: {
      references: components["schemas"]["SnapshotResourceReferenceDto"][];
      resourceId: string;
    };
    SnapshotResourceReferenceDto: {
      blockId: string;
      usageType: string;
    };
    SnapshotResponseDto: {
      data: components["schemas"]["SnapshotDetailDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    SnapshotSummaryDto: {
      /** Format: uuid */
      articleId: string;
      /** Format: uuid */
      brandVersionId: string | null;
      compatibilityScore: number | null;
      /** Format: date-time */
      createdAt: string;
      /** Format: uuid */
      createdBy: string;
      documentSchemaVersion: string;
      /** Format: uuid */
      id: string;
      isCurrent: boolean;
      note: string | null;
      packageCount: number;
      /** @enum {string} */
      reason:
        | "manual"
        | "after_import"
        | "before_theme_apply"
        | "before_copy"
        | "before_restore"
        | "restored";
      resourceCount: number;
      snapshotNumber: number;
      /** Format: uuid */
      themeId: string | null;
      themeVersion: string | null;
    };
    UpdateArticleDto: {
      /** Format: uuid */
      accountId?: string | null;
      /** @example inspection */
      contentType?: string;
      /** @enum {string} */
      layoutStrength?: "light" | "standard" | "strong";
      /** @description 发布标记的便捷写法；不能与 status 同时提交 */
      published?: boolean;
      /**
       * @description 仅允许用户驱动的编辑阶段与发布状态
       * @enum {string}
       */
      status?: "pending_layout" | "layout_editing" | "pending_check" | "published";
      subtitle?: string | null;
      title?: string;
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
  ArticleController_list: {
    parameters: {
      query?: {
        accountId?: string;
        compatibilityStatus?: "excellent" | "usable" | "risk";
        contentType?: string;
        hasSvg?: boolean;
        page?: number;
        pageSize?: number;
        search?: string;
        sort?: "updated_desc" | "updated_asc" | "created_desc" | "title_asc";
        status?:
          | "pending_import"
          | "pending_recognition"
          | "pending_layout"
          | "layout_editing"
          | "pending_check"
          | "copied"
          | "synced"
          | "published"
          | "archived"
          | "import_failed"
          | "recognition_failed"
          | "save_failed"
          | "compatibility_failed"
          | "copy_failed"
          | "sync_failed"
          | "trash";
        themeId?: string;
      };
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
          "application/json": components["schemas"]["ArticleListResponseDto"];
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
  ArticleController_create: {
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
        "application/json": components["schemas"]["CreateArticleDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
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
  ArticleController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ArticleController_trash: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章已在回收站 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ArticleController_update: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["UpdateArticleDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章状态不允许当前操作 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ArticleController_archive: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章状态不允许当前操作 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  DocumentController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["ArticleDocumentResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  DocumentController_save: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SaveArticleDocumentDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SaveArticleDocumentResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description baseVersion 已过期，不会覆盖远端文档 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseOpenApiModel"];
        };
      };
    };
  };
  ArticleController_duplicate: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DuplicateArticleDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 回收站文章不能复制 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ArticleController_restore: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不在回收站 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  SnapshotController_list: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["SnapshotListResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  SnapshotController_create: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateSnapshotDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SnapshotResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  SnapshotController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        articleId: string;
        snapshotId: string;
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
          "application/json": components["schemas"]["SnapshotResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章或快照不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  SnapshotController_preview: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
        snapshotId: string;
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
          "application/json": components["schemas"]["SnapshotResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章或快照不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  SnapshotController_restore: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
        snapshotId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RestoreSnapshotDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RestoreSnapshotResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章或快照不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文档版本冲突或快照无效 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ArticleController_history: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["ArticleStatusHistoryResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ArticleController_unarchive: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
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
          "application/json": components["schemas"]["ArticleResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description CSRF 校验失败 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章未归档 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
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
