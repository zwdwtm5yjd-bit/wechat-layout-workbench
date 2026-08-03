import { HttpStatus, Inject, Injectable } from "@nestjs/common";

import { ApiException } from "../common/http/api.exception.js";
import { JobService } from "../jobs/job.service.js";
import { DOCX_IMPORT_REPOSITORY } from "./import.constants.js";
import type { DocxImportDto, DocxImportJobDto } from "./import.dto.js";
import type { DocxImportRepository } from "./docx-import.types.js";
import type { ImportMutationContext } from "./import.types.js";

function apiError(status: number, code: string, message: string): ApiException {
  return new ApiException(status, { code, message, retryable: false });
}

@Injectable()
export class DocxImportService {
  constructor(
    @Inject(DOCX_IMPORT_REPOSITORY)
    private readonly repository: DocxImportRepository,
    @Inject(JobService)
    private readonly jobs: JobService,
  ) {}

  async create(
    ownerUserId: string,
    body: DocxImportDto,
    context: ImportMutationContext,
  ): Promise<DocxImportJobDto> {
    const pending = await this.repository.createPending({
      ownerUserId,
      resourceId: body.resourceId,
      accountId: body.accountId ?? null,
      contentType: body.contentType ?? "general",
      layoutStrength: body.layoutStrength ?? "standard",
      cleaningMode: body.cleaningMode ?? "preserve_structure",
      context,
    });
    if (pending.kind === "resource_not_found") {
      throw apiError(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "DOCX 资源不存在");
    }
    if (pending.kind === "resource_invalid") {
      throw apiError(
        HttpStatus.CONFLICT,
        "DOCX_RESOURCE_INVALID",
        "资源不是可导入的活动 DOCX 原文件",
      );
    }

    try {
      const enqueued = await this.jobs.enqueue({
        queueName: "import-docx",
        jobType: "import.docx.parse",
        ownerUserId,
        articleId: pending.articleId,
        ...(body.accountId === undefined || body.accountId === null
          ? {}
          : { accountId: body.accountId }),
        payloadSummary: {
          resourceId: body.resourceId,
          sourceDocumentId: pending.sourceDocumentId,
          cleaningMode: body.cleaningMode ?? "preserve_structure",
          intermediateSchemaVersion: "1.0.0",
        },
        maxAttempts: 3,
        traceId: context.traceId,
      });
      await this.repository.attachJob(pending.sourceDocumentId, enqueued.job.id).catch(() => {
        // Worker uses sourceDocumentId from the immutable payload and repairs this link on start.
      });
      return { jobId: enqueued.job.id, articleId: pending.articleId };
    } catch (error) {
      await this.repository.markEnqueueFailed(pending.articleId, context);
      throw error;
    }
  }
}
