"use client";

import {
  EDITOR_TRANSACTION_ORIGIN,
  canRedo,
  canUndo,
  createDocumentExtensions,
  deleteBlock,
  documentToEditorContent,
  duplicateBlock,
  editorContentToDocument,
  getEditorSelection,
  getEditorTextLength,
  insertBlockAfterSelection,
  listTopLevelBlocks,
  moveBlock,
  moveBlockToIndex,
  redo,
  selectBlock,
  setTextBlockType,
  toggleInlineMark,
  undo,
  updateBlockAttributes,
  type EditorBlockSnapshot,
  type EditorSelectionSnapshot,
  type InsertableBlockType,
} from "@wechat-layout/editor-core";
import type { DocumentV1 } from "@wechat-layout/document-schema";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronsUpDown,
  Copy,
  FileText,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  ListTree,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  RotateCcw,
  Strikethrough,
  Trash2,
  Underline,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

interface ArticleEditorProps {
  readonly document: DocumentV1;
  readonly editable: boolean;
  readonly onChange: (document: DocumentV1, transactionOrigin: string) => void;
  readonly onError: (message: string) => void;
}

const nodeLabels: Readonly<Record<string, string>> = {
  paragraph: "正文",
  heading: "标题",
  blockquote: "引用",
  bulletList: "无序列表",
  orderedList: "有序列表",
  imageBlock: "图片",
  divider: "分割线",
  semanticCard: "语义卡片",
  brandFooter: "品牌页脚",
  svgInteraction: "SVG 互动",
};

const insertBlocks: ReadonlyArray<{
  readonly type: InsertableBlockType;
  readonly label: string;
  readonly icon: typeof Pilcrow;
}> = [
  { type: "paragraph", label: "正文", icon: Pilcrow },
  { type: "heading1", label: "一级标题", icon: Heading1 },
  { type: "heading2", label: "二级标题", icon: Heading2 },
  { type: "heading3", label: "三级标题", icon: Heading3 },
  { type: "blockquote", label: "引用", icon: Quote },
  { type: "divider", label: "分割线", icon: Minus },
];

const alignmentOptions: ReadonlyArray<{
  readonly alignment: "left" | "center" | "right" | "justify";
  readonly icon: LucideIcon;
  readonly label: string;
}> = [
  { alignment: "left", icon: AlignLeft, label: "左对齐" },
  { alignment: "center", icon: AlignCenter, label: "居中" },
  { alignment: "right", icon: AlignRight, label: "右对齐" },
  { alignment: "justify", icon: AlignJustify, label: "两端对齐" },
];

