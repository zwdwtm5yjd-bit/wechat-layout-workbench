import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import http from "node:http";
import process from "node:process";
import { URL } from "node:url";

import sharp from "./apps/api/node_modules/sharp/lib/index.js";
import { createDatabaseConnection, createUuidV7 } from "./packages/database/dist/index.js";
import { S3CompatibleObjectStorage } from "./packages/storage-adapter/dist/index.js";

const apiBaseUrl = "http://127.0.0.1:3001";
const password = "correct-password-secret-marker";
const passwordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$FM9dAIf0WYf24OZpTOxpyA$m+jg0HVeC0/KOKRMWP1WXLQCsiYztbr0pSBYtfRELKQ";
const userId = createUuidV7();
const email = `resource-smoke-${userId}@example.invalid`;
const connection = createDatabaseConnection(process.env.DATABASE_URL, {
  applicationName: "resource-smoke",
});
const storage = new S3CompatibleObjectStorage({
  endpoint: process.env.S3_ENDPOINT,
  publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
  region: process.env.S3_REGION,
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

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

function minioRequest(url, method, headers = {}, bytes) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "minio",
        port: 9000,
        method,
        path: `${target.pathname}${target.search}`,
        headers: {
          ...headers,
          host: target.host,
          ...(bytes === undefined ? {} : { "content-length": bytes.byteLength }),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            bytes: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.on("error", reject);
    if (bytes !== undefined) {
      request.write(bytes);
    }
    request.end();
  });
}

async function createUpload(bytes, filename, mimeType, cookie, csrfToken) {
  return responseData(
    await write("/api/v1/resources/uploads", "POST", cookie, csrfToken, {
      filename,
      mimeType,
      fileSize: bytes.byteLength,
      sha256: digest(bytes),
    }),
    201,
  );
}

async function uploadSigned(session, bytes) {
  const response = await minioRequest(session.uploadUrl, "PUT", session.headers, bytes);
  assert.equal(
    response.status,
    200,
    `signed MinIO PUT returned ${response.status}: ${response.bytes.toString("utf8")}`,
  );
  const etag = response.headers.etag;
  assert.equal(typeof etag, "string");
  return etag;
}

