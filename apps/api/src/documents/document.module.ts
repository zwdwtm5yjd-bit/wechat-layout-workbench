import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { DOCUMENT_REPOSITORY } from "./document.constants.js";
import { DocumentController } from "./document.controller.js";
import { DocumentService } from "./document.service.js";
import { PostgresDocumentRepository } from "./postgres-document.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    {
      provide: DOCUMENT_REPOSITORY,
      useClass: PostgresDocumentRepository,
    },
  ],
  exports: [DocumentService],
})
export class DocumentModule {}
