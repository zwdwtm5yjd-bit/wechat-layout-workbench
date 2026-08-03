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
  "/api/v1/articles/{articleId}/copy-payload": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 获取通过兼容门禁的短时双 MIME 复制 Payload */
    post: operations["CopyController_payload"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/copy-records": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 由浏览器回写剪贴板复制成功或失败记录 */
    post: operations["CopyController_record"];
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
  "/api/v1/articles/{articleId}/render-outputs/{renderOutputId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 读取正式微信渲染结果和兼容报告 */
    get: operations["CopyController_getRender"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/render-wechat": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 从当前权威文档创建正式微信渲染输出与复制前快照 */
    post: operations["CopyController_createRender"];
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
  "/api/v1/articles/{articleId}/themes/{themeId}/apply": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 创建安全快照后应用主题，不修改原文 */
    post: operations["ThemeController_apply"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/articles/{articleId}/themes/{themeId}/preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 试穿主题并返回微信安全预览，不修改文章 */
    post: operations["ThemeController_preview"];
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
  "/api/v1/imports/{articleId}/structure": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取可刷新恢复的原文与结构识别结果 */
    get: operations["ImportController_getStructure"];
    /** 使用乐观锁确认结构并创建导入后不可变快照 */
    put: operations["ImportController_confirm"];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/imports/docx": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 使用已上传的 DOCX 原文件创建异步导入任务 */
    post: operations["DocxImportController_create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/imports/paste": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 清洗 HTML/纯文本并创建待结构确认的粘贴导入 */
    post: operations["ImportController_createPaste"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/internal/metrics": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["MetricsController_getMetrics"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/jobs": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 按当前用户分页查询任务 */
    get: operations["JobController_list"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/jobs/{jobId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 读取任务状态、进度与结果摘要 */
    get: operations["JobController_get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/jobs/{jobId}/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 取消排队中或执行中的任务 */
    post: operations["JobController_cancel"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/jobs/{jobId}/events": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 订阅任务事件；支持 Last-Event-ID 断线续传 */
    get: operations["JobController_events"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/jobs/{jobId}/retry": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 重新入队一个允许重试的失败任务 */
    post: operations["JobController_retry"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/resources/{resourceId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取当前用户的资源元数据 */
    get: operations["ResourceController_get"];
    put?: never;
    post?: never;
    /** 将未被引用的资源移入保留 30 天的回收站 */
    delete: operations["ResourceController_trash"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/resources/{resourceId}/access-url": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 签发短时私有资源访问地址 */
    post: operations["ResourceController_createAccessUrl"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/resources/{resourceId}/references": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 列出阻止资源删除的引用 */
    get: operations["ResourceController_references"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/resources/uploads": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 创建私有图片或 DOCX 直传会话，或复用相同资源 */
    post: operations["ResourceController_createUpload"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/resources/uploads/{uploadId}/complete": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** 校验直传对象并登记资源 */
    post: operations["ResourceController_completeUpload"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/themes": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 列出已安装的官方主题 */
    get: operations["ThemeController_list"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/themes/{themeId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取官方主题详情 */
    get: operations["ThemeController_get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/themes/{themeId}/versions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 列出主题的不可变版本 */
    get: operations["ThemeController_versions"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/themes/{themeId}/versions/{version}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** 获取指定主题版本 */
    get: operations["ThemeController_getVersion"];
    put?: never;
    post?: never;
    delete?: never;
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
    ApplyThemeRequestDto: {
      baseDocumentVersion: number;
      /**
       * @default soft
       * @enum {string}
       */
      brandMode: "off" | "soft";
      /** Format: uuid */
      paletteId?: string;
      /** @default true */
      preserveLockedBlocks: boolean;
      /**
       * @default full
       * @enum {string}
       */
      scope: "full";
      /** @example 1.0.0 */
      themeVersion?: string;
    };
    ApplyThemeResponseDto: {
      data: components["schemas"]["ApplyThemeResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ApplyThemeResultDto: {
      /** Format: date-time */
      appliedAt: string;
      /** Format: uuid */
      articleId: string;
      documentVersion: number;
      /** Format: uuid */
      lastTransactionId: string;
      originalTextUnchanged: boolean;
      /** Format: uuid */
      paletteId: string;
      /** Format: uuid */
      safetySnapshotId: string;
      /** Format: uuid */
      themeId: string;
      themeVersion: string;
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
      sourceBlocks: components["schemas"]["ArticleDocumentSourceBlockDto"][];
      textLocked: boolean;
    };
    ArticleDocumentResponseDto: {
      data: components["schemas"]["ArticleDocumentDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ArticleDocumentSourceBlockDto: {
      blockType: string;
      orderIndex: number;
      sourceBlockId: string;
      text: string;
      textHash: string | null;
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
    CompleteResourceUploadDto: {
      etag: string;
    };
    ConfirmImportBlockDto: {
      /** @enum {string} */
      role:
        | "title"
        | "subtitle"
        | "heading_1"
        | "heading_2"
        | "heading_3"
        | "paragraph"
        | "quote"
        | "bullet_item"
        | "ordered_item"
        | "image_reference"
        | "excluded";
      sourceBlockId: string;
    };
    ConfirmImportResponseDto: {
      data: components["schemas"]["ConfirmImportResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ConfirmImportResultDto: {
      /** Format: uuid */
      accountId: string | null;
      /** Format: uuid */
      articleId: string;
      blocks: components["schemas"]["ImportStructureBlockDto"][];
      /** @enum {string} */
      cleaningMode: "preserve_structure" | "plain_text" | "preserve_compatible";
      /** @enum {string} */
      detectedSource:
        "word" | "wps" | "web" | "wechat" | "markdown" | "plain_text" | "chatgpt" | "claude";
      /** Format: uuid */
      documentId: string;
      documentVersion: number;
      editorUrl: string;
      /** Format: date-time */
      lastSavedAt: string;
      /** Format: uuid */
      lastTransactionId: string | null;
      /** @description 标准化原文，不包含原始 HTML */
      originalText: string;
      /** Format: uuid */
      snapshotId: string;
      snapshotNumber: number;
      /** Format: uuid */
      sourceDocumentId: string;
      statistics: components["schemas"]["ImportStatisticsDto"];
      /** @enum {string} */
      status: "pending_recognition" | "pending_layout";
      title: string;
      warnings: components["schemas"]["ImportWarningDto"][];
    };
    ConfirmImportStructureDto: {
      baseVersion: number;
      blocks: components["schemas"]["ConfirmImportBlockDto"][];
      /** Format: uuid */
      lastTransactionId: string;
      title?: string | null;
    };
    CopyPayloadRequestDto: {
      /** Format: uuid */
      renderOutputId: string;
    };
    CopyPayloadResponseDto: {
      /** Format: date-time */
      expiresAt: string;
      html: string;
      plainText: string;
      /** Format: uuid */
      renderOutputId: string;
    };
    CopyRecordResponseDto: {
      /** Format: date-time */
      copiedAt: string;
      /** Format: uuid */
      id: string;
      /** Format: uuid */
      renderOutputId: string;
      /** @enum {string} */
      status: "success" | "failed";
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
    CreateCopyRecordDto: {
      browserInfo: {
        [key: string]: string;
      };
      failureReason?: string;
      /** Format: uuid */
      renderOutputId: string;
      /** @enum {string} */
      status: "success" | "failed";
    };
    CreateResourceAccessUrlDto: {
      /** @default 300 */
      expiresInSeconds: number;
      /** @enum {string} */
      purpose: "editor_preview";
      /**
       * @default original
       * @enum {string}
       */
      variant: "original" | "thumbnail";
    };
    CreateResourceUploadDto: {
      /** Format: uuid */
      accountId?: string | null;
      filename: string;
      fileSize: number;
      /** @enum {string} */
      mimeType:
        | "image/png"
        | "image/jpeg"
        | "image/webp"
        | "image/gif"
        | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      sha256: string;
    };
    CreateSnapshotDto: {
      note?: string | null;
      /** @enum {string} */
      reason: "manual";
    };
    CreateWechatRenderDto: {
      documentVersion: number;
      /** @enum {string} */
      outputMode: "standard" | "wechat_safe" | "static";
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
    DocxImportDto: {
      /** Format: uuid */
      accountId?: string | null;
      /**
       * @default preserve_structure
       * @enum {string}
       */
      cleaningMode: "preserve_structure" | "plain_text" | "preserve_compatible";
      /** @default general */
      contentType: string;
      /**
       * @default standard
       * @enum {string}
       */
      layoutStrength: "light" | "standard" | "strong";
      /** Format: uuid */
      resourceId: string;
    };
    DocxImportJobDto: {
      /** Format: uuid */
      articleId: string;
      /** Format: uuid */
      jobId: string;
    };
    DocxImportJobResponseDto: {
      data: components["schemas"]["DocxImportJobDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
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
    ImportBlockRelationDto: {
      alt?: string;
      listDepth?: number;
      listStart?: number;
      originalNumberText?: string;
      sourceUrl?: string | null;
      tableCells?: string[];
    };
    ImportStatisticsDto: {
      blockCount: number;
      characterCount: number;
      headingCount: number;
      imageCount: number;
      removedHiddenNodeCount: number;
      removedSecurityNodeCount: number;
      removedStyleCount: number;
      removedUnsafeLinkCount: number;
      tableCount: number;
      wordCount: number;
    };
    ImportStructureBlockDto: {
      orderIndex: number;
      originalTag?: string | null;
      relation: components["schemas"]["ImportBlockRelationDto"];
      /** @enum {string} */
      role:
        | "title"
        | "subtitle"
        | "heading_1"
        | "heading_2"
        | "heading_3"
        | "paragraph"
        | "quote"
        | "bullet_item"
        | "ordered_item"
        | "image_reference"
        | "excluded";
      sourceBlockId: string;
      text: string;
    };
    ImportStructureDto: {
      /** Format: uuid */
      accountId: string | null;
      /** Format: uuid */
      articleId: string;
      blocks: components["schemas"]["ImportStructureBlockDto"][];
      /** @enum {string} */
      cleaningMode: "preserve_structure" | "plain_text" | "preserve_compatible";
      /** @enum {string} */
      detectedSource:
        "word" | "wps" | "web" | "wechat" | "markdown" | "plain_text" | "chatgpt" | "claude";
      /** Format: uuid */
      documentId: string;
      documentVersion: number;
      /** Format: date-time */
      lastSavedAt: string;
      /** Format: uuid */
      lastTransactionId: string | null;
      /** @description 标准化原文，不包含原始 HTML */
      originalText: string;
      /** Format: uuid */
      sourceDocumentId: string;
      statistics: components["schemas"]["ImportStatisticsDto"];
      /** @enum {string} */
      status: "pending_recognition" | "pending_layout";
      title: string;
      warnings: components["schemas"]["ImportWarningDto"][];
    };
    ImportStructureResponseDto: {
      data: components["schemas"]["ImportStructureDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ImportWarningDto: {
      /** @enum {string} */
      code:
        | "SECURITY_CONTENT_REMOVED"
        | "HIDDEN_CONTENT_REMOVED"
        | "UNSAFE_LINK_REMOVED"
        | "STYLE_CLEANED"
        | "UNSUPPORTED_STRUCTURE_FLATTENED"
        | "EXTERNAL_IMAGE_REFERENCE"
        | "EMPTY_CONTENT_SKIPPED";
      count: number;
      message: string;
      /** @enum {string} */
      severity: "info" | "warning";
    };
    JobEventResultDto: {
      /** Format: date-time */
      createdAt: string;
      /** @enum {string} */
      eventType:
        "queued" | "started" | "progress" | "warning" | "completed" | "failed" | "cancelled";
      /** Format: uuid */
      id: string;
      /** Format: uuid */
      jobId: string;
      message: string | null;
      metadata: {
        [key: string]: unknown;
      };
      progress: number | null;
    };
    JobListResultDto: {
      items: components["schemas"]["JobResultDto"][];
      page: number;
      pageSize: number;
      total: number;
    };
    JobResultDto: {
      /** Format: uuid */
      accountId: string | null;
      /** Format: uuid */
      articleId: string | null;
      attemptCount: number;
      /** Format: date-time */
      completedAt: string | null;
      /** Format: date-time */
      createdAt: string;
      errorCode: string | null;
      errorMessage: string | null;
      /** Format: uuid */
      id: string;
      jobType: string;
      latestMessage: string | null;
      maxAttempts: number;
      progress: number;
      queueName: string;
      resultRef: string | null;
      resultSummary: {
        [key: string]: unknown;
      };
      /** @enum {string} */
      status: "queued" | "running" | "success" | "failed" | "cancelled" | "retry_pending";
      /** Format: date-time */
      updatedAt: string;
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
    PasteImportDto: {
      /** Format: uuid */
      accountId?: string | null;
      /**
       * @default preserve_structure
       * @enum {string}
       */
      cleaningMode: "preserve_structure" | "plain_text" | "preserve_compatible";
      /** @default general */
      contentType: string;
      /**
       * @default auto
       * @enum {string}
       */
      detectedSourceHint:
        | "auto"
        | "word"
        | "wps"
        | "web"
        | "wechat"
        | "markdown"
        | "plain_text"
        | "chatgpt"
        | "claude";
      /** @description 剪贴板提供的 HTML；服务端只保存清洗后的结构和标准化纯文本 */
      html?: string;
      /**
       * @default standard
       * @enum {string}
       */
      layoutStrength: "light" | "standard" | "strong";
      /** @description 剪贴板纯文本回退，也是原文追踪的优先来源 */
      plainText?: string;
    };
    RenderOutputResponseDto: {
      canCopy: boolean;
      compatibilityReport: {
        [key: string]: unknown;
      };
      compatibilityRuleVersion: string;
      /** Format: date-time */
      expiresAt: string;
      /** Format: date-time */
      generatedAt: string;
      /** Format: uuid */
      id: string;
      outputHash: string | null;
      /** @enum {string} */
      outputMode: "standard" | "wechat_safe" | "static";
      rendererVersion: string;
      /** Format: uuid */
      snapshotId: string;
      /** @enum {string} */
      status: "ready" | "blocked" | "failed";
    };
    ResourceAccessUrlDto: {
      /** Format: date-time */
      expiresAt: string;
      headers: {
        [key: string]: string;
      };
      url: string;
    };
    ResourceAccessUrlResponseDto: {
      data: components["schemas"]["ResourceAccessUrlDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ResourceDto: {
      /** Format: uuid */
      accountId: string | null;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      deletedAt: string | null;
      fileExtension: string | null;
      fileSize: number;
      height: number | null;
      /** Format: uuid */
      id: string;
      isPrivate: boolean;
      /** @enum {string} */
      mimeType:
        | "image/png"
        | "image/jpeg"
        | "image/webp"
        | "image/gif"
        | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      originalFilename: string | null;
      /** Format: date-time */
      purgeAfter: string | null;
      resourceType: string;
      sha256: string;
      sourceType: string;
      /** @enum {string} */
      status: "active" | "trash";
      thumbnail: components["schemas"]["ResourceThumbnailDto"] | null;
      /** Format: date-time */
      updatedAt: string;
      width: number | null;
    };
    ResourceReferenceDto: {
      blockId: string | null;
      /** Format: uuid */
      id: string;
      /** @enum {string} */
      kind: "article" | "source_document" | "avatar" | "derived_resource";
      label: string;
      usageType: string | null;
    };
    ResourceReferencesDto: {
      items: components["schemas"]["ResourceReferenceDto"][];
      total: number;
    };
    ResourceReferencesResponseDto: {
      data: components["schemas"]["ResourceReferencesDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ResourceResponseDto: {
      data: components["schemas"]["ResourceDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ResourceThumbnailDto: {
      available: boolean;
      fileSize: number;
      height: number;
      mimeType: string;
      width: number;
    };
    ResourceUploadResponseDto: {
      data: components["schemas"]["ResourceUploadResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ResourceUploadResultDto: {
      /** Format: date-time */
      expiresAt: string | null;
      headers: {
        [key: string]: string;
      };
      resource: components["schemas"]["ResourceDto"] | null;
      /** @enum {string} */
      status: "upload_required" | "deduplicated";
      /** Format: uuid */
      uploadId: string | null;
      uploadUrl: string | null;
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
    ThemeDto: {
      compatibility: {
        [key: string]: unknown;
      };
      componentRefs: string[];
      installed: boolean;
      manifest: components["schemas"]["ThemeManifestDto"];
      preview: components["schemas"]["ThemePreviewAssetDto"];
      tokens: {
        [key: string]: unknown;
      };
      variants: Record<string, never>[];
    };
    ThemeListResponseDto: {
      data: components["schemas"]["ThemeListResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ThemeListResultDto: {
      items: components["schemas"]["ThemeDto"][];
      pagination: components["schemas"]["ThemePaginationDto"];
    };
    ThemeManifestDto: {
      categories: string[];
      /** @enum {string} */
      compatibilityLevel: "safe" | "compatible" | "conditional";
      componentSetId: string;
      /** Format: date-time */
      createdAt: string;
      /** Format: uuid */
      defaultPaletteId: string;
      description: string;
      familyId: string;
      isDefault: boolean;
      name: string;
      recommendedContentTypes: string[];
      /** @enum {string} */
      status: "published";
      supportedPalettes: string[];
      /** Format: uuid */
      themeId: string;
      /** @example 1.0.0 */
      version: string;
    };
    ThemePaginationDto: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    ThemePreviewAssetDto: {
      accentColors: string[];
      body: string;
      dataLabel: string;
      dataValue: string;
      footer: string;
      heading1: string;
      heading2: string;
      heading3: string;
      imageAlt: string;
      mobileViewportWidth: number;
      quote: string;
      wechatContentWidth: number;
    };
    ThemePreviewRequestDto: {
      /**
       * @default soft
       * @enum {string}
       */
      brandMode: "off" | "soft";
      /** Format: uuid */
      paletteId?: string;
      /**
       * @default full
       * @enum {string}
       */
      scope: "full";
      /** @example 1.0.0 */
      themeVersion?: string;
    };
    ThemePreviewResponseDto: {
      data: components["schemas"]["ThemeRenderPreviewDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ThemeRenderPreviewDto: {
      /** Format: uuid */
      articleId: string;
      compatibilityReport: {
        [key: string]: unknown;
      };
      documentVersion: number;
      html: string;
      outputHash: string;
      /** Format: uuid */
      paletteId: string;
      textIntegrity: {
        [key: string]: unknown;
      };
      /** Format: uuid */
      themeId: string;
      themeVersion: string;
    };
    ThemeResponseDto: {
      data: components["schemas"]["ThemeDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ThemeVersionsResponseDto: {
      data: components["schemas"]["ThemeVersionsResultDto"];
      meta: components["schemas"]["ApiMetaOpenApiModel"];
      /** @example true */
      success: boolean;
    };
    ThemeVersionsResultDto: {
      items: components["schemas"]["ThemeDto"][];
      total: number;
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
  CopyController_payload: {
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
        "application/json": components["schemas"]["CopyPayloadRequestDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CopyPayloadResponseDto"];
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
      /** @description 渲染输出不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 兼容检查阻止正式复制 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 复制 Payload 已过期 */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  CopyController_record: {
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
        "application/json": components["schemas"]["CreateCopyRecordDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CopyRecordResponseDto"];
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
      /** @description 渲染输出不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 被阻止的输出不能记录成功 */
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
  CopyController_getRender: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        articleId: string;
        renderOutputId: string;
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
          "application/json": components["schemas"]["RenderOutputResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 渲染输出不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  CopyController_createRender: {
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
        "application/json": components["schemas"]["CreateWechatRenderDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RenderOutputResponseDto"];
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
      /** @description 文档版本冲突或兼容检查阻止复制 */
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
  ThemeController_apply: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
        themeId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ApplyThemeRequestDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplyThemeResponseDto"];
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
      /** @description 文章或主题不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文章版本冲突或主题预览失败 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ThemeController_preview: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        articleId: string;
        themeId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ThemePreviewRequestDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ThemePreviewResponseDto"];
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
      /** @description 文章或主题不存在 */
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
  ImportController_getStructure: {
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
          "application/json": components["schemas"]["ImportStructureResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 导入文章或原文不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ImportController_confirm: {
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
        "application/json": components["schemas"]["ConfirmImportStructureDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ConfirmImportResponseDto"];
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
      /** @description 导入文章或原文不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 文档版本冲突、结构已确认或区块集合不一致 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  DocxImportController_create: {
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
        "application/json": components["schemas"]["DocxImportDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["DocxImportJobResponseDto"];
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
      /** @description DOCX 资源不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 资源不是可导入的活动 DOCX */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ImportController_createPaste: {
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
        "application/json": components["schemas"]["PasteImportDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ImportStructureResponseDto"];
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
  MetricsController_getMetrics: {
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
        content?: never;
      };
    };
  };
  JobController_list: {
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
          "application/json": components["schemas"]["JobListResultDto"];
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
  JobController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        jobId: string;
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
          "application/json": components["schemas"]["JobResultDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 任务不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  JobController_cancel: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        jobId: string;
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
          "application/json": components["schemas"]["JobResultDto"];
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
      /** @description 任务不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  JobController_events: {
    parameters: {
      query?: never;
      header?: {
        "Last-Event-ID"?: string;
      };
      path: {
        jobId: string;
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
          "text/event-stream": components["schemas"]["JobEventResultDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 任务不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  JobController_retry: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        jobId: string;
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
          "application/json": components["schemas"]["JobResultDto"];
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
      /** @description 任务不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 任务未失败或错误不可重试 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ResourceController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        resourceId: string;
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
          "application/json": components["schemas"]["ResourceResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 资源不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ResourceController_trash: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        resourceId: string;
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
          "application/json": components["schemas"]["ResourceResponseDto"];
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
      /** @description 资源不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 资源仍被文章或其他实体引用 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ResourceController_createAccessUrl: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        resourceId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateResourceAccessUrlDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ResourceAccessUrlResponseDto"];
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
      /** @description 资源不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 请求的资源变体不可用 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ResourceController_references: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        resourceId: string;
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
          "application/json": components["schemas"]["ResourceReferencesResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 资源不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ResourceController_createUpload: {
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
        "application/json": components["schemas"]["CreateResourceUploadDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ResourceUploadResponseDto"];
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
      /** @description 相同摘要对应的文件元数据冲突 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ResourceController_completeUpload: {
    parameters: {
      query?: never;
      header: {
        "X-CSRF-Token": string;
      };
      path: {
        uploadId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CompleteResourceUploadDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ResourceResponseDto"];
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
      /** @description 上传会话不存在或已过期 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 上传对象尚未就绪 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ThemeController_list: {
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
          "application/json": components["schemas"]["ThemeListResponseDto"];
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
  ThemeController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        themeId: string;
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
          "application/json": components["schemas"]["ThemeResponseDto"];
        };
      };
      /** @description 会话不存在、已到期或已撤销 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 主题不存在 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ThemeController_versions: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        themeId: string;
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
          "application/json": components["schemas"]["ThemeVersionsResponseDto"];
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
  ThemeController_getVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        themeId: string;
        version: string;
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
          "application/json": components["schemas"]["ThemeResponseDto"];
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
