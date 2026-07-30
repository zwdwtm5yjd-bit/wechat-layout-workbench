import type { DocumentV1 } from "./document.js";
import type { BlockNode, DocNode, InlineNode } from "./nodes/index.js";
import { collectDocumentEntries } from "./traversal.js";

export type TextLockViolationCode =
  | "LOCKED_BLOCK_REMOVED"
  | "LOCKED_NUMBERING_CHANGED"
  | "LOCKED_TEXT_CHANGED"
  | "SOURCE_BLOCK_ID_DUPLICATED"
  | "SOURCE_TEXT_HASH_CHANGED";

export interface TextLockViolation {
  readonly code: TextLockViolationCode;
  readonly blockId: string;
  readonly path: string;
  readonly message: string;
  readonly sourceBlockId?: string;
}

export type TextLockValidationResult =
  | {
      readonly success: true;
    }
  | {
      readonly success: false;
      readonly violations: readonly TextLockViolation[];
    };

export interface TextChangeReport {
  readonly addedCharacters: number;
  readonly addedDesignBlocks: number;
  readonly changedCharacters: number;
  readonly changedSourceBlocks: number;
  readonly currentCharacters: number;
  readonly deletedCharacters: number;
  readonly modifiedCharacters: number;
  readonly orderChanged: boolean;
  readonly originalCharacters: number;
  readonly styleChangedBlocks: number;
  readonly styleOnly: boolean;
}

export interface SourceTextBaseline {
  readonly blockType: string;
  readonly orderIndex: number;
  readonly sourceBlockId: string;
  readonly text: string;
  readonly textHash?: string | null;
}

function inlineText(content: readonly InlineNode[] | undefined): string {
  return content?.map((node) => (node.type === "hardBreak" ? "\n" : node.text)).join("") ?? "";
}

function presentString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function blockText(node: BlockNode): string {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return inlineText(node.content);
    case "blockquote":
    case "bulletList":
    case "orderedList":
    case "listItem":
    case "semanticCard":
    case "brandFooter":
      return node.content?.map(blockText).filter(Boolean).join("\n") ?? "";
    case "imageBlock":
    case "divider":
    case "svgInteraction":
      return "";
  }
}

export function documentPlainText(content: DocNode): string {
  return content.content.map(blockText).filter(Boolean).join("\n");
}

function sourceOrder(content: DocNode): string[] {
  return collectDocumentEntries(content).blocks.flatMap(({ node }) =>
    presentString(node.attrs.sourceBlockId) ? [node.attrs.sourceBlockId] : [],
  );
}

function visualFingerprint(node: BlockNode): string {
  const clone = structuredClone(node) as BlockNode;
  const visit = (block: BlockNode): void => {
    const visualAttributes = { ...block.attrs } as Record<string, unknown>;
    delete visualAttributes.blockId;
    delete visualAttributes.locked;
    delete visualAttributes.sourceBlockId;
    delete visualAttributes.sourceTextHash;
    block.attrs = visualAttributes as unknown as BlockNode["attrs"];

    if ("content" in block && Array.isArray(block.content)) {
      for (const child of block.content) {
        if (child.type === "text") {
          child.text = "";
        } else if (child.type !== "hardBreak") {
          visit(child);
        }
      }
    }
  };

  visit(clone);
  return JSON.stringify(clone);
}

function shortestEditCounts(
  previous: string,
  current: string,
): { readonly inserted: number; readonly removed: number } {
  const before = [...previous];
  const after = [...current];
  const maximum = before.length + after.length;
  const furthest = new Map<number, number>([[1, 0]]);

  for (let distance = 0; distance <= maximum; distance += 1) {
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down =
        diagonal === -distance ||
        (diagonal !== distance &&
          (furthest.get(diagonal - 1) ?? -1) < (furthest.get(diagonal + 1) ?? -1));
      let x = down ? (furthest.get(diagonal + 1) ?? 0) : (furthest.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;

      while (x < before.length && y < after.length && before[x] === after[y]) {
        x += 1;
        y += 1;
      }
      furthest.set(diagonal, x);

      if (x >= before.length && y >= after.length) {
        return {
          inserted: (distance + after.length - before.length) / 2,
          removed: (distance + before.length - after.length) / 2,
        };
      }
    }
  }

  return {
    inserted: after.length,
    removed: before.length,
  };
}

