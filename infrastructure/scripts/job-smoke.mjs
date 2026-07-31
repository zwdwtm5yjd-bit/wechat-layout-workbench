import assert from "node:assert/strict";
import process from "node:process";

import { createDatabaseConnection, createUuidV7 } from "./packages/database/dist/index.js";
import { JobCoordinator, JobQueueRegistry, JobStore } from "./packages/job-runtime/dist/index.js";

const apiBaseUrl = "http://127.0.0.1:3001";
const password = "correct-password-secret-marker";
const passwordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$FM9dAIf0WYf24OZpTOxpyA$m+jg0HVeC0/KOKRMWP1WXLQCsiYztbr0pSBYtfRELKQ";
const userId = createUuidV7();
const email = `job-smoke-${userId}@example.invalid`;
const connection = createDatabaseConnection(process.env.DATABASE_URL, {
  applicationName: "job-smoke",
});
const store = new JobStore(connection);
const queues = new JobQueueRegistry(process.env.REDIS_URL);
const coordinator = new JobCoordinator(store, queues);

function cookieHeader(response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

async function responseData(response, expectedStatus) {
  const payload = await response.json();
  assert.equal(
    response.status,
    expectedStatus,
    `${response.url} returned ${response.status}: ${JSON.stringify(payload)}`,
  );
  assert.equal(payload.success, true, `${response.url} did not return a success envelope`);
  return payload.data;
}

async function waitForJob(jobId, statuses, cookie, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await globalThis.fetch(`${apiBaseUrl}/api/v1/jobs/${jobId}`, {
      headers: { cookie },
    });
    const job = await responseData(response, 200);
    if (statuses.includes(job.status)) return job;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
  }
  throw new Error(`等待任务状态超时：${jobId} -> ${statuses.join(",")}`);
}

async function waitForStartedCount(jobId, count) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const rows = await connection.sql`
      select count(*)::int as count
      from operations.job_events
      where job_id = ${jobId}::uuid and event_type = 'started'
    `;
    if ((rows[0]?.count ?? 0) >= count) return;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
  }
  throw new Error(`等待任务第 ${count} 次执行超时：${jobId}`);
}

async function write(path, cookie, csrfToken) {
  return globalThis.fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { cookie, "x-csrf-token": csrfToken },
  });
}

try {
  await connection.sql`
    insert into auth.users (
      id, email, display_name, password_hash, role, status, timezone, locale
    ) values (
      ${userId}::uuid, ${email}, 'Job Smoke', ${passwordHash},
      'owner', 'active', 'Asia/Shanghai', 'zh-CN'
    )
  `;

  const csrfResponse = await globalThis.fetch(`${apiBaseUrl}/api/v1/auth/csrf`);
  const csrf = await responseData(csrfResponse, 200);
  const anonymousCookies = cookieHeader(csrfResponse);
  const loginResponse = await globalThis.fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      cookie: anonymousCookies,
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
    },
    body: JSON.stringify({ identifier: email, password, rememberDevice: false }),
  });
  const login = await responseData(loginResponse, 200);
  const sessionCookies = cookieHeader(loginResponse);

  const successful = await coordinator.enqueue({
    queueName: "maintenance",
    jobType: "maintenance.probe",
    ownerUserId: userId,
    idempotencyKey: `smoke-success-${userId}`,
    payloadSummary: { durationMs: 50 },
  });
  const duplicate = await coordinator.enqueue({
    queueName: "maintenance",
    jobType: "maintenance.probe",
    ownerUserId: userId,
    idempotencyKey: `smoke-success-${userId}`,
    payloadSummary: { durationMs: 50 },
  });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.job.id, successful.job.id);
  const completed = await waitForJob(successful.job.id, ["success"], sessionCookies);
  assert.equal(completed.progress, 100);

  const list = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/jobs?status=success`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(
    list.items.some((job) => job.id === successful.job.id),
    true,
  );

  const events = await store.eventsOwned(userId, successful.job.id);
  assert.ok(events?.length >= 4, "成功任务应持久化完整事件流");
  const cursor = events[0].id;
  const stream = await globalThis.fetch(`${apiBaseUrl}/api/v1/jobs/${successful.job.id}/events`, {
    headers: { cookie: sessionCookies, "Last-Event-ID": cursor },
  });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
  const eventText = await stream.text();
  assert.equal(eventText.includes(`id: ${cursor}`), false);
  assert.equal(eventText.includes(`id: ${events.at(-1).id}`), true);

  const transient = await coordinator.enqueue({
    queueName: "maintenance",
    jobType: "maintenance.probe",
    ownerUserId: userId,
    payloadSummary: { durationMs: 0, failureMode: "retryable_once" },
    maxAttempts: 3,
  });
  const retried = await waitForJob(transient.job.id, ["success"], sessionCookies);
  assert.equal(retried.attemptCount, 2);

  const permanent = await coordinator.enqueue({
    queueName: "maintenance",
    jobType: "maintenance.probe",
    ownerUserId: userId,
    payloadSummary: { failureMode: "permanent" },
    maxAttempts: 5,
  });
  const failed = await waitForJob(permanent.job.id, ["failed"], sessionCookies);
  assert.equal(failed.attemptCount, 1);
  assert.equal(failed.resultSummary.retryable, false);

  const manual = await coordinator.enqueue({
    queueName: "maintenance",
    jobType: "maintenance.probe",
    ownerUserId: userId,
    payloadSummary: { failureMode: "retryable_once" },
    maxAttempts: 1,
  });
  await waitForJob(manual.job.id, ["failed"], sessionCookies);
  const manualRetry = await responseData(
    await write(`/api/v1/jobs/${manual.job.id}/retry`, sessionCookies, login.csrfToken),
    200,
  );
  assert.equal(["retry_pending", "running", "failed"].includes(manualRetry.status), true);
  await waitForStartedCount(manual.job.id, 2);
  await waitForJob(manual.job.id, ["failed"], sessionCookies);

  const cancellable = await coordinator.enqueue({
    queueName: "maintenance",
    jobType: "maintenance.probe",
    ownerUserId: userId,
    payloadSummary: { durationMs: 10_000 },
  });
  await waitForJob(cancellable.job.id, ["running"], sessionCookies);
  const cancelled = await responseData(
    await write(`/api/v1/jobs/${cancellable.job.id}/cancel`, sessionCookies, login.csrfToken),
    200,
  );
  assert.equal(cancelled.status, "cancelled");
  await new Promise((resolve) => globalThis.setTimeout(resolve, 300));
  assert.equal((await store.find(cancellable.job.id))?.status, "cancelled");
} finally {
  await queues.close();
  await connection.sql`delete from audit.audit_logs where actor_user_id = ${userId}::uuid`;
  await connection.sql`delete from operations.jobs where owner_user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.user_sessions where user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.users where id = ${userId}::uuid`;
  await connection.close();
}
