import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, type HealthCheckResult } from "@nestjs/terminus";

import { RawResponse } from "../common/http/raw-response.decorator.js";
import { ReadinessRegistry } from "./readiness-registry.service.js";

@ApiTags("health")
@Controller("health")
@RawResponse()
export class HealthController {
  constructor(
    @Inject(HealthCheckService)
    private readonly health: HealthCheckService,
    @Inject(ReadinessRegistry)
    private readonly readiness: ReadinessRegistry,
  ) {}

  @Get("live")
  @HealthCheck()
  @ApiOperation({ summary: "进程存活检查" })
  @ApiOkResponse({ description: "API 进程正在运行" })
  live(): Promise<HealthCheckResult> {
    return this.health.check([
      () => ({
        api: {
          status: "up",
        },
      }),
    ]);
  }

  @Get("ready")
  @HealthCheck()
  @ApiOperation({ summary: "服务就绪检查" })
  @ApiOkResponse({ description: "全部已注册依赖探针通过" })
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.readiness.check()]);
  }
}
