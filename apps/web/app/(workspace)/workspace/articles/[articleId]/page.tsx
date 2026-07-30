import type { Metadata } from "next";

import { DocumentWorkspace } from "../../../../../components/document-workspace";

export const metadata: Metadata = {
  title: "文章文档",
};

export default async function ArticleDocumentPage({
  params,
}: {
  readonly params: Promise<{ readonly articleId: string }>;
}) {
  const { articleId } = await params;
  return <DocumentWorkspace articleId={articleId} />;
}
