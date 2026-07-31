import assert from "node:assert/strict";
import process from "node:process";

import { createDatabaseConnection, createUuidV7 } from "./packages/database/dist/index.js";

const apiBaseUrl = "http://127.0.0.1:3001";
const modernCivicThemeId = "0198f8e1-7a01-7000-8000-000000000102";
const modernCivicPaletteId = "0198f8e1-7a01-7000-8000-000000000202";
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

  const pastedPlainText = [
    "Docker 粘贴导入验收",
    "第一部分",
    "这是一段来自 Word 的正文。",
    "第一项",
    "表头 数据",
    "外链示意图",
  ].join("\n");
  const pastedHtml = [
    '<html><head><meta name="Generator" content="Microsoft Word 16">',
    "<style>.MsoNormal { margin: 0; } .hidden { display:none }</style>",
    '<script>globalThis.__unsafe_import_marker = "must-not-survive"</script></head><body>',
    '<h1 class="MsoTitle" style="font-family:Calibri;color:red">Docker 粘贴导入验收</h1>',
    '<h2 class="MsoHeading1">第一部分</h2>',
    '<p class="MsoNormal">这是一段来自 <strong>Word</strong> 的正文。',
    '<a href="javascript:alert(1)">危险链接</a></p>',
    "<p hidden>必须移除的隐藏文字</p>",
    "<ul><li>第一项</li></ul>",
    "<table><tr><th>表头</th><td>数据</td></tr></table>",
    '<img src="https://cdn.example.invalid/import-image.png" alt="外链示意图">',
    "</body></html>",
  ].join("");
  const importCreated = await responseData(
    await write("/api/v1/imports/paste", "POST", sessionCookies, login.csrfToken, {
      html: pastedHtml,
      plainText: pastedPlainText,
      cleaningMode: "preserve_compatible",
      detectedSourceHint: "auto",
      contentType: "general",
      layoutStrength: "standard",
    }),
    201,
  );
  assert.equal(importCreated.status, "pending_recognition");
  assert.equal(importCreated.documentVersion, 1);
  assert.equal(importCreated.detectedSource, "word");
  assert.equal(importCreated.cleaningMode, "preserve_compatible");
  assert.equal(importCreated.originalText, pastedPlainText);
  assert.equal(importCreated.originalText.includes("must-not-survive"), false);
  assert.equal(importCreated.statistics.removedSecurityNodeCount >= 2, true);
  assert.equal(importCreated.statistics.removedHiddenNodeCount, 1);
  assert.equal(importCreated.statistics.removedUnsafeLinkCount, 1);
  assert.equal(importCreated.statistics.imageCount, 1);
  assert.equal(
    importCreated.warnings.some((warning) => warning.code === "SECURITY_CONTENT_REMOVED"),
    true,
  );
  assert.equal(
    importCreated.warnings.some((warning) => warning.code === "EXTERNAL_IMAGE_REFERENCE"),
    true,
  );

  const refreshedImport = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/imports/${importCreated.articleId}/structure`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(refreshedImport.sourceDocumentId, importCreated.sourceDocumentId);
  assert.deepEqual(
    refreshedImport.blocks.map((block) => block.sourceBlockId),
    importCreated.blocks.map((block) => block.sourceBlockId),
  );
  assert.equal(
    new Set(refreshedImport.blocks.map((block) => block.sourceBlockId)).size,
    refreshedImport.blocks.length,
  );

  const paragraphBlock = refreshedImport.blocks.find((block) => block.role === "paragraph");
  assert.ok(paragraphBlock, "Word 导入应识别至少一个正文块");
  const importTransactionId = createUuidV7();
  const confirmedImport = await responseData(
    await write(
      `/api/v1/imports/${importCreated.articleId}/structure`,
      "PUT",
      sessionCookies,
      login.csrfToken,
      {
        title: "Docker 已确认导入",
        baseVersion: 1,
        lastTransactionId: importTransactionId,
        blocks: refreshedImport.blocks.map((block) => ({
          sourceBlockId: block.sourceBlockId,
          role: block.sourceBlockId === paragraphBlock.sourceBlockId ? "quote" : block.role,
        })),
      },
    ),
    200,
  );
  assert.equal(confirmedImport.status, "pending_layout");
  assert.equal(confirmedImport.documentVersion, 2);
  assert.equal(confirmedImport.snapshotNumber, 1);
  assert.equal(confirmedImport.editorUrl, `/workspace/articles/${importCreated.articleId}`);
  assert.equal(
    confirmedImport.blocks.find((block) => block.sourceBlockId === paragraphBlock.sourceBlockId)
      ?.role,
    "quote",
  );

  const replayedImport = await responseData(
    await write(
      `/api/v1/imports/${importCreated.articleId}/structure`,
      "PUT",
      sessionCookies,
      login.csrfToken,
      {
        title: "Docker 已确认导入",
        baseVersion: 1,
        lastTransactionId: importTransactionId,
        blocks: confirmedImport.blocks.map((block) => ({
          sourceBlockId: block.sourceBlockId,
          role: block.role,
        })),
      },
    ),
    200,
  );
  assert.equal(replayedImport.snapshotId, confirmedImport.snapshotId);
  assert.equal(replayedImport.documentVersion, 2);

  const importSnapshotCountBeforeConflict = await connection.sql`
    select count(*)::int as count
    from content.article_snapshots
    where article_id = ${importCreated.articleId}::uuid
  `;
  const staleImportConfirmation = await write(
    `/api/v1/imports/${importCreated.articleId}/structure`,
    "PUT",
    sessionCookies,
    login.csrfToken,
    {
      title: "不应覆盖的新标题",
      baseVersion: 1,
      lastTransactionId: createUuidV7(),
      blocks: confirmedImport.blocks.map((block) => ({
        sourceBlockId: block.sourceBlockId,
        role: block.role,
      })),
    },
  );
  const staleImportBody = await staleImportConfirmation.json();
  assert.equal(staleImportConfirmation.status, 409);
  assert.equal(staleImportBody.error?.code, "ARTICLE_VERSION_CONFLICT");
  const importSnapshotCountAfterConflict = await connection.sql`
    select count(*)::int as count
    from content.article_snapshots
    where article_id = ${importCreated.articleId}::uuid
  `;
  assert.equal(
    importSnapshotCountAfterConflict[0]?.count,
    importSnapshotCountBeforeConflict[0]?.count,
  );

  const [persistedImport] = await connection.sql`
    select
      a.status,
      a.title,
      a.current_snapshot_id::text as "currentSnapshotId",
      d.document_version as "documentVersion",
      d.last_transaction_id::text as "lastTransactionId",
      d.document_json as "documentJson",
      sd.original_text as "originalText",
      sd.original_text_hash as "originalTextHash",
      sd.source_metadata as "sourceMetadata",
      s.id::text as "snapshotId",
      s.reason as "snapshotReason",
      s.snapshot_number as "snapshotNumber",
      s.document_json as "snapshotDocumentJson"
    from content.articles a
    join content.article_documents d on d.article_id = a.id
    join content.source_documents sd on sd.article_id = a.id and sd.is_primary = true
    join content.article_snapshots s on s.article_id = a.id
    where a.id = ${importCreated.articleId}::uuid
  `;
  assert.equal(persistedImport.status, "pending_layout");
  assert.equal(persistedImport.title, "Docker 已确认导入");
  assert.equal(Number(persistedImport.documentVersion), 2);
  assert.equal(persistedImport.lastTransactionId, importTransactionId);
  assert.equal(persistedImport.originalText, pastedPlainText);
  assert.match(persistedImport.originalTextHash, /^[a-f0-9]{64}$/);
  assert.equal(persistedImport.currentSnapshotId, persistedImport.snapshotId);
  assert.equal(persistedImport.snapshotReason, "after_import");
  assert.equal(Number(persistedImport.snapshotNumber), 1);
  assert.deepEqual(persistedImport.snapshotDocumentJson, persistedImport.documentJson);
  const persistedImportText = JSON.stringify(persistedImport);
  assert.equal(persistedImportText.includes("must-not-survive"), false);
  assert.equal(persistedImportText.includes("<script"), false);

  const persistedBlocks = await connection.sql`
    select
      source_block_id as "sourceBlockId",
      block_type as "blockType",
      text_content as "textContent",
      text_hash as "textHash",
      order_index as "orderIndex",
      relation_metadata as "relationMetadata"
    from content.source_blocks
    where source_document_id = ${importCreated.sourceDocumentId}::uuid
    order by order_index asc
  `;
  assert.equal(persistedBlocks.length, confirmedImport.blocks.length);
  assert.equal(
    persistedBlocks.find((block) => block.sourceBlockId === paragraphBlock.sourceBlockId)
      ?.blockType,
    "quote",
  );
  for (const block of persistedBlocks) {
    assert.match(block.textHash, /^[a-f0-9]{64}$/);
    assert.equal(block.textContent.includes("must-not-survive"), false);
  }
  const [importAuditCount] = await connection.sql`
    select count(*)::int as count
    from audit.audit_logs
    where actor_user_id = ${userId}::uuid
      and article_id = ${importCreated.articleId}::uuid
      and action in (
        'article.import.paste.create',
        'article.import.structure.confirm',
        'article.snapshot.create'
      )
  `;
  assert.equal(importAuditCount.count, 3);

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

  const themeCatalog = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/themes`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(themeCatalog.items.length, 2);
  assert.equal(
    themeCatalog.items.every((theme) => theme.installed === true),
    true,
  );
  assert.equal(
    themeCatalog.items.some((theme) => theme.manifest.themeId === modernCivicThemeId),
    true,
  );
  const beforeThemeDocument = cloneJson(restoredDocument.document);
  const themePreview = await responseData(
    await write(
      `/api/v1/articles/${created.id}/themes/${modernCivicThemeId}/preview`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        themeVersion: "1.0.0",
        paletteId: modernCivicPaletteId,
        scope: "full",
        brandMode: "soft",
      },
    ),
    200,
  );
  assert.equal(themePreview.documentVersion, 4);
  assert.equal(themePreview.textIntegrity.unchanged, true);
  assert.equal(themePreview.html.includes("#2F2525"), true);
  const afterPreviewDocument = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles/${created.id}/document`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(afterPreviewDocument.documentVersion, 4);
  assert.deepEqual(afterPreviewDocument.document, beforeThemeDocument);

  const appliedTheme = await responseData(
    await write(
      `/api/v1/articles/${created.id}/themes/${modernCivicThemeId}/apply`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        baseDocumentVersion: 4,
        themeVersion: "1.0.0",
        paletteId: modernCivicPaletteId,
        scope: "full",
        brandMode: "soft",
        preserveLockedBlocks: true,
      },
    ),
    200,
  );
  assert.equal(appliedTheme.documentVersion, 5);
  assert.equal(appliedTheme.originalTextUnchanged, true);
  assert.match(appliedTheme.lastTransactionId, /^[a-f0-9-]{36}$/);
  const themedDocument = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles/${created.id}/document`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(themedDocument.documentVersion, 5);
  assert.equal(themedDocument.document.themeId, modernCivicThemeId);
  assert.equal(themedDocument.document.themeVersion, "1.0.0");
  assert.deepEqual(themedDocument.document.content, beforeThemeDocument.content);
  const staleThemeApply = await write(
    `/api/v1/articles/${created.id}/themes/${modernCivicThemeId}/apply`,
    "POST",
    sessionCookies,
    login.csrfToken,
    {
      baseDocumentVersion: 4,
      themeVersion: "1.0.0",
      paletteId: modernCivicPaletteId,
      scope: "full",
      brandMode: "soft",
      preserveLockedBlocks: true,
    },
  );
  assert.equal(staleThemeApply.status, 409);
  assert.equal((await staleThemeApply.json()).error?.code, "ARTICLE_VERSION_CONFLICT");

  const renderOutput = await responseData(
    await write(
      `/api/v1/articles/${created.id}/render-wechat`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        documentVersion: 5,
        outputMode: "standard",
      },
    ),
    201,
  );
  assert.equal(renderOutput.status, "ready");
  assert.equal(renderOutput.canCopy, true);
  assert.equal(renderOutput.rendererVersion, "1.0.0");
  assert.equal(renderOutput.compatibilityRuleVersion, "1.0.0");
  assert.match(renderOutput.outputHash, /^sha256:[a-f0-9]{64}$/);
  const copyPayload = await responseData(
    await write(
      `/api/v1/articles/${created.id}/copy-payload`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        renderOutputId: renderOutput.id,
      },
    ),
    200,
  );
  assert.equal(copyPayload.renderOutputId, renderOutput.id);
  assert.equal(copyPayload.html.includes("<section"), true);
  assert.equal(copyPayload.html.includes("#2F2525"), true);
  assert.equal(copyPayload.plainText.includes("Docker 文档乐观锁"), true);
  const copyRecord = await responseData(
    await write(
      `/api/v1/articles/${created.id}/copy-records`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        renderOutputId: renderOutput.id,
        status: "success",
        browserInfo: {
          browser: "DockerSmoke",
          platform: "Linux",
        },
      },
    ),
    201,
  );
  assert.equal(copyRecord.status, "success");
  const [persistedCopy] = await connection.sql`
    select
      ro.status as "outputStatus",
      ro.output_sha256 as "outputSha256",
      ro.snapshot_id::text as "snapshotId",
      cr.status as "copyStatus",
      cr.browser_info as "browserInfo",
      a.status as "articleStatus",
      a.copied_at as "copiedAt"
    from content.render_outputs ro
    join content.copy_records cr on cr.render_output_id = ro.id
    join content.articles a on a.id = ro.article_id
    where ro.id = ${renderOutput.id}::uuid
  `;
  assert.equal(persistedCopy.outputStatus, "ready");
  assert.match(persistedCopy.outputSha256, /^[a-f0-9]{64}$/);
  assert.equal(persistedCopy.snapshotId, renderOutput.snapshotId);
  assert.equal(persistedCopy.copyStatus, "success");
  assert.equal(persistedCopy.browserInfo.browser, "DockerSmoke");
  assert.equal(persistedCopy.articleStatus, "copied");
  assert.ok(persistedCopy.copiedAt);

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
    ["before_copy", "before_copy", "before_theme_apply", "restored", "before_restore", "manual"],
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
  assert.equal(Number(savedDocumentRow.documentVersion), 5);
  assert.equal(savedDocumentRow.lastTransactionId, appliedTheme.lastTransactionId);
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
  assert.equal(snapshotAuditCount.count, 4);
  const [themeAuditCount] = await connection.sql`
    select count(*)::int as count
    from audit.audit_logs
    where actor_user_id = ${userId}::uuid
      and article_id = ${created.id}::uuid
      and action = 'article.theme.apply'
  `;
  assert.equal(themeAuditCount.count, 1);

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
    history.items.some((entry) => entry.fromStatus === "copied" && entry.toStatus === "published"),
    true,
  );
} finally {
  await connection.sql`delete from audit.audit_logs where actor_user_id = ${userId}::uuid`;
  await connection.sql`delete from content.article_status_history where created_by = ${userId}::uuid`;
  await connection.sql`delete from content.copy_records where copied_by = ${userId}::uuid`;
  await connection.sql`delete from content.render_outputs where generated_by = ${userId}::uuid`;
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
  await connection.sql`
    delete from content.source_blocks
    where source_document_id in (
      select sd.id
      from content.source_documents sd
      join content.articles a on a.id = sd.article_id
      where a.owner_user_id = ${userId}::uuid
    )
  `;
  await connection.sql`
    delete from content.source_documents
    where article_id in (
      select id
      from content.articles
      where owner_user_id = ${userId}::uuid
    )
  `;
  await connection.sql`delete from content.article_documents where last_saved_by = ${userId}::uuid`;
  await connection.sql`delete from content.articles where owner_user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.user_sessions where user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.users where id = ${userId}::uuid`;
  await connection.close();
}
