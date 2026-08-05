export const THEME_FILTER_ROWS = [
  {
    axis: "用途",
    options: [
      "公司宣传",
      "总结报告",
      "活动推广",
      "活动纪实",
      "放假通知",
      "温馨提示",
      "安全提醒",
      "主题教育",
      "党建宣传",
      "党日活动",
      "会议报道",
      "节气科普",
      "节气食育",
      "节日祝福",
      "人物介绍",
      "产品推介",
      "图集",
      "散文随笔",
      "促销宣传",
    ],
  },
  { axis: "行业", options: ["企业", "政务", "校园", "科技", "餐饮", "旅游", "媒体", "文化"] },
  {
    axis: "节假",
    options: [
      "二十四节气",
      "春节",
      "元旦",
      "除夕",
      "小年",
      "清明节",
      "劳动节",
      "母亲节",
      "端午节",
      "中秋节",
      "国庆节",
      "重阳节",
      "腊八节",
      "开学季",
      "暑假",
    ],
  },
  { axis: "风格", options: ["简洁", "商务", "杂志", "卡通", "手绘", "喜庆", "中国风"] },
  { axis: "色调", options: ["红", "黑", "黄", "绿", "蓝", "青", "橙"] },
] as const;

export type ThemeFilterAxis = (typeof THEME_FILTER_ROWS)[number]["axis"];
export type ThemeFilters = Partial<Record<ThemeFilterAxis, string>>;

const SUMMARY_AXES = ["用途", "行业", "风格"] as const;

export function displayThemeCategory(category: string): string {
  return category.includes(":") ? (category.split(":").at(-1) ?? category) : category;
}

export function clearThemeFilter(filters: ThemeFilters, axis: ThemeFilterAxis): ThemeFilters {
  const next = { ...filters };
  delete next[axis];
  return next;
}

export function themeMatchesFilters(categories: readonly string[], filters: ThemeFilters): boolean {
  return Object.entries(filters).every(
    ([axis, value]) => value === undefined || categories.includes(`${axis}:${value}`),
  );
}

export function summarizeThemeCategories(
  categories: readonly string[],
  includeHoliday = false,
): string {
  const axes: readonly string[] = includeHoliday ? [...SUMMARY_AXES, "节假"] : SUMMARY_AXES;
  return axes
    .map((axis) => categories.find((category) => category.startsWith(`${axis}:`)))
    .filter((category): category is string => category !== undefined)
    .map(displayThemeCategory)
    .join(" · ");
}
