import type { Metadata } from "next";

import { ThemeCatalog } from "../../../../components/theme-catalog";

export const metadata: Metadata = {
  title: "主题",
};

export default function ThemesPage() {
  return <ThemeCatalog />;
}
