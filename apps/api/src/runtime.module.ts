import { Module } from "@nestjs/common";

import { AppModule } from "./app.module.js";
import { ArticleModule } from "./articles/article.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DocumentModule } from "./documents/document.module.js";

@Module({
  imports: [AppModule, DatabaseModule, AuthModule, ArticleModule, DocumentModule],
})
export class RuntimeModule {}
