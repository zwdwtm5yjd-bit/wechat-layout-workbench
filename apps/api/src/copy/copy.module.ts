import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { COPY_REPOSITORY } from "./copy.constants.js";
import { CopyController } from "./copy.controller.js";
import { CopyService } from "./copy.service.js";
import { PostgresCopyRepository } from "./postgres-copy.repository.js";

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [CopyController],
  providers: [
    CopyService,
    {
      provide: COPY_REPOSITORY,
      useClass: PostgresCopyRepository,
    },
  ],
})
export class CopyModule {}
