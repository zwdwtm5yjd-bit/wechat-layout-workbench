import { createUuidV7 } from "@wechat-layout/database";
import {
  PermanentJobError,
  RetryableJobError,
  type JobHandlerContext,
  type JobRecord,
} from "@wechat-layout/job-runtime";
import { describe, expect, it, vi } from "vitest";

import { maintenanceProbeHandler } from "./maintenance-handler.js";

function record(payloadSummary: Readonly<Record<string, unknown>>): JobRecord {
  const now = new Date("2026-08-01T00:00:00.000Z");
  return {
    id: createUuidV7(),
    queueName: "maintenance",
    jobType: "maintenance.probe",
    ownerUserId: createUuidV7(),
    articleId: null,
    accountId: null,
    status: "running",
    priority: 0,
    progress: 0,
    idempotencyKey: null,
    payloadRef: null,
    payloadSummary,
    resultRef: null,
    resultSummary: {},
    attemptCount: 1,
    maxAttempts: 3,
    scheduledAt: now,
    startedAt: now,
    completedAt: null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
    traceId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function context(payload: Readonly<Record<string, unknown>>, attempt = 1): JobHandlerContext {
  return {
    attempt,
    job: record(payload),
    signal: undefined,
    assertNotCancelled: vi.fn().mockResolvedValue(undefined),
    progress: vi.fn().mockResolvedValue(undefined),
  };
}

describe("maintenanceProbeHandler", () => {
  it("reports progress and returns a probe result", async () => {
    const input = context({ durationMs: 0 });
    await expect(maintenanceProbeHandler(input)).resolves.toMatchObject({
      probe: "ok",
      attempt: 1,
    });
    expect(input.progress).toHaveBeenCalledTimes(2);
  });

  it("classifies transient and permanent failures", async () => {
    await expect(
      maintenanceProbeHandler(context({ failureMode: "retryable_once" })),
    ).rejects.toBeInstanceOf(RetryableJobError);
    await expect(
      maintenanceProbeHandler(context({ failureMode: "permanent" })),
    ).rejects.toBeInstanceOf(PermanentJobError);
    await expect(
      maintenanceProbeHandler(context({ durationMs: 0, failureMode: "retryable_once" }, 2)),
    ).resolves.toMatchObject({ probe: "ok", attempt: 2 });
  });
});
