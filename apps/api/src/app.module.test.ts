import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";

describe("AppModule", () => {
  it("exposes the NestJS application module", () => {
    expect(AppModule).toBeDefined();
  });
});
