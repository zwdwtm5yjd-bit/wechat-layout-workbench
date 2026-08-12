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

  it("允许原稿图片改变位置但不允许替换图片资源", () => {
    const previous: DocumentV1 = structuredClone(documentV1Fixture);
    const imageIndex = previous.content.content.findIndex((node) => node.type === "imageBlock");
    expect(imageIndex).toBeGreaterThanOrEqual(0);
    const planned: DocumentV1 = structuredClone(previous);
    const [image] = planned.content.content.splice(imageIndex, 1);
    if (image === undefined || image.type !== "imageBlock")
      throw new Error("fixture image missing");
    planned.content.content.splice(1, 0, image);

    expect(() => assertValidPlannedLayout(previous, planned)).not.toThrow();

    image.attrs.resourceId = "01900000-0000-7000-8000-000000000099";
    expect(() => assertValidPlannedLayout(previous, planned)).toThrow(/替换或改写了原稿图片/u);
  });
});
