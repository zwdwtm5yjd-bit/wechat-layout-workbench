import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface EditorBlockSnapshot {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly blockId: string;
  readonly index: number;
  readonly type: string;
  readonly locked: boolean;
  readonly textPreview: string;
}

export interface EditorSelectionSnapshot extends EditorBlockSnapshot {
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
}

interface TopLevelBlockEntry {
  readonly node: ProseMirrorNode;
  readonly pos: number;
  readonly index: number;
}

export function topLevelBlockEntries(editor: Editor): TopLevelBlockEntry[] {
  const entries: TopLevelBlockEntry[] = [];
  let pos = 0;

  editor.state.doc.forEach((node, _offset, index) => {
    entries.push({ node, pos, index });
    pos += node.nodeSize;
  });

  return entries;
}

function toSnapshot(entry: TopLevelBlockEntry): EditorBlockSnapshot {
  const blockId = typeof entry.node.attrs.blockId === "string" ? entry.node.attrs.blockId : "";
  return {
    attributes: structuredClone(entry.node.attrs) as Readonly<Record<string, unknown>>,
    blockId,
    index: entry.index,
    type: entry.node.type.name,
    locked: entry.node.attrs.locked === true,
    textPreview: entry.node.textContent.trim().slice(0, 48),
  };
}

export function listTopLevelBlocks(editor: Editor): EditorBlockSnapshot[] {
  return topLevelBlockEntries(editor).map(toSnapshot);
}

export function getEditorTextLength(editor: Editor): number {
  return editor.state.doc.textContent.length;
}

export function getEditorSelection(editor: Editor): EditorSelectionSnapshot | null {
  const entries = topLevelBlockEntries(editor);
  const selectionPosition = editor.state.selection.from;
  const selected =
    entries.find((entry) => {
      const end = entry.pos + entry.node.nodeSize;
      return selectionPosition >= entry.pos && selectionPosition <= end;
    }) ?? entries[0];

  if (selected === undefined) {
    return null;
  }

  return {
    ...toSnapshot(selected),
    canMoveUp: selected.index > 0,
    canMoveDown: selected.index < entries.length - 1,
  };
}

export function findTopLevelBlockById(editor: Editor, blockId: string): TopLevelBlockEntry | null {
  return topLevelBlockEntries(editor).find((entry) => entry.node.attrs.blockId === blockId) ?? null;
}
