import assert from "node:assert/strict";
import process from "node:process";

import { createDatabaseConnection, createUuidV7 } from "./packages/database/dist/index.js";

const apiBaseUrl = "http://127.0.0.1:3001";
const password = "correct-password-secret-marker";
const passwordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$FM9dAIf0WYf24OZpTOxpyA$m+jg0HVeC0/KOKRMWP1WXLQCsiYztbr0pSBYtfRELKQ";
const userId = createUuidV7();
const email = `article-smoke-${userId}@example.invalid`;
const connection = createDatabaseConnection(process.env.DATABASE_URL, {
  applicationName: "article-smoke",
});

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

async function write(path, method, cookie, csrfToken, body) {
  return globalThis.fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      "x-csrf-token": csrfToken,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

try {
  await connection.sql`
    insert into auth.users (
      id,
      email,
      display_name,
      password_hash,
      role,
      status,
      timezone,
      locale
    )
    values (
      ${userId}::uuid,
      ${email},
      'Article Smoke',
      ${passwordHash},
      'owner',
      'active',
      'Asia/Shanghai',
      'zh-CN'
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
    body: JSON.stringify({
      identifier: email,
      password,
      rememberDevice: false,
    }),
  });
  const login = await responseData(loginResponse, 200);
  const sessionCookies = cookieHeader(loginResponse);

  const createResponse = await write("/api/v1/articles", "POST", sessionCookies, login.csrfToken, {
    title: "Docker 文章 CRUD 验收",
    contentType: "inspection",
    sourceType: "blank",
    layoutStrength: "standard",
  });
  const created = await responseData(createResponse, 201);
  assert.equal(created.status, "pending_layout");
  assert.equal(created.documentVersion, 1);

  const documentResponse = await globalThis.fetch(
    `${apiBaseUrl}/api/v1/articles/${created.id}/document`,
    {
      headers: { cookie: sessionCookies },
    },
  );
  const currentDocument = await responseData(documentResponse, 200);
  assert.equal(currentDocument.documentVersion, 1);
  const concurrentDocuments = ["Docker 文档乐观锁 A", "Docker 文档乐观锁 B"].map((text, index) => ({
    ...cloneJson(currentDocument.document),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: {
            blockId: `docker_document_block_${index}`,
            locked: false,
          },
          content: [{ type: "text", text }],
        },
      ],
    },
    meta: {
      ...cloneJson(currentDocument.document.meta),
      updatedAt: new Date().toISOString(),
    },
  }));
  const transactionIds = [createUuidV7(), createUuidV7()];
  const concurrentSaveResponses = await Promise.all(
    concurrentDocuments.map((document, index) =>
      write(`/api/v1/articles/${created.id}/document`, "PUT", sessionCookies, login.csrfToken, {
        baseVersion: 1,
        schemaVersion: "1.0.0",
        document,
        lastTransactionId: transactionIds[index],
        transactionOrigin: "docker_concurrent_tab",
      }),
    ),
  );
  assert.deepEqual(concurrentSaveResponses.map((response) => response.status).sort(), [200, 409]);
  const winnerIndex = concurrentSaveResponses.findIndex((response) => response.status === 200);
  const loserIndex = winnerIndex === 0 ? 1 : 0;
  const winningSave = await responseData(concurrentSaveResponses[winnerIndex], 200);
  const conflictingSave = await concurrentSaveResponses[loserIndex].json();
  assert.equal(winningSave.documentVersion, 2);
  assert.equal(conflictingSave.error?.code, "ARTICLE_VERSION_CONFLICT");
  assert.equal(conflictingSave.error?.details?.currentVersion, 2);
  assert.equal(conflictingSave.error?.details?.submittedVersion, 1);

  const replayedSave = await responseData(
    await write(`/api/v1/articles/${created.id}/document`, "PUT", sessionCookies, login.csrfToken, {
      baseVersion: 1,
      schemaVersion: "1.0.0",
      document: concurrentDocuments[winnerIndex],
      lastTransactionId: transactionIds[winnerIndex],
      transactionOrigin: "docker_network_retry",
    }),
    200,
  );
  assert.equal(replayedSave.documentVersion, 2);
  assert.equal(replayedSave.replayed, true);

  const savedDocument = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles/${created.id}/document`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(savedDocument.documentVersion, 2);
  assert.deepEqual(savedDocument.document, concurrentDocuments[winnerIndex]);

  const manualSnapshot = await responseData(
    await write(
      `/api/v1/articles/${created.id}/snapshots`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        reason: "manual",
        note: "Docker 快照恢复点",
      },
    ),
    201,
  );
  assert.equal(manualSnapshot.snapshotNumber, 1);
  assert.equal(manualSnapshot.reason, "manual");
  assert.equal(manualSnapshot.isCurrent, true);
  assert.equal(Array.isArray(manualSnapshot.resourceManifest), true);
  assert.equal(Array.isArray(manualSnapshot.packageManifest), true);
  const manualSnapshotDocument = cloneJson(manualSnapshot.document);

  const postSnapshotTransactionId = createUuidV7();
  const postSnapshotSave = await responseData(
    await write(`/api/v1/articles/${created.id}/document`, "PUT", sessionCookies, login.csrfToken, {
      baseVersion: 2,
      schemaVersion: "1.0.0",
      document: concurrentDocuments[loserIndex],
      lastTransactionId: postSnapshotTransactionId,
      transactionOrigin: "docker_after_snapshot",
    }),
    200,
  );
  assert.equal(postSnapshotSave.documentVersion, 3);
  const manualAfterEdit = await responseData(
    await globalThis.fetch(
      `${apiBaseUrl}/api/v1/articles/${created.id}/snapshots/${manualSnapshot.id}`,
      {
        headers: { cookie: sessionCookies },
      },
    ),
    200,
  );
  assert.equal(manualAfterEdit.isCurrent, false);
  assert.deepEqual(manualAfterEdit.document, manualSnapshotDocument);

  const restoreTransactionId = createUuidV7();
  const restoredSnapshotResult = await responseData(
    await write(
      `/api/v1/articles/${created.id}/snapshots/${manualSnapshot.id}/restore`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        mode: "replace_current",
        baseVersion: 3,
        lastTransactionId: restoreTransactionId,
      },
    ),
    200,
  );
  assert.equal(restoredSnapshotResult.documentVersion, 4);
  assert.equal(restoredSnapshotResult.safetySnapshot.reason, "before_restore");
  assert.equal(restoredSnapshotResult.safetySnapshot.isCurrent, false);
  assert.equal(restoredSnapshotResult.restoredSnapshot.reason, "restored");
  assert.equal(restoredSnapshotResult.restoredSnapshot.isCurrent, true);

  const restoredDocument = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles/${created.id}/document`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(restoredDocument.documentVersion, 4);
  assert.deepEqual(restoredDocument.document.content, manualSnapshotDocument.content);

  const snapshotCountBeforeConflict = await connection.sql`
    select count(*)::int as count
    from content.article_snapshots
    where article_id = ${created.id}::uuid
  `;
  const staleRestore = await write(
    `/api/v1/articles/${created.id}/snapshots/${manualSnapshot.id}/restore`,
    "POST",
    sessionCookies,
    login.csrfToken,
    {
      mode: "replace_current",
      baseVersion: 3,
      lastTransactionId: createUuidV7(),
    },
  );
  const staleRestoreBody = await staleRestore.json();
  assert.equal(staleRestore.status, 409);
  assert.equal(staleRestoreBody.error?.code, "ARTICLE_VERSION_CONFLICT");
  const snapshotCountAfterConflict = await connection.sql`
    select count(*)::int as count
    from content.article_snapshots
    where article_id = ${created.id}::uuid
  `;
  assert.equal(snapshotCountAfterConflict[0]?.count, snapshotCountBeforeConflict[0]?.count);

  const publishResponse = await write(
    `/api/v1/articles/${created.id}`,
    "PATCH",
    sessionCookies,
    login.csrfToken,
    { published: true },
  );
  const published = await responseData(publishResponse, 200);
  assert.equal(published.status, "published");

  const listResponse = await globalThis.fetch(
    `${apiBaseUrl}/api/v1/articles?search=${encodeURIComponent("Docker 文章")}`,
    {
      headers: { cookie: sessionCookies },
    },
  );
  const listed = await responseData(listResponse, 200);
  assert.equal(listed.pagination.total, 1);
  assert.equal(listed.items[0]?.id, created.id);

  const duplicateResponse = await write(
    `/api/v1/articles/${created.id}/duplicate`,
    "POST",
    sessionCookies,
    login.csrfToken,
    {
      title: "Docker 独立副本",
      copyMode: "full",
      contentGroupMode: "independent",
    },
  );
  const duplicate = await responseData(duplicateResponse, 201);
  assert.notEqual(duplicate.id, created.id);
  assert.equal(duplicate.status, "pending_layout");
  const snapshotsAfterDuplicate = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles/${created.id}/snapshots`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.deepEqual(
    snapshotsAfterDuplicate.items.map((snapshot) => snapshot.reason),
    ["before_copy", "restored", "before_restore", "manual"],
  );
  assert.equal(snapshotsAfterDuplicate.items[0]?.isCurrent, true);

  const documents = await connection.sql`
    select
      id::text as id,
      article_id::text as "articleId",
      document_json as "documentJson"
    from content.article_documents
    where article_id in (${created.id}::uuid, ${duplicate.id}::uuid)
  `;
  assert.equal(documents.length, 2);
  assert.notEqual(documents[0]?.id, documents[1]?.id);
  for (const document of documents) {
    assert.equal(document.documentJson.articleId, document.articleId);
  }
  const [savedDocumentRow] = await connection.sql`
    select
      document_version as "documentVersion",
      last_transaction_id::text as "lastTransactionId",
      current_text_hash as "currentTextHash"
    from content.article_documents
    where article_id = ${created.id}::uuid
  `;
  assert.equal(Number(savedDocumentRow.documentVersion), 4);
  assert.equal(savedDocumentRow.lastTransactionId, restoreTransactionId);
  assert.match(savedDocumentRow.currentTextHash, /^[a-f0-9]{64}$/);
  const [documentAuditCount] = await connection.sql`
    select count(*)::int as count
    from audit.audit_logs
    where actor_user_id = ${userId}::uuid
      and article_id = ${created.id}::uuid
      and action = 'article.document.save'
  `;
  assert.equal(documentAuditCount.count, 2);
  const [snapshotAuditCount] = await connection.sql`
    select count(*)::int as count
    from audit.audit_logs
    where actor_user_id = ${userId}::uuid
      and article_id = ${created.id}::uuid
      and action in ('article.snapshot.create', 'article.snapshot.restore')
  `;
  assert.equal(snapshotAuditCount.count, 3);

  await assert.rejects(
    connection.sql`
      update content.article_snapshots
      set note = '不应允许修改'
      where id = ${manualSnapshot.id}::uuid
    `,
    (error) => error?.code === "55000",
  );
  await assert.rejects(
    connection.sql`
      delete from content.article_snapshots
      where id = ${manualSnapshot.id}::uuid
    `,
    (error) => error?.code === "55000",
  );
  const immutableManualSnapshot = await responseData(
    await globalThis.fetch(
      `${apiBaseUrl}/api/v1/articles/${created.id}/snapshots/${manualSnapshot.id}`,
      {
        headers: { cookie: sessionCookies },
      },
    ),
    200,
  );
  assert.equal(immutableManualSnapshot.note, "Docker 快照恢复点");
  assert.deepEqual(immutableManualSnapshot.document, manualSnapshotDocument);

  await responseData(
    await write(`/api/v1/articles/${duplicate.id}`, "DELETE", sessionCookies, login.csrfToken),
    200,
  );
  const trash = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles?status=trash`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(
    trash.items.some((article) => article.id === duplicate.id),
    true,
  );

  const restored = await responseData(
    await write(
      `/api/v1/articles/${duplicate.id}/restore`,
      "POST",
      sessionCookies,
      login.csrfToken,
    ),
    200,
  );
  assert.equal(restored.deletedAt, null);

  const history = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles/${created.id}/status-history`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(
    history.items.some(
      (entry) => entry.fromStatus === "pending_layout" && entry.toStatus === "published",
    ),
    true,
  );
} finally {
  await connection.sql`delete from audit.audit_logs where actor_user_id = ${userId}::uuid`;
  await connection.sql`delete from content.article_status_history where created_by = ${userId}::uuid`;
  await connection.sql.begin(async (transaction) => {
    await transaction`
      update content.articles
      set current_snapshot_id = null
      where owner_user_id = ${userId}::uuid
    `;
    await transaction`alter table content.article_snapshots disable trigger trg_article_snapshots_immutable`;
    await transaction`
      delete from content.article_snapshots
      where created_by = ${userId}::uuid
    `;
    await transaction`alter table content.article_snapshots enable trigger trg_article_snapshots_immutable`;
  });
  await connection.sql`delete from content.article_documents where last_saved_by = ${userId}::uuid`;
  await connection.sql`delete from content.articles where owner_user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.user_sessions where user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.users where id = ${userId}::uuid`;
  await connection.close();
}
