import { createHash } from "node:crypto";

import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { createUuidV7 } from "@wechat-layout/database";
import {
  ObjectStorageError,
  type ObjectStorage,
  type ObjectStorageStat,
  type SignedObjectRequest,
} from "@wechat-layout/storage-adapter";
import sharp from "sharp";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import type { AuthenticatedHttpRequest } from "../auth/auth.types.js";
import { ApiException } from "../common/http/api.exception.js";
import { configureApplication } from "../configure-application.js";
import { OBJECT_STORAGE } from "../storage/storage.module.js";
import {
  RESOURCE_REPOSITORY,
  RESOURCE_RUNTIME_OPTIONS,
  RESOURCE_UPLOAD_SESSION_STORE,
} from "./resource.constants.js";
import { ResourceController } from "./resource.controller.js";
import { ResourceService } from "./resource.service.js";
import type {
  CreateValidatedResourceInput,
  ResourceRecord,
  ResourceListInput,
  ResourceListResult,
  ResourceReference,
  ResourceRepository,
  TrashResourceResult,
  UploadSession,
  UploadSessionStore,
} from "./resource.types.js";

const ownerUserId = createUuidV7();
const otherUserId = createUuidV7();
const csrfToken = "test-csrf-token";

function bytesHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

@Injectable()
class ResourceHttpTestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      AuthenticatedHttpRequest & {
        readonly method: string;
        readonly headers: Readonly<Record<string, string | string[] | undefined>>;
      }
    >();
    if (request.headers["x-test-user"] === "missing") {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: "AUTH_REQUIRED",
        message: "需要登录后继续",
        retryable: false,
      });
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers["x-csrf-token"] !== csrfToken
    ) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: "CSRF_INVALID",
        message: "CSRF 校验失败",
        retryable: false,
      });
    }

    const other = request.headers["x-test-user"] === "other";
    request.auth = {
      sessionId: createUuidV7(),
      sessionTokenHash: "a".repeat(64),
      rawSessionToken: "test-session",
      expiresAt: new Date("2026-08-30T00:00:00.000Z"),
      user: {
        id: other ? otherUserId : ownerUserId,
        email: other ? "other@example.com" : "owner@example.com",
        username: null,
        displayName: other ? "Other" : "Owner",
        role: "owner",
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
        avatarResourceId: null,
      },
    };
    return true;
  }
}

@Injectable()
class InMemoryUploadSessionStore implements UploadSessionStore {
  readonly sessions = new Map<string, UploadSession>();

  save(session: UploadSession): Promise<void> {
    this.sessions.set(session.id, session);
    return Promise.resolve();
  }

  find(uploadId: string): Promise<UploadSession | null> {
    return Promise.resolve(this.sessions.get(uploadId) ?? null);
  }

  delete(uploadId: string): Promise<void> {
    this.sessions.delete(uploadId);
    return Promise.resolve();
  }
}

interface StoredObject {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly etag: string;
  readonly metadata: Readonly<Record<string, string>>;
}

@Injectable()
class InMemoryObjectStorage implements ObjectStorage {
  readonly bucket = "resource-test";
  readonly objects = new Map<string, StoredObject>();

