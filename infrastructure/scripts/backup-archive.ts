import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  promises as fileSystem,
  type WriteStream,
} from "node:fs";
import { basename, join } from "node:path";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

const archiveFormat = "wechat-layout-postgresql-backup";
const formatVersion = 1;
const encryptionAlgorithm = "aes-256-gcm";
const keyDerivation = "hkdf-sha256";
const manifestAuthentication = "hmac-sha256";
const encryptionInfo = Buffer.from("wechat-layout/database-backup/encryption/v1", "utf8");
const manifestInfo = Buffer.from("wechat-layout/database-backup/manifest/v1", "utf8");
const backupIdPattern = /^\d{8}T\d{6}Z-[0-9a-f]{12}$/;

export interface BackupArchiveDatabaseMetadata {
  readonly databaseName: string;
  readonly dumpFormat: "postgresql-custom";
  readonly migrationVersion: string;
  readonly serverVersion: string;
  readonly tables: readonly string[];
}

export interface BackupManifestPayload {
  readonly archiveFormat: typeof archiveFormat;
  readonly formatVersion: typeof formatVersion;
  readonly backupId: string;
  readonly createdAt: string;
  readonly applicationRelease: string;
  readonly documentSchemaVersion: string;
  readonly database: BackupArchiveDatabaseMetadata;
  readonly encryption: Readonly<{
    algorithm: typeof encryptionAlgorithm;
    authenticationTagBase64: string;
    initializationVectorBase64: string;
    keyDerivation: typeof keyDerivation;
    keyVersion: string;
    saltBase64: string;
  }>;
  readonly artifact: Readonly<{
    encryptedSizeBytes: number;
    fileName: string;
    plaintextSizeBytes: number;
    sha256: string;
  }>;
}

export interface BackupManifest {
  readonly payload: BackupManifestPayload;
  readonly authentication: Readonly<{
    algorithm: typeof manifestAuthentication;
    value: string;
  }>;
}

export interface EncryptBackupArchiveInput {
  readonly applicationRelease: string;
  readonly backupId?: string;
  readonly createdAt?: Date;
  readonly database: BackupArchiveDatabaseMetadata;
  readonly directory: string;
  readonly documentSchemaVersion: string;
  readonly encryptionKey: string;
  readonly keyVersion: string;
  readonly source: Readable;
}

export interface EncryptedBackupArchive {
  readonly archivePath: string;
  readonly manifest: BackupManifest;
  readonly manifestPath: string;
}

export class BackupArchiveError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackupArchiveError";
  }
}

function requireSafeToken(value: string, name: string, maximumLength = 128): string {
  if (
    value.length < 1 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    !/^[A-Za-z0-9._-]+$/.test(value)
  ) {
    throw new BackupArchiveError("INVALID_METADATA", `${name} 不是有效安全标识`);
  }
  return value;
}

function requireEncryptionKey(value: string): Buffer {
  if (value.length < 32 || value.trim() !== value || /\s/.test(value)) {
    throw new BackupArchiveError(
      "INVALID_ENCRYPTION_KEY",
      "备份加密密钥必须至少 32 个字符且不能包含空白",
    );
  }
  return Buffer.from(value, "utf8");
}

function deriveKey(secret: Buffer, salt: Buffer, info: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, salt, info, 32));
}

