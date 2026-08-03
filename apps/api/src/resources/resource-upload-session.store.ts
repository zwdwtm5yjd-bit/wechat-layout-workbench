import { Inject, Injectable } from "@nestjs/common";

import { REDIS_CLIENT, type RedisClient } from "../redis/redis.module.js";
import { RESOURCE_DOCX_MIME_TYPE, RESOURCE_IMAGE_MIME_TYPES } from "./resource.constants.js";
import type {
  ResourceUploadMimeType,
  UploadSession,
  UploadSessionStore,
} from "./resource.types.js";

const keyPrefix = "resource-upload:";
const sha256Pattern = /^[a-f0-9]{64}$/;
const allowedMimeTypes = new Set<ResourceUploadMimeType>([
  ...RESOURCE_IMAGE_MIME_TYPES,
  RESOURCE_DOCX_MIME_TYPE,
]);

function isUploadSession(value: unknown): value is UploadSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const session = value as Partial<UploadSession>;
  return (
    typeof session.id === "string" &&
    typeof session.ownerUserId === "string" &&
    (session.accountId === null || typeof session.accountId === "string") &&
    typeof session.filename === "string" &&
    typeof session.mimeType === "string" &&
    allowedMimeTypes.has(session.mimeType as ResourceUploadMimeType) &&
    typeof session.fileSize === "number" &&
    Number.isSafeInteger(session.fileSize) &&
    session.fileSize > 0 &&
    typeof session.sha256 === "string" &&
    sha256Pattern.test(session.sha256) &&
    typeof session.objectKey === "string" &&
    typeof session.createdAt === "string" &&
    typeof session.expiresAt === "string"
  );
}

@Injectable()
export class RedisResourceUploadSessionStore implements UploadSessionStore {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
  ) {}

  async save(session: UploadSession, ttlSeconds: number): Promise<void> {
    const result = await this.redis.set(`${keyPrefix}${session.id}`, JSON.stringify(session), {
      EX: ttlSeconds,
      NX: true,
    });
    if (result !== "OK") {
      throw new Error("资源上传会话 ID 冲突");
    }
  }

  async find(uploadId: string): Promise<UploadSession | null> {
    const serialized = await this.redis.get(`${keyPrefix}${uploadId}`);
    if (serialized === null) {
      return null;
    }

    try {
      const session: unknown = JSON.parse(serialized);
      return isUploadSession(session) ? session : null;
    } catch {
      return null;
    }
  }

  async delete(uploadId: string): Promise<void> {
    await this.redis.del(`${keyPrefix}${uploadId}`);
  }
}
