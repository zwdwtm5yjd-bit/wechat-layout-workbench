import type { Editor, JSONContent } from "@tiptap/core";
import {
  type ComponentInsertionResult,
  type ComponentRegistry,
  type ComponentSlotValue,
} from "@wechat-layout/component-registry";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

import { createBlockId } from "./extensions.js";
import {
  findTopLevelBlockById,
  getEditorSelection,
  topLevelBlockEntries,
} from "./selection-adapter.js";

export const EDITOR_TRANSACTION_ORIGIN = {
  delete: "editor.block.delete",
  duplicate: "editor.block.duplicate",
  format: "editor.format",
  insert: "editor.block.insert",
  input: "editor.input",
  lock: "editor.lock",
  move: "editor.block.move",
} as const;

export type InsertableBlockType =
  "paragraph" | "heading1" | "heading2" | "heading3" | "blockquote" | "divider";

export type InlineMarkName = "bold" | "italic" | "underline" | "strike";

export interface InsertRegisteredComponentInput {
  readonly componentId: string;
  readonly slots?: Readonly<Record<string, ComponentSlotValue>>;
  readonly variantId?: string;
  readonly version?: string;
}

export function canUndo(editor: Editor): boolean {
  return editor.can().undo();
}

export function canRedo(editor: Editor): boolean {
  return editor.can().redo();
}

export function undo(editor: Editor): boolean {
  return editor.chain().focus().undo().run();
}

export function redo(editor: Editor): boolean {
  return editor.chain().focus().redo().run();
}

export function toggleInlineMark(editor: Editor, mark: InlineMarkName): boolean {
  return editor
    .chain()
    .focus()
    .setMeta("transactionOrigin", EDITOR_TRANSACTION_ORIGIN.format)
    .toggleMark(mark)
    .run();
}

function withFreshBlockIds(value: JSONContent): JSONContent {
  const clone = structuredClone(value);

  const visit = (node: JSONContent) => {
    if (node.attrs !== undefined && "blockId" in node.attrs) {
      node.attrs.blockId = createBlockId();
    }
    node.content?.forEach(visit);
  };
  visit(clone);
  return clone;
}

function blockJson(type: InsertableBlockType): JSONContent {
  if (type === "paragraph") {
    return {
      type: "paragraph",
      attrs: { blockId: createBlockId(), locked: false },
    };
  }

  if (type.startsWith("heading")) {
    return {
      type: "heading",
      attrs: {
        blockId: createBlockId(),
        locked: false,
        level: Number(type.at(-1)),
      },
    };
  }

  if (type === "blockquote") {
    return {
      type: "blockquote",
      attrs: {
        blockId: createBlockId(),
        locked: false,
        quoteType: "standard",
      },
      content: [
        {
          type: "paragraph",
          attrs: { blockId: createBlockId(), locked: false },
        },
      ],
    };
  }

  return {
    type: "divider",
    attrs: {
      blockId: createBlockId(),
      locked: false,
      variant: "solid",
      widthPercent: 100,
      align: "center",
    },
  };
}

function nodeSelectionAt(transaction: ReturnType<Editor["state"]["tr"]["setMeta"]>, pos: number) {
  const node = transaction.doc.nodeAt(pos);
  if (node?.isTextblock === true) {
    return TextSelection.near(transaction.doc.resolve(pos + 1));
  }
  return NodeSelection.create(transaction.doc, pos);
}

function compatibilityLevel(
  value: "compatible" | "conditional" | "risky" | "safe",
): "conditional" | "safe" | "static" {
  if (value === "conditional") {
    return "conditional";
  }
  return value === "risky" ? "static" : "safe";
}

function textContent(value: string | number): JSONContent[] | undefined {
  const text = String(value);
  return text.length === 0 ? undefined : [{ type: "text", text }];
}

