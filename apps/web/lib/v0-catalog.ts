export type ThemePreviewId = "editorial-minimal" | "modern-civic";

export interface ThemePreview {
  readonly category: string;
  readonly colors: readonly [string, string, string];
  readonly description: string;
  readonly id: ThemePreviewId;
  readonly name: string;
  readonly scenes: readonly string[];
}

export const V0_THEME_PREVIEWS: readonly ThemePreview[] = [
  {
    id: "editorial-minimal",
    name: "高级极简",
    category: "通用编辑",
    description: "强调留白、字阶与细线分隔，让长文保持安静、稳定的阅读节奏。",
    colors: ["#18181b", "#f5f5f4", "#4f46e5"],
    scenes: ["长文", "观点", "访谈"],
  },
  {
    id: "modern-civic",
    name: "现代政务红",
    category: "党政纪检",
    description: "以克制的深红作为信息锚点，适合正式通知、政策解读和纪检内容。",
    colors: ["#8f1d22", "#fff8f4", "#2f2525"],
    scenes: ["政务", "政策", "纪检"],
  },
] as const;

export type NativeComponentBlock = "blockquote" | "divider" | "heading1" | "heading2" | "paragraph";

export interface ComponentPreview {
  readonly blockType: NativeComponentBlock;
  readonly category: "分割线" | "引用" | "提示" | "标题";
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly tone: "accent" | "danger" | "neutral" | "warning";
}

export const V0_COMPONENT_PREVIEWS: readonly ComponentPreview[] = [
  {
    id: "heading-focus",
    name: "主章节标题",
    category: "标题",
    description: "适合文章主章节，建立清晰的一级阅读层级。",
    blockType: "heading1",
    tone: "accent",
  },
  {
    id: "heading-section",
    name: "小节标题",
    category: "标题",
    description: "适合连续内容中的二级分段，视觉重量更轻。",
    blockType: "heading2",
    tone: "neutral",
  },
  {
    id: "quote-focus",
    name: "重点引用",
    category: "引用",
    description: "突出原文中的关键判断，不改变引用文字。",
    blockType: "blockquote",
    tone: "accent",
  },
  {
    id: "quote-warning",
    name: "风险提示",
    category: "提示",
    description: "用于注意事项和风险信息，保留安全的静态降级。",
    blockType: "blockquote",
    tone: "warning",
  },
  {
    id: "paragraph-note",
    name: "补充说明",
    category: "提示",
    description: "插入一段轻量说明文字，适合定义和上下文补充。",
    blockType: "paragraph",
    tone: "neutral",
  },
  {
    id: "divider-clean",
    name: "留白分割",
    category: "分割线",
    description: "使用细线和留白分隔章节，兼容微信安全模式。",
    blockType: "divider",
    tone: "neutral",
  },
] as const;
