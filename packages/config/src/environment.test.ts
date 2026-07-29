import { describe, expect, it } from "vitest";

import { parseRuntimeEnvironment } from "./environment.js";

describe("parseRuntimeEnvironment", () => {
  it("provides safe local defaults", () => {
    const environment = parseRuntimeEnvironment({});

    expect(environment).toEqual({
      NODE_ENV: "development",
      WEB_PORT: 3000,
      API_PORT: 3001,
      WORKER_CONCURRENCY: 2,
      SCHEDULER_INTERVAL_SECONDS: 60,
    });
  });

  it("rejects an invalid port", () => {
    expect(() => parseRuntimeEnvironment({ API_PORT: "70000" })).toThrow();
  });
});
