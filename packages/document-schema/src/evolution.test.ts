import { describe, expect, it } from "vitest";

import type { DocumentV1 } from "./document.js";
import { validateSourceBlockIdStability } from "./evolution.js";
import { documentV1Fixture } from "./fixtures/index.js";
import {
  createTextChangeReport,
  documentPlainText,
  lockAllSourceBlocks,
  setDocumentBlockLocked,
  validateTextLockEvolution,
} from "./text-lock.js";

describe("sourceBlockId stability", () => {
  it("allows sourceBlockId to remain optional", () => {
    const previous = structuredClone(documentV1Fixture);
    const current = structuredClone(documentV1Fixture) as DocumentV1;

    expect(validateSourceBlockIdStability(previous, current)).toEqual({
      success: true,
    });
  });

  it("rejects changing or removing an existing sourceBlockId", () => {
    const previous = structuredClone(documentV1Fixture);
    const changed = structuredClone(documentV1Fixture);
    const removed = structuredClone(documentV1Fixture);

    changed.content.content[0]!.attrs.sourceBlockId = "source_reassigned";
    delete removed.content.content[0]!.attrs.sourceBlockId;

    expect(validateSourceBlockIdStability(previous, changed)).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          code: "SOURCE_BLOCK_ID_CHANGED",
          blockId: "block_heading",
          previousSourceBlockId: "source_heading",
          currentSourceBlockId: "source_reassigned",
        }),
      ],
    });

    expect(validateSourceBlockIdStability(previous, removed)).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          code: "SOURCE_BLOCK_ID_CHANGED",
          blockId: "block_heading",
          previousSourceBlockId: "source_heading",
        }),
      ],
    });
  });
});

describe("original text lock", () => {
  it("allows visual changes, decorations and complete-block moves", () => {
    const current = structuredClone(documentV1Fixture) as DocumentV1;
    const heading = current.content.content[0]!;
    if (heading.type === "heading") {
      heading.attrs.level = 2;
      heading.attrs.styleOverrides = { marginBottom: 28 };
      const firstInline = heading.content?.[0];
      if (firstInline?.type === "text") {
        firstInline.marks = [...(firstInline.marks ?? []), { type: "underline" }];
      }
    }
    current.content.content.push({
      type: "divider",
      attrs: {
        blockId: "block_new_decoration",
        locked: false,
        variant: "dotted",
      },
    });
    const moved = current.content.content.shift()!;
    current.content.content.splice(2, 0, moved);

    expect(validateTextLockEvolution(documentV1Fixture.content, current.content, true)).toEqual({
      success: true,
    });
  });

  it("rejects edits, deletion, splitting and source hash tampering in locked blocks", () => {
    const edited = structuredClone(documentV1Fixture) as DocumentV1;
    const removed = structuredClone(documentV1Fixture) as DocumentV1;
    const split = structuredClone(documentV1Fixture) as DocumentV1;
    const tampered = structuredClone(documentV1Fixture) as DocumentV1;
    const editedHeading = edited.content.content[0]!;
    const splitHeading = split.content.content[0]!;
    const tamperedHeading = tampered.content.content[0]!;

    if (editedHeading.type === "heading" && editedHeading.content?.[0]?.type === "text") {
      editedHeading.content[0].text = "被修改的原文";
    }
    removed.content.content.shift();
    if (splitHeading.type === "heading") {
      splitHeading.content = [{ type: "text", text: "Document" }];
      split.content.content.splice(1, 0, {
        type: "heading",
        attrs: {
          ...structuredClone(splitHeading.attrs),
          blockId: "block_split_heading",
        },
        content: [{ type: "text", text: " Schema V1" }],
      });
    }
    tamperedHeading.attrs.sourceTextHash = `sha256:${"b".repeat(64)}`;

    for (const candidate of [edited, removed, split, tampered]) {
      expect(
        validateTextLockEvolution(documentV1Fixture.content, candidate.content, true).success,
      ).toBe(false);
    }
  });

  it("requires an explicit unlock before text can change and can lock all source blocks again", () => {
    const unlocked = setDocumentBlockLocked(documentV1Fixture, "block_heading", false);
    expect(unlocked).not.toBeNull();
    expect(validateTextLockEvolution(documentV1Fixture.content, unlocked!.content, true)).toEqual({
      success: true,
    });

    const edited = structuredClone(unlocked!);
    const heading = edited.content.content[0]!;
    if (heading.type === "heading" && heading.content?.[0]?.type === "text") {
      heading.content[0].text = "解锁后可以修改";
    }
    expect(validateTextLockEvolution(unlocked!.content, edited.content, true)).toEqual({
      success: true,
    });

    const relocked = lockAllSourceBlocks(edited);
    expect(relocked.content.content[0]?.attrs.locked).toBe(true);
  });

  it("reports text, style, order and decoration changes separately", () => {
    const current = structuredClone(documentV1Fixture) as DocumentV1;
    const heading = current.content.content[0]!;
    if (heading.type === "heading" && heading.content?.[0]?.type === "text") {
      heading.content[0].text = "Document Schema V2";
      heading.attrs.styleOverrides = { marginBottom: 24 };
    }
    current.content.content.push({
      type: "divider",
      attrs: { blockId: "block_report_divider", locked: false },
    });

    const report = createTextChangeReport(documentV1Fixture, current);
    expect(report).toMatchObject({
      addedCharacters: 0,
      addedDesignBlocks: 1,
      changedCharacters: 1,
      changedSourceBlocks: 1,
      deletedCharacters: 0,
      modifiedCharacters: 1,
      orderChanged: false,
      styleChangedBlocks: 1,
      styleOnly: false,
    });
  });

  it("uses persisted Source Blocks as the report baseline after a document reload", () => {
    const saved = structuredClone(documentV1Fixture) as DocumentV1;
    saved.content.content = [saved.content.content[0]!];
    const heading = saved.content.content[0]!;
    if (heading.type === "heading" && heading.content?.[0]?.type === "text") {
      heading.content[0].text = "Document Schema V2";
    }

    const report = createTextChangeReport(saved, saved, [
      {
        blockType: "title",
        orderIndex: 0,
        sourceBlockId: "source_heading",
        text: "Document Schema V1",
        textHash: "a".repeat(64),
      },
    ]);

    expect(report).toMatchObject({
      changedCharacters: 1,
      changedSourceBlocks: 1,
      currentCharacters: 18,
      modifiedCharacters: 1,
      originalCharacters: 18,
    });
  });

  it("keeps plain text stable when marks split adjacent text nodes", () => {
    const current = structuredClone(documentV1Fixture) as DocumentV1;
    const paragraph = current.content.content[1]!;
    if (paragraph.type === "paragraph") {
      paragraph.content = [
        { type: "text", text: "正文", marks: [{ type: "bold" }] },
        { type: "text", text: "支持" },
        { type: "hardBreak" },
        { type: "text", text: "受控行内样式" },
      ];
    }

    expect(documentPlainText(current.content)).toBe(documentPlainText(documentV1Fixture.content));
  });
});
