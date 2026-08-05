import { describe, expect, it } from "vitest";

import {
  clearThemeFilter,
  displayThemeCategory,
  summarizeThemeCategories,
  themeMatchesFilters,
  THEME_FILTER_ROWS,
} from "./taxonomy";

describe("theme taxonomy", () => {
  it("exposes material-derived use cases and holiday filters without duplicates", () => {
    expect(THEME_FILTER_ROWS.map((row) => row.axis)).toEqual([
      "用途",
      "行业",
      "节假",
      "风格",
      "色调",
    ]);
    expect(THEME_FILTER_ROWS.find((row) => row.axis === "用途")?.options).toEqual(
      expect.arrayContaining(["放假通知", "活动纪实", "党建宣传", "节气科普"]),
    );
    expect(THEME_FILTER_ROWS.find((row) => row.axis === "节假")?.options).toEqual(
      expect.arrayContaining(["二十四节气", "端午节", "中秋节", "重阳节"]),
    );

    for (const row of THEME_FILTER_ROWS) {
      expect(new Set(row.options).size).toBe(row.options.length);
    }
  });

  it("keeps compact card summaries while optionally surfacing a holiday", () => {
    const categories = ["用途:活动纪实", "用途:主题教育", "行业:校园", "风格:卡通", "节假:母亲节"];

    expect(displayThemeCategory("节假:母亲节")).toBe("母亲节");
    expect(summarizeThemeCategories(categories)).toBe("活动纪实 · 校园 · 卡通");
    expect(summarizeThemeCategories(categories, true)).toBe("活动纪实 · 校园 · 卡通 · 母亲节");
  });

  it("removes a cleared axis instead of matching an undefined category", () => {
    const categories = ["用途:党建宣传", "行业:政务", "节假:国庆节"];
    const selected = { 用途: "党建宣传", 节假: "中秋节" } as const;
    const cleared = clearThemeFilter(selected, "节假");

    expect(cleared).toEqual({ 用途: "党建宣传" });
    expect(themeMatchesFilters(categories, cleared)).toBe(true);
  });
});
