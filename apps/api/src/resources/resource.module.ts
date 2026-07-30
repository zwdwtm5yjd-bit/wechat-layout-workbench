import { Module } from "@nestjs/common";
import { loadServerEnvironment } from "@wechat-layout/config/server";

import { DatabaseModule } from "../database/database.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { StorageModule } from "../storage/storage.module.js";
import {
  RESOURCE_REPOSITORY,
  RESOURCE_RUNTIME_OPTIONS,
  RESOURCE_UPLOAD_SESSION_STORE,
} from "./resource.constants.js";
import { ResourceController } from "./resource.controller.js";
import { RedisResourceUploadSessionStore } from "./resource-upload-session.store.js";
import { ResourceService } from "./resource.service.js";
import { PostgresResourceRepository } from "./postgres-resource.repository.js";

@Module({
  imports: [DatabaseModule, RedisModule, StorageModule],
  controllers: [ResourceController],
  providers: [
    ResourceService,
    {
      provide: RESOURCE_REPOSITORY,
      useClass: PostgresResourceRepository,
    },
    {
      provide: RESOURCE_UPLOAD_SESSION_STORE,
      useClass: RedisResourceUploadSessionStore,
    },
    {
      provide: RESOURCE_RUNTIME_OPTIONS,
      useFactory: () => ({
        maximumImageBytes: loadServerEnvironment().limits.imageFileBytes,
      }),
    },
  ],
})
export class ResourceModule {}
