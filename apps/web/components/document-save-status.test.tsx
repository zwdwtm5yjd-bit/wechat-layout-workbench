// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentSaveStatus } from "./document-save-status";

afterEach(() => {
  cleanup();
});

describe("DocumentSaveStatus", () => {
  it.each([
    ["saved", "已保存"],
    ["saving", "正在保存…"],
    ["local_saved", "本地已保存"],
    ["error", "保存失败"],
    ["conflict", "存在版本冲突"],
  ] as const)("renders the %s label", (status, label) => {
    render(
      <DocumentSaveStatus
        snapshot={{
          status,
          documentVersion: 7,
          lastSavedAt: "2026-07-30T08:00:00.000Z",
          errorMessage: status === "error" ? "请求超时" : null,
          conflict:
            status === "conflict"
              ? {
                  submittedVersion: 6,
                  currentVersion: 7,
                }
              : null,
        }}
      />,
    );

    expect(screen.getAllByText(label)).toHaveLength(2);
  });

  it("explains that a conflict kept the local draft without overwriting remote content", () => {
    const { container } = render(
      <DocumentSaveStatus
        snapshot={{
          status: "conflict",
          documentVersion: 6,
          lastSavedAt: null,
          errorMessage: "文章已在其他标签页更新",
          conflict: {
            submittedVersion: 6,
            currentVersion: 7,
          },
        }}
      />,
    );

    const conflictDetail = [...container.querySelectorAll("p")].find((element) =>
      element.textContent.includes("本地基于版本 6"),
    );
    expect(conflictDetail?.textContent).toContain("远端版本 7");
    expect(conflictDetail?.textContent).toContain("本地草稿仍保留，未覆盖远端内容");
  });
});