export function createTextChangeReport(
  original: DocumentV1,
  current: DocumentV1,
  sourceBaseline: readonly SourceTextBaseline[] = [],
): TextChangeReport {
  const includedSourceBaseline = sourceBaseline
    .filter((block) => block.blockType !== "excluded")
    .toSorted((left, right) => left.orderIndex - right.orderIndex);
  const originalText =
    includedSourceBaseline.length === 0
      ? documentPlainText(original.content)
      : includedSourceBaseline
          .map((block) => block.text)
          .filter(Boolean)
          .join("\n");
  const currentText = documentPlainText(current.content);
  const edits = shortestEditCounts(originalText, currentText);
  const modifiedCharacters = Math.min(edits.inserted, edits.removed);
  const originalEntries = collectDocumentEntries(original.content).blocks;
  const currentEntries = collectDocumentEntries(current.content).blocks;
  const originalById = new Map(originalEntries.map(({ node }) => [node.attrs.blockId, node]));
  const currentBySourceId = new Map(
    currentEntries.flatMap(({ node }) =>
      presentString(node.attrs.sourceBlockId) ? ([[node.attrs.sourceBlockId, node]] as const) : [],
    ),
  );
  const changedSourceBlocks =
    includedSourceBaseline.length === 0
      ? originalEntries.filter(({ node }) => {
          const sourceBlockId = node.attrs.sourceBlockId;
          if (!presentString(sourceBlockId)) {
            return false;
          }
          const currentNode = currentBySourceId.get(sourceBlockId);
          return currentNode === undefined || blockText(currentNode) !== blockText(node);
        }).length
      : includedSourceBaseline.filter((source) => {
          const currentNode = currentBySourceId.get(source.sourceBlockId);
          return currentNode === undefined || blockText(currentNode) !== source.text;
        }).length;
  const styleChangedBlocks = currentEntries.filter(({ node }) => {
    const originalNode = originalById.get(node.attrs.blockId);
    return (
      originalNode !== undefined && visualFingerprint(originalNode) !== visualFingerprint(node)
    );
  }).length;
  const addedDesignBlocks = currentEntries.filter(
    ({ node }) => !originalById.has(node.attrs.blockId) && blockText(node) === "",
  ).length;
  const changedCharacters =
    modifiedCharacters +
    Math.max(0, edits.inserted - modifiedCharacters) +
    Math.max(0, edits.removed - modifiedCharacters);

  return {
    addedCharacters: Math.max(0, edits.inserted - modifiedCharacters),
    addedDesignBlocks,
    changedCharacters,
    changedSourceBlocks,
    currentCharacters: [...currentText].length,
    deletedCharacters: Math.max(0, edits.removed - modifiedCharacters),
    modifiedCharacters,
    orderChanged:
      (includedSourceBaseline.length === 0
        ? sourceOrder(original.content)
        : includedSourceBaseline.map((block) => block.sourceBlockId)
      ).join("\u0000") !== sourceOrder(current.content).join("\u0000"),
    originalCharacters: [...originalText].length,
    styleChangedBlocks,
    styleOnly: changedCharacters === 0 && styleChangedBlocks > 0,
  };
}