let referenceArticleId;

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
      'Resource Smoke',
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

  const image = await sharp({
    create: {
      width: 640,
      height: 480,
      channels: 4,
      background: "#155e75",
    },
  })
    .png()
    .toBuffer();
  const upload = await createUpload(
    image,
    "docker-resource.png",
    "image/png",
    sessionCookies,
    login.csrfToken,
  );
  assert.equal(upload.status, "upload_required");
  assert.match(upload.uploadUrl, /^http:\/\/localhost:\d+\//);
  assert.equal(upload.headers["content-type"], "image/png");
  const etag = await uploadSigned(upload, image);
  const resource = await responseData(
    await write(
      `/api/v1/resources/uploads/${upload.uploadId}/complete`,
      "POST",
      sessionCookies,
      login.csrfToken,
      { etag },
    ),
    200,
  );
  assert.equal(resource.mimeType, "image/png");
  assert.equal(resource.width, 640);
  assert.equal(resource.height, 480);
  assert.equal(resource.sha256, digest(image));
  assert.equal(resource.isPrivate, true);
  assert.equal(resource.thumbnail.width, 320);
  assert.equal(resource.thumbnail.height, 240);

  const [stored] = await connection.sql`
    select
      storage_key as "storageKey",
      metadata_json as metadata,
      deleted_at as "deletedAt"
    from content.resources
    where id = ${resource.id}::uuid
  `;
  assert.equal(stored.deletedAt, null);
  assert.equal(stored.metadata.thumbnail.mimeType, "image/webp");

  const anonymousOriginal = await minioRequest(
    `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${stored.storageKey}`,
    "GET",
  );
  assert.equal(anonymousOriginal.status, 403);

  const signedThumbnail = await responseData(
    await write(
      `/api/v1/resources/${resource.id}/access-url`,
      "POST",
      sessionCookies,
      login.csrfToken,
      {
        purpose: "editor_preview",
        variant: "thumbnail",
        expiresInSeconds: 120,
      },
    ),
    200,
  );
  const thumbnailResponse = await minioRequest(signedThumbnail.url, "GET", signedThumbnail.headers);
  assert.equal(
    thumbnailResponse.status,
    200,
    `signed MinIO GET returned ${thumbnailResponse.status}: ${thumbnailResponse.bytes.toString("utf8")}`,
  );
  assert.equal((await sharp(thumbnailResponse.bytes).metadata()).format, "webp");

  const deduplicated = await createUpload(
    image,
    "same-content.png",
    "image/png",
    sessionCookies,
    login.csrfToken,
  );
  assert.equal(deduplicated.status, "deduplicated");
  assert.equal(deduplicated.resource.id, resource.id);
  assert.equal(deduplicated.uploadUrl, null);

  const wrongMimeImage = await sharp({
    create: {
      width: 13,
      height: 11,
      channels: 3,
      background: "#f97316",
    },
  })
    .png()
    .toBuffer();
  const mismatched = await createUpload(
    wrongMimeImage,
    "wrong-mime.jpg",
    "image/jpeg",
    sessionCookies,
    login.csrfToken,
  );
  const mismatchEtag = await uploadSigned(mismatched, wrongMimeImage);
  const mismatchResponse = await write(
    `/api/v1/resources/uploads/${mismatched.uploadId}/complete`,
    "POST",
    sessionCookies,
    login.csrfToken,
    { etag: mismatchEtag },
  );
  const mismatchPayload = await mismatchResponse.json();
  assert.equal(mismatchResponse.status, 400);
  assert.equal(mismatchPayload.error?.code, "RESOURCE_MIME_MISMATCH");

  const fakeImage = Buffer.from("this is not an image");
  const fake = await createUpload(
    fakeImage,
    "fake.png",
    "image/png",
    sessionCookies,
    login.csrfToken,
  );
  const fakeEtag = await uploadSigned(fake, fakeImage);
  const fakeResponse = await write(
    `/api/v1/resources/uploads/${fake.uploadId}/complete`,
    "POST",
    sessionCookies,
    login.csrfToken,
    { etag: fakeEtag },
  );
  const fakePayload = await fakeResponse.json();
  assert.equal(fakeResponse.status, 400);
  assert.equal(fakePayload.error?.code, "RESOURCE_IMAGE_INVALID");

  const referenceArticle = await responseData(
    await write("/api/v1/articles", "POST", sessionCookies, login.csrfToken, {
      title: "资源引用保护验收",
      contentType: "smoke",
      sourceType: "blank",
      layoutStrength: "standard",
    }),
    201,
  );
  referenceArticleId = referenceArticle.id;
  const currentDocument = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/articles/${referenceArticleId}/document`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  const imageDocument = globalThis.structuredClone(currentDocument.document);
  imageDocument.content = {
    ...imageDocument.content,
    content: [
      {
        type: "imageBlock",
        attrs: {
          blockId: "image-smoke-1",
          locked: false,
          resourceId: resource.id,
          alt: "Docker 资源绑定烟测",
        },
      },
    ],
  };
  imageDocument.meta = { ...imageDocument.meta, updatedAt: new Date().toISOString() };
  const imageSaved = await responseData(
    await write(
      `/api/v1/articles/${referenceArticleId}/document`,
      "PUT",
      sessionCookies,
      login.csrfToken,
      {
        baseVersion: currentDocument.documentVersion,
        schemaVersion: currentDocument.schemaVersion,
        document: imageDocument,
        lastTransactionId: createUuidV7(),
        transactionOrigin: "resource_smoke_bind",
      },
    ),
    200,
  );
  const references = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/resources/${resource.id}/references`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(references.total, 1);
  assert.equal(references.items[0]?.kind, "article");
  assert.equal(references.items[0]?.blockId, "image-smoke-1");
  assert.equal(references.items[0]?.usageType, "image");

  const protectedDelete = await write(
    `/api/v1/resources/${resource.id}`,
    "DELETE",
    sessionCookies,
    login.csrfToken,
  );
  const protectedPayload = await protectedDelete.json();
  assert.equal(protectedDelete.status, 409);
  assert.equal(protectedPayload.error?.code, "RESOURCE_IN_USE");

  const emptyDocument = globalThis.structuredClone(imageDocument);
  emptyDocument.content = { ...emptyDocument.content, content: [] };
  emptyDocument.meta = { ...emptyDocument.meta, updatedAt: new Date().toISOString() };
  await responseData(
    await write(
      `/api/v1/articles/${referenceArticleId}/document`,
      "PUT",
      sessionCookies,
      login.csrfToken,
      {
        baseVersion: imageSaved.documentVersion,
        schemaVersion: currentDocument.schemaVersion,
        document: emptyDocument,
        lastTransactionId: createUuidV7(),
        transactionOrigin: "resource_smoke_unbind",
      },
    ),
    200,
  );
  const releasedReferences = await responseData(
    await globalThis.fetch(`${apiBaseUrl}/api/v1/resources/${resource.id}/references`, {
      headers: { cookie: sessionCookies },
    }),
    200,
  );
  assert.equal(releasedReferences.total, 0);
  await responseData(
    await write(`/api/v1/resources/${resource.id}`, "DELETE", sessionCookies, login.csrfToken),
    200,
  );
  const [trashed] = await connection.sql`
    select status, deleted_at as "deletedAt", purge_after as "purgeAfter"
    from content.resources
    where id = ${resource.id}::uuid
  `;
  assert.equal(trashed.status, "trash");
  const deletedAt = new Date(trashed.deletedAt);
  const purgeAfter = new Date(trashed.purgeAfter);
  assert.equal(Number.isNaN(deletedAt.valueOf()), false);
  assert.equal(Number.isNaN(purgeAfter.valueOf()), false);
  assert.ok(purgeAfter > deletedAt);

  const [audit] = await connection.sql`
    select count(*)::int as count
    from audit.audit_logs
    where actor_user_id = ${userId}::uuid
      and action in ('resource.upload.complete', 'resource.trash')
  `;
  assert.equal(audit.count, 2);
} finally {
  const rows = await connection.sql`
    select storage_key as "storageKey", metadata_json as metadata
    from content.resources
    where owner_user_id = ${userId}::uuid
  `;
  for (const row of rows) {
    await Promise.allSettled([
      storage.deleteObject(row.storageKey),
      ...(typeof row.metadata?.thumbnail?.storageKey === "string"
        ? [storage.deleteObject(row.metadata.thumbnail.storageKey)]
        : []),
    ]);
  }
  await connection.sql`delete from audit.audit_logs where actor_user_id = ${userId}::uuid`;
  await connection.sql`
    delete from content.article_resources
    where resource_id in (
      select id from content.resources where owner_user_id = ${userId}::uuid
    )
  `;
  if (referenceArticleId !== undefined) {
    await connection.sql`
      delete from content.article_status_history where article_id = ${referenceArticleId}::uuid
    `;
    await connection.sql`
      delete from content.article_documents where article_id = ${referenceArticleId}::uuid
    `;
    await connection.sql`
      delete from content.articles where id = ${referenceArticleId}::uuid
    `;
  }
  await connection.sql`delete from content.resources where owner_user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.user_sessions where user_id = ${userId}::uuid`;
  await connection.sql`delete from auth.users where id = ${userId}::uuid`;
  await connection.close();
}
