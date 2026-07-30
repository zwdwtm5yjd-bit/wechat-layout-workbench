import { describe, expect, it } from "vitest";

import { validateSourceBlockIdStability } from "./evolution.js";
import { documentV1Fixture } from "./fixtures/index.js";

describe("sourceBlockId stability", () => {
  it("allows sourceBlockId to remain optional", () => {
    const previous = structuredClone(documentV1Fixture);
    const current = structuredClone(documentV1Fixture);

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
