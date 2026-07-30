import {
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";
import {
  checkDatabaseConnection,
  createDatabaseConnection,
  type DatabaseConnection,
  verifyDatabaseSchema,
} from "@wechat-layout/database";

import { HealthModule } from "../health/health.module.js";
import { ReadinessRegistry, type ReadinessProbe } from "../health/readiness-registry.service.js";

export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");

@Injectable()
class DatabaseLifecycle implements OnModuleInit, OnModuleDestroy, ReadinessProbe {
  readonly name = "database";

  #closed = false;
  #unregister?: () => void;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
    @Inject(ReadinessRegistry)
    private readonly readiness: ReadinessRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await verifyDatabaseSchema(this.connection);
      this.#unregister = this.readiness.register(this);
    } catch (error) {
      await this.closeConnection();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.#unregister?.();
    await this.closeConnection();
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      await checkDatabaseConnection(this.connection);
      return {
        database: {
          status: "up",
        },
      };
    } catch {
      return {
        database: {
          status: "down",
          message: "数据库连接不可用",
        },
      };
    }
  }

  private async closeConnection(): Promise<void> {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    await this.connection.close();
  }
}

@Module({
  imports: [HealthModule],
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (): DatabaseConnection => {
        const configuration = loadServerEnvironment();

        return createDatabaseConnection(revealSecret(configuration.database.url), {
          applicationName: "wechat-layout-api",
        });
      },
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
