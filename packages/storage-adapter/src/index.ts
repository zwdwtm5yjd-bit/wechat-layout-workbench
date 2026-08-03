import { createHash, createHmac } from "node:crypto";

const algorithm = "AWS4-HMAC-SHA256";
const service = "s3";
const unsignedPayload = "UNSIGNED-PAYLOAD";
const emptyPayloadHash = createHash("sha256").update("").digest("hex");

export interface SignedObjectRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface ObjectStorageStat {
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly lastModified: Date | null;
  readonly metadata: Readonly<Record<string, string>>;
  readonly size: number;
}

export interface ObjectStorage {
  readonly bucket: string;
  createUploadUrl(input: {
    readonly key: string;
    readonly contentType: string;
    readonly contentLength?: number;
    readonly contentMd5?: string;
    readonly expiresInSeconds: number;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<SignedObjectRequest>;
  createDownloadUrl(input: {
    readonly key: string;
    readonly expiresInSeconds: number;
    readonly responseContentType?: string;
  }): Promise<SignedObjectRequest>;
  statObject(key: string): Promise<ObjectStorageStat>;
  getObject(key: string, maximumBytes: number): Promise<Uint8Array>;
  putObject(input: {
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<ObjectStorageStat>;
  deleteObject(key: string): Promise<void>;
}

export interface S3CompatibleObjectStorageOptions {
  readonly endpoint: string;
  readonly publicEndpoint?: string;
  readonly addressingStyle?: ObjectStorageAddressingStyle;
  readonly publicAddressingStyle?: ObjectStorageAddressingStyle;
  readonly metadataHeaderPrefix?: ObjectStorageMetadataHeaderPrefix;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly request?: typeof fetch;
  readonly now?: () => Date;
}

export type ObjectStorageAddressingStyle = "path" | "virtual-hosted" | "bucket-endpoint";
export type ObjectStorageMetadataHeaderPrefix = "x-amz-meta-" | "x-cos-meta-";

export class ObjectStorageError extends Error {
  override readonly name = "ObjectStorageError";

  constructor(
    readonly operation: string,
    readonly status: number | null,
    readonly storageCode: string,
    message: string,
  ) {
    super(message);
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Uint8Array, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replaceAll(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalKey(key: string): string {
  if (key.startsWith("/") || key.endsWith("/") || key.includes("//")) {
    throw new Error("对象存储 Key 不能包含空路径段");
  }
  const segments = key.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === ".." || segment.includes("\\"),
    )
  ) {
    throw new Error("对象存储 Key 包含非法路径段");
  }
  return segments.map(awsEncode).join("/");
}

function dateParts(date: Date): { readonly date: string; readonly timestamp: string } {
  const timestamp = date.toISOString().replaceAll(/[:-]|\.\d{3}/g, "");
  return { date: timestamp.slice(0, 8), timestamp };
}

function normalizedHeaderValue(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ");
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalHeaders(headers: Readonly<Record<string, string>>): {
  readonly canonical: string;
  readonly signed: string;
} {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), normalizedHeaderValue(value)] as const)
    .sort(([left], [right]) => lexicalCompare(left, right));
  return {
    canonical: entries.map(([name, value]) => `${name}:${value}\n`).join(""),
    signed: entries.map(([name]) => name).join(";"),
  };
}

function canonicalQuery(parameters: Readonly<Record<string, string>>): string {
  return Object.entries(parameters)
    .map(([name, value]) => [awsEncode(name), awsEncode(value)] as const)
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      const nameOrder = lexicalCompare(leftName, rightName);
      return nameOrder === 0 ? lexicalCompare(leftValue, rightValue) : nameOrder;
    })
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

function signingKey(
  secretAccessKey: string,
  date: string,
  region: string,
  targetService: string,
): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, targetService);
  return hmac(serviceKey, "aws4_request");
}

