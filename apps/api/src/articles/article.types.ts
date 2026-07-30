export const ARTICLE_STATUSES = [
  "pending_import",
  "pending_recognition",
  "pending_layout",
  "layout_editing",
  "pending_check",
  "copied",
  "synced",
  "published",
  "archived",
  "import_failed",
  "recognition_failed",
  "save_failed",
  "compatibility_failed",
  "copy_failed",
  "sync_failed",
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export type ArticleListStatus = ArticleStatus | "trash";
export type ArticleLayoutStrength = "light" | "standard" | "strong";
export type ArticleCompatibilityStatus = "excellent" | "usable" | "risk";
export type ArticleSort = "updated_desc" | "updated_asc" | "created_desc" | "title_asc";

export interface ArticleRecord {
  readonly id: string;
  readonly ownerUserId: string;
  readonly accountId: string | null;
  readonly contentGroupId: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly slug: string | null;
  readonly contentType: string;
  readonly sourceType: string;
  readonly status: ArticleStatus;
  readonly themeId: string | null;
  readonly themeVersion: string | null;
  readonly paletteId: string | null;
  readonly brandVersionId: string | null;
  readonly layoutStrength: ArticleLayoutStrength;
  readonly textLocked: boolean;
  readonly wordCount: number;
  readonly imageCount: number;
  readonly svgCount: number;
  readonly compatibilityScore: number | null;
  readonly compatibilityStatus: ArticleCompatibilityStatus | null;
  readonly currentSnapshotId: string | null;
  readonly copiedAt: Date | null;
  readonly syncedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly deletePurgeAfter: Date | null;
}

export interface ArticleDetailRecord extends ArticleRecord {
  readonly documentVersion: number | null;
  readonly lastSavedAt: Date | null;
}

export interface ArticleListQuery {
  readonly accountId?: string;
  readonly status?: ArticleListStatus;
  readonly contentType?: string;
  readonly themeId?: string;
  readonly hasSvg?: boolean;
  readonly compatibilityStatus?: ArticleCompatibilityStatus;
  readonly search?: string;
  readonly sort: ArticleSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface ArticleListResult {
  readonly items: readonly ArticleRecord[];
  readonly total: number;
}

export interface CreateArticleInput {
  readonly ownerUserId: string;
  readonly title: string;
  readonly accountId: string | null;
  readonly contentType: string;
  readonly layoutStrength: ArticleLayoutStrength;
  readonly context: ArticleMutationContext;
}

export interface UpdateArticleInput {
  readonly title?: string;
  readonly subtitle?: string | null;
  readonly accountId?: string | null;
  readonly contentType?: string;
  readonly layoutStrength?: ArticleLayoutStrength;
  readonly status?: ArticleStatus;
}

export interface DuplicateArticleInput {
  readonly title?: string;
  readonly targetAccountId?: string | null;
  readonly contentGroupMode: "same_group" | "independent";
  readonly context: ArticleMutationContext;
}

export interface ArticleMutationContext {
  readonly actorUserId: string;
  readonly requestId: string;
  readonly traceId: string;
}

export interface ArticleStatusHistoryRecord {
  readonly id: string;
  readonly articleId: string;
  readonly fromStatus: ArticleStatus | null;
  readonly toStatus: ArticleStatus;
  readonly reason: string;
  readonly source: "user" | "system" | "import" | "copy" | "restore";
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface ArticleRepository {
  list(ownerUserId: string, query: ArticleListQuery): Promise<ArticleListResult>;
  findDetail(ownerUserId: string, articleId: string): Promise<ArticleDetailRecord | null>;
  create(input: CreateArticleInput): Promise<ArticleDetailRecord>;
  update(
    ownerUserId: string,
    articleId: string,
    patch: UpdateArticleInput,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null>;
  duplicate(
    ownerUserId: string,
    articleId: string,
    input: DuplicateArticleInput,
  ): Promise<ArticleDetailRecord | null>;
  archive(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null>;
  unarchive(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null>;
  trash(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null>;
  restore(
    ownerUserId: string,
    articleId: string,
    context: ArticleMutationContext,
  ): Promise<ArticleDetailRecord | null>;
  statusHistory(
    ownerUserId: string,
    articleId: string,
  ): Promise<readonly ArticleStatusHistoryRecord[] | null>;
}
