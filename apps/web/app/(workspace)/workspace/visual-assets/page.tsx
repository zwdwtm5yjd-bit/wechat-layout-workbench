import type { Metadata } from "next";

import { VisualAssetCatalog } from "../../../../components/visual-asset-catalog";

export const metadata: Metadata = {
  title: "视觉素材",
};

export default function VisualAssetsPage() {
  return <VisualAssetCatalog />;
}
