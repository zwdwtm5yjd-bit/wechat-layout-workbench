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
  insertVisualAssetAfterSelection,
  listTopLevelBlocks,
  moveBlock,
  moveBlockToIndex,
  redo,
  selectBlock,
  setInlineMarkAttributes,
  setTextBlockType,
  toggleInlineMark,
  undo,
  updateBlockAttributes,
  type EditorBlockSnapshot,
  type EditorSelectionSnapshot,
  type InsertableBlockType,
} from "@wechat-layout/editor-core";
import {
  OFFICIAL_VISUAL_ASSETS,
  VISUAL_ASSET_FUNCTION_LABELS,
  VISUAL_ASSET_STYLE_LABELS,
  createOfficialComponentRegistry,
  type OfficialVisualAsset,
  type VisualAssetStyle,
  type VisualAssetMotion,
} from "@wechat-layout/component-registry";
import {
  collectDocumentEntries,
  createTextChangeReport,
  lockAllSourceBlocks,
  setDocumentBlockLocked,
  type DocumentV1,
  type SourceTextBaseline,
} from "@wechat-layout/document-schema";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Eye,
  FileText,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  ListTree,
  LoaderCircle,
  LockKeyhole,
  LockOpen,
  MapPin,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Strikethrough,
  Trash2,
  Underline,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
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
import {
  EDITOR_COMPONENT_SCENES,
  EDITOR_COMPONENT_SECTIONS,
  EDITOR_COMPONENT_SECTION_DETAILS,
  V0_COMPONENT_PREVIEWS,
  componentMatchesEditorScene,
  editorComponentSection,
  isPopularEditorComponent,
  type ComponentCatalogGroup,
  type ComponentPreview,
  type EditorComponentScene,
  type EditorComponentSection,
} from "../lib/v0-catalog";
import {
  createResourceAccessUrl,
  listResources,
  uploadResource,
  type Resource,
} from "../lib/resources/client";
import {
  VISUAL_ASSET_TASK_GROUPS,
  visualAssetMatchesTaskGroup,
  visualAssetTaskGroupFunctions,
  type VisualAssetTaskGroupId,
} from "../lib/visual-asset-navigation";
import { useVisualAssetPreferences } from "../lib/visual-assets/use-preferences";
import { VisualAssetPreviewDialog } from "./visual-asset-preview-dialog";

const officialComponentRegistry = createOfficialComponentRegistry();

const EDITOR_LEFT_PANELS = [
  ["structure", ListTree, "结构"],
  ["themes", Palette, "主题"],
  ["components", Blocks, "排版模块"],
  ["assets", Sparkles, "图片装饰"],
] as const;

function resourceLabel(resource: Resource): string {
  return resource.displayName ?? resource.originalFilename ?? "未命名素材";
}

const EDITOR_ASSET_FUNCTIONS = [
  { id: "all", label: "全部" },
  { id: "background", label: "背景" },
  { id: "hero", label: "主视觉" },
  { id: "heading", label: "标题" },
  { id: "divider", label: "分隔" },
  { id: "frame", label: "边框" },
  { id: "corner", label: "边角" },
  { id: "badge", label: "标签" },
  { id: "ribbon", label: "横幅" },
  { id: "gallery", label: "图集" },
  { id: "sticker", label: "贴纸" },
] as const;

const STATIC_ASSET_COUNT = OFFICIAL_VISUAL_ASSETS.filter(
  (asset) => asset.motion === "static",
).length;
const DYNAMIC_ASSET_COUNT = OFFICIAL_VISUAL_ASSETS.filter(
  (asset) => asset.motion === "dynamic",
).length;
type AssetCollectionFilter = "all" | "favorite" | "recent";

function visualAssetSerial(asset: OfficialVisualAsset): number {
  return Number.parseInt(asset.id.match(/(\d+)$/u)?.[1] ?? "0", 10);
}

function isNewVisualAsset(asset: OfficialVisualAsset): boolean {
  return visualAssetSerial(asset) > (asset.motion === "static" ? 130 : 50);
}

function usesCompactVisualPreview(asset: OfficialVisualAsset): boolean {
  return asset.function === "sticker" || asset.function === "corner" || asset.function === "badge";
}

function editorComponentVariant(component: ComponentPreview): string {
  const tokenVariant = component.asset.manifest.defaultTokenMap.variant;
  if (typeof tokenVariant === "string") return tokenVariant;
  const attributes = component.asset.manifest.insertionPreset.attributes;
  return "variant" in attributes && typeof attributes.variant === "string"
    ? attributes.variant
    : component.asset.manifest.defaultVariantId;
}

function EditorComponentThumbnail({ component }: { readonly component: ComponentPreview }) {
  const { layoutKey, sample } = component.asset.preview;
  const variant = editorComponentVariant(component);
  if (layoutKey === "visual" && sample.assetPath !== undefined) {
    return (
      <span className="relative block h-24 overflow-hidden bg-[#fbf8f1]" aria-hidden="true">
        <img alt="" className="h-full w-full object-cover" loading="lazy" src={sample.assetPath} />
        <span className="absolute inset-x-2 bottom-2 rounded bg-white/85 px-2 py-1.5 shadow-sm backdrop-blur">
          <span className="block truncate text-[8px] font-semibold text-zinc-800">
            {sample.title ?? "原创视觉模块"}
          </span>
        </span>
        <span className="absolute top-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[7px] font-semibold text-white uppercase">
          {sample.assetKind}
        </span>
      </span>
    );
  }

  if (layoutKey === "heading") {
    const title = sample.title ?? "清晰的小节标题";
    let heading: ReactNode = (
      <span className="block border-l-[3px] border-indigo-500 py-1 pl-2 text-[10px] font-semibold leading-4 text-zinc-800">
        {title}
      </span>
    );
    if (variant === "ribbon") {
      heading = (
        <span className="block rounded bg-indigo-600 px-3 py-2 text-center text-[10px] font-semibold text-white shadow-sm">
          {title}
        </span>
      );
    } else if (variant === "framed") {
      heading = (
        <span className="block rounded border border-amber-400 px-3 py-2 text-center text-[10px] font-semibold text-zinc-800">
          {title}
        </span>
      );
    } else if (variant === "pill") {
      heading = (
        <span className="inline-block rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-semibold text-indigo-700">
          {title}
        </span>
      );
    } else if (variant === "marker") {
      heading = (
        <span className="block border-b-2 border-indigo-400 pb-1.5 text-[10px] font-semibold text-zinc-800">
          {title}
        </span>
      );
    } else if (variant === "underlined") {
      heading = (
        <span className="block text-[10px] font-semibold text-zinc-800">
          {title}
          <span className="mt-1.5 block h-px w-10 bg-indigo-400" />
        </span>
      );
    } else if (variant === "centered") {
      heading = (
        <span className="block text-center text-[10px] font-semibold tracking-wide text-zinc-800">
          {title}
        </span>
      );
    } else if (variant === "dot") {
      heading = (
        <span className="flex items-start gap-2 text-[10px] font-semibold text-zinc-800">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-500" />
          <span>{title}</span>
        </span>
      );
    } else if (variant === "numbered") {
      heading = (
        <span className="flex items-start gap-2">
          <span className="border-b-2 border-indigo-500 text-[9px] font-bold text-indigo-600">
            01
          </span>
          <span className="text-[10px] font-semibold text-zinc-800">{title}</span>
        </span>
      );
    }
    return (
      <span className="flex h-24 items-center bg-[#fbfaf8] px-3" aria-hidden="true">
        <span className="w-full">{heading}</span>
      </span>
    );
  }

  if (layoutKey === "quote" || layoutKey === "notice") {
    const body = sample.body ?? sample.title ?? "这里放置需要强调的重点信息";
    const quotation = variant === "quotation" || variant === "postcard";
    const toneClass =
      variant === "risk"
        ? "border-2 border-red-300 bg-red-50 text-red-950"
        : variant === "checklist" || variant === "success"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
          : variant === "warning" || variant === "story" || variant === "postcard"
            ? "border border-amber-200 bg-amber-50 text-amber-950"
            : layoutKey === "quote"
              ? "border-l-[3px] border-amber-400 bg-amber-50 text-amber-950"
              : "border border-indigo-100 bg-indigo-50 text-indigo-950";
    return (
      <span className="flex h-24 items-center bg-[#fbfaf8] p-2.5" aria-hidden="true">
        <span
          className={`relative line-clamp-3 w-full rounded px-2.5 py-2 text-[8px] leading-3.5 ${toneClass}`}
        >
          {quotation ? (
            <span className="absolute top-0.5 left-1.5 text-xl leading-none text-amber-300">“</span>
          ) : null}
          <span className={quotation ? "block px-2 text-center" : undefined}>{body}</span>
        </span>
      </span>
    );
  }

  if (layoutKey === "data") {
    const value = sample.value ?? "96";
    const unit = sample.unit ?? "";
    if (variant === "double_compare") {
      return (
        <span
          className="grid h-24 grid-cols-2 items-center divide-x divide-zinc-200 bg-zinc-50 text-center"
          aria-hidden="true"
        >
          {[
            ["主指标", value],
            ["对比值", "82"],
          ].map(([label, item]) => (
            <span key={label}>
              <span className="block text-[7px] text-zinc-500">{label}</span>
              <span className="mt-1 block text-lg font-bold text-indigo-600">{item}</span>
            </span>
          ))}
        </span>
      );
    }
    return (
      <span
        className="flex h-24 items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-amber-50"
        aria-hidden="true"
      >
        <span
          className={
            variant === "badge_metric"
              ? "rounded-full border border-indigo-200 bg-white px-5 py-2 text-center"
              : "w-4/5 border-t-2 border-indigo-500 bg-white/70 px-3 py-2 text-center"
          }
        >
          <span className="block text-lg font-bold tracking-tight text-indigo-600">
            {value}
            <span className="text-[8px]">{unit}</span>
          </span>
          <span className="mt-0.5 block text-[7px] text-zinc-500">
            {sample.title ?? "核心数据"}
          </span>
          {variant === "progress" ? (
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-zinc-200">
              <span className="block h-full w-3/4 bg-indigo-500" />
            </span>
          ) : null}
        </span>
      </span>
    );
  }

  if (layoutKey === "image") {
    const frameClass =
      variant === "polaroid"
        ? "rotate-[-2deg] border-[5px] border-white shadow-md"
        : variant === "documentary"
          ? "border-2 border-zinc-500"
          : variant === "rounded_caption"
            ? "rounded-lg border border-zinc-200"
            : "border border-zinc-200";
    return (
      <span
        className="flex h-24 flex-col items-center justify-center bg-[#f4f1eb] p-2.5"
        aria-hidden="true"
      >
        <span
          className={`h-14 w-20 bg-gradient-to-br from-sky-200 via-emerald-100 to-amber-200 ${frameClass}`}
        />
        <span className="mt-1 block max-w-full truncate text-[7px] text-zinc-500">
          {sample.caption ?? "图片说明"}
        </span>
      </span>
    );
  }

  if (layoutKey === "divider") {
    const dashed = variant === "dashed";
    const ornament = variant === "ornament";
    return (
      <span className="flex h-24 items-center gap-2 bg-[#fbfaf8] px-4" aria-hidden="true">
        <span
          className={`h-px flex-1 ${dashed ? "border-t border-dashed border-zinc-400" : "bg-zinc-300"}`}
        />
        {ornament ? <span className="text-[9px] text-indigo-500">◆</span> : null}
        {ornament ? <span className="h-px flex-1 bg-zinc-300" /> : null}
      </span>
    );
  }

  return (
    <span
      className="flex h-24 flex-col items-center justify-center bg-[#fbfaf8] text-zinc-500"
      aria-hidden="true"
    >
      <Blocks size={16} />
      <span className="mt-1 text-[8px]">完整组件</span>
    </span>
  );
}

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
  decorativeContainer: "文字装饰容器",
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

