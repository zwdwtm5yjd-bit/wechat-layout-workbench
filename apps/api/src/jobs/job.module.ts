import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";
import { JobCoordinator, JobQueueRegistry, JobStore } from "@wechat-layout/job-runtime";

import { DATABASE_CONNECTION, DatabaseModule } from "../database/database.module.js";
import { HealthModule } from "../health/health.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { JOB_COORDINATOR, JOB_QUEUES, JOB_STORE } from "./job.constants.js";
import { JobController } from "./job.controller.js";
import { JobService } from "./job.service.js";
import { WorkerHeartbeatReadiness } from "./worker-heartbeat.readiness.js";

@Injectable()
class JobQueueLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(JOB_QUEUES)
    private readonly queues: JobQueueRegistry,
  ) {}

  onModuleDestroy(): Promise<void> {
    return this.queues.close();
  }
}

@Module({
  imports: [DatabaseModule, RedisModule, HealthModule],
  controllers: [JobController],
  providers: [
    {
      provide: JOB_STORE,
      inject: [DATABASE_CONNECTION],
      useFactory: (connection: ConstructorParameters<typeof JobStore>[0]) =>
        new JobStore(connection),
    },
    {
      provide: JOB_QUEUES,
      useFactory: () => {
        const configuration = loadServerEnvironment();
        return new JobQueueRegistry(revealSecret(configuration.redis.url));
      },
    },
    {
      provide: JOB_COORDINATOR,
      inject: [JOB_STORE, JOB_QUEUES],
      useFactory: (store: JobStore, queues: JobQueueRegistry) => new JobCoordinator(store, queues),
    },
    JobQueueLifecycle,
    WorkerHeartbeatReadiness,
    JobService,
  ],
  exports: [JobService],
})
export class JobModule {}
