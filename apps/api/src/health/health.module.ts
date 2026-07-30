import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller.js";
import { ReadinessRegistry } from "./readiness-registry.service.js";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [ReadinessRegistry],
  exports: [ReadinessRegistry],
})
export class HealthModule {}
