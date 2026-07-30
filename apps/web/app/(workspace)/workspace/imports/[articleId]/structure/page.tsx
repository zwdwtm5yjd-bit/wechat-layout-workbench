import type { Metadata } from "next";

import { ImportStructureWorkspace } from "../../../../../../components/import-structure-workspace";

export const metadata: Metadata = {
  title: "确认文章结构",
};

export default async function ImportStructurePage({
  params,
}: {
  readonly params: Promise<{ readonly articleId: string }>;
}) {
  const { articleId } = await params;
  return <ImportStructureWorkspace articleId={articleId} />;
}