function signature(input: {
  readonly canonicalRequest: string;
  readonly date: string;
  readonly region: string;
  readonly secretAccessKey: string;
  readonly timestamp: string;
}): string {
  const scope = `${input.date}/${input.region}/${service}/aws4_request`;
  const stringToSign = [algorithm, input.timestamp, scope, sha256(input.canonicalRequest)].join(
    "\n",
  );
  return createHmac("sha256", signingKey(input.secretAccessKey, input.date, input.region, service))
    .update(stringToSign)
    .digest("hex");
}

function endpointUrl(
  endpoint: string,
  bucket: string,
  key: string,
  addressingStyle: ObjectStorageAddressingStyle,
): URL {
  const url = new URL(endpoint);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("对象存储 Endpoint 必须是不含凭据、查询参数或片段的 HTTP(S) URL");
  }
  const basePath = url.pathname.replace(/\/+$/, "");
  if (addressingStyle === "virtual-hosted") {
    url.hostname = `${bucket}.${url.hostname}`;
  }
  const bucketSegment = addressingStyle === "path" ? `/${awsEncode(bucket)}` : "";
  url.pathname = `${basePath}${bucketSegment}/${canonicalKey(key)}`;
  return url;
}

function metadataHeaders(
  metadata: Readonly<Record<string, string>>,
  prefix: ObjectStorageMetadataHeaderPrefix,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(metadata).map(([name, value]) => {
      const normalizedName = name.toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(normalizedName) || /[\r\n]/.test(value)) {
        throw new Error("对象存储自定义元数据无效");
      }
      return [`${prefix}${normalizedName}`, value];
    }),
  );
}

function responseMetadata(headers: Headers): Readonly<Record<string, string>> {
  const metadata: Record<string, string> = {};
  for (const [name, value] of headers.entries()) {
    for (const prefix of ["x-amz-meta-", "x-cos-meta-"] as const) {
      if (name.startsWith(prefix)) {
        metadata[name.slice(prefix.length)] = value;
      }
    }
  }
  return metadata;
}

function parseSize(value: string | null): number {
  if (value === null || !/^\d+$/.test(value)) {
    throw new ObjectStorageError("stat", null, "INVALID_CONTENT_LENGTH", "对象存储未返回有效大小");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ObjectStorageError("stat", null, "INVALID_CONTENT_LENGTH", "对象大小超出安全范围");
  }
  return parsed;
}

function toStat(headers: Headers): ObjectStorageStat {
  const lastModified = headers.get("last-modified");
  const parsedLastModified = lastModified === null ? null : new Date(lastModified);
  return {
    contentType: headers.get("content-type"),
    etag: headers.get("etag")?.replaceAll('"', "") ?? null,
    lastModified:
      parsedLastModified === null || Number.isNaN(parsedLastModified.valueOf())
        ? null
        : parsedLastModified,
    metadata: responseMetadata(headers),
    size: parseSize(headers.get("content-length")),
  };
}

async function storageFailure(operation: string, response: Response): Promise<ObjectStorageError> {
  const text = (await response.text()).slice(0, 4_096);
  const storageCode = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? "S3_REQUEST_FAILED";
  return new ObjectStorageError(
    operation,
    response.status,
    storageCode,
    `对象存储操作失败（${response.status}）`,
  );
}

export class S3CompatibleObjectStorage implements ObjectStorage {
  readonly bucket: string;

  readonly #endpoint: string;
  readonly #publicEndpoint: string;
  readonly #addressingStyle: ObjectStorageAddressingStyle;
  readonly #publicAddressingStyle: ObjectStorageAddressingStyle;
  readonly #metadataHeaderPrefix: ObjectStorageMetadataHeaderPrefix;
  readonly #region: string;
  readonly #accessKeyId: string;
  readonly #secretAccessKey: string;
  readonly #request: typeof fetch;
  readonly #now: () => Date;

