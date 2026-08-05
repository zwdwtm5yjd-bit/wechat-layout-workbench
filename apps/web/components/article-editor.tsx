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
  insertRegisteredComponentAfterSelection,
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
import { createOfficialComponentRegistry } from "@wechat-layout/component-registry";
import {
  collectDocumentEntries,
  createTextChangeReport,
  lockAllSourceBlocks,
  setDocumentBlockLocked,
  type DocumentV1,
  type SourceTextBaseline,
} from "@wechat-layout/document-schema";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Blocks,
  Bold,
  Check,
  ChevronsUpDown,
  Copy,
  FileText,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  ListTree,
  LockKeyhole,
  LockOpen,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  RotateCcw,
  Search,
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
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { themePreviewKey, type OfficialTheme } from "../lib/themes/client";
import { summarizeThemeCategories } from "../lib/themes/taxonomy";
import { COMPONENT_CATALOG_GROUPS, V0_COMPONENT_PREVIEWS } from "../lib/v0-catalog";

const officialComponentRegistry = createOfficialComponentRegistry();

interface ArticleEditorProps {
  readonly applyingThemeId?: string | null;
  readonly currentThemeId?: string | null;
  readonly document: DocumentV1;
  readonly editable: boolean;
  readonly lockActionsEnabled: boolean;
  readonly onApplyTheme?: (theme: OfficialTheme) => Promise<void>;
  readonly onChange: (document: DocumentV1, transactionOrigin: string) => void;
  readonly onError: (message: string) => void;
  readonly onLockChange: (document: DocumentV1, transactionOrigin: string) => Promise<boolean>;
  readonly sourceBlocks: readonly SourceTextBaseline[];
  readonly textLocked: boolean;
  readonly themes?: readonly OfficialTheme[];
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

const componentAttributeFields: Readonly<
  Record<
    string,
    readonly {
      readonly attribute: string;
      readonly label: string;
      readonly maxLength: number;
    }[]
  >
> = {
  blockquote: [{ attribute: "source", label: "引用来源", maxLength: 500 }],
  imageBlock: [
    { attribute: "alt", label: "图片替代文本", maxLength: 500 },
    { attribute: "caption", label: "图片图注", maxLength: 2_000 },
  ],
  semanticCard: [
    { attribute: "eyebrow", label: "语义标签", maxLength: 200 },
    { attribute: "title", label: "卡片标题", maxLength: 500 },
    { attribute: "footer", label: "卡片补充文字", maxLength: 1_000 },
  ],
};

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

export function ArticleEditor({
  applyingThemeId = null,
  currentThemeId = null,
  document,
  editable,
  lockActionsEnabled,
  onChange,
  onApplyTheme,
  onError,
  onLockChange,
  sourceBlocks,
  textLocked,
  themes = [],
}: ArticleEditorProps) {
  const baseDocumentRef = useRef(document);
  const sourceDocumentRef = useRef(document);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const externalDocumentRef = useRef(document);
  const blockedNoticeRef = useRef<(message: string) => void>(() => undefined);
  const [renderRevision, forceRender] = useReducer((value: number) => value + 1, 0);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [blockHandleTop, setBlockHandleTop] = useState<number | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [lockMutationPending, setLockMutationPending] = useState(false);
  const [unlockCandidate, setUnlockCandidate] = useState<string | null>(null);
  const [leftPanel, setLeftPanel] = useState<"components" | "structure" | "themes">("structure");
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [themeQuery, setThemeQuery] = useState("");
  const [componentQuery, setComponentQuery] = useState("");
  const [componentCategory, setComponentCategory] = useState<string>("全部");
  const visualTheme = themes.find(
    (theme) => theme.manifest.themeId === (previewThemeId ?? currentThemeId),
  );
  const visibleThemes = useMemo(() => {
    const normalized = themeQuery.trim().toLocaleLowerCase("zh-CN");
    return normalized === ""
      ? themes
      : themes.filter((theme) =>
          `${theme.manifest.name} ${theme.manifest.description} ${theme.manifest.categories.join(" ")}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalized),
        );
  }, [themeQuery, themes]);
  const visibleEditorComponents = useMemo(() => {
    const normalized = componentQuery.trim().toLocaleLowerCase("zh-CN");
    return V0_COMPONENT_PREVIEWS.filter((component) => {
      const searchText =
        `${component.name} ${component.category} ${component.description} ${(component.asset.manifest.scenarios ?? []).join(" ")}`.toLocaleLowerCase(
          "zh-CN",
        );
      return (
        (componentCategory === "全部" || component.category === componentCategory) &&
        (normalized === "" || searchText.includes(normalized))
      );
    });
  }, [componentCategory, componentQuery]);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const extensions = useMemo(
    () =>
      createDocumentExtensions({
        textLocked,
        onTextMutationBlocked: () => {
          blockedNoticeRef.current("原文已锁定。请先解锁当前区块，再修改文字。");
        },
      }),
    [textLocked],
  );

  baseDocumentRef.current = document;
  onChangeRef.current = onChange;
  onErrorRef.current = onError;
  blockedNoticeRef.current = setLockNotice;
  if (sourceDocumentRef.current.documentId !== document.documentId) {
    sourceDocumentRef.current = document;
  }

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
    editor?.setEditable(editable && !lockMutationPending);
    if (!editable || lockMutationPending) {
      setDraggedBlockId(null);
      setDropTargetId(null);
    }
  }, [editable, editor, lockMutationPending]);

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
  let currentDocument = document;
  if (editor !== null) {
    try {
      currentDocument = editorContentToDocument(
        baseDocumentRef.current,
        editor.getJSON(),
        new Date(baseDocumentRef.current.meta.updatedAt),
      );
    } catch {
      currentDocument = document;
    }
  }
  const textChangeReport = createTextChangeReport(
    sourceDocumentRef.current,
    currentDocument,
    sourceBlocks,
  );
  const hasUnlockedSourceBlocks = collectDocumentEntries(currentDocument.content).blocks.some(
    ({ node }) =>
      node.attrs.locked === false &&
      (typeof node.attrs.sourceBlockId === "string" ||
        typeof node.attrs.sourceTextHash === "string"),
  );

  const persistLockChange = async (nextDocument: DocumentV1) => {
    if (editor === null || lockMutationPending) {
      return;
    }

    setLockMutationPending(true);
    setLockNotice(null);
    try {
      const saved = await onLockChange(nextDocument, EDITOR_TRANSACTION_ORIGIN.lock);
      if (!saved) {
        return;
      }
      baseDocumentRef.current = nextDocument;
      externalDocumentRef.current = nextDocument;
      editor.commands.setContent(documentToEditorContent(nextDocument), {
        emitUpdate: false,
        errorOnInvalidContent: true,
      });
      if (selectedBlockId !== null) {
        selectBlock(editor, selectedBlockId);
      }
      forceRender();
    } finally {
      setLockMutationPending(false);
    }
  };

  const unlockBlock = async (blockId: string) => {
    const nextDocument = setDocumentBlockLocked(currentDocument, blockId, false);
    setUnlockCandidate(null);
    if (nextDocument !== null) {
      await persistLockChange(nextDocument);
    }
  };

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
      {textLocked ? (
        <div className="flex flex-col gap-2 border-b border-accent/15 bg-accent-soft px-4 py-2.5 text-[11px] sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2 font-medium text-accent">
            <LockKeyhole aria-hidden="true" size={13} />
            原文保护已开启
          </span>
          <span className="text-muted">可调整样式和移动区块；改字前需先解锁对应区块。</span>
          {hasUnlockedSourceBlocks ? (
            <button
              className="sm:ml-auto inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-accent/20 bg-panel px-2.5 text-[10px] font-medium text-accent hover:bg-hover disabled:opacity-45"
              disabled={!lockActionsEnabled || lockMutationPending}
              onClick={() => {
                void persistLockChange(lockAllSourceBlocks(currentDocument));
              }}
              type="button"
            >
              <LockKeyhole aria-hidden="true" size={11} />
              重新锁定全文
            </button>
          ) : null}
        </div>
      ) : null}
      {lockNotice === null ? null : (
        <div
          className="flex items-center justify-between gap-3 border-b border-warning/20 bg-warning-soft px-4 py-2 text-[11px] text-warning"
          role="status"
        >
          <span>{lockNotice}</span>
          <button
            className="font-medium underline underline-offset-2"
            onClick={() => setLockNotice(null)}
            type="button"
          >
            知道了
          </button>
        </div>
      )}
      <div className="grid min-h-[680px] xl:grid-cols-[250px_minmax(0,1fr)_280px]">
        <aside className="border-b border-line bg-panel-muted xl:border-r xl:border-b-0">
          <div className="grid grid-cols-3 gap-1 border-b border-line p-2">
            {(
              [
                ["structure", ListTree, "结构"],
                ["themes", Palette, "主题"],
                ["components", Blocks, "组件"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                aria-selected={leftPanel === value}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-control text-[10px] font-medium transition ${
                  leftPanel === value
                    ? "bg-panel text-accent shadow-subtle"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
                key={value}
                onClick={() => setLeftPanel(value)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" size={13} />
                {label}
              </button>
            ))}
          </div>
          {leftPanel === "structure" ? (
            <>
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
            </>
          ) : leftPanel === "themes" ? (
            <div className="space-y-3 p-3">
              <div className="rounded-control border border-accent/15 bg-accent-soft p-3">
                <p className="text-[10px] leading-5 text-muted">
                  试穿只改变当前画布；正式应用会先创建快照，再持久化主题版本，原文保持不变。
                </p>
              </div>
              <label className="relative block">
                <span className="sr-only">搜索主题</span>
                <Search
                  aria-hidden="true"
                  className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
                  size={12}
                />
                <input
                  className="h-8 w-full rounded-md border border-line bg-panel pr-2 pl-8 text-[10px] text-ink outline-none focus:border-accent"
                  onChange={(event) => setThemeQuery(event.target.value)}
                  placeholder="搜索通知、党建、中秋节…"
                  value={themeQuery}
                />
              </label>
              {themes.length === 0 ? (
                <p className="rounded-control border border-line bg-panel p-3 text-[10px] text-muted">
                  正在读取已安装主题…
                </p>
              ) : null}
              {visibleThemes.map((theme) => {
                const themeId = theme.manifest.themeId;
                const previewing = previewThemeId === themeId;
                const applied = currentThemeId === themeId;
                const applying = applyingThemeId === themeId;
                return (
                  <article
                    className={`w-full rounded-control border bg-panel p-3 text-left transition ${
                      previewing
                        ? "border-accent ring-2 ring-accent/10"
                        : "border-line hover:border-line-strong"
                    }`}
                    key={themeId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-ink">{theme.manifest.name}</p>
                        <p className="mt-1 text-[9px] text-faint">
                          {summarizeThemeCategories(theme.manifest.categories, true)} · v
                          {theme.manifest.version}
                        </p>
                      </div>
                      {applied ? (
                        <span className="grid size-5 place-items-center rounded-full bg-accent text-white">
                          <Check aria-hidden="true" size={11} />
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex gap-1">
                      {theme.preview.accentColors.map((color) => (
                        <span
                          className="h-2 flex-1 rounded-full"
                          key={color}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-[9px] leading-4 text-muted">
                      {theme.manifest.description}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      <button
                        aria-pressed={previewing}
                        className="h-7 rounded-md border border-line text-[9px] font-medium text-ink hover:bg-hover"
                        onClick={() =>
                          setPreviewThemeId((current) => (current === themeId ? null : themeId))
                        }
                        type="button"
                      >
                        {previewing ? "取消试穿" : "试穿"}
                      </button>
                      <button
                        className="h-7 rounded-md bg-accent text-[9px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={
                          !editable ||
                          applyingThemeId !== null ||
                          applied ||
                          onApplyTheme === undefined
                        }
                        onClick={() => {
                          void onApplyTheme?.(theme)
                            .then(() => setPreviewThemeId(null))
                            .catch(() => undefined);
                        }}
                        type="button"
                      >
                        {applying ? "应用中…" : applied ? "已应用" : "正式应用"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 p-3">
              <p className="px-1 text-[10px] leading-5 text-muted">
                点击后按正式 Manifest 插入；组件版本会随文章保存并用于微信安全渲染。
              </p>
              <label className="relative block">
                <span className="sr-only">搜索组件</span>
                <Search
                  aria-hidden="true"
                  className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
                  size={12}
                />
                <input
                  className="h-8 w-full rounded-md border border-line bg-panel pr-2 pl-8 text-[10px] text-ink outline-none focus:border-accent"
                  onChange={(event) => setComponentQuery(event.target.value)}
                  placeholder="搜索山水、SVG、图集或场景"
                  value={componentQuery}
                />
              </label>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {["全部", ...COMPONENT_CATALOG_GROUPS].map((item) => (
                  <button
                    className={`shrink-0 rounded-md px-2 py-1 text-[9px] ${componentCategory === item ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-hover"}`}
                    key={item}
                    onClick={() => setComponentCategory(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="px-1 text-[9px] text-faint">
                当前 {visibleEditorComponents.length} 个可插入组件
              </p>
              {visibleEditorComponents.map((component) => (
                <button
                  className="flex w-full items-center gap-3 rounded-control border border-line bg-panel p-3 text-left transition hover:border-line-strong hover:bg-hover disabled:opacity-45"
                  disabled={!editable}
                  key={component.id}
                  onClick={() => {
                    const result = insertRegisteredComponentAfterSelection(
                      editor,
                      officialComponentRegistry,
                      {
                        componentId: component.id,
                        slots: component.asset.defaultSlots,
                        version: component.version,
                      },
                    );
                    if (!result.success) {
                      onError(result.issues.map((issue) => issue.message).join("；"));
                    }
                  }}
                  type="button"
                >
                  {component.layoutKey === "visual" &&
                  component.asset.preview.sample.assetPath !== undefined ? (
                    <span
                      aria-hidden="true"
                      className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-white bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${component.asset.preview.sample.assetPath})`,
                      }}
                    >
                      <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-[7px] font-bold tracking-wide text-white uppercase">
                        {component.asset.preview.sample.assetKind}
                      </span>
                    </span>
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                      <Blocks aria-hidden="true" size={13} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold text-ink">
                      {component.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-faint">
                      {component.category} · {component.asset.manifest.nodeType}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div
          className="min-w-0 bg-[#efefed]"
          data-preview-theme={visualTheme === undefined ? "default" : themePreviewKey(visualTheme)}
          style={
            {
              "--preview-accent": visualTheme?.preview.accentColors[2] ?? "#4f46e5",
              "--preview-primary": visualTheme?.preview.accentColors[0] ?? "#18181b",
              "--preview-surface": visualTheme?.preview.accentColors[1] ?? "#f7f7f5",
            } as CSSProperties
          }
        >
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
              style={{
                backgroundColor: visualTheme?.preview.accentColors[1] ?? "#ffffff",
              }}
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
                  <p
                    className={
                      selection.locked
                        ? "mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-accent"
                        : "mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-success"
                    }
                  >
                    {selection.locked ? (
                      <LockKeyhole aria-hidden="true" size={11} />
                    ) : (
                      <LockOpen aria-hidden="true" size={11} />
                    )}
                    {selection.locked ? "原文区块已锁定" : "区块文字可编辑"}
                  </p>
                  {typeof selection.attributes.componentId === "string" ? (
                    <p className="mt-2 break-all font-mono text-[9px] leading-4 text-faint">
                      {selection.attributes.componentId}@
                      {String(selection.attributes.componentVersion ?? "unknown")}
                    </p>
                  ) : null}
                </div>
              </div>

              {typeof selection.attributes.componentId === "string" &&
              (componentAttributeFields[selection.type]?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                    组件文字槽
                  </p>
                  <div className="mt-2 space-y-2">
                    {componentAttributeFields[selection.type]?.map((field) => (
                      <label className="block" key={field.attribute}>
                        <span className="mb-1 block text-[9px] text-muted">{field.label}</span>
                        <input
                          aria-label={field.label}
                          className="h-9 w-full rounded-md border border-line bg-panel px-2.5 text-[10px] text-ink outline-none focus:border-accent disabled:opacity-45"
                          disabled={!editable || (textLocked && selection.locked)}
                          maxLength={field.maxLength}
                          onChange={(event) => {
                            updateBlockAttributes(editor, selection.blockId, {
                              [field.attribute]: event.currentTarget.value,
                            });
                          }}
                          value={String(selection.attributes[field.attribute] ?? "")}
                        />
                      </label>
                    ))}
                  </div>
                  {selection.type === "imageBlock" &&
                  String(selection.attributes.resourceId).startsWith("component_slot_") ? (
                    <p className="mt-2 text-[9px] leading-4 text-warning">
                      图片槽尚未选择资源；正式复制前需替换为文章资源。
                    </p>
                  ) : null}
                </div>
              ) : null}

              {textLocked && selection.locked ? (
                <div className="rounded-control border border-warning/20 bg-warning-soft p-3">
                  {unlockCandidate === selection.blockId ? (
                    <>
                      <p className="text-[10px] leading-5 text-warning">
                        解锁后，后续文字修改会进入差异报告。当前版本会先保存，再开放输入。
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          className="h-8 flex-1 rounded-md bg-warning px-2 text-[10px] font-medium text-white disabled:opacity-45"
                          disabled={!lockActionsEnabled || lockMutationPending}
                          onClick={() => {
                            void unlockBlock(selection.blockId);
                          }}
                          type="button"
                        >
                          确认解锁
                        </button>
                        <button
                          className="h-8 rounded-md border border-line bg-panel px-2 text-[10px] text-muted"
                          onClick={() => setUnlockCandidate(null)}
                          type="button"
                        >
                          取消
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-warning/25 bg-panel text-[10px] font-medium text-warning hover:bg-hover disabled:opacity-45"
                      disabled={!lockActionsEnabled || lockMutationPending}
                      onClick={() => setUnlockCandidate(selection.blockId)}
                      type="button"
                    >
                      <LockOpen aria-hidden="true" size={12} />
                      解锁当前区块
                    </button>
                  )}
                </div>
              ) : null}

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
                  段间距
                </p>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {[
                    { label: "紧凑", value: 12 },
                    { label: "标准", value: 20 },
                    { label: "宽松", value: 32 },
                  ].map((spacing) => (
                    <button
                      aria-label={`${spacing.label}段间距`}
                      className="h-8 rounded-md border border-line text-[10px] text-muted hover:bg-hover hover:text-ink disabled:opacity-40"
                      disabled={!editable}
                      key={spacing.value}
                      onClick={() => {
                        const current = selection.attributes.styleOverrides as
                          Record<string, unknown> | undefined;
                        updateBlockAttributes(editor, selection.blockId, {
                          styleOverrides: {
                            ...current,
                            marginBottom: spacing.value,
                          },
                        });
                      }}
                      type="button"
                    >
                      {spacing.label}
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
          <div className="border-t border-line p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                原文变化检测
              </p>
              <span
                className={
                  textChangeReport.changedCharacters === 0
                    ? "text-[10px] font-medium text-success"
                    : "text-[10px] font-medium text-warning"
                }
              >
                {textChangeReport.changedCharacters === 0 ? "文字一致" : "存在变化"}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
              <div className="flex justify-between gap-2">
                <dt className="text-faint">原文字数</dt>
                <dd className="font-mono text-muted">{textChangeReport.originalCharacters}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-faint">当前字数</dt>
                <dd className="font-mono text-muted">{textChangeReport.currentCharacters}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-faint">新增</dt>
                <dd className="font-mono text-muted">+{textChangeReport.addedCharacters}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-faint">删除</dt>
                <dd className="font-mono text-muted">-{textChangeReport.deletedCharacters}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-faint">修改</dt>
                <dd className="font-mono text-muted">{textChangeReport.modifiedCharacters}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-faint">样式区块</dt>
                <dd className="font-mono text-muted">{textChangeReport.styleChangedBlocks}</dd>
              </div>
              <div className="col-span-2 flex justify-between gap-2">
                <dt className="text-faint">新增设计组件</dt>
                <dd className="font-mono text-muted">{textChangeReport.addedDesignBlocks}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
