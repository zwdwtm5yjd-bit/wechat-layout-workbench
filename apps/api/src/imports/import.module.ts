import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { JobModule } from "../jobs/job.module.js";
import { DocxImportController } from "./docx-import.controller.js";
import { DocxImportService } from "./docx-import.service.js";
import { DOCX_IMPORT_REPOSITORY, IMPORT_REPOSITORY } from "./import.constants.js";
import { ImportController } from "./import.controller.js";
import { ImportService } from "./import.service.js";
import { PostgresDocxImportRepository } from "./postgres-docx-import.repository.js";
import { PostgresImportRepository } from "./postgres-import.repository.js";

@Module({
  imports: [DatabaseModule, JobModule],
  controllers: [DocxImportController, ImportController],
  providers: [
    DocxImportService,
    ImportService,
    {
      provide: DOCX_IMPORT_REPOSITORY,
      useClass: PostgresDocxImportRepository,
    },
    {
      provide: IMPORT_REPOSITORY,
      useClass: PostgresImportRepository,
    },
  ],
})
export class ImportModule {}
