import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { normalizeWebUrl, WebpageImportError } from "@wechat-layout/webpage-import";

import { ApiException } from "../common/http/api.exception.js";
import { JobService } from "../jobs/job.service.js";
import { WEBPAGE_IMPORT_REPOSITORY } from "./import.constants.js";
import type { WebpageImportDto, WebpageImportJobDto } from "./import.dto.js";
import type { ImportMutationContext } from "./import.types.js";
import type { WebpageImportRepository } from "./webpage-import.types.js";

function validation(error: WebpageImportError): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, {
    code: error.code,
    message: error.message,
    details: { fields: [{ path: "url", message: error.message }] },
    retryable: false,
  });
}

@Injectable()
export class WebpageImportService {
  constructor(
    @Inject(WEBPAGE_IMPORT_REPOSITORY)
    private readonly repository: WebpageImportRepository,
    @Inject(JobService)
    private readonly jobs: JobService,
  ) {}

  async create(
    ownerUserId: string,
    body: WebpageImportDto,
    context: ImportMutationContext,
  ): Promise<WebpageImportJobDto> {
    let url: string;
    try {
      url = normalizeWebUrl(body.url.trim()).href;
    } catch (error) {
      if (error instanceof WebpageImportError) throw validation(error);
      throw error;
    }
    const pending = await this.repository.createPending({
      ownerUserId,
      url,
      accountId: body.accountId ?? null,
      contentType: body.contentType ?? "general",
      layoutStrength: body.layoutStrength ?? "standard",
      cleaningMode: body.cleaningMode ?? "preserve_structure",
      context,
    });
    try {
      const enqueued = await this.jobs.enqueue({
        queueName: "import-webpage",
        jobType: "import.webpage.fetch",
        ownerUserId,
        articleId: pending.articleId,
        ...(body.accountId === undefined || body.accountId === null
          ? {}
          : { accountId: body.accountId }),
        payloadSummary: {
          sourceDocumentId: pending.sourceDocumentId,
          requestedUrl: url,
          cleaningMode: body.cleaningMode ?? "preserve_structure",
          intermediateSchemaVersion: "1.0.0",
        },
        maxAttempts: 3,
        traceId: context.traceId,
      });
      await this.repository.attachJob(pending.sourceDocumentId, enqueued.job.id).catch(() => {
        // Worker uses the immutable sourceDocumentId and repairs this link before persistence.
      });
      return { jobId: enqueued.job.id, articleId: pending.articleId };
    } catch (error) {
      await this.repository.markEnqueueFailed(pending.articleId, context);
      throw error;
    }
  }
}