function topLevelBlockElement(editor: Editor, target: EventTarget | null): HTMLElement | null {
  let element =
    target instanceof HTMLElement ? target.closest<HTMLElement>("[data-block-id]") : null;

  while (element !== null && element.parentElement !== editor.view.dom) {
    element = element.parentElement?.closest<HTMLElement>("[data-block-id]") ?? null;
  }

  return element;
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: {
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="grid size-8 place-items-center rounded-md text-muted transition hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 data-[active=true]:bg-accent-soft data-[active=true]:text-accent"
      data-active={active}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function EditorToolbar({
  editable,
  editor,
  selection,
}: {
  readonly editable: boolean;
  readonly editor: Editor;
  readonly selection: EditorSelectionSnapshot | null;
}) {
  const selectedType = selection?.type;
  const headingLevel = selectedType === "heading" ? selection?.attributes.level : undefined;
  const canChangeTextBlock = selectedType === "paragraph" || selectedType === "heading";
  const setTextBlock = (type: "paragraph" | "heading", level?: 1 | 2 | 3) => {
    if (selection !== null) {
      setTextBlockType(editor, selection.blockId, type, level);
    }
  };

  return (
    <div
      aria-label="编辑工具栏"
      className="flex min-h-11 flex-wrap items-center gap-0.5 border-b border-line bg-panel px-2.5 py-1.5"
      role="toolbar"
    >
      <ToolbarButton
        disabled={!editable || !canUndo(editor)}
        label="撤销（⌘Z）"
        onClick={() => undo(editor)}
      >
        <RotateCcw aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton
        disabled={!editable || !canRedo(editor)}
        label="重做（⇧⌘Z）"
        onClick={() => redo(editor)}
      >
        <Redo2 aria-hidden="true" size={15} />
      </ToolbarButton>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
      <ToolbarButton
        active={selectedType === "paragraph"}
        disabled={!editable || !canChangeTextBlock}
        label="正文"
        onClick={() => setTextBlock("paragraph")}
      >
        <Pilcrow aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton
        active={headingLevel === 1}
        disabled={!editable || !canChangeTextBlock}
        label="一级标题"
        onClick={() => setTextBlock("heading", 1)}
      >
        <Heading1 aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton
        active={headingLevel === 2}
        disabled={!editable || !canChangeTextBlock}
        label="二级标题"
        onClick={() => setTextBlock("heading", 2)}
      >
        <Heading2 aria-hidden="true" size={15} />
      </ToolbarButton>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
      <ToolbarButton
        active={editor.isActive("bold")}
        disabled={!editable}
        label="加粗（⌘B）"
        onClick={() => toggleInlineMark(editor, "bold")}
      >
        <Bold aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        disabled={!editable}
        label="斜体（⌘I）"
        onClick={() => toggleInlineMark(editor, "italic")}
      >
        <Italic aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        disabled={!editable}
        label="下划线（⌘U）"
        onClick={() => toggleInlineMark(editor, "underline")}
      >
        <Underline aria-hidden="true" size={15} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        disabled={!editable}
        label="删除线"
        onClick={() => toggleInlineMark(editor, "strike")}
      >
        <Strikethrough aria-hidden="true" size={15} />
      </ToolbarButton>
      <span className="ml-auto hidden text-[10px] text-faint sm:block">
        {getEditorTextLength(editor).toLocaleString("zh-CN")} 字
      </span>
    </div>
  );
}

function OutlineBlock({
  block,
  dragging,
  editable,
  selected,
  onDragEnd,
  onDragStart,
  onDrop,
  onSelect,
}: {
  readonly block: EditorBlockSnapshot;
  readonly dragging: boolean;
  readonly editable: boolean;
  readonly selected: boolean;
  readonly onDragEnd: () => void;
  readonly onDragStart: () => void;
  readonly onDrop: () => void;
  readonly onSelect: () => void;
}) {
  return (
    <button
      className="group flex w-full items-center gap-2 rounded-control border border-transparent px-2 py-2 text-left transition hover:bg-hover data-[dragging=true]:opacity-40 data-[selected=true]:border-accent/20 data-[selected=true]:bg-accent-soft"
      data-dragging={dragging}
      data-selected={selected}
      draggable={editable}
      onClick={onSelect}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={(event) => {
        if (!editable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", block.blockId);
        onDragStart();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      type="button"
    >
      <GripVertical
        aria-hidden="true"
        className="shrink-0 text-faint group-hover:text-muted"
        size={13}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium text-faint">
          {String(block.index + 1).padStart(2, "0")} · {nodeLabels[block.type] ?? block.type}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-ink">
          {block.textPreview || "空区块"}
        </span>
      </span>
    </button>
  );
}

export function ArticleEditor({ document, editable, onChange, onError }: ArticleEditorProps) {
  const extensions = useMemo(() => createDocumentExtensions(), []);
  const baseDocumentRef = useRef(document);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const externalDocumentRef = useRef(document);
  const [renderRevision, forceRender] = useReducer((value: number) => value + 1, 0);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [blockHandleTop, setBlockHandleTop] = useState<number | null>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);

  baseDocumentRef.current = document;
  onChangeRef.current = onChange;
  onErrorRef.current = onError;

  const editor = useEditor({
    content: documentToEditorContent(document),
    editable,
    enableContentCheck: true,
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "文章编辑画布",
        class: "wechat-article-editor",
        role: "textbox",
      },
    },
    onContentError: ({ error }) => {
      onErrorRef.current(error.message);
    },
    onSelectionUpdate: () => {
      forceRender();
    },
    onTransaction: () => {
      forceRender();
    },
    onUpdate: ({ editor: currentEditor, transaction }) => {
      try {
        const nextDocument = editorContentToDocument(
          baseDocumentRef.current,
          currentEditor.getJSON(),
        );
        const origin =
          (transaction.getMeta("transactionOrigin") as string | undefined) ??
          EDITOR_TRANSACTION_ORIGIN.input;
        onChangeRef.current(nextDocument, origin);
      } catch (error) {
        onErrorRef.current(error instanceof Error ? error.message : "编辑内容不符合文档格式");
      }
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
    if (!editable) {
      setDraggedBlockId(null);
      setDropTargetId(null);
    }
  }, [editable, editor]);

  useEffect(() => {
    if (editor === null || externalDocumentRef.current === document) {
      return;
    }

    externalDocumentRef.current = document;
    editor.commands.setContent(documentToEditorContent(document), {
      emitUpdate: false,
      errorOnInvalidContent: true,
    });
    forceRender();
  }, [document, editor]);

  const selection = editor === null ? null : getEditorSelection(editor);
  const blocks = editor === null ? [] : listTopLevelBlocks(editor);
  const selectedBlockId = selection?.blockId ?? null;

  useLayoutEffect(() => {
    const editorChildren = editor === null ? [] : [...editor.view.dom.children];
    if (editor === null || selectedBlockId === null || canvasShellRef.current === null) {
      setBlockHandleTop(null);
      return;
    }

    const block = editorChildren.find(
      (element) => element instanceof HTMLElement && element.dataset.blockId === selectedBlockId,
    );
    if (!(block instanceof HTMLElement)) {
      setBlockHandleTop(null);
      return;
    }

    const shellRect = canvasShellRef.current.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();
    setBlockHandleTop(Math.max(12, blockRect.top - shellRect.top + 2));
  }, [editor, renderRevision, selectedBlockId]);

  const runBlockCommand = useCallback(
    (command: (currentEditor: Editor, blockId: string) => boolean) => {
      if (editor !== null && selectedBlockId !== null) {
        command(editor, selectedBlockId);
      }
    },
    [editor, selectedBlockId],
  );

  const handleKeyboardShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !editable ||
      editor === null ||
      selectedBlockId === null ||
      (!event.metaKey && !event.ctrlKey)
    ) {
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateBlock(editor, selectedBlockId);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertBlockAfterSelection(editor, "paragraph");
    } else if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      moveBlock(editor, selectedBlockId, -1);
    } else if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      moveBlock(editor, selectedBlockId, 1);
    }
  };

  const handleCanvasDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (editor === null || draggedBlockId === null) {
      return;
    }
    const block = topLevelBlockElement(editor, event.target);
    if (block !== null) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetId(block.dataset.blockId ?? null);
    }
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    if (editor === null || draggedBlockId === null) {
      return;
    }
    event.preventDefault();
    const block = topLevelBlockElement(editor, event.target);
    const targetId = block?.dataset.blockId;
    const target = blocks.find((item) => item.blockId === targetId);
    if (target !== undefined) {
      moveBlockToIndex(editor, draggedBlockId, target.index);
    }
    setDraggedBlockId(null);
    setDropTargetId(null);
  };

  if (editor === null) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded-card border border-line bg-panel text-[12px] text-muted">
        正在加载编辑器…
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-card border border-line bg-panel shadow-subtle"
      data-editor-revision={renderRevision}
      onKeyDown={handleKeyboardShortcut}
    >
      <div className="grid min-h-[680px] xl:grid-cols-[220px_minmax(0,1fr)_248px]">
        <aside className="border-b border-line bg-panel-muted xl:border-r xl:border-b-0">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <ListTree aria-hidden="true" className="text-accent" size={15} />
              <p className="text-[12px] font-semibold text-ink">文章结构</p>
              <span className="ml-auto rounded-full bg-panel px-2 py-0.5 text-[9px] text-faint">
                {blocks.length}
              </span>
            </div>
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto p-2 xl:max-h-[390px]">
            {blocks.map((block) => (
              <OutlineBlock
                block={block}
                dragging={draggedBlockId === block.blockId}
                editable={editable}
                key={block.blockId}
                onDragEnd={() => {
                  setDraggedBlockId(null);
                  setDropTargetId(null);
                }}
                onDragStart={() => setDraggedBlockId(block.blockId)}
                onDrop={() => {
                  if (draggedBlockId !== null) {
                    moveBlockToIndex(editor, draggedBlockId, block.index);
                  }
                  setDraggedBlockId(null);
                  setDropTargetId(null);
                }}
                onSelect={() => selectBlock(editor, block.blockId)}
                selected={selectedBlockId === block.blockId}
              />
            ))}
          </div>
          <div className="border-t border-line p-3">
            <p className="mb-2 text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
              插入区块
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {insertBlocks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-control border border-line bg-panel text-[10px] text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-45"
                    disabled={!editable}
                    key={item.type}
                    onClick={() => insertBlockAfterSelection(editor, item.type)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={14} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0 bg-[#efefed]">
          <EditorToolbar editable={editable} editor={editor} selection={selection} />
          <div
            className="editor-canvas-scroll overflow-auto px-5 py-8 sm:px-8"
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropTargetId(null);
              }
            }}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            <div
              className="editor-canvas-shell relative mx-auto max-w-[677px] bg-white shadow-[0_4px_22px_rgb(24_24_27/8%)]"
              ref={canvasShellRef}
            >
              {selectedBlockId === null || blockHandleTop === null ? null : (
                <div
                  className="editor-block-handle"
                  contentEditable={false}
                  style={{ top: blockHandleTop }}
                >
                  <button
                    aria-label="拖动当前区块"
                    className="grid size-7 cursor-grab place-items-center rounded-md border border-line bg-panel text-faint shadow-subtle hover:text-ink active:cursor-grabbing"
                    disabled={!editable}
                    draggable={editable}
                    onDragEnd={() => {
                      setDraggedBlockId(null);
                      setDropTargetId(null);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", selectedBlockId);
                      setDraggedBlockId(selectedBlockId);
                    }}
                    title="拖动当前区块"
                    type="button"
                  >
                    <GripVertical aria-hidden="true" size={14} />
                  </button>
                </div>
              )}
              <EditorContent
                className={dropTargetId === null ? undefined : "is-block-dragging"}
                editor={editor}
              />
            </div>
          </div>
        </div>

        <aside className="border-t border-line bg-panel xl:border-t-0 xl:border-l">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[12px] font-semibold text-ink">区块属性</p>
            <p className="mt-0.5 text-[10px] text-faint">仅作用于当前选中区块</p>
          </div>
          {selection === null ? (
            <div className="px-4 py-10 text-center">
              <FileText aria-hidden="true" className="mx-auto text-faint" size={20} />
              <p className="mt-2 text-[11px] text-muted">选择一个区块查看属性</p>
            </div>
          ) : (
            <div className="space-y-5 p-4">
              <div>
                <p className="text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                  当前区块
                </p>
                <div className="mt-2 rounded-control border border-line bg-panel-muted p-3">
                  <p className="text-[12px] font-semibold text-ink">
                    {nodeLabels[selection.type] ?? selection.type}
                  </p>
                  <p className="mt-1 truncate font-mono text-[9px] text-faint">
                    {selection.blockId}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                  对齐
                </p>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {alignmentOptions.map(({ alignment, icon: Icon, label }) => (
                    <button
                      aria-label={label}
                      className="grid h-8 place-items-center rounded-md border border-line text-muted hover:bg-hover hover:text-ink disabled:opacity-40"
                      disabled={!editable}
                      key={alignment}
                      onClick={() => {
                        const current = selection.attributes.styleOverrides as
                          Record<string, unknown> | undefined;
                        updateBlockAttributes(editor, selection.blockId, {
                          styleOverrides: {
                            ...current,
                            textAlign: alignment,
                          },
                        });
                      }}
                      title={label}
                      type="button"
                    >
                      <Icon aria-hidden="true" size={14} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                  区块操作
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-line text-[10px] text-muted hover:bg-hover hover:text-ink disabled:opacity-40"
                    disabled={!editable || !selection.canMoveUp}
                    onClick={() => runBlockCommand((current, id) => moveBlock(current, id, -1))}
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" size={13} />
                    上移
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-line text-[10px] text-muted hover:bg-hover hover:text-ink disabled:opacity-40"
                    disabled={!editable || !selection.canMoveDown}
                    onClick={() => runBlockCommand((current, id) => moveBlock(current, id, 1))}
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" size={13} />
                    下移
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-line text-[10px] text-muted hover:bg-hover hover:text-ink disabled:opacity-40"
                    disabled={!editable}
                    onClick={() => runBlockCommand(duplicateBlock)}
                    type="button"
                  >
                    <Copy aria-hidden="true" size={13} />
                    复制
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-danger/15 text-[10px] text-danger hover:bg-danger-soft disabled:opacity-40"
                    disabled={!editable}
                    onClick={() => runBlockCommand(deleteBlock)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={13} />
                    删除
                  </button>
                </div>
              </div>

              <div className="rounded-control bg-panel-muted p-3 text-[10px] leading-5 text-faint">
                <p className="flex items-center gap-1.5 font-medium text-muted">
                  <ChevronsUpDown aria-hidden="true" size={12} />
                  快捷操作
                </p>
                <p className="mt-1">⌘ Enter 新增正文</p>
                <p>⇧ ⌘ D 复制区块</p>
                <p>⌥ ⌘ ↑ / ↓ 移动区块</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
