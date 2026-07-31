import { describe, expect, it } from "vitest";

import { parseBullMqConnection } from "./connection.js";

describe("parseBullMqConnection", () => {
  it("parses authenticated Redis URLs without retaining the raw URL", () => {
    expect(parseBullMqConnection("rediss://worker:p%40ss@redis.internal:6380/4")).toEqual({
      host: "redis.internal",
      port: 6380,
      db: 4,
      maxRetriesPerRequest: null,
      username: "worker",
      password: "p@ss",
      tls: {},
    });
  });

  it("rejects unsupported protocols and invalid database numbers", () => {
    expect(() => parseBullMqConnection("http://localhost:6379/0")).toThrow("仅支持");
    expect(() => parseBullMqConnection("redis://localhost/not-a-number")).toThrow("数据库编号");
  });
});
