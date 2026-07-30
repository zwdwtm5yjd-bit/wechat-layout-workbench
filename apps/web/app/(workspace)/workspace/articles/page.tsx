import type { Metadata } from "next";

import { ArticleManager } from "../../../../components/article-manager";

export const metadata: Metadata = {
  title: "文章",
};

export default function ArticlesPage() {
  return <ArticleManager />;
}
