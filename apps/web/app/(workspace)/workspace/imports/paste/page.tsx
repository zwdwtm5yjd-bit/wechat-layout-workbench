import type { Metadata } from "next";

import { ImportCenterWorkspace } from "../../../../../components/import-center-workspace";

export const metadata: Metadata = { title: "导入文章" };

export default function PasteImportPage() {
  return <ImportCenterWorkspace />;
}
