import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { IMPORT_REPOSITORY } from "./import.constants.js";
import { ImportController } from "./import.controller.js";
import { ImportService } from "./import.service.js";
import { PostgresImportRepository } from "./postgres-import.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ImportController],
  providers: [
    ImportService,
    {
      provide: IMPORT_REPOSITORY,
      useClass: PostgresImportRepository,
    },
  ],
})
export class ImportModule {}
