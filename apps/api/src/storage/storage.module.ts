import {
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";
import { S3CompatibleObjectStorage, type ObjectStorage } from "@wechat-layout/storage-adapter";

import { HealthModule } from "../health/health.module.js";
import { ReadinessRegistry, type ReadinessProbe } from "../health/readiness-registry.service.js";

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

@Injectable()
class ObjectStorageLifecycle implements OnModuleInit, OnModuleDestroy, ReadinessProbe {
  readonly name = "objectStorage";

  #unregister?: () => void;

  constructor(
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorage,
    @Inject(ReadinessRegistry)
    private readonly readiness: ReadinessRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.storage.statObject("healthcheck.txt");
    this.#unregister = this.readiness.register(this);
  }

  onModuleDestroy(): void {
    this.#unregister?.();
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.storage.statObject("healthcheck.txt");
      return {
        objectStorage: {
          status: "up",
        },
      };
    } catch {
      return {
        objectStorage: {
          status: "down",
          message: "对象存储不可用",
        },
      };
    }
  }
}

@Module({
  imports: [HealthModule],
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: (): ObjectStorage => {
        const configuration = loadServerEnvironment();
        return new S3CompatibleObjectStorage({
          endpoint: configuration.objectStorage.endpoint,
          publicEndpoint: configuration.objectStorage.publicEndpoint,
          addressingStyle: configuration.objectStorage.addressingStyle,
          publicAddressingStyle: configuration.objectStorage.publicAddressingStyle,
          metadataHeaderPrefix: configuration.objectStorage.metadataHeaderPrefix,
          region: configuration.objectStorage.region,
          bucket: configuration.objectStorage.bucket,
          accessKeyId: revealSecret(configuration.objectStorage.accessKeyId),
          secretAccessKey: revealSecret(configuration.objectStorage.secretAccessKey),
        });
      },
    },
    ObjectStorageLifecycle,
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