  constructor(options: S3CompatibleObjectStorageOptions) {
    if (options.accessKeyId.trim() === "" || options.secretAccessKey.trim() === "") {
      throw new Error("对象存储凭据不能为空");
    }
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(options.bucket)) {
      throw new Error("对象存储 Bucket 名称无效");
    }
    const addressingStyles: readonly ObjectStorageAddressingStyle[] = [
      "path",
      "virtual-hosted",
      "bucket-endpoint",
    ];
    if (
      (options.addressingStyle !== undefined &&
        !addressingStyles.includes(options.addressingStyle)) ||
      (options.publicAddressingStyle !== undefined &&
        !addressingStyles.includes(options.publicAddressingStyle))
    ) {
      throw new Error("对象存储寻址方式无效");
    }
    if (
      options.metadataHeaderPrefix !== undefined &&
      options.metadataHeaderPrefix !== "x-amz-meta-" &&
      options.metadataHeaderPrefix !== "x-cos-meta-"
    ) {
      throw new Error("对象存储自定义元数据头前缀无效");
    }
    this.#endpoint = options.endpoint;
    this.#publicEndpoint = options.publicEndpoint ?? options.endpoint;
    this.#addressingStyle = options.addressingStyle ?? "path";
    this.#publicAddressingStyle = options.publicAddressingStyle ?? this.#addressingStyle;
    this.#metadataHeaderPrefix = options.metadataHeaderPrefix ?? "x-amz-meta-";
    this.#region = options.region;
    this.bucket = options.bucket;
    this.#accessKeyId = options.accessKeyId;
    this.#secretAccessKey = options.secretAccessKey;
    this.#request = options.request ?? fetch;
    this.#now = options.now ?? (() => new Date());
  }

  async createUploadUrl(input: {
    readonly key: string;
    readonly contentType: string;
    readonly contentLength?: number;
    readonly contentMd5?: string;
    readonly expiresInSeconds: number;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<SignedObjectRequest> {
    if (
      input.contentLength !== undefined &&
      (!Number.isSafeInteger(input.contentLength) || input.contentLength < 1)
    ) {
      throw new Error("上传对象大小必须是正安全整数");
    }
    if (input.contentMd5 !== undefined) {
      const decoded = Buffer.from(input.contentMd5, "base64");
      if (decoded.byteLength !== 16 || decoded.toString("base64") !== input.contentMd5) {
        throw new Error("上传对象 Content-MD5 无效");
      }
    }
    return this.#presign({
      method: "PUT",
      key: input.key,
      expiresInSeconds: input.expiresInSeconds,
      headers: {
        "content-type": input.contentType,
        ...(input.contentLength === undefined
          ? {}
          : { "content-length": String(input.contentLength) }),
        ...(input.contentMd5 === undefined ? {} : { "content-md5": input.contentMd5 }),
        ...metadataHeaders(input.metadata ?? {}, this.#metadataHeaderPrefix),
      },
    });
  }

  async createDownloadUrl(input: {
    readonly key: string;
    readonly expiresInSeconds: number;
    readonly responseContentType?: string;
  }): Promise<SignedObjectRequest> {
    return this.#presign({
      method: "GET",
      key: input.key,
      expiresInSeconds: input.expiresInSeconds,
      headers: {},
      query:
        input.responseContentType === undefined
          ? {}
          : { "response-content-type": input.responseContentType },
    });
  }

  async statObject(key: string): Promise<ObjectStorageStat> {
    const response = await this.#signedRequest("HEAD", key);
    if (!response.ok) {
      throw await storageFailure("stat", response);
    }
    return toStat(response.headers);
  }

  async getObject(key: string, maximumBytes: number): Promise<Uint8Array> {
    const response = await this.#signedRequest("GET", key);
    if (!response.ok) {
      throw await storageFailure("get", response);
    }
    const declaredSize = response.headers.get("content-length");
    if (declaredSize !== null && parseSize(declaredSize) > maximumBytes) {
      await response.body?.cancel();
      throw new ObjectStorageError("get", 413, "OBJECT_TOO_LARGE", "对象超过允许读取的大小");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) {
      throw new ObjectStorageError("get", 413, "OBJECT_TOO_LARGE", "对象超过允许读取的大小");
    }
    return bytes;
  }

  async putObject(input: {
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<ObjectStorageStat> {
    const response = await this.#signedRequest("PUT", input.key, {
      body: input.bytes,
      headers: {
        "content-type": input.contentType,
        ...metadataHeaders(input.metadata ?? {}, this.#metadataHeaderPrefix),
      },
    });
    if (!response.ok) {
      throw await storageFailure("put", response);
    }
    return {
      contentType: input.contentType,
      etag: response.headers.get("etag")?.replaceAll('"', "") ?? null,
      lastModified: null,
      metadata: input.metadata ?? {},
      size: input.bytes.byteLength,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const response = await this.#signedRequest("DELETE", key);
    if (!response.ok && response.status !== 404) {
      throw await storageFailure("delete", response);
    }
  }

  async #presign(input: {
    readonly method: "GET" | "PUT";
    readonly key: string;
    readonly expiresInSeconds: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly query?: Readonly<Record<string, string>>;
  }): Promise<SignedObjectRequest> {
    if (
      !Number.isInteger(input.expiresInSeconds) ||
      input.expiresInSeconds < 1 ||
      input.expiresInSeconds > 3_600
    ) {
      throw new Error("签名 URL 有效期必须在 1 到 3600 秒之间");
    }
    const now = this.#now();
    const { date, timestamp } = dateParts(now);
    const url = endpointUrl(
      this.#publicEndpoint,
      this.bucket,
      input.key,
      this.#publicAddressingStyle,
    );
    const headerSet = canonicalHeaders({ host: url.host, ...input.headers });
    const scope = `${date}/${this.#region}/${service}/aws4_request`;
    const parameters = {
      ...(input.query ?? {}),
      "X-Amz-Algorithm": algorithm,
      "X-Amz-Credential": `${this.#accessKeyId}/${scope}`,
      "X-Amz-Date": timestamp,
      "X-Amz-Expires": String(input.expiresInSeconds),
      "X-Amz-SignedHeaders": headerSet.signed,
    };
    const query = canonicalQuery(parameters);
    const canonicalRequest = [
      input.method,
      url.pathname,
      query,
      headerSet.canonical,
      headerSet.signed,
      unsignedPayload,
    ].join("\n");
    const signed = signature({
      canonicalRequest,
      date,
      region: this.#region,
      secretAccessKey: this.#secretAccessKey,
      timestamp,
    });
    url.search = `${query}&X-Amz-Signature=${signed}`;
    return {
      url: url.toString(),
      headers: { ...input.headers },
      expiresAt: new Date(now.valueOf() + input.expiresInSeconds * 1_000),
    };
  }

  async #signedRequest(
    method: "DELETE" | "GET" | "HEAD" | "PUT",
    key: string,
    input: {
      readonly body?: Uint8Array;
      readonly headers?: Readonly<Record<string, string>>;
    } = {},
  ): Promise<Response> {
    const now = this.#now();
    const { date, timestamp } = dateParts(now);
    const url = endpointUrl(this.#endpoint, this.bucket, key, this.#addressingStyle);
    const payloadHash = input.body === undefined ? emptyPayloadHash : sha256(input.body);
    const requestHeaders = {
      ...(input.headers ?? {}),
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": timestamp,
    };
    const headerSet = canonicalHeaders(requestHeaders);
    const canonicalRequest = [
      method,
      url.pathname,
      "",
      headerSet.canonical,
      headerSet.signed,
      payloadHash,
    ].join("\n");
    const scope = `${date}/${this.#region}/${service}/aws4_request`;
    const signed = signature({
      canonicalRequest,
      date,
      region: this.#region,
      secretAccessKey: this.#secretAccessKey,
      timestamp,
    });
    const headers = new Headers(input.headers);
    headers.set("x-amz-content-sha256", payloadHash);
    headers.set("x-amz-date", timestamp);
    headers.set(
      "authorization",
      `${algorithm} Credential=${this.#accessKeyId}/${scope}, SignedHeaders=${headerSet.signed}, Signature=${signed}`,
    );
    return this.#request(url, {
      method,
      headers,
      ...(input.body === undefined ? {} : { body: Buffer.from(input.body) }),
    });
  }
}