function archiveId(now: Date): string {
  const timestamp = now
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `${timestamp}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function byteMeter(onChunk: (chunk: Buffer) => void): Transform {
  return new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      onChunk(bytes);
      callback(null, bytes);
    },
  });
}

function manifestValue(payload: BackupManifestPayload, key: Buffer): string {
  return createHmac("sha256", key).update(JSON.stringify(payload)).digest("hex");
}

function authenticatedManifest(
  payload: BackupManifestPayload,
  secret: Buffer,
  salt: Buffer,
): BackupManifest {
  const authenticationKey = deriveKey(secret, salt, manifestInfo);
  return Object.freeze({
    payload: Object.freeze(payload),
    authentication: Object.freeze({
      algorithm: manifestAuthentication,
      value: manifestValue(payload, authenticationKey),
    }),
  });
}

async function closeOnFailure(stream: WriteStream): Promise<void> {
  if (!stream.closed) {
    stream.destroy();
  }
}

export async function encryptBackupArchive(
  input: EncryptBackupArchiveInput,
): Promise<EncryptedBackupArchive> {
  const secret = requireEncryptionKey(input.encryptionKey);
  const keyVersion = requireSafeToken(input.keyVersion, "备份密钥版本", 64);
  const applicationRelease = requireSafeToken(input.applicationRelease, "应用版本");
  const documentSchemaVersion = requireSafeToken(input.documentSchemaVersion, "文档 Schema 版本");
  const createdAt = input.createdAt ?? new Date();
  if (Number.isNaN(createdAt.valueOf())) {
    throw new BackupArchiveError("INVALID_METADATA", "备份时间无效");
  }
  const backupId = input.backupId ?? archiveId(createdAt);
  if (!backupIdPattern.test(backupId)) {
    throw new BackupArchiveError("INVALID_BACKUP_ID", "备份 ID 格式无效");
  }
  if (
    input.database.tables.length < 1 ||
    input.database.tables.some((table) => !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(table))
  ) {
    throw new BackupArchiveError("INVALID_METADATA", "数据库表清单无效或为空");
  }

  await fileSystem.mkdir(input.directory, { mode: 0o700, recursive: true });
  const fileName = `postgresql-${backupId}.dump.enc`;
  const manifestFileName = `postgresql-${backupId}.manifest.json`;
  const archivePath = join(input.directory, fileName);
  const manifestPath = join(input.directory, manifestFileName);
  const partialArchivePath = `${archivePath}.partial`;
  const partialManifestPath = `${manifestPath}.partial`;
  const salt = randomBytes(32);
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    encryptionAlgorithm,
    deriveKey(secret, salt, encryptionInfo),
    initializationVector,
  );
  const encryptedHash = createHash("sha256");
  let plaintextSizeBytes = 0;
  let encryptedSizeBytes = 0;
  const destination = createWriteStream(partialArchivePath, { flags: "wx", mode: 0o600 });

  try {
    await pipeline(
      input.source,
      byteMeter((chunk) => {
        plaintextSizeBytes += chunk.byteLength;
      }),
      cipher,
      byteMeter((chunk) => {
        encryptedHash.update(chunk);
        encryptedSizeBytes += chunk.byteLength;
      }),
      destination,
    );
    if (plaintextSizeBytes < 1 || encryptedSizeBytes < 1) {
      throw new BackupArchiveError("EMPTY_BACKUP", "数据库备份流为空");
    }
    await fileSystem.rename(partialArchivePath, archivePath);

    const payload: BackupManifestPayload = {
      archiveFormat,
      formatVersion,
      backupId,
      createdAt: createdAt.toISOString(),
      applicationRelease,
      documentSchemaVersion,
      database: Object.freeze({
        databaseName: requireSafeToken(input.database.databaseName, "数据库名", 63),
        dumpFormat: "postgresql-custom",
        migrationVersion: requireSafeToken(input.database.migrationVersion, "数据库迁移版本", 64),
        serverVersion: requireSafeToken(input.database.serverVersion, "PostgreSQL 版本", 64),
        tables: Object.freeze([...new Set(input.database.tables)].sort()),
      }),
      encryption: Object.freeze({
        algorithm: encryptionAlgorithm,
        authenticationTagBase64: cipher.getAuthTag().toString("base64"),
        initializationVectorBase64: initializationVector.toString("base64"),
        keyDerivation,
        keyVersion,
        saltBase64: salt.toString("base64"),
      }),
      artifact: Object.freeze({
        encryptedSizeBytes,
        fileName,
        plaintextSizeBytes,
        sha256: encryptedHash.digest("hex"),
      }),
    };
    const manifest = authenticatedManifest(payload, secret, salt);
    await fileSystem.writeFile(partialManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await fileSystem.rename(partialManifestPath, manifestPath);
    return Object.freeze({ archivePath, manifest, manifestPath });
  } catch (error) {
    await closeOnFailure(destination);
    await Promise.allSettled([
      fileSystem.unlink(partialArchivePath),
      fileSystem.unlink(partialManifestPath),
      fileSystem.unlink(archivePath),
      fileSystem.unlink(manifestPath),
    ]);
    throw error;
  } finally {
    secret.fill(0);
  }
}

function parsedManifest(value: unknown): BackupManifest {
  if (typeof value !== "object" || value === null) {
    throw new BackupArchiveError("INVALID_MANIFEST", "备份 Manifest 不是对象");
  }
  const manifest = value as Partial<BackupManifest>;
  const payload = manifest.payload as Partial<BackupManifestPayload> | undefined;
  const database = payload?.database as Partial<BackupArchiveDatabaseMetadata> | undefined;
  const salt =
    typeof payload?.encryption?.saltBase64 === "string"
      ? Buffer.from(payload.encryption.saltBase64, "base64")
      : Buffer.alloc(0);
  const initializationVector =
    typeof payload?.encryption?.initializationVectorBase64 === "string"
      ? Buffer.from(payload.encryption.initializationVectorBase64, "base64")
      : Buffer.alloc(0);
  const authenticationTag =
    typeof payload?.encryption?.authenticationTagBase64 === "string"
      ? Buffer.from(payload.encryption.authenticationTagBase64, "base64")
      : Buffer.alloc(0);
  if (
    payload?.archiveFormat !== archiveFormat ||
    payload.formatVersion !== formatVersion ||
    typeof payload.backupId !== "string" ||
    !backupIdPattern.test(payload.backupId) ||
    typeof payload.createdAt !== "string" ||
    Number.isNaN(new Date(payload.createdAt).valueOf()) ||
    typeof payload.applicationRelease !== "string" ||
    typeof payload.documentSchemaVersion !== "string" ||
    database?.dumpFormat !== "postgresql-custom" ||
    typeof database.databaseName !== "string" ||
    typeof database.migrationVersion !== "string" ||
    typeof database.serverVersion !== "string" ||
    !Array.isArray(database.tables) ||
    database.tables.length < 1 ||
    database.tables.some(
      (table) => typeof table !== "string" || !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(table),
    ) ||
    typeof payload.artifact?.fileName !== "string" ||
    payload.artifact.fileName !== `postgresql-${payload.backupId}.dump.enc` ||
    typeof payload.artifact.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(payload.artifact.sha256) ||
    !Number.isSafeInteger(payload.artifact.encryptedSizeBytes) ||
    (payload.artifact.encryptedSizeBytes ?? 0) < 1 ||
    !Number.isSafeInteger(payload.artifact.plaintextSizeBytes) ||
    (payload.artifact.plaintextSizeBytes ?? 0) < 1 ||
    payload.encryption?.algorithm !== encryptionAlgorithm ||
    payload.encryption.keyDerivation !== keyDerivation ||
    typeof payload.encryption.saltBase64 !== "string" ||
    typeof payload.encryption.initializationVectorBase64 !== "string" ||
    typeof payload.encryption.authenticationTagBase64 !== "string" ||
    typeof payload.encryption.keyVersion !== "string" ||
    salt.byteLength !== 32 ||
    initializationVector.byteLength !== 12 ||
    authenticationTag.byteLength !== 16 ||
    manifest.authentication?.algorithm !== manifestAuthentication ||
    typeof manifest.authentication.value !== "string" ||
    !/^[0-9a-f]{64}$/.test(manifest.authentication.value)
  ) {
    throw new BackupArchiveError("INVALID_MANIFEST", "备份 Manifest 字段无效");
  }
  return manifest as BackupManifest;
}

export async function loadBackupManifest(manifestPath: string): Promise<BackupManifest> {
  try {
    return parsedManifest(JSON.parse(await fileSystem.readFile(manifestPath, "utf8")) as unknown);
  } catch (error) {
    if (error instanceof BackupArchiveError) {
      throw error;
    }
    throw new BackupArchiveError("INVALID_MANIFEST", "备份 Manifest 无法解析");
  }
}

async function fileSha256(
  path: string,
): Promise<{ readonly bytes: number; readonly value: string }> {
  const hash = createHash("sha256");
  let bytes = 0;
  await pipeline(
    createReadStream(path),
    byteMeter((chunk) => {
      bytes += chunk.byteLength;
      hash.update(chunk);
    }),
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
  );
  return { bytes, value: hash.digest("hex") };
}

function equalHex(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes);
}

export async function verifyBackupArchive(input: {
  readonly archivePath: string;
  readonly encryptionKey: string;
  readonly expectedKeyVersion?: string;
  readonly manifestPath: string;
}): Promise<BackupManifest> {
  const secret = requireEncryptionKey(input.encryptionKey);
  try {
    const manifest = await loadBackupManifest(input.manifestPath);
    if (manifest.payload.artifact.fileName !== basename(input.archivePath)) {
      throw new BackupArchiveError("ARCHIVE_NAME_MISMATCH", "备份文件名与 Manifest 不一致");
    }
    if (
      input.expectedKeyVersion !== undefined &&
      manifest.payload.encryption.keyVersion !== input.expectedKeyVersion
    ) {
      throw new BackupArchiveError("KEY_VERSION_MISMATCH", "备份密钥版本与预期不一致");
    }
    const salt = Buffer.from(manifest.payload.encryption.saltBase64, "base64");
    const authenticationKey = deriveKey(secret, salt, manifestInfo);
    const expectedAuthentication = manifestValue(manifest.payload, authenticationKey);
    if (!equalHex(expectedAuthentication, manifest.authentication.value)) {
      throw new BackupArchiveError("MANIFEST_AUTHENTICATION_FAILED", "备份 Manifest 认证失败");
    }
    const digest = await fileSha256(input.archivePath);
    if (
      digest.bytes !== manifest.payload.artifact.encryptedSizeBytes ||
      !equalHex(digest.value, manifest.payload.artifact.sha256)
    ) {
      throw new BackupArchiveError("ARCHIVE_HASH_MISMATCH", "备份文件哈希或大小不一致");
    }
    return manifest;
  } finally {
    secret.fill(0);
  }
}

export async function decryptBackupArchive(input: {
  readonly archivePath: string;
  readonly destination: Writable;
  readonly encryptionKey: string;
  readonly expectedKeyVersion?: string;
  readonly manifestPath: string;
}): Promise<BackupManifest> {
  const manifest = await verifyBackupArchive(input);
  const secret = requireEncryptionKey(input.encryptionKey);
  try {
    const salt = Buffer.from(manifest.payload.encryption.saltBase64, "base64");
    const decipher = createDecipheriv(
      encryptionAlgorithm,
      deriveKey(secret, salt, encryptionInfo),
      Buffer.from(manifest.payload.encryption.initializationVectorBase64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(manifest.payload.encryption.authenticationTagBase64, "base64"));
    await pipeline(createReadStream(input.archivePath), decipher, input.destination);
    return manifest;
  } catch (error) {
    if (error instanceof BackupArchiveError) {
      throw error;
    }
    throw new BackupArchiveError("ARCHIVE_DECRYPTION_FAILED", "备份文件解密认证失败");
  } finally {
    secret.fill(0);
  }
}
