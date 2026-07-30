import type { Metadata } from "next";

import { PasteImportWorkspace } from "../../../../../components/paste-import-workspace";

export const metadata: Metadata = {
  title: "粘贴导入",
};

export default function PasteImportPage() {
  return <PasteImportWorkspace />;
}
