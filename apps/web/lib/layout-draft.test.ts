import {
  collectDocumentEntries,
  parseDocument,
  validateTextLockEvolution,
} from "@wechat-layout/document-schema";
import { documentV1Fixture } from "@wechat-layout/document-schema/fixtures";
import { describe, expect, it } from "vitest";

import { createEditableLayoutDraft } from "./layout-draft";

describe("editable layout draft", () => {
  it("unlocks every block while retaining source provenance", () => {
    const source = structuredClone(documentV1Fixture);
    const sourceEntries = collectDocumentEntries(source.content).blocks;
    const draft = createEditableLayoutDraft(source);
    const draftEntries = collectDocumentEntries(draft.content).blocks;

    expect(() => parseDocument(draft)).not.toThrow();
    expect(draftEntries.every(({ node }) => node.attrs.locked === false)).toBe(true);
    expect(
      draftEntries.map(({ node }) => ({
        blockId: node.attrs.blockId,
        sourceBlockId: node.attrs.sourceBlockId,
        sourceTextHash: node.attrs.sourceTextHash,
      })),
    ).toEqual(
      sourceEntries.map(({ node }) => ({
        blockId: node.attrs.blockId,
        sourceBlockId: node.attrs.sourceBlockId,
        sourceTextHash: node.attrs.sourceTextHash,
      })),
    );
    expect(
      collectDocumentEntries(source.content).blocks.some(({ node }) => node.attrs.locked),
    ).toBe(true);
  });

  it("establishes the unlocked baseline required before manual text editing", () => {
    const source = structuredClone(documentV1Fixture);
    const baseline = createEditableLayoutDraft(source);
    const edited = structuredClone(baseline);
    const heading = edited.content.content.find((node) => node.type === "heading");
    if (heading?.type !== "heading" || heading.content?.[0]?.type !== "text") {
      throw new Error("fixture heading missing");
    }
    heading.content[0].text = `${heading.content[0].text}·已审阅`;

    expect(validateTextLockEvolution(source.content, baseline.content, true)).toEqual({
      success: true,
    });
    expect(validateTextLockEvolution(source.content, edited.content, true).success).toBe(false);
    expect(validateTextLockEvolution(baseline.content, edited.content, true)).toEqual({
      success: true,
    });
  });
});
