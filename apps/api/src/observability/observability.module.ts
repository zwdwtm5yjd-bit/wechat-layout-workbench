import { Module } from "@nestjs/common";
import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";

import { AppModule } from "../app.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { RedisModule } from "../redis/redis.module.js";
import { METRICS_AUTH_TOKEN, MetricsController } from "./metrics.controller.js";
import { PrometheusMetricsService } from "./prometheus-metrics.service.js";

@Module({
  imports: [AppModule, DatabaseModule, RedisModule],
  controllers: [MetricsController],
  providers: [
    PrometheusMetricsService,
    {
      provide: METRICS_AUTH_TOKEN,
      useFactory: (): string => revealSecret(loadServerEnvironment().security.metricsBearerToken),
    },
  ],
})
export class ObservabilityModule {}
