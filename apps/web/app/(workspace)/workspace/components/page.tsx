import type { Metadata } from "next";

import { ComponentCatalog } from "../../../../components/component-catalog";

export const metadata: Metadata = {
  title: "组件",
};

export default function ComponentsPage() {
  return <ComponentCatalog />;
}