  createUploadUrl(input: {
    readonly key: string;
    readonly contentType: string;
    readonly expiresInSeconds: number;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<SignedObjectRequest> {
    return Promise.resolve({
      url: `https://private-storage.test/${this.bucket}/${input.key}`,
      headers: {
        "content-type": input.contentType,
        ...Object.fromEntries(
          Object.entries(input.metadata ?? {}).map(([key, value]) => [`x-amz-meta-${key}`, value]),
        ),
      },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    });
  }

  createDownloadUrl(input: {
    readonly key: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedObjectRequest> {
    return Promise.resolve({
      url: `https://private-storage.test/${this.bucket}/${input.key}?signed=true`,
      headers: {},
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000),
    });
  }

  statObject(key: string): Promise<ObjectStorageStat> {
    const object = this.objects.get(key);
    if (object === undefined) {
      return Promise.reject(new ObjectStorageError("stat", 404, "NoSuchKey", "missing"));
    }
    return Promise.resolve({
      contentType: object.contentType,
      etag: object.etag,
      lastModified: new Date(),
      metadata: object.metadata,
      size: object.bytes.byteLength,
    });
  }

  getObject(key: string, maximumBytes: number): Promise<Uint8Array> {
    const object = this.objects.get(key);
    if (object === undefined) {
      return Promise.reject(new ObjectStorageError("get", 404, "NoSuchKey", "missing"));
    }
    if (object.bytes.byteLength > maximumBytes) {
      return Promise.reject(new ObjectStorageError("get", 413, "OBJECT_TOO_LARGE", "too large"));
    }
    return Promise.resolve(object.bytes);
  }

  putObject(input: {
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<ObjectStorageStat> {
    this.objects.set(input.key, {
      bytes: input.bytes,
      contentType: input.contentType,
      etag: "server-etag",
      metadata: input.metadata ?? {},
    });
    return this.statObject(input.key);
  }

  deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  stageUpload(session: UploadSession, bytes: Uint8Array): string {
    const etag = `etag-${session.id}`;
    this.objects.set(session.objectKey, {
      bytes,
      contentType: session.mimeType,
      etag,
      metadata: {
        "upload-id": session.id,
        sha256: session.sha256,
      },
    });
    return etag;
  }
}

@Injectable()
class InMemoryResourceRepository implements ResourceRepository {
  readonly resources = new Map<string, ResourceRecord>();
  readonly references = new Map<string, ResourceReference[]>();

  findActiveByOwnerHash(ownerId: string, sha256: string): Promise<ResourceRecord | null> {
    return Promise.resolve(
      [...this.resources.values()].find(
        (resource) =>
          resource.ownerUserId === ownerId &&
          resource.sha256 === sha256 &&
          resource.deletedAt === null,
      ) ?? null,
    );
  }

  findOwnedById(ownerId: string, resourceId: string): Promise<ResourceRecord | null> {
    const resource = this.resources.get(resourceId);
    return Promise.resolve(
      resource?.ownerUserId === ownerId && resource.deletedAt === null ? resource : null,
    );
  }

  listOwned(ownerId: string, input: ResourceListInput): Promise<ResourceListResult> {
    const status = input.status ?? "active";
    const matching = [...this.resources.values()]
      .filter(
        (resource) =>
          resource.ownerUserId === ownerId &&
          resource.status === status &&
          (input.resourceType === undefined || resource.resourceType === input.resourceType),
      )
      .sort((left, right) => right.createdAt.valueOf() - left.createdAt.valueOf());
    const offset = (input.page - 1) * input.pageSize;
    return Promise.resolve({
      items: matching.slice(offset, offset + input.pageSize),
      page: input.page,
      pageSize: input.pageSize,
      total: matching.length,
    });
  }

  async createValidated(input: CreateValidatedResourceInput): Promise<ResourceRecord> {
    const existing = await this.findActiveByOwnerHash(input.ownerUserId, input.sha256);
    if (existing !== null) {
      return existing;
    }
    const now = new Date();
    const resource: ResourceRecord = {
      id: createUuidV7(),
      ownerUserId: input.ownerUserId,
      accountId: input.accountId,
      resourceType: input.resourceType,
      sourceType: "upload",
      originalFilename: input.filename,
      storageProvider: input.storageProvider,
      storageBucket: input.storageBucket,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      fileExtension: input.fileExtension,
      fileSize: input.fileSize,
      width: input.width,
      height: input.height,
      sha256: input.sha256,
      status: "active",
      isPrivate: true,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      purgeAfter: null,
    };
    this.resources.set(resource.id, resource);
    return resource;
  }

  async listReferences(
    ownerId: string,
    resourceId: string,
  ): Promise<readonly ResourceReference[] | null> {
    const resource = await this.findOwnedById(ownerId, resourceId);
    return resource === null ? null : (this.references.get(resourceId) ?? []);
  }

  async trashIfUnreferenced(ownerId: string, resourceId: string): Promise<TrashResourceResult> {
    const resource = await this.findOwnedById(ownerId, resourceId);
    if (resource === null) {
      return { kind: "not_found" };
    }
    const references = this.references.get(resourceId) ?? [];
    if (references.length > 0) {
      return { kind: "in_use", references };
    }
    const now = new Date();
    const trashed: ResourceRecord = {
      ...resource,
      status: "trash",
      updatedAt: now,
      deletedAt: now,
      purgeAfter: new Date(now.valueOf() + 30 * 24 * 60 * 60 * 1_000),
    };
    this.resources.set(resourceId, trashed);
    return { kind: "trashed", resource: trashed };
  }
}

@Module({
  imports: [AppModule],
  controllers: [ResourceController],
  providers: [
    ResourceService,
    InMemoryResourceRepository,
    InMemoryUploadSessionStore,
    InMemoryObjectStorage,
    {
      provide: RESOURCE_REPOSITORY,
      useExisting: InMemoryResourceRepository,
    },
    {
      provide: RESOURCE_UPLOAD_SESSION_STORE,
      useExisting: InMemoryUploadSessionStore,
    },
    {
      provide: OBJECT_STORAGE,
      useExisting: InMemoryObjectStorage,
    },
    {
      provide: RESOURCE_RUNTIME_OPTIONS,
      useValue: { maximumDocxBytes: 50 * 1024 * 1024, maximumImageBytes: 2 * 1024 * 1024 },
    },
    {
      provide: APP_GUARD,
      useClass: ResourceHttpTestGuard,
    },
  ],
})
class ResourceHttpTestModule {}

describe("resource HTTP flow", () => {
  let application: INestApplication;
  let repository: InMemoryResourceRepository;
  let sessions: InMemoryUploadSessionStore;
  let storage: InMemoryObjectStorage;

  beforeAll(async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    application = await NestFactory.create(ResourceHttpTestModule, {
      abortOnError: false,
      logger: false,
    });
    configureApplication(application, "development");
    await application.init();
    repository = application.get(InMemoryResourceRepository);
    sessions = application.get(InMemoryUploadSessionStore);
    storage = application.get(InMemoryObjectStorage);
  });

  afterAll(async () => {
    await application.close();
    vi.restoreAllMocks();
  });

  it("publishes the upload contract and protects authentication and CSRF boundaries", async () => {
    const specification = await supertest(application.getHttpServer())
      .get("/api/openapi.json")
      .expect(200);
    expect(
      specification.body.paths?.["/api/v1/resources/uploads"]?.post?.requestBody?.content?.[
        "application/json"
      ]?.schema,
    ).toEqual({ $ref: "#/components/schemas/CreateResourceUploadDto" });
    expect(
      specification.body.paths?.["/api/v1/resources/uploads/{uploadId}/complete"]?.post
        ?.responses?.["200"]?.content?.["application/json"]?.schema,
    ).toEqual({ $ref: "#/components/schemas/ResourceResponseDto" });

    await supertest(application.getHttpServer())
      .post("/api/v1/resources/uploads")
      .send({
        filename: "test.png",
        mimeType: "image/png",
        fileSize: 10,
        sha256: "a".repeat(64),
      })
      .expect(403);
    await supertest(application.getHttpServer())
      .get(`/api/v1/resources/${createUuidV7()}`)
      .set("x-test-user", "missing")
      .expect(401);
  });

  it("uploads, validates, signs, deduplicates and protects referenced resources", async () => {
    const png = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 4,
        background: "#0f766e",
      },
    })
      .png()
      .toBuffer();
    const sha256 = bytesHash(png);
    const upload = await supertest(application.getHttpServer())
      .post("/api/v1/resources/uploads")
      .set("x-csrf-token", csrfToken)
      .send({
        filename: " cover.png ",
        mimeType: "image/png",
        fileSize: png.byteLength,
        sha256,
      })
      .expect(201);
    expect(upload.body.data).toMatchObject({
      status: "upload_required",
      resource: null,
      headers: {
        "content-type": "image/png",
        "x-amz-meta-sha256": sha256,
      },
    });

    const uploadId = upload.body.data.uploadId as string;
    const session = sessions.sessions.get(uploadId);
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }
    const etag = storage.stageUpload(session, png);
    const completed = await supertest(application.getHttpServer())
      .post(`/api/v1/resources/uploads/${uploadId}/complete`)
      .set("x-csrf-token", csrfToken)
      .send({ etag })
      .expect(200);
    const resourceId = completed.body.data.id as string;
    expect(completed.body.data).toMatchObject({
      id: resourceId,
      originalFilename: "cover.png",
      mimeType: "image/png",
      width: 640,
      height: 480,
      sha256,
      status: "active",
      isPrivate: true,
      thumbnail: {
        available: true,
        mimeType: "image/webp",
        width: 320,
        height: 240,
      },
    });
    expect(sessions.sessions.has(uploadId)).toBe(false);
    expect(storage.objects.has(session.objectKey)).toBe(false);
    const storedResource = repository.resources.get(resourceId);
    expect(storedResource).toBeDefined();
    const thumbnailKey = storedResource?.metadata.thumbnail?.storageKey ?? "";
    expect(storage.objects.get(thumbnailKey)?.metadata).toMatchObject({
      "parent-sha256": sha256,
    });

    const listed = await supertest(application.getHttpServer())
      .get("/api/v1/resources?page=1&pageSize=24")
      .expect(200);
    expect(listed.body.data).toMatchObject({ page: 1, pageSize: 24, total: 1 });
    expect(listed.body.data.items[0]).toMatchObject({ sha256, status: "active" });

    await supertest(application.getHttpServer())
      .get(`/api/v1/resources/${resourceId}`)
      .set("x-test-user", "other")
      .expect(404);
    const access = await supertest(application.getHttpServer())
      .post(`/api/v1/resources/${resourceId}/access-url`)
      .set("x-csrf-token", csrfToken)
      .send({
        purpose: "editor_preview",
        variant: "thumbnail",
        expiresInSeconds: 120,
      })
      .expect(200);
    expect(access.body.data.url).toContain("thumbnail.webp?signed=true");

    const deduplicated = await supertest(application.getHttpServer())
      .post("/api/v1/resources/uploads")
      .set("x-csrf-token", csrfToken)
      .send({
        filename: "same.png",
        mimeType: "image/png",
        fileSize: png.byteLength,
        sha256,
      })
      .expect(201);
    expect(deduplicated.body.data).toMatchObject({
      status: "deduplicated",
      uploadId: null,
      uploadUrl: null,
      resource: { id: resourceId },
    });

    repository.references.set(resourceId, [
      {
        kind: "article",
        id: createUuidV7(),
        label: "引用中的文章",
        usageType: "inline_image",
        blockId: "image-1",
      },
    ]);
    const references = await supertest(application.getHttpServer())
      .get(`/api/v1/resources/${resourceId}/references`)
      .expect(200);
    expect(references.body.data).toMatchObject({
      total: 1,
      items: [{ kind: "article", label: "引用中的文章" }],
    });
    const protectedDelete = await supertest(application.getHttpServer())
      .delete(`/api/v1/resources/${resourceId}`)
      .set("x-csrf-token", csrfToken)
      .expect(409);
    expect(protectedDelete.body.error).toMatchObject({
      code: "RESOURCE_IN_USE",
      details: {
        referenceCount: 1,
        referenceKinds: ["article"],
      },
    });

    repository.references.delete(resourceId);
    const deleted = await supertest(application.getHttpServer())
      .delete(`/api/v1/resources/${resourceId}`)
      .set("x-csrf-token", csrfToken)
      .expect(200);
    expect(deleted.body.data).toMatchObject({
      id: resourceId,
      status: "trash",
    });
    expect(deleted.body.data.deletedAt).toEqual(expect.any(String));
    await supertest(application.getHttpServer()).get(`/api/v1/resources/${resourceId}`).expect(404);
  });

  it("rejects wrong MIME declarations and fake image bytes", async () => {
    const png = await sharp({
      create: {
        width: 12,
        height: 12,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const mismatchedUpload = await supertest(application.getHttpServer())
      .post("/api/v1/resources/uploads")
      .set("x-csrf-token", csrfToken)
      .send({
        filename: "wrong.jpg",
        mimeType: "image/jpeg",
        fileSize: png.byteLength,
        sha256: bytesHash(png),
      })
      .expect(201);
    const mismatchId = mismatchedUpload.body.data.uploadId as string;
    const mismatchSession = sessions.sessions.get(mismatchId);
    expect(mismatchSession).toBeDefined();
    if (mismatchSession !== undefined) {
      const mismatchEtag = storage.stageUpload(mismatchSession, png);
      const mismatch = await supertest(application.getHttpServer())
        .post(`/api/v1/resources/uploads/${mismatchId}/complete`)
        .set("x-csrf-token", csrfToken)
        .send({ etag: mismatchEtag })
        .expect(400);
      expect(mismatch.body.error.code).toBe("RESOURCE_MIME_MISMATCH");
    }

    const fake = new TextEncoder().encode("not a real png");
    const fakeUpload = await supertest(application.getHttpServer())
      .post("/api/v1/resources/uploads")
      .set("x-csrf-token", csrfToken)
      .send({
        filename: "fake.png",
        mimeType: "image/png",
        fileSize: fake.byteLength,
        sha256: bytesHash(fake),
      })
      .expect(201);
    const fakeId = fakeUpload.body.data.uploadId as string;
    const fakeSession = sessions.sessions.get(fakeId);
    expect(fakeSession).toBeDefined();
    if (fakeSession !== undefined) {
      const fakeEtag = storage.stageUpload(fakeSession, fake);
      const rejected = await supertest(application.getHttpServer())
        .post(`/api/v1/resources/uploads/${fakeId}/complete`)
        .set("x-csrf-token", csrfToken)
        .send({ etag: fakeEtag })
        .expect(400);
      expect(rejected.body.error.code).toBe("RESOURCE_IMAGE_INVALID");
    }
  });

  it("retains DOCX uploads as private document resources", async () => {
    const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const docx = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    const sha256 = bytesHash(docx);
    const upload = await supertest(application.getHttpServer())
      .post("/api/v1/resources/uploads")
      .set("x-csrf-token", csrfToken)
      .send({
        filename: "采访稿.docx",
        mimeType: docxMime,
        fileSize: docx.byteLength,
        sha256,
      })
      .expect(201);
    const uploadId = upload.body.data.uploadId as string;
    const session = sessions.sessions.get(uploadId);
    expect(session).toBeDefined();
    if (session === undefined) return;

    const etag = storage.stageUpload(session, docx);
    const completed = await supertest(application.getHttpServer())
      .post(`/api/v1/resources/uploads/${uploadId}/complete`)
      .set("x-csrf-token", csrfToken)
      .send({ etag })
      .expect(200);
    expect(completed.body.data).toMatchObject({
      resourceType: "document",
      originalFilename: "采访稿.docx",
      mimeType: docxMime,
      fileExtension: "docx",
      width: null,
      height: null,
      thumbnail: null,
      sha256,
      status: "active",
      isPrivate: true,
    });
    const resource = repository.resources.get(completed.body.data.id as string);
    expect(resource?.storageKey).toMatch(/\/original\.docx$/);
    expect(storage.objects.get(resource?.storageKey ?? "")?.bytes).toEqual(docx);

    await supertest(application.getHttpServer())
      .post("/api/v1/resources/uploads")
      .set("x-csrf-token", csrfToken)
      .send({
        filename: "wrong.zip",
        mimeType: docxMime,
        fileSize: docx.byteLength,
        sha256: "f".repeat(64),
      })
      .expect(400);
  });
});