function componentBlockJson(
  descriptor: Extract<ComponentInsertionResult, { readonly success: true }>["descriptor"],
): JSONContent {
  const attributes: Record<string, unknown> = {
    blockId: createBlockId(),
    compatibilityLevel: compatibilityLevel(descriptor.compatibilityLevel),
    componentId: descriptor.componentId,
    componentVersion: descriptor.version,
    locked: false,
    variant: descriptor.variantId,
  };
  const content: JSONContent[] = [];

  descriptor.manifest.slots.forEach((slot) => {
    const value = descriptor.slots[slot.slotId];
    if (value === undefined) {
      return;
    }
    if (slot.editorBinding !== "content") {
      if (typeof value === "string" || typeof value === "number") {
        attributes[slot.editorBinding] = String(value);
      }
      return;
    }
    if (typeof value === "object") {
      content.push({
        type: "imageBlock",
        attrs: {
          alt: value.alt ?? null,
          blockId: createBlockId(),
          caption: value.caption ?? null,
          compatibilityLevel: compatibilityLevel(descriptor.compatibilityLevel),
          locked: slot.textLocked,
          resourceId: value.resourceId,
          semanticRole: slot.slotId,
        },
      });
      return;
    }
    const paragraphContent = textContent(value);
    content.push({
      type: "paragraph",
      attrs: {
        blockId: createBlockId(),
        compatibilityLevel: compatibilityLevel(descriptor.compatibilityLevel),
        locked: slot.textLocked,
        semanticRole: slot.slotId,
      },
      ...(paragraphContent === undefined ? {} : { content: paragraphContent }),
    });
  });

  return {
    type: "semanticCard",
    attrs: attributes,
    ...(content.length === 0 ? {} : { content }),
  };
}

export function selectBlock(editor: Editor, blockId: string): boolean {
  const entry = findTopLevelBlockById(editor, blockId);
  if (entry === null) {
    return false;
  }

  const transaction = editor.state.tr
    .setSelection(nodeSelectionAt(editor.state.tr, entry.pos))
    .scrollIntoView();
  editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

export function insertBlockAfterSelection(editor: Editor, type: InsertableBlockType): boolean {
  const entries = topLevelBlockEntries(editor);
  const selection = getEditorSelection(editor);
  const selectedEntry =
    selection === null ? entries.at(-1) : entries.find((entry) => entry.index === selection.index);
  const insertionPos =
    selectedEntry === undefined ? 0 : selectedEntry.pos + selectedEntry.node.nodeSize;
  const node = editor.schema.nodeFromJSON(blockJson(type));
  const transaction = editor.state.tr
    .insert(insertionPos, node)
    .setMeta("transactionOrigin", EDITOR_TRANSACTION_ORIGIN.insert);
  closeHistory(transaction);
  transaction.setSelection(nodeSelectionAt(transaction, insertionPos));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
  return true;
}

export function insertRegisteredComponentAfterSelection(
  editor: Editor,
  registry: ComponentRegistry,
  input: InsertRegisteredComponentInput,
): ComponentInsertionResult {
  const result = registry.prepareInsertion(input);
  if (!result.success) {
    return result;
  }

  const entries = topLevelBlockEntries(editor);
  const selection = getEditorSelection(editor);
  const selectedEntry =
    selection === null ? entries.at(-1) : entries.find((entry) => entry.index === selection.index);
  const insertionPos =
    selectedEntry === undefined ? 0 : selectedEntry.pos + selectedEntry.node.nodeSize;
  const node = editor.schema.nodeFromJSON(componentBlockJson(result.descriptor));
  const transaction = editor.state.tr
    .insert(insertionPos, node)
    .setMeta("transactionOrigin", EDITOR_TRANSACTION_ORIGIN.insert);
  closeHistory(transaction);
  transaction.setSelection(nodeSelectionAt(transaction, insertionPos));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
  return result;
}

export function duplicateBlock(editor: Editor, blockId?: string): boolean {
  const selected = blockId === undefined ? getEditorSelection(editor) : null;
  const entry =
    blockId === undefined
      ? topLevelBlockEntries(editor).find((candidate) => candidate.index === selected?.index)
      : findTopLevelBlockById(editor, blockId);

  if (entry === null || entry === undefined) {
    return false;
  }

  const clonedNode = editor.schema.nodeFromJSON(
    withFreshBlockIds(entry.node.toJSON() as JSONContent),
  );
  const insertionPos = entry.pos + entry.node.nodeSize;
  const transaction = editor.state.tr
    .insert(insertionPos, clonedNode)
    .setMeta("transactionOrigin", EDITOR_TRANSACTION_ORIGIN.duplicate);
  closeHistory(transaction);
  transaction.setSelection(nodeSelectionAt(transaction, insertionPos));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
  return true;
}

export function deleteBlock(editor: Editor, blockId?: string): boolean {
  const selected = blockId === undefined ? getEditorSelection(editor) : null;
  const entries = topLevelBlockEntries(editor);
  const entry =
    blockId === undefined
      ? entries.find((candidate) => candidate.index === selected?.index)
      : findTopLevelBlockById(editor, blockId);

  if (entry === null || entry === undefined) {
    return false;
  }

  const transaction = editor.state.tr.setMeta(
    "transactionOrigin",
    EDITOR_TRANSACTION_ORIGIN.delete,
  );
  closeHistory(transaction);

  if (entries.length === 1) {
    const paragraph = editor.schema.node("paragraph", {
      blockId: createBlockId(),
      locked: false,
    });
    transaction.replaceWith(0, editor.state.doc.content.size, paragraph);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(1)));
  } else {
    transaction.delete(entry.pos, entry.pos + entry.node.nodeSize);
    const nextPos =
      entry.index >= entries.length - 1
        ? Math.max(0, entry.pos - entries[entry.index - 1]!.node.nodeSize)
        : entry.pos;
    transaction.setSelection(nodeSelectionAt(transaction, nextPos));
  }

  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
  return true;
}

