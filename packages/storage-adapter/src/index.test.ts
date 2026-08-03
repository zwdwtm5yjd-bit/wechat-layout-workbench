import { describe, expect, it, vi } from "vitest";

import { ObjectStorageError, S3CompatibleObjectStorage } from "./index.js";

const fixedNow = new Date("2026-07-30T08:00:00.000Z");

function adapter(request: typeof fetch = vi.fn()): S3CompatibleObjectStorage {
  return new S3CompatibleObjectStorage({
    endpoint: "http://minio:9000",
    publicEndpoint: "http://localhost:9000",
    region: "us-east-1",
    bucket: "private-bucket",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key-that-must-not-leak",
    request,
    now: () => fixedNow,
  });
}

describe("S3CompatibleObjectStorage", () => {
  it("creates a short-lived SigV4 PUT URL for the public endpoint", async () => {
    const result = await adapter().createUploadUrl({
      key: "uploads/owner/file name",
      contentType: "image/png",
      contentLength: 1_024,
      contentMd5: "AAAAAAAAAAAAAAAAAAAAAA==",
      expiresInSeconds: 900,
      metadata: { "upload-id": "upload-1" },
    });
    const url = new URL(result.url);

    expect(url.origin).toBe("http://localhost:9000");
    expect(url.pathname).toBe("/private-bucket/uploads/owner/file%20name");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-length;content-md5;content-type;host;x-amz-meta-upload-id",
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(result.headers).toEqual({
      "content-length": "1024",
      "content-md5": "AAAAAAAAAAAAAAAAAAAAAA==",
      "content-type": "image/png",
      "x-amz-meta-upload-id": "upload-1",
    });
    expect(result.url).not.toContain("secret-key-that-must-not-leak");
    expect(result.expiresAt.toISOString()).toBe("2026-07-30T08:15:00.000Z");
  });

  it("supports virtual-hosted COS and a bucket-specific public domain", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-length": "1", "x-cos-meta-sha256": "remote-hash" },
      }),
    );
    const storage = new S3CompatibleObjectStorage({
      accessKeyId: "access-key",
      addressingStyle: "virtual-hosted",
      bucket: "wechat-layout-1250000000",
      endpoint: "https://cos.ap-shanghai.myqcloud.com",
      metadataHeaderPrefix: "x-cos-meta-",
      now: () => fixedNow,
      publicAddressingStyle: "bucket-endpoint",
      publicEndpoint: "https://assets.example.com",
      region: "ap-shanghai",
      request,
      secretAccessKey: "secret-key-that-must-not-leak",
    });

    const stat = await storage.statObject("healthcheck.txt");
    const requestUrl = new URL(String(request.mock.calls[0]?.[0]));
    expect(requestUrl.hostname).toBe("wechat-layout-1250000000.cos.ap-shanghai.myqcloud.com");
    expect(requestUrl.pathname).toBe("/healthcheck.txt");
    expect(stat.metadata).toEqual({ sha256: "remote-hash" });

    const signed = await storage.createUploadUrl({
      contentType: "application/octet-stream",
      expiresInSeconds: 60,
      key: "resources/owner/thumbnail.webp",
      metadata: { "parent-sha256": "parent-hash", sha256: "local-hash" },
    });
    const publicUrl = new URL(signed.url);
    expect(publicUrl.origin).toBe("https://assets.example.com");
    expect(publicUrl.pathname).toBe("/resources/owner/thumbnail.webp");
    expect(signed.headers).toMatchObject({
      "x-cos-meta-parent-sha256": "parent-hash",
      "x-cos-meta-sha256": "local-hash",
    });
  });

  it("sorts signed response parameters by AWS byte order", async () => {
    const result = await adapter().createDownloadUrl({
      key: "resources/owner/thumbnail.webp",
      expiresInSeconds: 120,
      responseContentType: "image/webp",
    });
    const query = new URL(result.url).search.slice(1);

    expect(query.indexOf("X-Amz-Algorithm")).toBeLessThan(query.indexOf("response-content-type"));
    expect(new URL(result.url).searchParams.get("response-content-type")).toBe("image/webp");
  });

  it("signs server requests and returns controlled object metadata", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "content-length": "128",
          "content-type": "image/webp",
          etag: '"object-etag"',
          "last-modified": "Thu, 30 Jul 2026 08:00:00 GMT",
          "x-amz-meta-upload-id": "upload-1",
        },
      }),
    );

    const result = await adapter(request).statObject("uploads/owner/object");

    expect(result).toEqual({
      contentType: "image/webp",
      etag: "object-etag",
      lastModified: fixedNow,
      metadata: { "upload-id": "upload-1" },
      size: 128,
    });
    const headers = new Headers(request.mock.calls[0]?.[1]?.headers);
    expect(headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=access-key\//);
    expect(headers.get("authorization")).not.toContain("secret-key-that-must-not-leak");
    expect(headers.get("x-amz-content-sha256")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stops oversized downloads before reading their body", async () => {
    const cancel = vi.fn();
    const request = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "129" }),
      body: { cancel },
    } as unknown as Response);

    const error = await adapter(request)
      .getObject("uploads/owner/object", 128)
      .catch((reason) => reason);

    expect(error).toBeInstanceOf(ObjectStorageError);
    expect(error).toMatchObject({ status: 413, storageCode: "OBJECT_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects ambiguous object keys before signing", async () => {
    await expect(
      adapter().createDownloadUrl({
        key: "../private-object",
        expiresInSeconds: 60,
      }),
    ).rejects.toThrow("非法路径段");

    await expect(
      adapter().createUploadUrl({
        contentMd5: "not-base64-md5",
        contentType: "application/octet-stream",
        expiresInSeconds: 60,
        key: "uploads/owner/object",
      }),
    ).rejects.toThrow("Content-MD5 无效");

    await expect(
      adapter().createUploadUrl({
        contentType: "application/octet-stream",
        expiresInSeconds: 60,
        key: "uploads/owner/object",
        metadata: { parent_sha256: "parent-hash" },
      }),
    ).rejects.toThrow("对象存储自定义元数据无效");
  });
});
