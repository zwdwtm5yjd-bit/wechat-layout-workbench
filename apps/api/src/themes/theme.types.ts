import type { DocumentV1 } from "@wechat-layout/document-schema";

import type { RequestContext } from "../common/http/request-context.js";

export interface ThemeArticleSource {
  readonly accountId: string | null;
  readonly articleId: string;
  readonly currentTextHash: string | null;
  readonly document: DocumentV1;
  readonly documentVersion: number;
  readonly themeId: string | null;
  readonly themeVersion: string | null;
}

export type ThemeMutationContext = RequestContext & { readonly actorUserId: string };

export interface ApplyThemeInput {
  readonly articleId: string;
  readonly baseDocumentVersion: number;
  readonly context: ThemeMutationContext;
  readonly ownerUserId: string;
  readonly paletteId: string;
  readonly themeId: string;
  readonly themeVersion: string;
}

export type ApplyThemeResult =
  | {
      readonly appliedAt: Date;
      readonly documentVersion: number;
      readonly kind: "applied";
      readonly lastTransactionId: string;
    }
  | { readonly kind: "not_found" }
  | {
      readonly currentVersion: number;
      readonly kind: "version_conflict";
    };

export interface ThemeRepository {
  apply(input: ApplyThemeInput): Promise<ApplyThemeResult>;
  findArticle(ownerUserId: string, articleId: string): Promise<ThemeArticleSource | null>;
}
