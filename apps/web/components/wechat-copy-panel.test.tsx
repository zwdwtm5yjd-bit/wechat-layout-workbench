// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCopyRecord, createWechatRender, getCopyPayload } from "../lib/copy/client";
import { writeWechatClipboard } from "../lib/copy/clipboard";
import { AppToastProvider } from "./ui/app-toast";
import { WechatCopyPanel } from "./wechat-copy-panel";

vi.mock("../lib/copy/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/copy/client")>();
  return {
    ...actual,
    createCopyRecord: vi.fn(),
    createWechatRender: vi.fn(),
    getCopyPayload: vi.fn(),
  };
});

vi.mock("../lib/copy/clipboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/copy/clipboard")>();
  return {
    ...actual,
    writeWechatClipboard: vi.fn(),
  };
});

const articleId = "0197a5ab-5b00-7000-8000-000000000001";
const renderOutput = {
  id: "0197a5ab-5b00-7000-8000-000000000002",
  snapshotId: "0197a5ab-5b00-7000-8000-000000000003",
  status: "ready" as const,
  outputMode: "standard" as const,
  rendererVersion: "1.0.0",
  compatibilityRuleVersion: "1.0.0",
  outputHash: `sha256:${"a".repeat(64)}`,
  canCopy: true,
  compatibilityReport: {
    canCopy: true,
    issues: [],
    ruleVersion: "1.0.0",
    score: 100,
    status: "passed" as const,
    summary: {
      critical: 0,
      suggestion: 0,
      total: 0,
      warning: 0,
    },
  },
  generatedAt: "2026-07-31T10:00:00.000Z",
  expiresAt: "2099-07-31T10:15:00.000Z",
};
const payload = {
  renderOutputId: renderOutput.id,
  html: "<section><p>正式正文</p></section>",
  plainText: "正式正文",
  expiresAt: "2099-07-31T10:15:00.000Z",
};

function renderPanel() {
  return render(
    <AppToastProvider>
      <WechatCopyPanel articleId={articleId} documentVersion={4} saveStatus="saved" />
    </AppToastProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(globalThis, "isSecureContext", {
    configurable: true,
    value: true,
  });
  vi.mocked(createWechatRender).mockResolvedValue(renderOutput);
  vi.mocked(getCopyPayload).mockResolvedValue(payload);
  vi.mocked(createCopyRecord).mockResolvedValue({
    id: "0197a5ab-5b00-7000-8000-000000000004",
    renderOutputId: renderOutput.id,
    status: "success",
    copiedAt: "2026-07-31T10:01:00.000Z",
  });
  vi.mocked(writeWechatClipboard).mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
});

describe("WechatCopyPanel", () => {
  it("requires a second explicit click before writing both formats", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "生成正式内容" }));
    expect(
      await screen.findByText("正式内容已生成。请再次点击“写入剪贴板”完成复制。"),
    ).not.toBeNull();
    expect(writeWechatClipboard).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "写入剪贴板" }));
    expect(writeWechatClipboard).toHaveBeenCalledWith(payload);
    expect(
      await screen.findByText(
        "内容已写入剪贴板。请粘贴到微信公众号后台，并完成标题、封面和最终预览。",
      ),
    ).not.toBeNull();
    expect(createCopyRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId,
        renderOutputId: renderOutput.id,
        status: "success",
      }),
    );
    const visibleToast = (await screen.findByRole("button", { name: "关闭通知" })).parentElement;
    expect(visibleToast).not.toBeNull();
    expect(visibleToast?.textContent).toContain("此操作不代表文章已发布");
  });

  it("shares the exact formal render result with the compatibility drawer", async () => {
    const user = userEvent.setup();
    const onRenderOutput = vi.fn();
    render(
      <AppToastProvider>
        <WechatCopyPanel
          articleId={articleId}
          documentVersion={4}
          onRenderOutput={onRenderOutput}
          saveStatus="saved"
        />
      </AppToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "生成正式内容" }));

    await waitFor(() => expect(onRenderOutput).toHaveBeenCalledWith(renderOutput));
  });

  it("opens a controlled manual-copy region when browser permission fails", async () => {
    vi.mocked(writeWechatClipboard).mockResolvedValue({
      ok: false,
      reason: "CLIPBOARD_WRITE_FAILED",
      detail: "NotAllowedError",
    });
    vi.mocked(createCopyRecord).mockResolvedValue({
      id: "0197a5ab-5b00-7000-8000-000000000005",
      renderOutputId: renderOutput.id,
      status: "failed",
      copiedAt: "2026-07-31T10:01:00.000Z",
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "生成正式内容" }));
    await screen.findByText(/正式内容已生成/);
    await user.click(screen.getByRole("button", { name: "写入剪贴板" }));

    expect(await screen.findByRole("textbox", { name: "手动复制内容" })).not.toBeNull();
    expect(screen.getByText("正式正文")).not.toBeNull();
    expect(createCopyRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        failureReason: "CLIPBOARD_WRITE_FAILED:NotAllowedError",
        status: "failed",
      }),
    );
  });

  it("shows block-locatable critical issues and never requests a payload", async () => {
    vi.mocked(createWechatRender).mockResolvedValue({
      ...renderOutput,
      status: "blocked",
      canCopy: false,
      compatibilityReport: {
        ...renderOutput.compatibilityReport,
        canCopy: false,
        score: 75,
        status: "failed",
        summary: {
          critical: 1,
          suggestion: 0,
          total: 1,
          warning: 0,
        },
        issues: [
          {
            issueId: "compat_image",
            blockId: "block_image",
            title: "图片资源缺失",
            message: "图片必须存在已发布地址",
            severity: "critical",
          },
        ],
      },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "生成正式内容" }));
    expect(await screen.findByText(/Block block_image/)).not.toBeNull();
    expect(getCopyPayload).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "写入剪贴板" }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
  });
});
