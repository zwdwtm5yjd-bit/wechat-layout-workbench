// @vitest-environment jsdom

import type {
  AiLayoutCandidateProfileId,
  AiLayoutTemplateCatalogCategoryId,
  AiLayoutTemplateSummary,
} from "@wechat-layout/api-contracts";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiTemplateLibrary } from "./ai-template-library";

const categories = [
  ["official-report", "政务报告"],
  ["data-business", "数据商业"],
  ["knowledge-guide", "知识指南"],
  ["story-people", "人物故事"],
  ["brand-event", "品牌活动"],
] as const satisfies readonly (readonly [AiLayoutTemplateCatalogCategoryId, string])[];

const profiles = [
  "editorial-index",
  "briefing-cards",
  "evidence-led",
  "minimal-longread",
  "documentary-visual",
  "action-roadmap",
] as const satisfies readonly AiLayoutCandidateProfileId[];

function template(index: number): AiLayoutTemplateSummary {
  const [catalogCategoryId, categoryLabel] = categories[index % categories.length]!;
  return {
    catalogCategoryId,
    categoryLabel,
    contentClasses: catalogCategoryId === "official-report" ? ["government"] : ["narrative"],
    defaultLanguageId:
      catalogCategoryId === "official-report" ? "crimson-editorial" : "minimal-blue",
    description: index === 17 ? "独有搜索词 专项复盘" : `模板 ${String(index)} 的安全描述`,
    imagePolicy: "optional",
    minimumSourceImages: index % 4 === 0 ? 2 : 0,
    name: `AI 模板 ${String(index + 1)}`,
    preferredLanguageIds: [
      catalogCategoryId === "official-report" ? "crimson-editorial" : "minimal-blue",
    ],
    previewKey: `preview-${String(index % 10)}`,
    profileId: profiles[index % profiles.length]!,
    rhythm: index % 2 === 0 ? "balanced" : "airy",
    sourceImageFallback: "text-first",
    strategyId: [
      "editorial-index",
      "briefing-cards",
      "evidence-led",
      "minimal-longread",
      "documentary-visual",
      "action-roadmap",
      "timeline-milestones",
      "quote-led",
      "chapter-magazine",
      "checklist-guide",
    ][index % 10] as AiLayoutTemplateSummary["strategyId"],
    structureLabel: `结构 ${String((index % 10) + 1)}`,
    tags: index === 17 ? ["独有搜索词", "复盘"] : ["长文", categoryLabel],
    templateId: `template-${String(index + 1)}`,
    version: 1,
    visualIntensity: index % 3 === 0 ? "bold" : "restrained",
  };
}

const templates = Array.from({ length: 50 }, (_, index) => template(index));

afterEach(cleanup);

describe("AiTemplateLibrary", () => {
  it("shows six recommendations first and mounts only twelve cards when browsing all", () => {
    const { container } = render(
      <AiTemplateLibrary
        onSelectTemplate={vi.fn()}
        selectedTemplateId={null}
        templates={templates}
      />,
    );

    expect(screen.getAllByTestId("ai-template-card")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "浏览全部 50 套" }));
    expect(screen.getAllByTestId("ai-template-card")).toHaveLength(12);
    expect(
      new Set(
        [...container.querySelectorAll("[data-preview-variant]")].map((node) =>
          node.getAttribute("data-preview-variant"),
        ),
      ).size,
    ).toBe(10);
    expect(screen.getByRole("status").textContent).toContain("找到 50 套模板");
    expect(screen.getByRole("button", { name: "下一页模板" })).toBeTruthy();
  });

  it("searches and intersects an explicit five-category filter", () => {
    render(
      <AiTemplateLibrary
        onSelectTemplate={vi.fn()}
        selectedTemplateId={null}
        templates={templates}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "浏览全部 50 套" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索 AI 模板" }), {
      target: { value: "独有搜索词" },
    });

    expect(screen.getAllByTestId("ai-template-card")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "选择模板 AI 模板 18" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /政务报告/u }));
    expect(screen.getByText("没有匹配的模板")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getAllByTestId("ai-template-card")).toHaveLength(12);
  });

  it("supports controlled selection, favorites and recent-only browsing", () => {
    const select = vi.fn();
    const toggleFavorite = vi.fn();
    render(
      <AiTemplateLibrary
        favoriteTemplateIds={["template-2"]}
        onSelectTemplate={select}
        onToggleFavorite={toggleFavorite}
        recentTemplateIds={["template-7", "template-3"]}
        selectedTemplateId="template-1"
        templates={templates}
      />,
    );

    const selected = screen.getByRole("radio", { name: "选择模板 AI 模板 1" });
    expect(selected.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /由 AI 自动匹配/u }));
    expect(select).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole("radio", { name: "选择模板 AI 模板 2" }));
    expect(select).toHaveBeenCalledWith("template-2");
    fireEvent.click(screen.getByRole("button", { name: "取消收藏AI 模板 2" }));
    expect(toggleFavorite).toHaveBeenCalledWith("template-2");

    fireEvent.click(screen.getByRole("button", { name: "浏览全部 50 套" }));
    fireEvent.click(screen.getByRole("button", { name: "最近 2" }));
    const recentCards = screen.getAllByTestId("ai-template-card");
    expect(recentCards).toHaveLength(2);
    expect(within(recentCards[0]!).getByText("AI 模板 7")).toBeTruthy();
  });

  it("provides responsive card columns, large touch targets and truthful loading/error states", () => {
    const { rerender } = render(
      <AiTemplateLibrary
        loading
        onSelectTemplate={vi.fn()}
        selectedTemplateId={null}
        templates={templates}
      />,
    );
    expect(screen.getByRole("status", { name: "" }).textContent).toContain("正在读取 AI 模板");

    rerender(
      <AiTemplateLibrary
        errorMessage="模板服务暂时不可用"
        onSelectTemplate={vi.fn()}
        selectedTemplateId={null}
        templates={templates}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("模板服务暂时不可用");

    rerender(
      <AiTemplateLibrary
        onSelectTemplate={vi.fn()}
        selectedTemplateId={null}
        templates={templates}
      />,
    );
    const grid = screen.getByRole("radiogroup", { name: "可选 AI 模板" });
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("min-[420px]:grid-cols-2");
    expect(screen.getByRole("button", { name: "收藏AI 模板 1" }).className).toContain("size-11");
  });
});
