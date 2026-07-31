import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import { CopyModule } from "./copy/copy.module.js";

describe("AppModule", () => {
  it("exposes the NestJS application module", () => {
    expect(AppModule).toBeDefined();
    expect(CopyModule).toBeDefined();
  });
});
