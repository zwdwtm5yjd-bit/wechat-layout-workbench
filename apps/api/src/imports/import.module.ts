import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { JobModule } from "../jobs/job.module.js";
import { DocxImportController } from "./docx-import.controller.js";
import { DocxImportService } from "./docx-import.service.js";
import {
  DOCX_IMPORT_REPOSITORY,
  IMPORT_REPOSITORY,
  WEBPAGE_IMPORT_REPOSITORY,
} from "./import.constants.js";
import { ImportController } from "./import.controller.js";
import { ImportService } from "./import.service.js";
import { PostgresDocxImportRepository } from "./postgres-docx-import.repository.js";
import { PostgresImportRepository } from "./postgres-import.repository.js";
import { PostgresWebpageImportRepository } from "./postgres-webpage-import.repository.js";
import { WebpageImportController } from "./webpage-import.controller.js";
import { WebpageImportService } from "./webpage-import.service.js";

@Module({
  imports: [DatabaseModule, JobModule],
  controllers: [DocxImportController, WebpageImportController, ImportController],
  providers: [
    DocxImportService,
    ImportService,
    WebpageImportService,
    {
      provide: DOCX_IMPORT_REPOSITORY,
      useClass: PostgresDocxImportRepository,
    },
    {
      provide: IMPORT_REPOSITORY,
      useClass: PostgresImportRepository,
    },
    {
      provide: WEBPAGE_IMPORT_REPOSITORY,
      useClass: PostgresWebpageImportRepository,
    },
  ],
})
export class ImportModule {}
