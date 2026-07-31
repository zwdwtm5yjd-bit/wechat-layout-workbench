import {
  PermanentJobError,
  RetryableJobError,
  type JobHandler,
  type JobJson,
} from "@wechat-layout/job-runtime";

function integer(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, minimum), maximum);
}

async function wait(durationMs: number, assertNotCancelled: () => Promise<void>): Promise<void> {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(100, end - Date.now())));
    await assertNotCancelled();
  }
}

export const maintenanceProbeHandler: JobHandler = async (context): Promise<JobJson> => {
  const durationMs = integer(context.job.payloadSummary.durationMs, 300, 0, 30_000);
  const failureMode = context.job.payloadSummary.failureMode;

  await context.progress(10, "维护探针开始执行", { attempt: context.attempt });

  if (failureMode === "permanent") {
    throw new PermanentJobError("MAINTENANCE_PERMANENT_FAILURE", "维护探针模拟永久错误");
  }
  if (failureMode === "retryable_once" && context.attempt === 1) {
    throw new RetryableJobError("MAINTENANCE_TRANSIENT_FAILURE", "维护探针模拟一次瞬时错误");
  }

  await wait(durationMs, context.assertNotCancelled);
  await context.progress(90, "维护探针即将完成");
  return {
    attempt: context.attempt,
    checkedAt: new Date().toISOString(),
    probe: "ok",
  };
};
