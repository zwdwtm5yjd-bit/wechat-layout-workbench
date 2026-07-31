import type { Metadata } from "next";

import { ArticlePreviewWorkspace } from "../../../../../../components/article-preview-workspace";

export const metadata: Metadata = {
  title: "文章预览",
};

export default async function ArticlePreviewPage({
  params,
}: {
  readonly params: Promise<{ readonly articleId: string }>;
}) {
  const { articleId } = await params;
  return <ArticlePreviewWorkspace articleId={articleId} />;
}
