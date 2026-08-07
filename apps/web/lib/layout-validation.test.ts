import { describe, expect, it } from "vitest";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";

import { assertValidPlannedLayout, LayoutValidationError } from "./layout-validation";

describe("assertValidPlannedLayout", () => {
  it("允许仅修改视觉属性", () => {
    const previous: DocumentV1 = structuredClone(documentV1Fixture);
    const planned: DocumentV1 = structuredClone(previous);
    planned.content.content[0]!.attrs.styleOverrides = {
      ...planned.content.content[0]!.attrs.styleOverrides,
      textColor: "#B4232C",
    };

    expect(() => assertValidPlannedLayout(previous, planned)).not.toThrow();
  });

  it("在请求发往服务端前拦截非法属性", () => {
    const previous: DocumentV1 = structuredClone(documentV1Fixture);
    const planned = structuredClone(previous) as DocumentV1 & {
      content: { content: Array<{ attrs: Record<string, unknown> }> };
    };
    planned.content.content[0]!.attrs.semanticRole = "x".repeat(201);

    expect(() => assertValidPlannedLayout(previous, planned)).toThrow(LayoutValidationError);
  });
});