function replaceTopLevelBlocks(
  editor: Editor,
  nodes: readonly ProseMirrorNode[],
  selectedIndex: number,
): boolean {
  const transaction = editor.state.tr
    .replaceWith(0, editor.state.doc.content.size, Fragment.fromArray([...nodes]))
    .setMeta("transactionOrigin", EDITOR_TRANSACTION_ORIGIN.move);
  closeHistory(transaction);
  const selectedPos = nodes
    .slice(0, selectedIndex)
    .reduce((position, node) => position + node.nodeSize, 0);
  transaction.setSelection(nodeSelectionAt(transaction, selectedPos));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
  return true;
}

export function moveBlockToIndex(editor: Editor, blockId: string, targetIndex: number): boolean {
  const entries = topLevelBlockEntries(editor);
  const sourceIndex = entries.findIndex((entry) => entry.node.attrs.blockId === blockId);
  if (sourceIndex < 0 || entries.length < 2) {
    return false;
  }

  const boundedIndex = Math.max(0, Math.min(entries.length - 1, targetIndex));
  if (boundedIndex === sourceIndex) {
    return false;
  }

  const nodes = entries.map((entry) => entry.node);
  const [moved] = nodes.splice(sourceIndex, 1);
  if (moved === undefined) {
    return false;
  }
  nodes.splice(boundedIndex, 0, moved);
  return replaceTopLevelBlocks(editor, nodes, boundedIndex);
}

export function moveBlock(editor: Editor, blockId: string, direction: -1 | 1): boolean {
  const entry = findTopLevelBlockById(editor, blockId);
  return entry === null ? false : moveBlockToIndex(editor, blockId, entry.index + direction);
}

export function setTextBlockType(
  editor: Editor,
  blockId: string,
  type: "paragraph" | "heading",
  level?: 1 | 2 | 3,
): boolean {
  const entry = findTopLevelBlockById(editor, blockId);
  const nodeType = editor.schema.nodes[type];
  if (
    entry === null ||
    nodeType === undefined ||
    (entry.node.type.name !== "paragraph" && entry.node.type.name !== "heading")
  ) {
    return false;
  }

  const transaction = editor.state.tr
    .setNodeMarkup(entry.pos, nodeType, {
      ...entry.node.attrs,
      ...(type === "heading" ? { level: level ?? 1 } : {}),
    })
    .setMeta("transactionOrigin", EDITOR_TRANSACTION_ORIGIN.format);
  closeHistory(transaction);
  editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

export function updateBlockAttributes(
  editor: Editor,
  blockId: string,
  attributes: Readonly<Record<string, unknown>>,
): boolean {
  const entry = findTopLevelBlockById(editor, blockId);
  if (entry === null) {
    return false;
  }

  const transaction = editor.state.tr
    .setNodeMarkup(entry.pos, undefined, {
      ...entry.node.attrs,
      ...attributes,
    })
    .setMeta("transactionOrigin", EDITOR_TRANSACTION_ORIGIN.format);
  closeHistory(transaction);
  editor.view.dispatch(transaction);
  return true;
}
