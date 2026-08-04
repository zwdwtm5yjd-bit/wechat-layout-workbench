import { createUuidV7 } from "@wechat-layout/database";
import { describe, expect, it, vi } from "vitest";

import type { JobService } from "../jobs/job.service.js";
import { WebpageImportService } from "./webpage-import.service.js";
import type { WebpageImportRepository } from "./webpage-import.types.js";

const context = {
  actorUserId: createUuidV7(),
  requestId: "req-webpage",
  traceId: "trace-webpage",
};

function repository(articleId = createUuidV7()): WebpageImportRepository {
  return {
    createPending: vi.fn().mockResolvedValue({ articleId, sourceDocumentId: createUuidV7() }),
    attachJob: vi.fn().mockResolvedValue(undefined),
    markEnqueueFailed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("WebpageImportService", () => {
  it("records the canonical source URL and enqueues an immutable webpage job", async () => {
    const imports = repository();
    const jobId = createUuidV7();
    const jobs = { enqueue: vi.fn().mockResolvedValue({ created: true, job: { id: jobId } }) };
    const service = new WebpageImportService(imports, jobs as unknown as JobService);

    const result = await service.create(
      context.actorUserId,
      {
        url: "https://NEWS.example/story#comments",
        cleaningMode: "preserve_structure",
        contentType: "general",
        layoutStrength: "standard",
      },
      context,
    );
    expect(result.jobId).toBe(jobId);
    expect(imports.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://news.example/story" }),
    );
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: "import-webpage",
        jobType: "import.webpage.fetch",
        payloadSummary: expect.objectContaining({ requestedUrl: "https://news.example/story" }),
      }),
    );
  });

  it.each(["http://localhost/admin", "http://127.0.0.1/admin", "file:///etc/passwd"])(
    "rejects a blocked URL before creating database state: %s",
    async (url) => {
      const imports = repository();
      const jobs = { enqueue: vi.fn() };
      const service = new WebpageImportService(imports, jobs as unknown as JobService);
      const error = await service
        .create(
          context.actorUserId,
          {
            url,
            cleaningMode: "preserve_structure",
            contentType: "general",
            layoutStrength: "standard",
          },
          context,
        )
        .catch((reason) => reason);
      expect(error.apiError.code).toMatch(/^WEBPAGE_URL_/);
      expect(imports.createPending).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    },
  );

  it("marks the article failed when Redis enqueue fails", async () => {
    const articleId = createUuidV7();
    const imports = repository(articleId);
    const service = new WebpageImportService(imports, {
      enqueue: vi.fn().mockRejectedValue(new Error("redis unavailable")),
    } as unknown as JobService);
    await expect(
      service.create(
        context.actorUserId,
        {
          url: "https://news.example/story",
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
