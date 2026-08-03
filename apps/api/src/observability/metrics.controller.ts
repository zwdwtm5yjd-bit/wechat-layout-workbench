import { Controller, Get, Headers, Inject, Res, UnauthorizedException } from "@nestjs/common";

import { PublicRoute } from "../auth/auth.decorators.js";
import { RawResponse } from "../common/http/raw-response.decorator.js";
import { validMetricsAuthorization } from "./metrics-auth.js";
import { PrometheusMetricsService } from "./prometheus-metrics.service.js";

interface MetricsResponse {
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

export const METRICS_AUTH_TOKEN = Symbol("METRICS_AUTH_TOKEN");

@Controller("internal")
@PublicRoute()
@RawResponse()
export class MetricsController {
  constructor(
    @Inject(PrometheusMetricsService)
    private readonly metrics: PrometheusMetricsService,
    @Inject(METRICS_AUTH_TOKEN)
    private readonly token: string,
  ) {}

  @Get("metrics")
  async getMetrics(
    @Headers("authorization") authorization: string | undefined,
    @Res() response: MetricsResponse,
  ): Promise<void> {
    if (!validMetricsAuthorization(authorization, this.token)) {
      throw new UnauthorizedException("指标访问凭据无效");
    }
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
    response.send(await this.metrics.render());
  }
}
