import type { Metadata } from "next";

import { ResourceLibrary } from "../../../../components/resource-library";

export const metadata: Metadata = { title: "素材库" };

export default function ResourcesPage() {
  return <ResourceLibrary />;
}
