import { createUuidV7 } from "@wechat-layout/database";
import { describe, expect, it, vi } from "vitest";

import type { JobService } from "../jobs/job.service.js";
import type { DocxImportRepository } from "./docx-import.types.js";
import { DocxImportService } from "./docx-import.service.js";

const context = {
  actorUserId: createUuidV7(),
  requestId: "req-docx",
  traceId: "trace-docx",
};

function repository(
  result: Awaited<ReturnType<DocxImportRepository["createPending"]>>,
): DocxImportRepository {
  return {
    createPending: vi.fn().mockResolvedValue(result),
    attachJob: vi.fn().mockResolvedValue(undefined),
    markEnqueueFailed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DocxImportService", () => {
  it("creates a pending article and enqueues the immutable DOCX payload", async () => {
    const articleId = createUuidV7();
    const sourceDocumentId = createUuidV7();
    const jobId = createUuidV7();
    const resourceId = createUuidV7();
    const imports = repository({
      kind: "created",
      articleId,
      sourceDocumentId,
      resourceSha256: "a".repeat(64),
    });
    const jobs = {
      enqueue: vi.fn().mockResolvedValue({ created: true, job: { id: jobId } }),
    };
    const service = new DocxImportService(imports, jobs as unknown as JobService);

    await expect(
      service.create(
        context.actorUserId,
        {
          resourceId,
          cleaningMode: "preserve_structure",
          contentType: "general",
          layoutStrength: "standard",
        },
        context,
      ),
    ).resolves.toEqual({ articleId, jobId });
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: "import-docx",
        jobType: "import.docx.parse",
        articleId,
        ownerUserId: context.actorUserId,
        payloadSummary: expect.objectContaining({ resourceId, sourceDocumentId }),
      }),
    );
    expect(imports.attachJob).toHaveBeenCalledWith(sourceDocumentId, jobId);
  });

  it("rejects missing and invalid document resources before enqueue", async () => {
    for (const [kind, code] of [
      ["resource_not_found", "RESOURCE_NOT_FOUND"],
      ["resource_invalid", "DOCX_RESOURCE_INVALID"],
    ] as const) {
      const jobs = { enqueue: vi.fn() };
      const service = new DocxImportService(repository({ kind }), jobs as unknown as JobService);
      const error = await service
        .create(
          context.actorUserId,
          {
            resourceId: createUuidV7(),
            cleaningMode: "preserve_structure",
            contentType: "general",
            layoutStrength: "standard",
          },
          context,
        )
        .catch((reason) => reason);
      expect(error.apiError.code).toBe(code);
      expect(jobs.enqueue).not.toHaveBeenCalled();
    }
  });

  it("moves the pending article to import_failed when enqueue fails", async () => {
    const articleId = createUuidV7();
    const imports = repository({
      kind: "created",
      articleId,
      sourceDocumentId: createUuidV7(),
      resourceSha256: "b".repeat(64),
    });
    const service = new DocxImportService(imports, {
      enqueue: vi.fn().mockRejectedValue(new Error("redis unavailable")),
    } as unknown as JobService);

    await expect(
      service.create(
        context.actorUserId,
        {
          resourceId: createUuidV7(),
          cleaningMode: "preserve_structure",
          contentType: "general",
          layoutStrength: "standard",
        },
        context,
      ),
    ).rejects.toThrow("redis unavailable");
    expect(imports.markEnqueueFailed).toHaveBeenCalledWith(articleId, context);
  });
});
