import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { ARTICLE_REPOSITORY } from "./article.constants.js";
import { ArticleController } from "./article.controller.js";
import { ArticleService } from "./article.service.js";
import { PostgresArticleRepository } from "./postgres-article.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ArticleController],
  providers: [
    ArticleService,
    {
      provide: ARTICLE_REPOSITORY,
      useClass: PostgresArticleRepository,
    },
  ],
})
export class ArticleModule {}
