import type { DocumentV1 } from "./document.js";
import { collectDocumentEntries } from "./traversal.js";

export interface SourceBlockStabilityError {
  code: "SOURCE_BLOCK_ID_CHANGED";
  blockId: string;
  previousSourceBlockId: string;
  currentSourceBlockId?: string;
  path: string;
  message: string;
}

export type SourceBlockStabilityResult =
  | {
      success: true;
    }
  | {
      success: false;
      errors: SourceBlockStabilityError[];
    };

export function validateSourceBlockIdStability(
  previous: DocumentV1,
  current: DocumentV1,
): SourceBlockStabilityResult {
  const previousSources = new Map<string, string>();
  const currentEntries = collectDocumentEntries(current.content).blocks;

  for (const { node } of collectDocumentEntries(previous.content).blocks) {
    if (node.attrs.sourceBlockId !== undefined) {
      previousSources.set(node.attrs.blockId, node.attrs.sourceBlockId);
    }
  }

  const errors: SourceBlockStabilityError[] = [];

  for (const { node, path } of currentEntries) {
    const previousSourceBlockId = previousSources.get(node.attrs.blockId);

    if (previousSourceBlockId !== undefined && node.attrs.sourceBlockId !== previousSourceBlockId) {
      errors.push({
        code: "SOURCE_BLOCK_ID_CHANGED",
        blockId: node.attrs.blockId,
        previousSourceBlockId,
        ...(node.attrs.sourceBlockId === undefined
          ? {}
          : { currentSourceBlockId: node.attrs.sourceBlockId }),
        path: `${path}/attrs/sourceBlockId`,
        message: `Block “${node.attrs.blockId}” 的 Source ID 一经写入便不能修改或删除`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
  };
}
