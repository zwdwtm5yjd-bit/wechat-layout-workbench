import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { SNAPSHOT_REPOSITORY } from "./snapshot.constants.js";
import { PostgresSnapshotRepository } from "./postgres-snapshot.repository.js";
import { SnapshotController } from "./snapshot.controller.js";
import { SnapshotService } from "./snapshot.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [SnapshotController],
  providers: [
    SnapshotService,
    {
      provide: SNAPSHOT_REPOSITORY,
      useClass: PostgresSnapshotRepository,
    },
  ],
  exports: [SnapshotService],
})
export class SnapshotModule {}
