import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { NodeSDK } from "@opentelemetry/sdk-node";

function validOtlpEndpoint(value: string | undefined): string | undefined {
  const endpoint = value?.trim();
  if (!endpoint) return undefined;
  try {
    const url = new URL(endpoint);
    return ["http:", "https:"].includes(url.protocol) ? endpoint : undefined;
  } catch {
    return undefined;
  }
}

const endpoint = validOtlpEndpoint(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);

export const telemetrySdk = endpoint
  ? new NodeSDK({
      serviceName: "wechat-layout-api",
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    })
  : null;

telemetrySdk?.start();

if (telemetrySdk !== null) {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void telemetrySdk.shutdown();
    });
  }
}
