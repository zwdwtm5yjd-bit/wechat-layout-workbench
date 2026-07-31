import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { SnapshotModule } from "../snapshots/snapshot.module.js";
import { PostgresThemeRepository } from "./postgres-theme.repository.js";
import { THEME_REPOSITORY } from "./theme.constants.js";
import { ThemeController } from "./theme.controller.js";
import { ThemeService } from "./theme.service.js";

@Module({
  imports: [DatabaseModule, SnapshotModule],
  controllers: [ThemeController],
  providers: [
    ThemeService,
    {
      provide: THEME_REPOSITORY,
      useClass: PostgresThemeRepository,
    },
  ],
  exports: [ThemeService],
})
export class ThemeModule {}
