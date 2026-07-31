import type { Metadata } from "next";

import { WorkspaceDashboard } from "../../../components/workspace-dashboard";

export const metadata: Metadata = {
  title: "工作台",
};

export default function WorkspacePage() {
  const today = new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    weekday: "long",
  }).format(new Date());

  return <WorkspaceDashboard today={today} />;
}
