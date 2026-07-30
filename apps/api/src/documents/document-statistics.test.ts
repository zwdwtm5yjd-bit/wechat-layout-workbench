import type { DocumentV1 } from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { describe, expect, it } from "vitest";

import { statisticsForDocument } from "./document-statistics.js";

describe("document statistics", () => {
  it("keeps the text hash unchanged for mark and visual-style changes", () => {
    const styled = structuredClone(documentV1Fixture) as DocumentV1;
    const paragraph = styled.content.content[1]!;
    if (paragraph.type === "paragraph") {
      paragraph.attrs.styleOverrides = {
        ...paragraph.attrs.styleOverrides,
        marginBottom: 36,
      };
      paragraph.content = [
        { type: "text", text: "正文", marks: [{ type: "bold" }] },
        { type: "text", text: "支持" },
        { type: "hardBreak" },
        { type: "text", text: "受控行内样式", marks: [{ type: "italic" }] },
      ];
    }

    expect(statisticsForDocument(styled).currentTextHash).toBe(
      statisticsForDocument(documentV1Fixture).currentTextHash,
    );
  });
});
