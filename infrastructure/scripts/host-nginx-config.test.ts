import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const config = readFileSync(
  resolve(process.cwd(), "infrastructure/nginx/visual.ericmm.com.host.conf"),
  "utf8",
);

function locationBody(pattern: RegExp): string {
  const match = config.match(pattern);
  expect(match?.[1]).toBeDefined();
  return match?.[1] ?? "";
}

describe("host Nginx AI layout timeouts", () => {
  it("lets AI layout requests outlive the provider timeout", () => {
    const aiLayoutLocation = locationBody(
      /location ~ \^\/api\/v1\/articles\/\[\^\/\]\+\/ai-layout\/plan\$ \{([\s\S]*?)\n  \}/,
    );

    expect(aiLayoutLocation).toContain("proxy_connect_timeout 5s;");
    expect(aiLayoutLocation).toContain("proxy_read_timeout 120s;");
    expect(aiLayoutLocation).toContain("proxy_send_timeout 120s;");
  });

  it("keeps the generic API timeout narrow", () => {
    const genericApiLocation = locationBody(/location \/api\/ \{([\s\S]*?)\n  \}/);

    expect(genericApiLocation).toContain("proxy_read_timeout 30s;");
    expect(genericApiLocation).toContain("proxy_send_timeout 30s;");
  });
});
