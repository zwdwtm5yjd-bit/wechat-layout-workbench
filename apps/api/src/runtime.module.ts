import { Module } from "@nestjs/common";

import { AppModule } from "./app.module.js";
import { ArticleModule } from "./articles/article.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DocumentModule } from "./documents/document.module.js";
import { CopyModule } from "./copy/copy.module.js";
import { ImportModule } from "./imports/import.module.js";
import { JobModule } from "./jobs/job.module.js";
import { ResourceModule } from "./resources/resource.module.js";
import { SnapshotModule } from "./snapshots/snapshot.module.js";
import { ThemeModule } from "./themes/theme.module.js";

@Module({
  imports: [
    AppModule,
    DatabaseModule,
    AuthModule,
    ArticleModule,
    DocumentModule,
    CopyModule,
    SnapshotModule,
    ImportModule,
    ResourceModule,
    JobModule,
    ThemeModule,
  ],
})
export class RuntimeModule {}
