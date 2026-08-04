import type { Metadata } from "next";

import { JobCenter } from "../../../../components/job-center";

export const metadata: Metadata = { title: "任务中心" };

export default function JobsPage() {
  return <JobCenter />;
}