const fontFamilyOptions = [
  {
    label: "系统默认",
    value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  { label: "苹方 / 微软雅黑", value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: "宋体", value: '"Songti SC", "SimSun", serif' },
  { label: "楷体", value: '"Kaiti SC", "KaiTi", serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
] as const;

const fontSizeOptions = [12, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 36, 40, 48] as const;

function applyTextStyle(
  editor: Editor,
  selection: EditorSelectionSnapshot | null,
  style: "textColor" | "fontSize" | "fontFamily",
  value: string | number,
): boolean {
  if (!editor.state.selection.empty) {
    return setInlineMarkAttributes(
      editor,
      style,
      style === "textColor"
        ? { color: value }
        : style === "fontSize"
          ? { size: value }
          : { family: value },
    );
  }
  if (selection === null) return false;
  const overrides = selection.attributes.styleOverrides as Record<string, unknown> | undefined;
  return updateBlockAttributes(editor, selection.blockId, {
    styleOverrides: {
      ...overrides,
      [style]: value,
    },
  });
}

function currentTextStyle(
  editor: Editor,
  selection: EditorSelectionSnapshot | null,
  style: "textColor" | "fontSize" | "fontFamily",
  fallback: string | number,
): string | number {
  const markAttributes = editor.getAttributes(style) as Record<string, unknown>;
  const markValue =
    style === "textColor"
      ? markAttributes.color
      : style === "fontSize"
        ? markAttributes.size
        : markAttributes.family;
  if (typeof markValue === "string" || typeof markValue === "number") return markValue;
  const overrides = selection?.attributes.styleOverrides as Record<string, unknown> | undefined;
  const blockValue = overrides?.[style];
  return typeof blockValue === "string" || typeof blockValue === "number" ? blockValue : fallback;
}

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
  const canFormatText = editor.state.selection.$from.parent.isTextblock;
  const activeFontFamily = String(
    currentTextStyle(editor, selection, "fontFamily", fontFamilyOptions[0].value),
  );
  const activeFontSize = Number(currentTextStyle(editor, selection, "fontSize", 16));
  const activeTextColor = String(currentTextStyle(editor, selection, "textColor", "#18181b"));
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
      <select
        aria-label="字体"
        className="h-8 max-w-32 rounded-md border border-line bg-panel px-2 text-[10px] text-ink outline-none focus:border-accent disabled:opacity-35"
        disabled={!editable || !canFormatText}
        onChange={(event) =>
          applyTextStyle(editor, selection, "fontFamily", event.currentTarget.value)
        }
        title="字体"
        value={activeFontFamily}
      >
        {fontFamilyOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        aria-label="字号"
        className="h-8 w-[66px] rounded-md border border-line bg-panel px-2 text-[10px] text-ink outline-none focus:border-accent disabled:opacity-35"
        disabled={!editable || !canFormatText}
        onChange={(event) =>
          applyTextStyle(editor, selection, "fontSize", Number(event.currentTarget.value))
        }
        title="字号"
        value={activeFontSize}
      >
        {fontSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>
      <label
        aria-label="文字颜色"
        className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-hover"
        title="文字颜色"
      >
        <Palette aria-hidden="true" size={15} />
        <span
          aria-hidden="true"
          className="mt-[-3px] h-0.5 w-4 rounded-full"
          style={{ backgroundColor: activeTextColor }}
        />
        <input
          aria-label="选择文字颜色"
          className="sr-only"
          disabled={!editable || !canFormatText}
          onChange={(event) =>
            applyTextStyle(editor, selection, "textColor", event.currentTarget.value)
          }
          type="color"
          value={/^#[0-9a-f]{6}$/iu.test(activeTextColor) ? activeTextColor : "#18181b"}
        />
      </label>
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
  const [leftPanel, setLeftPanel] = useState<"assets" | "components" | "structure" | "themes">(
    "structure",
  );
  const [mobileEditorPanel, setMobileEditorPanel] = useState<"properties" | "tools" | null>(null);
  const leftPanelTablistId = useId();
  const leftPanelContentId = `${leftPanelTablistId}-panel`;
  const mobileToolsPanelId = `${leftPanelTablistId}-mobile-tools`;
  const mobilePropertiesPanelId = `${leftPanelTablistId}-mobile-properties`;
  const mobileToolsTriggerRef = useRef<HTMLButtonElement>(null);
  const mobilePropertiesTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileToolsCloseRef = useRef<HTMLButtonElement>(null);
  const mobilePropertiesCloseRef = useRef<HTMLButtonElement>(null);
  const previousMobileEditorPanelRef = useRef<"properties" | "tools" | null>(null);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [themeQuery, setThemeQuery] = useState("");
  const [componentQuery, setComponentQuery] = useState("");
  const [componentSection, setComponentSection] = useState<EditorComponentSection>("popular");
  const [componentDetail, setComponentDetail] = useState<ComponentCatalogGroup | "all">("all");
  const [componentScene, setComponentScene] = useState<EditorComponentScene>("all");
  const [assetMotion, setAssetMotion] = useState<VisualAssetMotion>("static");
  const [assetSource, setAssetSource] = useState<"official" | "personal">("official");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetTaskGroup, setAssetTaskGroup] = useState<VisualAssetTaskGroupId>("all");
  const [assetFunction, setAssetFunction] = useState("all");
  const [assetStyle, setAssetStyle] = useState<VisualAssetStyle | "all">("all");
  const [assetCollection, setAssetCollection] = useState<AssetCollectionFilter>("all");
  const [previewAsset, setPreviewAsset] = useState<OfficialVisualAsset | null>(null);
  const [insertedAssetId, setInsertedAssetId] = useState<string | null>(null);
  const [assetStatusMessage, setAssetStatusMessage] = useState<string | null>(null);
  const [assetDisplayLimit, setAssetDisplayLimit] = useState(24);
  const assetFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    preferences: assetPreferences,
    recordRecent,
    toggleFavorite,
  } = useVisualAssetPreferences();
  const [personalFolder, setPersonalFolder] = useState("all");
  const queryClient = useQueryClient();
  const privateResourcesQuery = useQuery({
    queryKey: ["editor-private-resources"],
    queryFn: () => listResources({ resourceType: "image", pageSize: 100 }),
    staleTime: 30_000,
  });
  const privateResources = privateResourcesQuery.data?.items ?? [];
  const resourceIdsKey = privateResources.map((resource) => resource.id).join(",");
  const privateResourceUrlsQuery = useQuery({
    queryKey: ["editor-private-resource-urls", resourceIdsKey],
    enabled: privateResources.length > 0,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        privateResources.map(async (resource) => {
          try {
            const access = await createResourceAccessUrl(resource.id, "original");
            return [resource.id, access.url] as const;
          } catch {
            return [resource.id, null] as const;
          }
        }),
      );
      return Object.fromEntries(
        entries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
      );
    },
  });
  const privateResourceUrls = privateResourceUrlsQuery.data ?? {};
  const resourceUrlMapRef = useRef<Readonly<Record<string, string>>>({});
  resourceUrlMapRef.current = privateResourceUrls;
  const uploadPrivateResource = useMutation({
    mutationFn: (file: File) => uploadResource(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["editor-private-resources"] });
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (error) => onError(error instanceof Error ? error.message : "素材上传失败"),
  });
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
        (normalized !== "" ||
          (componentSection === "popular"
            ? isPopularEditorComponent(component)
            : editorComponentSection(component) === componentSection)) &&
        (normalized !== "" ||
          componentDetail === "all" ||
          component.category === componentDetail) &&
        componentMatchesEditorScene(component, componentScene) &&
        (normalized === "" || searchText.includes(normalized))
      );
    });
  }, [componentDetail, componentQuery, componentScene, componentSection]);
  const componentSectionCounts = useMemo(
    () =>
      Object.fromEntries(
        EDITOR_COMPONENT_SECTIONS.map((section) => [
          section.id,
          V0_COMPONENT_PREVIEWS.filter((component) =>
            section.id === "popular"
              ? isPopularEditorComponent(component)
              : editorComponentSection(component) === section.id,
          ).length,
        ]),
      ) as Readonly<Record<EditorComponentSection, number>>,
    [],
  );
  const componentDetails = EDITOR_COMPONENT_SECTION_DETAILS[componentSection] ?? [];
  const activeComponentSectionLabel =
    EDITOR_COMPONENT_SECTIONS.find((section) => section.id === componentSection)?.label ?? "组件";
  const favoriteAssetIds = useMemo(
    () => new Set(assetPreferences.favoriteVariantIds),
    [assetPreferences.favoriteVariantIds],
  );
  const recentAssetPositions = useMemo(
    () => new Map(assetPreferences.recentVariantIds.map((assetId, index) => [assetId, index])),
    [assetPreferences.recentVariantIds],
  );
  const assetCollectionCounts = useMemo(
    () => ({
      favorite: OFFICIAL_VISUAL_ASSETS.filter(
        (asset) => asset.motion === assetMotion && favoriteAssetIds.has(asset.id),
      ).length,
      recent: OFFICIAL_VISUAL_ASSETS.filter(
        (asset) => asset.motion === assetMotion && recentAssetPositions.has(asset.id),
      ).length,
    }),
    [assetMotion, favoriteAssetIds, recentAssetPositions],
  );
  const visibleEditorAssets = useMemo(() => {
    const normalized = assetQuery.trim().toLocaleLowerCase("zh-CN");
    const matches = OFFICIAL_VISUAL_ASSETS.filter((asset) => {
      const searchText =
        `${asset.name} ${asset.description} ${asset.tags.join(" ")}`.toLocaleLowerCase("zh-CN");
      return (
        asset.motion === assetMotion &&
        visualAssetMatchesTaskGroup(asset, assetTaskGroup) &&
        (assetFunction === "all" || asset.function === assetFunction) &&
        (assetStyle === "all" || asset.style === assetStyle) &&
        (assetCollection === "all" ||
          (assetCollection === "favorite"
            ? favoriteAssetIds.has(asset.id)
            : recentAssetPositions.has(asset.id))) &&
        (normalized === "" || searchText.includes(normalized))
      );
    });
    return matches.toSorted((left, right) => {
      if (assetCollection === "recent") {
        return (
          (recentAssetPositions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (recentAssetPositions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        );
      }
      const favoriteDifference =
        Number(favoriteAssetIds.has(right.id)) - Number(favoriteAssetIds.has(left.id));
      if (favoriteDifference !== 0) return favoriteDifference;
      const newDifference = Number(isNewVisualAsset(right)) - Number(isNewVisualAsset(left));
      return newDifference === 0
        ? visualAssetSerial(right) - visualAssetSerial(left)
        : newDifference;
    });
  }, [
    assetCollection,
    assetFunction,
    assetMotion,
    assetQuery,
    assetStyle,
    assetTaskGroup,
    favoriteAssetIds,
    recentAssetPositions,
  ]);
  const displayedEditorAssets = visibleEditorAssets.slice(0, assetDisplayLimit);
  useEffect(() => {
    setAssetDisplayLimit(24);
  }, [assetCollection, assetFunction, assetMotion, assetQuery, assetStyle, assetTaskGroup]);
  useEffect(
    () => () => {
      if (assetFeedbackTimerRef.current !== null) {
        clearTimeout(assetFeedbackTimerRef.current);
      }
    },
    [],
  );
  useEffect(() => {
    const previousPanel = previousMobileEditorPanelRef.current;
    previousMobileEditorPanelRef.current = mobileEditorPanel;
    if (mobileEditorPanel === "tools") {
      mobileToolsCloseRef.current?.focus();
    } else if (mobileEditorPanel === "properties") {
      mobilePropertiesCloseRef.current?.focus();
    } else if (previousPanel === "tools") {
      mobileToolsTriggerRef.current?.focus();
    } else if (previousPanel === "properties") {
      mobilePropertiesTriggerRef.current?.focus();
    }
  }, [mobileEditorPanel]);
  const activeAssetFunctions = visualAssetTaskGroupFunctions(assetTaskGroup);
  const assetTaskGroupCounts = useMemo(
    () =>
      Object.fromEntries(
        VISUAL_ASSET_TASK_GROUPS.map((group) => [
          group.id,
          OFFICIAL_VISUAL_ASSETS.filter(
            (asset) => asset.motion === assetMotion && visualAssetMatchesTaskGroup(asset, group.id),
          ).length,
        ]),
      ) as Readonly<Record<(typeof VISUAL_ASSET_TASK_GROUPS)[number]["id"], number>>,
    [assetMotion],
  );
  const personalFolders = useMemo(
    () =>
      [...new Set(privateResources.map((resource) => resource.folder).filter(Boolean))].sort(
        (left, right) => left!.localeCompare(right!, "zh-CN"),
      ) as readonly string[],
    [privateResources],
  );
  const visiblePrivateResources = useMemo(() => {
    const normalized = assetQuery.trim().toLocaleLowerCase("zh-CN");
    return privateResources.filter((resource) => {
      const matchesFolder =
        personalFolder === "all" ||
        (personalFolder === "ungrouped"
          ? resource.folder === null || resource.folder === undefined || resource.folder === ""
          : resource.folder === personalFolder);
      const matchesQuery =
        normalized === "" ||
        `${resource.displayName ?? ""} ${resource.originalFilename ?? ""} ${resource.folder ?? ""} ${resource.tags.join(" ")}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalized);
      return matchesFolder && matchesQuery;
    });
  }, [assetQuery, personalFolder, privateResources]);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const extensions = useMemo(
    () =>
      createDocumentExtensions({
        resourceUrlResolver: (resourceId) => resourceUrlMapRef.current[resourceId],
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
    if (editor === null) return;
    editor.view.dom.querySelectorAll<HTMLElement>("figure[data-resource-id]").forEach((figure) => {
      const resourceId = figure.dataset.resourceId;
      const url = resourceId === undefined ? undefined : privateResourceUrls[resourceId];
      const image = figure.querySelector<HTMLImageElement>("img");
      const label = figure.querySelector<HTMLElement>(".editor-atom-label");
      if (url !== undefined && image !== null) {
        image.src = url;
        image.hidden = false;
        if (label !== null) label.hidden = true;
      }
    });
  }, [editor, privateResourceUrls]);

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
  const insertionTargetLabel =
    selection === null ? "插入到文章末尾" : `插入到第 ${String(selection.index + 1)} 个区块后`;
  const insertionTargetSummary =
    selection === null
      ? "当前文章没有可选区块"
      : selection.textPreview || nodeLabels[selection.type] || selection.type;
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
    if (event.defaultPrevented || previewAsset !== null) return;
    if (event.key === "Escape" && mobileEditorPanel !== null) {
      event.preventDefault();
      setMobileEditorPanel(null);
      return;
    }
    if (event.key === "Tab" && mobileEditorPanel !== null) {
      const panelId = mobileEditorPanel === "tools" ? mobileToolsPanelId : mobilePropertiesPanelId;
      const panel = globalThis.document.getElementById(panelId);
      const focusable =
        panel === null
          ? []
          : [
              ...panel.querySelectorAll<HTMLElement>(
                "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
              ),
            ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first !== undefined && last !== undefined) {
        if (event.shiftKey && globalThis.document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && globalThis.document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
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

  const handleLeftPanelTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tablist = event.currentTarget.closest<HTMLElement>("[role='tablist']");
    const tabs =
      tablist === null ? [] : [...tablist.querySelectorAll<HTMLButtonElement>("[role='tab']")];
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0 || tabs.length === 0) return;

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    nextTab?.focus();
    nextTab?.click();
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

  const insertOfficialAsset = (asset: OfficialVisualAsset): boolean => {
    if (!insertVisualAssetAfterSelection(editor, asset)) {
      onError("当前动态素材缺少静态备用图，暂时无法插入。");
      return false;
    }
    if (assetFeedbackTimerRef.current !== null) {
      clearTimeout(assetFeedbackTimerRef.current);
    }
    recordRecent(asset.id);
    setInsertedAssetId(asset.id);
    setAssetStatusMessage(`已将“${asset.name}”${insertionTargetLabel}。`);
    assetFeedbackTimerRef.current = setTimeout(() => {
      setInsertedAssetId(null);
      setAssetStatusMessage(null);
    }, 2_400);
    return true;
  };

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
      <div className="grid min-h-[680px] xl:h-[calc(100vh-96px)] xl:min-h-0 xl:grid-cols-[344px_minmax(0,1fr)_312px]">
        {mobileEditorPanel === null ? null : (
          <button
            aria-label="关闭编辑面板"
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] xl:hidden"
            onClick={() => setMobileEditorPanel(null)}
            type="button"
          />
        )}
        <aside
          aria-label="排版工具"
          aria-modal={mobileEditorPanel === "tools" || undefined}
          className={`bg-panel-muted ${
            mobileEditorPanel === "tools"
              ? "fixed inset-x-3 bottom-3 z-50 block max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-card border border-line shadow-raised"
              : "hidden"
          } xl:static xl:z-auto xl:block xl:h-full xl:max-h-none xl:overflow-y-auto xl:rounded-none xl:border-0 xl:border-r xl:border-line xl:shadow-none`}
          id={mobileToolsPanelId}
          role={mobileEditorPanel === "tools" ? "dialog" : undefined}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-3 py-2 xl:hidden">
            <p className="text-[12px] font-semibold text-ink">排版工具</p>
            <button
              aria-label="关闭排版工具"
              className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
              onClick={() => setMobileEditorPanel(null)}
              ref={mobileToolsCloseRef}
              type="button"
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
          <div
            aria-label="排版工具分类"
            className="grid grid-cols-4 gap-1 border-b border-line p-2"
            id={leftPanelTablistId}
            role="tablist"
          >
            {EDITOR_LEFT_PANELS.map(([value, Icon, label]) => (
              <button
                aria-controls={leftPanelContentId}
                aria-selected={leftPanel === value}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-control text-[10px] font-medium transition ${
                  leftPanel === value
                    ? "bg-panel text-accent shadow-subtle"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
                id={`${leftPanelTablistId}-${value}`}
                key={value}
                onClick={() => setLeftPanel(value)}
                onKeyDown={handleLeftPanelTabKeyDown}
                role="tab"
                tabIndex={leftPanel === value ? 0 : -1}
                type="button"
              >
                <Icon aria-hidden="true" size={13} />
                {label}
              </button>
            ))}
          </div>
          <div
            aria-labelledby={`${leftPanelTablistId}-${leftPanel}`}
            id={leftPanelContentId}
            role="tabpanel"
            tabIndex={0}
          >
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
                          <p className="text-[11px] font-semibold text-ink">
                            {theme.manifest.name}
                          </p>
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
            ) : leftPanel === "components" ? (
              <div className="space-y-3 p-3">
                <div className="px-1">
                  <p className="text-[11px] font-semibold text-ink">插入排版组件</p>
                  <p className="mt-1 text-[9px] leading-4 text-muted">
                    先选类型，再按场景缩小范围；点击预览即可插入当前段落之后。
                  </p>
                </div>
                <nav aria-label="组件类型" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                  {EDITOR_COMPONENT_SECTIONS.map((section) => (
                    <button
                      aria-pressed={componentSection === section.id}
                      className={`shrink-0 rounded-md px-2.5 py-2 text-[10px] font-medium transition ${
                        componentSection === section.id
                          ? "bg-accent text-white shadow-subtle"
                          : "bg-panel text-muted hover:bg-hover hover:text-ink"
                      }`}
                      key={section.id}
                      onClick={() => {
                        setComponentSection(section.id);
                        setComponentDetail("all");
                      }}
                      type="button"
                    >
                      {section.label}
                      <span
                        className={`ml-1 text-[8px] ${componentSection === section.id ? "text-white/70" : "text-faint"}`}
                      >
                        {componentSectionCounts[section.id]}
                      </span>
                    </button>
                  ))}
                </nav>
                {componentDetails.length === 0 ? null : (
                  <div
                    className="flex flex-wrap gap-1"
                    aria-label={`${activeComponentSectionLabel}子分类`}
                  >
                    <button
                      aria-pressed={componentDetail === "all"}
                      className={`rounded-md px-2 py-1 text-[9px] ${
                        componentDetail === "all"
                          ? "bg-accent-soft font-medium text-accent-strong"
                          : "text-muted hover:bg-hover"
                      }`}
                      onClick={() => setComponentDetail("all")}
                      type="button"
                    >
                      全部
                    </button>
                    {componentDetails.map((detail) => (
                      <button
                        aria-pressed={componentDetail === detail}
                        className={`rounded-md px-2 py-1 text-[9px] ${
                          componentDetail === detail
                            ? "bg-accent-soft font-medium text-accent-strong"
                            : "text-muted hover:bg-hover"
                        }`}
                        key={detail}
                        onClick={() => setComponentDetail(detail)}
                        type="button"
                      >
                        {detail === "提示" ? "提示卡" : detail}
                      </button>
                    ))}
                  </div>
                )}
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
                    placeholder="搜索全部排版模块"
                    value={componentQuery}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="按使用场景筛选组件"
                    className="h-8 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-[9px] text-ink outline-none focus:border-accent"
                    onChange={(event) =>
                      setComponentScene(event.target.value as EditorComponentScene)
                    }
                    value={componentScene}
                  >
                    {EDITOR_COMPONENT_SCENES.map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.label}
                      </option>
                    ))}
                  </select>
                  <span className="shrink-0 text-[9px] tabular-nums text-faint">
                    {visibleEditorComponents.length} 个结果
                  </span>
                </div>
                {visibleEditorComponents.length === 0 ? (
                  <div className="rounded-control border border-dashed border-line p-5 text-center">
                    <Blocks aria-hidden="true" className="mx-auto text-faint" size={18} />
                    <p className="mt-2 text-[10px] font-medium text-ink">这个分类没有匹配项</p>
                    <button
                      className="mt-2 text-[9px] font-medium text-accent"
                      onClick={() => {
                        setComponentQuery("");
                        setComponentScene("all");
                        setComponentDetail("all");
                      }}
                      type="button"
                    >
                      清除筛选
                    </button>
                  </div>
                ) : (
                  <div className="grid max-h-[510px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
                    {visibleEditorComponents.map((component) => (
                      <button
                        className="min-w-0 overflow-hidden rounded-control border border-line bg-panel text-left transition hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-subtle active:translate-y-0 disabled:opacity-45"
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
                        <EditorComponentThumbnail component={component} />
                        <span className="block border-t border-line px-2 py-2">
                          <span className="block truncate text-[9px] font-semibold text-ink">
                            {component.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[8px] text-faint">
                            {component.category}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-3">
                <div className="px-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold text-ink">图片与装饰</p>
                    <span className="rounded-full bg-accent-soft px-2 py-1 text-[8px] font-semibold text-accent">
                      {STATIC_ASSET_COUNT + DYNAMIC_ASSET_COUNT} 个可用变体
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] leading-4 text-muted">
                    先按用途找素材，再明确点击“插入”；新素材会优先展示。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-md bg-panel p-1">
                  {(["official", "personal"] as const).map((source) => (
                    <button
                      className={`h-7 rounded text-[9px] font-medium ${
                        assetSource === source
                          ? "bg-accent-soft text-accent-strong"
                          : "text-muted hover:bg-hover"
                      }`}
                      key={source}
                      onClick={() => {
                        setAssetSource(source);
                        setAssetQuery("");
                      }}
                      type="button"
                    >
                      {source === "official" ? "官方精选" : `我的素材 · ${privateResources.length}`}
                    </button>
                  ))}
                </div>
                <label className="relative block">
                  <span className="sr-only">搜索视觉素材</span>
                  <Search
                    aria-hidden="true"
                    className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
                    size={12}
                  />
                  <input
                    className="h-8 w-full rounded-md border border-line bg-panel pr-2 pl-8 text-[10px] text-ink outline-none focus:border-accent"
                    onChange={(event) => setAssetQuery(event.target.value)}
                    placeholder={
                      assetSource === "official"
                        ? "搜索水墨、节气、党政、教育…"
                        : "搜索名称、文件夹或标签"
                    }
                    value={assetQuery}
                  />
                </label>
                {assetSource === "official" ? (
                  <>
                    <div className="grid grid-cols-2 gap-1 rounded-md bg-panel p-1">
                      {(["static", "dynamic"] as const).map((motion) => (
                        <button
                          className={`h-7 rounded text-[9px] font-medium ${
                            assetMotion === motion
                              ? "bg-accent-soft text-accent-strong"
                              : "text-muted hover:bg-hover"
                          }`}
                          key={motion}
                          onClick={() => {
                            setAssetMotion(motion);
                            setAssetTaskGroup("all");
                            setAssetFunction("all");
                            setAssetStyle("all");
                          }}
                          type="button"
                        >
                          {motion === "static"
                            ? `静态素材 · ${String(STATIC_ASSET_COUNT)}`
                            : `动态素材 · ${String(DYNAMIC_ASSET_COUNT)}`}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1" aria-label="素材使用记录">
                      {(
                        [
                          [
                            "all",
                            "全部",
                            assetMotion === "static" ? STATIC_ASSET_COUNT : DYNAMIC_ASSET_COUNT,
                          ],
                          ["favorite", "收藏", assetCollectionCounts.favorite],
                          ["recent", "最近", assetCollectionCounts.recent],
                        ] as const
                      ).map(([value, label, count]) => (
                        <button
                          aria-pressed={assetCollection === value}
                          className={`flex h-8 items-center justify-center gap-1 rounded-md border text-[9px] font-semibold transition ${
                            assetCollection === value
                              ? "border-accent/30 bg-accent-soft text-accent-strong"
                              : "border-line bg-panel text-muted hover:border-line-strong hover:text-ink"
                          }`}
                          key={value}
                          onClick={() => setAssetCollection(value)}
                          type="button"
                        >
                          {value === "favorite" ? (
                            <Star
                              aria-hidden="true"
                              fill={assetCollection === value ? "currentColor" : "none"}
                              size={10}
                            />
                          ) : value === "recent" ? (
                            <Eye aria-hidden="true" size={10} />
                          ) : (
                            <Sparkles aria-hidden="true" size={10} />
                          )}
                          {label} · {count}
                        </button>
                      ))}
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between px-1">
                        <p className="text-[9px] font-semibold tracking-[0.08em] text-faint uppercase">
                          按编辑任务
                        </p>
                        <button
                          aria-pressed={assetTaskGroup === "all"}
                          className={`text-[9px] font-medium ${assetTaskGroup === "all" ? "text-accent" : "text-muted hover:text-ink"}`}
                          onClick={() => {
                            setAssetTaskGroup("all");
                            setAssetFunction("all");
                          }}
                          type="button"
                        >
                          全部任务
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {VISUAL_ASSET_TASK_GROUPS.map((group) => (
                          <button
                            aria-pressed={assetTaskGroup === group.id}
                            className={`min-h-12 rounded-control border px-2.5 py-2 text-left transition ${
                              assetTaskGroup === group.id
                                ? "border-accent/35 bg-accent-soft shadow-subtle"
                                : "border-line bg-panel hover:border-line-strong hover:shadow-subtle"
                            }`}
                            key={group.id}
                            onClick={() => {
                              setAssetTaskGroup(group.id);
                              setAssetFunction("all");
                            }}
                            type="button"
                          >
                            <span className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-semibold text-ink">
                                {group.label}
                              </span>
                              <span className="text-[8px] tabular-nums text-faint">
                                {assetTaskGroupCounts[group.id]}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[8px] text-muted">
                              {group.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-0.5" aria-label="素材细分类">
                      <button
                        aria-pressed={assetFunction === "all"}
                        className={`h-7 shrink-0 rounded-md px-2.5 text-[9px] font-medium ${
                          assetFunction === "all"
                            ? "bg-ink text-white"
                            : "bg-panel text-muted hover:bg-hover"
                        }`}
                        onClick={() => setAssetFunction("all")}
                        type="button"
                      >
                        全部
                      </button>
                      {EDITOR_ASSET_FUNCTIONS.filter(
                        (item) => item.id !== "all" && activeAssetFunctions.includes(item.id),
                      ).map((item) => {
                        const count = OFFICIAL_VISUAL_ASSETS.filter(
                          (asset) => asset.motion === assetMotion && asset.function === item.id,
                        ).length;
                        return (
                          <button
                            aria-pressed={assetFunction === item.id}
                            className={`h-7 shrink-0 rounded-md px-2.5 text-[9px] font-medium ${
                              assetFunction === item.id
                                ? "bg-ink text-white"
                                : "bg-panel text-muted hover:bg-hover"
                            }`}
                            disabled={count === 0}
                            key={item.id}
                            onClick={() => setAssetFunction(item.id)}
                            type="button"
                          >
                            {item.label} · {count}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="按视觉风格筛选素材"
                        className="h-8 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-[9px] text-ink outline-none focus:border-accent"
                        onChange={(event) =>
                          setAssetStyle(event.target.value as VisualAssetStyle | "all")
                        }
                        value={assetStyle}
                      >
                        <option value="all">全部风格</option>
                        {Object.entries(VISUAL_ASSET_STYLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <span className="shrink-0 text-[9px] tabular-nums text-faint">
                        {visibleEditorAssets.length} 个结果
                      </span>
                    </div>
                    <div className="rounded-control border border-accent/15 bg-accent-soft px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[9px] font-semibold text-accent-strong">
                        <MapPin aria-hidden="true" size={11} />
                        {insertionTargetLabel}
                      </p>
                      <p
                        className="mt-1 truncate text-[8px] text-muted"
                        title={insertionTargetSummary}
                      >
                        当前锚点：{insertionTargetSummary}
                      </p>
                    </div>
                    {assetStatusMessage === null ? null : (
                      <p
                        className="rounded-control bg-success-soft px-3 py-2 text-[9px] font-medium text-success"
                        role="status"
                      >
                        {assetStatusMessage}
                      </p>
                    )}
                    {visibleEditorAssets.length === 0 ? (
                      <div className="rounded-control border border-dashed border-line p-5 text-center">
                        <Sparkles aria-hidden="true" className="mx-auto text-faint" size={18} />
                        <p className="mt-2 text-[10px] font-medium text-ink">
                          {assetCollection === "favorite"
                            ? "当前分类还没有收藏素材"
                            : assetCollection === "recent"
                              ? "当前分类还没有最近使用素材"
                              : "这个分类没有匹配素材"}
                        </p>
                        <button
                          className="mt-2 text-[9px] font-medium text-accent"
                          onClick={() => {
                            setAssetQuery("");
                            setAssetFunction("all");
                            setAssetStyle("all");
                            setAssetCollection("all");
                          }}
                          type="button"
                        >
                          清除筛选
                        </button>
                      </div>
                    ) : (
                      <div className="grid max-h-[540px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
                        {displayedEditorAssets.map((asset) => {
                          const compactPreview = usesCompactVisualPreview(asset);
                          const inserted = insertedAssetId === asset.id;
                          return (
                            <article
                              className="group min-w-0 self-start overflow-hidden rounded-control border border-line bg-panel transition hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-subtle"
                              key={asset.id}
                            >
                              <div
                                className={`relative overflow-hidden bg-[linear-gradient(45deg,#f5f3ef_25%,transparent_25%),linear-gradient(-45deg,#f5f3ef_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f5f3ef_75%),linear-gradient(-45deg,transparent_75%,#f5f3ef_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0] ${compactPreview ? "aspect-square" : "aspect-[5/2]"}`}
                              >
                                <button
                                  aria-label={`查看大图：${asset.name}`}
                                  className="absolute inset-0 z-10 grid place-items-center bg-zinc-950/0 text-white transition hover:bg-zinc-950/20 focus-visible:bg-zinc-950/20 focus-visible:outline-none"
                                  onClick={() => {
                                    recordRecent(asset.id);
                                    setPreviewAsset(asset);
                                  }}
                                  type="button"
                                >
                                  <span className="rounded-full bg-zinc-950/70 px-2 py-1 text-[8px] font-semibold opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100">
                                    <Eye aria-hidden="true" className="mr-1 inline" size={9} />
                                    大图预览
                                  </span>
                                </button>
                                <img
                                  alt={asset.name}
                                  className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
                                  loading="lazy"
                                  src={asset.previewPath}
                                />
                                <span
                                  className={`pointer-events-none absolute top-1.5 left-1.5 z-20 rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white ${
                                    asset.motion === "dynamic"
                                      ? "bg-violet-600/85"
                                      : "bg-zinc-900/70"
                                  }`}
                                >
                                  {asset.motion === "dynamic" ? "动态" : "静态"}
                                </span>
                                {isNewVisualAsset(asset) ? (
                                  <span className="pointer-events-none absolute top-1.5 right-1.5 z-20 rounded-full bg-orange-500 px-1.5 py-0.5 text-[8px] font-semibold text-white">
                                    上新
                                  </span>
                                ) : null}
                                <button
                                  aria-label={
                                    favoriteAssetIds.has(asset.id)
                                      ? `取消收藏${asset.name}`
                                      : `收藏${asset.name}`
                                  }
                                  className={`absolute right-1.5 bottom-1.5 z-20 grid size-7 place-items-center rounded-full border backdrop-blur transition ${
                                    favoriteAssetIds.has(asset.id)
                                      ? "border-amber-300 bg-amber-50 text-amber-600"
                                      : "border-white/70 bg-white/85 text-zinc-500 hover:text-amber-600"
                                  }`}
                                  onClick={() => toggleFavorite(asset.id)}
                                  type="button"
                                >
                                  <Star
                                    aria-hidden="true"
                                    fill={favoriteAssetIds.has(asset.id) ? "currentColor" : "none"}
                                    size={11}
                                  />
                                </button>
                              </div>
                              <div className="border-t border-line p-2.5">
                                <p className="truncate text-[10px] font-semibold text-ink">
                                  {asset.name}
                                </p>
                                <p className="mt-0.5 truncate text-[9px] text-faint">
                                  {VISUAL_ASSET_FUNCTION_LABELS[asset.function]} ·{" "}
                                  {VISUAL_ASSET_STYLE_LABELS[asset.style]}
                                </p>
                                <button
                                  aria-label={`插入素材：${asset.name}`}
                                  className={`mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[9px] font-semibold transition active:scale-[0.98] disabled:opacity-45 ${
                                    inserted
                                      ? "bg-emerald-600 text-white"
                                      : "bg-ink text-white hover:bg-accent"
                                  }`}
                                  disabled={!editable}
                                  onClick={() => insertOfficialAsset(asset)}
                                  type="button"
                                >
                                  {inserted ? (
                                    <Check aria-hidden="true" size={11} />
                                  ) : (
                                    <Sparkles aria-hidden="true" size={11} />
                                  )}
                                  {inserted ? "已插入画布" : insertionTargetLabel}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                        {assetDisplayLimit < visibleEditorAssets.length ? (
                          <button
                            className="col-span-2 h-9 rounded-control border border-line bg-panel text-[10px] font-medium text-muted hover:border-line-strong hover:text-ink"
                            onClick={() => setAssetDisplayLimit((current) => current + 24)}
                            type="button"
                          >
                            再看 {Math.min(24, visibleEditorAssets.length - assetDisplayLimit)} 个
                          </button>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex gap-1 overflow-x-auto pb-0.5" aria-label="我的素材文件夹">
                      <button
                        aria-pressed={personalFolder === "all"}
                        className={`shrink-0 rounded-md px-2 py-1 text-[9px] ${
                          personalFolder === "all"
                            ? "bg-accent-soft font-medium text-accent-strong"
                            : "text-muted hover:bg-hover"
                        }`}
                        onClick={() => setPersonalFolder("all")}
                        type="button"
                      >
                        全部
                      </button>
                      <button
                        aria-pressed={personalFolder === "ungrouped"}
                        className={`shrink-0 rounded-md px-2 py-1 text-[9px] ${
                          personalFolder === "ungrouped"
                            ? "bg-accent-soft font-medium text-accent-strong"
                            : "text-muted hover:bg-hover"
                        }`}
                        onClick={() => setPersonalFolder("ungrouped")}
                        type="button"
                      >
                        未分组
                      </button>
                      {personalFolders.map((folder) => (
                        <button
                          aria-pressed={personalFolder === folder}
                          className={`shrink-0 rounded-md px-2 py-1 text-[9px] ${
                            personalFolder === folder
                              ? "bg-accent-soft font-medium text-accent-strong"
                              : "text-muted hover:bg-hover"
                          }`}
                          key={folder}
                          onClick={() => setPersonalFolder(folder)}
                          type="button"
                        >
                          {folder}
                        </button>
                      ))}
                    </div>
                    <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-accent/35 bg-accent-soft text-[10px] font-semibold text-accent hover:border-accent disabled:opacity-45">
                      {uploadPrivateResource.isPending ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" size={12} />
                      ) : (
                        <UploadCloud aria-hidden="true" size={12} />
                      )}
                      {uploadPrivateResource.isPending ? "正在上传…" : "上传到我的素材"}
                      <input
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        disabled={uploadPrivateResource.isPending}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file !== undefined) uploadPrivateResource.mutate(file);
                          event.currentTarget.value = "";
                        }}
                        type="file"
                      />
                    </label>
                    {privateResourcesQuery.isPending ? (
                      <p className="rounded-control border border-line bg-panel p-4 text-center text-[10px] text-muted">
                        正在读取我的素材…
                      </p>
                    ) : visiblePrivateResources.length === 0 ? (
                      <div className="rounded-control border border-line bg-panel p-5 text-center">
                        <ImageIcon aria-hidden="true" className="mx-auto text-faint" size={18} />
                        <p className="mt-2 text-[10px] font-medium text-ink">还没有匹配的图片</p>
                        <p className="mt-1 text-[9px] leading-4 text-faint">
                          上传后会永久保存在私有素材库，可反复使用。
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[510px] space-y-2 overflow-y-auto pr-0.5">
                        {visiblePrivateResources.map((resource) => {
                          const url = privateResourceUrls[resource.id];
                          return (
                            <article
                              className="overflow-hidden rounded-control border border-line bg-panel"
                              key={resource.id}
                            >
                              <div className="grid aspect-[5/2] place-items-center overflow-hidden bg-panel-muted">
                                {url === undefined ? (
                                  <ImageIcon aria-hidden="true" className="text-faint" size={18} />
                                ) : (
                                  <img
                                    alt={resourceLabel(resource)}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    src={url}
                                  />
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="truncate text-[9px] font-semibold text-ink">
                                  {resourceLabel(resource)}
                                </p>
                                <p className="mt-0.5 truncate text-[8px] text-faint">
                                  {resource.folder ?? "未分组"}
                                  {resource.tags.length === 0
                                    ? ""
                                    : ` · ${resource.tags.join(" / ")}`}
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                  <button
                                    className="h-7 rounded-md bg-accent text-[9px] font-semibold text-white disabled:opacity-45"
                                    disabled={!editable || url === undefined}
                                    onClick={() => {
                                      insertVisualAssetAfterSelection(editor, {
                                        id: `private_${resource.id}`,
                                        motion: "static",
                                        name: resourceLabel(resource),
                                        resourceId: resource.id,
                                      });
                                    }}
                                    type="button"
                                  >
                                    插入
                                  </button>
                                  <button
                                    className="h-7 rounded-md border border-line text-[9px] font-medium text-ink hover:bg-hover disabled:opacity-35"
                                    disabled={
                                      !editable ||
                                      selection?.type !== "imageBlock" ||
                                      url === undefined
                                    }
                                    onClick={() => {
                                      if (selection?.type !== "imageBlock") return;
                                      updateBlockAttributes(editor, selection.blockId, {
                                        alt: resourceLabel(resource),
                                        originalResourceId:
                                          selection.attributes.originalResourceId ??
                                          selection.attributes.resourceId,
                                        resourceId: resource.id,
                                      });
                                    }}
                                    type="button"
                                  >
                                    替换当前
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        <div
          className="min-w-0 bg-[#efefed] xl:flex xl:min-h-0 xl:flex-col"
          data-preview-theme={visualTheme === undefined ? "default" : themePreviewKey(visualTheme)}
          style={
            {
              "--preview-accent": visualTheme?.preview.accentColors[2] ?? "#4f46e5",
              "--preview-primary": visualTheme?.preview.accentColors[0] ?? "#18181b",
              "--preview-surface": visualTheme?.preview.accentColors[1] ?? "#f7f7f5",
            } as CSSProperties
          }
        >
          <div className="sticky top-14 z-30 grid grid-cols-2 gap-2 border-b border-line bg-panel/95 p-2 backdrop-blur xl:hidden">
            <button
              aria-controls={mobileToolsPanelId}
              aria-expanded={mobileEditorPanel === "tools"}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-control border border-line bg-panel text-[10px] font-semibold text-ink shadow-subtle"
              onClick={() => setMobileEditorPanel("tools")}
              ref={mobileToolsTriggerRef}
              type="button"
            >
              <Blocks aria-hidden="true" size={13} />
              排版工具
            </button>
            <button
              aria-controls={mobilePropertiesPanelId}
              aria-expanded={mobileEditorPanel === "properties"}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-control border border-line bg-panel text-[10px] font-semibold text-ink shadow-subtle"
              onClick={() => setMobileEditorPanel("properties")}
              ref={mobilePropertiesTriggerRef}
              type="button"
            >
              <ChevronsUpDown aria-hidden="true" size={13} />
              区块属性
            </button>
          </div>
          <EditorToolbar editable={editable} editor={editor} selection={selection} />
          <div
            className="editor-canvas-scroll overflow-auto px-5 py-8 sm:px-8 xl:min-h-0 xl:flex-1"
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

        <aside
          aria-label="区块属性"
          aria-modal={mobileEditorPanel === "properties" || undefined}
          className={`bg-panel ${
            mobileEditorPanel === "properties"
              ? "fixed inset-x-3 bottom-3 z-50 block max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-card border border-line shadow-raised"
              : "hidden"
          } xl:static xl:z-auto xl:block xl:h-full xl:max-h-none xl:overflow-y-auto xl:rounded-none xl:border-0 xl:border-l xl:border-line xl:shadow-none`}
          id={mobilePropertiesPanelId}
          role={mobileEditorPanel === "properties" ? "dialog" : undefined}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold text-ink">区块属性</p>
              <p className="mt-0.5 text-[10px] text-faint">仅作用于当前选中区块</p>
            </div>
            <button
              aria-label="关闭区块属性"
              className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink xl:hidden"
              onClick={() => setMobileEditorPanel(null)}
              ref={mobilePropertiesCloseRef}
              type="button"
            >
              <X aria-hidden="true" size={15} />
            </button>
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

              {!(["imageBlock", "divider", "svgInteraction"] as const).includes(
                selection.type as "imageBlock" | "divider" | "svgInteraction",
              ) ? (
                <div className="rounded-control border border-accent/20 bg-accent-soft/45 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-ink">文字格式</p>
                    <span className="text-[8px] text-faint">
                      {editor.state.selection.empty ? "当前区块" : "已选文字"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_76px] gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[8px] text-faint">字体</span>
                      <select
                        aria-label="属性栏字体"
                        className="h-8 w-full rounded-md border border-line bg-panel px-2 text-[9px] text-ink outline-none focus:border-accent"
                        disabled={!editable || (textLocked && selection.locked)}
                        onChange={(event) =>
                          applyTextStyle(editor, selection, "fontFamily", event.currentTarget.value)
                        }
                        value={String(
                          currentTextStyle(
                            editor,
                            selection,
                            "fontFamily",
                            fontFamilyOptions[0].value,
                          ),
                        )}
                      >
                        {fontFamilyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[8px] text-faint">字号</span>
                      <select
                        aria-label="属性栏字号"
                        className="h-8 w-full rounded-md border border-line bg-panel px-2 text-[9px] text-ink outline-none focus:border-accent"
                        disabled={!editable || (textLocked && selection.locked)}
                        onChange={(event) =>
                          applyTextStyle(
                            editor,
                            selection,
                            "fontSize",
                            Number(event.currentTarget.value),
                          )
                        }
                        value={Number(currentTextStyle(editor, selection, "fontSize", 16))}
                      >
                        {fontSizeOptions.map((size) => (
                          <option key={size} value={size}>
                            {size}px
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-[76px_1fr] items-end gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[8px] text-faint">文字颜色</span>
                      <input
                        aria-label="属性栏文字颜色"
                        className="h-8 w-full cursor-pointer rounded-md border border-line bg-panel p-1"
                        disabled={!editable || (textLocked && selection.locked)}
                        onChange={(event) =>
                          applyTextStyle(editor, selection, "textColor", event.currentTarget.value)
                        }
                        type="color"
                        value={String(currentTextStyle(editor, selection, "textColor", "#18181b"))}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["lineHeight", "行高", 1, 3, 1.8, 0.1],
                          ["letterSpacing", "字距", -2, 10, 0, 0.5],
                        ] as const
                      ).map(([attribute, label, min, max, fallback, step]) => {
                        const overrides = selection.attributes.styleOverrides as
                          Record<string, unknown> | undefined;
                        const current = overrides?.[attribute];
                        const value = typeof current === "number" ? current : fallback;
                        return (
                          <label className="block" key={attribute}>
                            <span className="mb-1 flex justify-between text-[8px] text-faint">
                              {label}
                              <span>{value}</span>
                            </span>
                            <input
                              className="h-8 w-full accent-indigo-600"
                              disabled={!editable || (textLocked && selection.locked)}
                              max={max}
                              min={min}
                              onChange={(event) =>
                                updateBlockAttributes(editor, selection.blockId, {
                                  styleOverrides: {
                                    ...overrides,
                                    [attribute]: Number(event.currentTarget.value),
                                  },
                                })
                              }
                              step={step}
                              type="range"
                              value={value}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {(typeof selection.attributes.componentId === "string" ||
                selection.type === "imageBlock") &&
              (componentAttributeFields[selection.type]?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                    {selection.type === "imageBlock" ? "图片信息" : "组件文字槽"}
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

              {selection.type === "imageBlock" ? (
                <div className="space-y-4 rounded-control border border-line bg-panel-muted p-3">
                  <div>
                    <p className="text-[10px] font-medium text-ink">显示宽度</p>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {(
                        [
                          ["full", "通栏"],
                          ["percent", "自定义"],
                          ["original", "原始"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          className={`h-8 rounded-md border text-[9px] ${
                            selection.attributes.widthMode === value ||
                            (selection.attributes.widthMode === undefined && value === "full")
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-line bg-panel text-muted"
                          }`}
                          disabled={!editable}
                          key={value}
                          onClick={() =>
                            updateBlockAttributes(editor, selection.blockId, { widthMode: value })
                          }
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {selection.attributes.widthMode === "percent" ? (
                      <label className="mt-3 block">
                        <span className="flex items-center justify-between text-[9px] text-muted">
                          图片宽度
                          <span>{String(selection.attributes.widthPercent ?? 80)}%</span>
                        </span>
                        <input
                          className="mt-2 w-full accent-indigo-600"
                          disabled={!editable}
                          max={100}
                          min={selection.attributes.elementKind === "sticker" ? 8 : 20}
                          onChange={(event) =>
                            updateBlockAttributes(editor, selection.blockId, {
                              widthPercent: Number(event.currentTarget.value),
                            })
                          }
                          step={5}
                          type="range"
                          value={Number(selection.attributes.widthPercent ?? 80)}
                        />
                      </label>
                    ) : null}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium text-ink">位置与层级</p>
                      <button
                        aria-pressed={selection.attributes.freePosition === true}
                        className={`rounded-md px-2 py-1 text-[8px] font-medium ${
                          selection.attributes.freePosition === true
                            ? "bg-accent text-white"
                            : "border border-line bg-panel text-muted"
                        }`}
                        disabled={!editable}
                        onClick={() =>
                          updateBlockAttributes(editor, selection.blockId, {
                            freePosition: selection.attributes.freePosition !== true,
                          })
                        }
                        type="button"
                      >
                        {selection.attributes.freePosition === true ? "可拖动" : "开启自由移动"}
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {(
                        [
                          ["left", "靠左"],
                          ["center", "居中"],
                          ["right", "靠右"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          aria-pressed={
                            selection.attributes.horizontalAlign === value ||
                            (selection.attributes.horizontalAlign === undefined &&
                              value === "center")
                          }
                          className={`h-8 rounded-md border text-[9px] ${
                            selection.attributes.horizontalAlign === value ||
                            (selection.attributes.horizontalAlign === undefined &&
                              value === "center")
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-line bg-panel text-muted"
                          }`}
                          disabled={!editable}
                          key={value}
                          onClick={() =>
                            updateBlockAttributes(editor, selection.blockId, {
                              horizontalAlign: value,
                            })
                          }
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {selection.attributes.freePosition === true ? (
                      <div className="mt-3 space-y-3 rounded-md border border-accent/15 bg-panel p-2.5">
                        <p className="text-[8px] leading-4 text-accent">
                          可直接在画布中拖动；也可用下面的数值精确调整。
                        </p>
                        {(
                          [
                            ["offsetX", "左右", -300, 300, 0, 1, "px"],
                            ["offsetY", "上下", -300, 300, 0, 1, "px"],
                            ["rotation", "旋转", -180, 180, 0, 1, "°"],
                            ["layer", "层级", 0, 20, 1, 1, ""],
                          ] as const
                        ).map(([attribute, label, min, max, fallback, step, unit]) => {
                          const current = selection.attributes[attribute];
                          const value = typeof current === "number" ? current : fallback;
                          return (
                            <label className="block" key={attribute}>
                              <span className="flex justify-between text-[8px] text-faint">
                                {label}
                                <span>
                                  {value}
                                  {unit}
                                </span>
                              </span>
                              <input
                                className="mt-1 w-full accent-indigo-600"
                                disabled={!editable}
                                max={max}
                                min={min}
                                onChange={(event) =>
                                  updateBlockAttributes(editor, selection.blockId, {
                                    [attribute]: Number(event.currentTarget.value),
                                  })
                                }
                                step={step}
                                type="range"
                                value={value}
                              />
                            </label>
                          );
                        })}
                        <button
                          className="h-7 w-full rounded-md border border-line text-[8px] text-muted hover:bg-hover"
                          disabled={!editable}
                          onClick={() =>
                            updateBlockAttributes(editor, selection.blockId, {
                              layer: 1,
                              offsetX: 0,
                              offsetY: 0,
                              rotation: 0,
                            })
                          }
                          type="button"
                        >
                          重置位置
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-ink">裁切方式</p>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {(
                        [
                          ["contain", "完整显示"],
                          ["cover", "铺满裁切"],
                          ["fill", "拉伸填充"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          className={`h-8 rounded-md border text-[9px] ${
                            selection.attributes.objectFit === value ||
                            (selection.attributes.objectFit === undefined && value === "contain")
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-line bg-panel text-muted"
                          }`}
                          disabled={!editable}
                          key={value}
                          onClick={() =>
                            updateBlockAttributes(editor, selection.blockId, { objectFit: value })
                          }
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {selection.attributes.objectFit === "cover" ? (
                      <div className="mt-3 space-y-2 rounded-md border border-line bg-panel p-2.5">
                        <p className="text-[8px] text-faint">裁切焦点</p>
                        {(
                          [
                            ["objectPositionX", "左右焦点"],
                            ["objectPositionY", "上下焦点"],
                          ] as const
                        ).map(([attribute, label]) => {
                          const current = selection.attributes[attribute];
                          const value = typeof current === "number" ? current : 50;
                          return (
                            <label className="block" key={attribute}>
                              <span className="flex justify-between text-[8px] text-faint">
                                {label}
                                <span>{value}%</span>
                              </span>
                              <input
                                className="mt-1 w-full accent-indigo-600"
                                disabled={!editable}
                                max={100}
                                min={0}
                                onChange={(event) =>
                                  updateBlockAttributes(editor, selection.blockId, {
                                    [attribute]: Number(event.currentTarget.value),
                                  })
                                }
                                type="range"
                                value={value}
                              />
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                    <label className="mt-3 block">
                      <span className="flex justify-between text-[8px] text-faint">
                        透明度
                        <span>{Math.round(Number(selection.attributes.opacity ?? 1) * 100)}%</span>
                      </span>
                      <input
                        className="mt-1 w-full accent-indigo-600"
                        disabled={!editable}
                        max={1}
                        min={0.1}
                        onChange={(event) =>
                          updateBlockAttributes(editor, selection.blockId, {
                            opacity: Number(event.currentTarget.value),
                          })
                        }
                        step={0.05}
                        type="range"
                        value={Number(selection.attributes.opacity ?? 1)}
                      />
                    </label>
                  </div>
                  <button
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-accent/25 bg-panel text-[9px] font-medium text-accent hover:bg-hover"
                    onClick={() => {
                      setLeftPanel("assets");
                      setAssetSource("personal");
                    }}
                    type="button"
                  >
                    <ImageIcon aria-hidden="true" size={11} />
                    从我的素材替换
                  </button>
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

              <div className="rounded-control border border-line bg-panel-muted p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium text-ink">自由样式</p>
                  <button
                    className="text-[9px] font-medium text-accent hover:text-accent-strong disabled:opacity-40"
                    disabled={!editable}
                    onClick={() =>
                      updateBlockAttributes(editor, selection.blockId, { styleOverrides: {} })
                    }
                    type="button"
                  >
                    重置
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["textColor", "文字", "#18181b"],
                      ["backgroundColor", "背景", "#ffffff"],
                      ["borderColor", "边框", "#d4d4d8"],
                    ] as const
                  ).map(([attribute, label, fallback]) => {
                    const overrides = selection.attributes.styleOverrides as
                      Record<string, unknown> | undefined;
                    const value = overrides?.[attribute];
                    return (
                      <label className="text-center" key={attribute}>
                        <span className="mb-1.5 block text-[8px] text-faint">{label}</span>
                        <input
                          aria-label={`${label}颜色`}
                          className="h-7 w-full cursor-pointer rounded border border-line bg-panel p-0.5 disabled:opacity-40"
                          disabled={!editable}
                          onChange={(event) =>
                            updateBlockAttributes(editor, selection.blockId, {
                              styleOverrides: {
                                ...overrides,
                                [attribute]: event.currentTarget.value,
                              },
                            })
                          }
                          type="color"
                          value={
                            typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value)
                              ? value
                              : fallback
                          }
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 space-y-3">
                  {(
                    [
                      ["padding", "内边距", 0, 40, 12],
                      ["borderRadius", "圆角", 0, 32, 8],
                      ["borderWidth", "边框", 0, 6, 0],
                    ] as const
                  ).map(([attribute, label, min, max, fallback]) => {
                    const overrides = selection.attributes.styleOverrides as
                      Record<string, unknown> | undefined;
                    const current =
                      attribute === "padding" ? overrides?.paddingTop : overrides?.[attribute];
                    const value = typeof current === "number" ? current : fallback;
                    return (
                      <label className="block" key={attribute}>
                        <span className="flex items-center justify-between text-[8px] text-faint">
                          {label}
                          <span>{value}px</span>
                        </span>
                        <input
                          className="mt-1 w-full accent-indigo-600"
                          disabled={!editable}
                          max={max}
                          min={min}
                          onChange={(event) => {
                            const next = Number(event.currentTarget.value);
                            updateBlockAttributes(editor, selection.blockId, {
                              styleOverrides: {
                                ...overrides,
                                ...(attribute === "padding"
                                  ? {
                                      paddingBottom: next,
                                      paddingLeft: next,
                                      paddingRight: next,
                                      paddingTop: next,
                                    }
                                  : { [attribute]: next }),
                                ...(attribute === "borderWidth" && next > 0
                                  ? { borderStyle: "solid" }
                                  : {}),
                              },
                            });
                          }}
                          type="range"
                          value={value}
                        />
                      </label>
                    );
                  })}
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
      <VisualAssetPreviewDialog
        asset={previewAsset}
        favorite={previewAsset !== null && favoriteAssetIds.has(previewAsset.id)}
        inserted={previewAsset !== null && insertedAssetId === previewAsset.id}
        insertionLabel={insertionTargetLabel}
        onClose={() => setPreviewAsset(null)}
        onInsert={(asset) => {
          if (insertOfficialAsset(asset)) setPreviewAsset(null);
        }}
        onToggleFavorite={(asset) => toggleFavorite(asset.id)}
      />
    </section>
  );
}