export function validateTextLockEvolution(
  previous: DocNode,
  current: DocNode,
  textLocked: boolean,
): TextLockValidationResult {
  const previousEntries = collectDocumentEntries(previous).blocks;
  const currentEntries = collectDocumentEntries(current).blocks;
  const currentById = new Map(currentEntries.map((entry) => [entry.node.attrs.blockId, entry]));
  const currentSourceIds = new Map<string, { readonly blockId: string; readonly path: string }>();
  const violations: TextLockViolation[] = [];

  for (const { node, path } of currentEntries) {
    const sourceBlockId = node.attrs.sourceBlockId;
    if (!presentString(sourceBlockId)) {
      continue;
    }
    const existing = currentSourceIds.get(sourceBlockId);
    if (existing === undefined) {
      currentSourceIds.set(sourceBlockId, { blockId: node.attrs.blockId, path });
    } else {
      violations.push({
        code: "SOURCE_BLOCK_ID_DUPLICATED",
        blockId: node.attrs.blockId,
        path: `${path}/attrs/sourceBlockId`,
        sourceBlockId,
        message: `Source Block “${sourceBlockId}” 不能重复`,
      });
    }
  }

  for (const { node: previousNode, path } of previousEntries) {
    const currentEntry = currentById.get(previousNode.attrs.blockId);
    if (
      currentEntry !== undefined &&
      presentString(previousNode.attrs.sourceTextHash) &&
      currentEntry.node.attrs.sourceTextHash !== previousNode.attrs.sourceTextHash
    ) {
      violations.push({
        code: "SOURCE_TEXT_HASH_CHANGED",
        blockId: previousNode.attrs.blockId,
        path: `${currentEntry.path}/attrs/sourceTextHash`,
        ...(presentString(previousNode.attrs.sourceBlockId)
          ? { sourceBlockId: previousNode.attrs.sourceBlockId }
          : {}),
        message: `区块 “${previousNode.attrs.blockId}” 的原文哈希不能修改或删除`,
      });
    }

    if (!textLocked || previousNode.attrs.locked !== true) {
      continue;
    }
    if (currentEntry === undefined) {
      violations.push({
        code: "LOCKED_BLOCK_REMOVED",
        blockId: previousNode.attrs.blockId,
        path,
        ...(presentString(previousNode.attrs.sourceBlockId)
          ? { sourceBlockId: previousNode.attrs.sourceBlockId }
          : {}),
        message: `锁定区块 “${previousNode.attrs.blockId}” 不能删除`,
      });
      continue;
    }
    if (blockText(previousNode) !== blockText(currentEntry.node)) {
      violations.push({
        code: "LOCKED_TEXT_CHANGED",
        blockId: previousNode.attrs.blockId,
        path: currentEntry.path,
        ...(presentString(previousNode.attrs.sourceBlockId)
          ? { sourceBlockId: previousNode.attrs.sourceBlockId }
          : {}),
        message: `区块 “${previousNode.attrs.blockId}” 的原文已锁定`,
      });
    }
    if (
      previousNode.type === "listItem" &&
      currentEntry.node.type === "listItem" &&
      previousNode.attrs.originalNumberText !== currentEntry.node.attrs.originalNumberText
    ) {
      violations.push({
        code: "LOCKED_NUMBERING_CHANGED",
        blockId: previousNode.attrs.blockId,
        path: `${currentEntry.path}/attrs/originalNumberText`,
        ...(presentString(previousNode.attrs.sourceBlockId)
          ? { sourceBlockId: previousNode.attrs.sourceBlockId }
          : {}),
        message: `区块 “${previousNode.attrs.blockId}” 的原始编号已锁定`,
      });
    }
  }

  return violations.length === 0 ? { success: true } : { success: false, violations };
}

function updateLock(
  node: BlockNode,
  blockId: string,
  locked: boolean,
): { readonly changed: boolean; readonly node: BlockNode } {
  let changed = node.attrs.blockId === blockId;
  const clone = structuredClone(node) as BlockNode;

  if (changed) {
    clone.attrs.locked = locked;
  }
  if ("content" in clone && Array.isArray(clone.content)) {
    for (let index = 0; index < clone.content.length; index += 1) {
      const child = clone.content[index];
      if (child?.type === "text" || child?.type === "hardBreak" || child === undefined) {
        continue;
      }
      if (changed) {
        child.attrs.locked = locked;
      } else {
        const result = updateLock(child, blockId, locked);
        changed = result.changed;
        clone.content[index] = result.node as never;
      }
    }
  }

  return { changed, node: clone };
}

export function setDocumentBlockLocked(
  document: DocumentV1,
  blockId: string,
  locked: boolean,
): DocumentV1 | null {
  const next = structuredClone(document);

  for (let index = 0; index < next.content.content.length; index += 1) {
    const node = next.content.content[index];
    if (node === undefined) {
      continue;
    }
    const result = updateLock(node, blockId, locked);
    next.content.content[index] = result.node as DocNode["content"][number];
    if (result.changed) {
      next.meta.updatedAt = new Date().toISOString();
      return next;
    }
  }

  return null;
}

function lockSourceNodes(node: BlockNode): boolean {
  let containsSource =
    presentString(node.attrs.sourceBlockId) || presentString(node.attrs.sourceTextHash);
  if ("content" in node && Array.isArray(node.content)) {
    for (const child of node.content) {
      if (child.type !== "text" && child.type !== "hardBreak") {
        containsSource = lockSourceNodes(child) || containsSource;
      }
    }
  }
  if (containsSource) {
    node.attrs.locked = true;
  }
  return containsSource;
}

export function lockAllSourceBlocks(document: DocumentV1): DocumentV1 {
  const next = structuredClone(document);
  next.content.content.forEach(lockSourceNodes);
  next.meta.updatedAt = new Date().toISOString();
  return next;
}
