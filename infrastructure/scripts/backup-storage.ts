import { createHash } from "node:crypto";
import { createReadStream, promises as fileSystem } from "node:fs";
import { basename } from "node:path";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { S3CompatibleObjectStorage } from "../../packages/storage-adapter/src/index.js";
import type { BackupConfiguration } from "./backup-config.js";
import type { EncryptedBackupArchive } from "./backup-archive.js";

export interface UploadedBackupArchive {
  readonly archiveKey: string;
  readonly archiveSize: number;
  readonly manifestKey: string;
  readonly manifestSize: number;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(
    createReadStream(path),
    new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        hash.update(chunk);
        callback();
      },
    }),
  );
  return hash.digest("hex");
}

async function contentMd5(path: string): Promise<string> {
  const hash = createHash("md5");
  await pipeline(
    createReadStream(path),
    new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        hash.update(chunk);
        callback();
      },
    }),
  );
  return hash.digest("base64");
}

async function uploadFile(input: {
  readonly contentType: string;
  readonly filePath: string;
  readonly key: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly storage: S3CompatibleObjectStorage;
}): Promise<number> {
  const file = await fileSystem.stat(input.filePath);
  if (!file.isFile() || file.size < 1) {
    throw new Error("待上传备份文件无效或为空");
  }
  const signed = await input.storage.createUploadUrl({
    contentLength: file.size,
    contentMd5: await contentMd5(input.filePath),
    contentType: input.contentType,
    expiresInSeconds: 900,
    key: input.key,
    metadata: input.metadata,
  });
  const body = Readable.toWeb(createReadStream(input.filePath)) as ReadableStream<Uint8Array>;
  const response = await fetch(signed.url, {
    body,
    duplex: "half",
    headers: signed.headers,
    method: "PUT",
  } as RequestInit & { duplex: "half" });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`备份对象上传失败（HTTP ${String(response.status)}）`);
  }
  const remote = await input.storage.statObject(input.key);
  if (remote.size !== file.size || remote.metadata.sha256 !== input.metadata.sha256) {
    throw new Error("备份对象上传后大小或哈希元数据不一致");
  }
  return file.size;
}

export async function uploadBackupArchive(
  archive: EncryptedBackupArchive,
  configuration: BackupConfiguration,
): Promise<UploadedBackupArchive> {
  const storage = new S3CompatibleObjectStorage({
    accessKeyId: configuration.storage.accessKeyId,
    addressingStyle: configuration.storage.addressingStyle,
    bucket: configuration.storage.bucket,
    endpoint: configuration.storage.endpoint,
    metadataHeaderPrefix: configuration.storage.metadataHeaderPrefix,
    publicEndpoint: configuration.storage.endpoint,
    publicAddressingStyle: configuration.storage.addressingStyle,
    region: configuration.storage.region,
    secretAccessKey: configuration.storage.secretAccessKey,
  });
  const date = archive.manifest.payload.createdAt.slice(0, 10).replaceAll("-", "/");
  const basePrefix = `${configuration.storage.prefix}/${date}`;
  const archiveKey = `${basePrefix}/${basename(archive.archivePath)}`;
  const manifestKey = `${basePrefix}/${basename(archive.manifestPath)}`;
  const commonMetadata = {
    "backup-id": archive.manifest.payload.backupId,
    "key-version": archive.manifest.payload.encryption.keyVersion,
  };
  const archiveSize = await uploadFile({
    contentType: "application/octet-stream",
    filePath: archive.archivePath,
    key: archiveKey,
    metadata: {
      ...commonMetadata,
      sha256: archive.manifest.payload.artifact.sha256,
    },
    storage,
  });
  const manifestHash = await sha256(archive.manifestPath);
  const manifestSize = await uploadFile({
    contentType: "application/json",
    filePath: archive.manifestPath,
    key: manifestKey,
    metadata: { ...commonMetadata, sha256: manifestHash },
    storage,
  });
  return Object.freeze({ archiveKey, archiveSize, manifestKey, manifestSize });
}
