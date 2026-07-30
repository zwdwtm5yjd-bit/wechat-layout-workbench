import type { JsonObject } from "../json.js";
import type { DocumentMark } from "../marks/index.js";

export const INLINE_NODE_TYPES = ["text", "hardBreak"] as const;

export const BLOCK_NODE_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "imageBlock",
  "divider",
  "semanticCard",
  "brandFooter",
  "svgInteraction",
] as const;

export const NODE_TYPES = ["doc", ...INLINE_NODE_TYPES, ...BLOCK_NODE_TYPES] as const;

export type InlineNodeType = (typeof INLINE_NODE_TYPES)[number];
export type BlockNodeType = (typeof BLOCK_NODE_TYPES)[number];
export type NodeType = (typeof NODE_TYPES)[number];

export type CompatibilityLevel = "safe" | "conditional" | "static";

export interface StyleOverrides {
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: 300 | 400 | 500 | 600 | 700;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginBottom?: number;
  borderWidth?: number;
  borderStyle?: "none" | "solid" | "dashed" | "dotted";
  borderColor?: string;
  borderRadius?: number;
}

export interface BlockAttributes {
  blockId: string;
  sourceBlockId?: string;
  semanticRole?: string;
  styleRef?: string;
  styleOverrides?: StyleOverrides;
  locked: boolean;
  sourceTextHash?: string;
  compatibilityLevel?: CompatibilityLevel;
}

export interface TextNode {
  type: "text";
  text: string;
  marks?: DocumentMark[];
}

export interface HardBreakNode {
  type: "hardBreak";
}

export type InlineNode = TextNode | HardBreakNode;

export interface ParagraphAttributes extends BlockAttributes {
  indentMode?: "none" | "firstLine" | "hanging";
}

export interface ParagraphNode {
  type: "paragraph";
  attrs: ParagraphAttributes;
  content?: InlineNode[];
}

export interface HeadingAttributes extends BlockAttributes {
  level: 1 | 2 | 3;
  numbering?: string;
}

export interface HeadingNode {
  type: "heading";
  attrs: HeadingAttributes;
  content?: InlineNode[];
}

export interface BlockquoteAttributes extends BlockAttributes {
  quoteType?: "standard" | "citation" | "warning";
  source?: string;
  variant?: string;
  showQuotes?: boolean;
  showSource?: boolean;
}

export interface BlockquoteNode {
  type: "blockquote";
  attrs: BlockquoteAttributes;
  content: BlockquoteContentNode[];
}

export interface BulletListAttributes extends BlockAttributes {
  bulletStyle?: "disc" | "square" | "check" | "arrow" | "brand";
  indentLevel?: number;
}

export interface BulletListNode {
  type: "bulletList";
  attrs: BulletListAttributes;
  content: ListItemNode[];
}

export interface OrderedListAttributes extends BlockAttributes {
  start: number;
  numberingStyle?: "decimal" | "chinese" | "roman" | "legal";
  indentLevel?: number;
  preserveOriginalNumbering?: boolean;
}

export interface OrderedListNode {
  type: "orderedList";
  attrs: OrderedListAttributes;
  content: ListItemNode[];
}

export interface ListItemAttributes extends BlockAttributes {
  originalNumberText?: string;
}

export interface ListItemNode {
  type: "listItem";
  attrs: ListItemAttributes;
  content: ListItemContentNode[];
}

export interface ImageBlockAttributes extends BlockAttributes {
  resourceId: string;
  originalResourceId?: string;
  alt?: string;
  caption?: string;
  widthMode?: "full" | "percent" | "original";
  widthPercent?: number;
  aspectRatio?: string;
  objectFit?: "contain" | "cover" | "fill";
  watermarkId?: string;
}

export interface ImageBlockNode {
  type: "imageBlock";
  attrs: ImageBlockAttributes;
}

export interface DividerAttributes extends BlockAttributes {
  variant?: "solid" | "dashed" | "dotted" | "ornament";
  widthPercent?: number;
  align?: "left" | "center" | "right";
  icon?: string;
  spacingBefore?: number;
  spacingAfter?: number;
}

export interface DividerNode {
  type: "divider";
  attrs: DividerAttributes;
}

export interface SemanticCardAttributes extends BlockAttributes {
  componentId: string;
  componentVersion: string;
  variant?: string;
  eyebrow?: string;
  title?: string;
  footer?: string;
}

export interface SemanticCardNode {
  type: "semanticCard";
  attrs: SemanticCardAttributes;
  content?: SemanticCardContentNode[];
}

export interface BrandFooterAttributes extends BlockAttributes {
  accountId: string;
  templateId: string;
  mode: "linked" | "frozen";
  autoUpdate: boolean;
  frozenVersion?: string;
}

export interface BrandFooterNode {
  type: "brandFooter";
  attrs: BrandFooterAttributes;
  content?: BrandFooterContentNode[];
}

export interface SvgInteractionAttributes extends BlockAttributes {
  interactionId: string;
  templateId: string;
  templateVersion: string;
  interactionType: string;
  configuration: JsonObject;
  resourceIds: string[];
  fallbackResourceId: string;
}

export interface SvgInteractionNode {
  type: "svgInteraction";
  attrs: SvgInteractionAttributes;
}

export type BlockquoteContentNode = ParagraphNode | HeadingNode | BulletListNode | OrderedListNode;

export type ListItemContentNode = ParagraphNode | BulletListNode | OrderedListNode;

export type SemanticCardContentNode =
  | ParagraphNode
  | HeadingNode
  | BlockquoteNode
  | BulletListNode
  | OrderedListNode
  | ImageBlockNode
  | DividerNode;

export type BrandFooterContentNode = ParagraphNode | ImageBlockNode | DividerNode;

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BlockquoteNode
  | BulletListNode
  | OrderedListNode
  | ListItemNode
  | ImageBlockNode
  | DividerNode
  | SemanticCardNode
  | BrandFooterNode
  | SvgInteractionNode;

export interface DocNode {
  type: "doc";
  content: Exclude<BlockNode, ListItemNode>[];
}
