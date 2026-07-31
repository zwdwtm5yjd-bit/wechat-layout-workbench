// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { selectManualCopyContent, writeWechatClipboard, type ClipboardRuntime } from "./clipboard";

class TestClipboardItem {
  static supports(type: string): boolean {
    return type === "text/html";
  }

  constructor(readonly items: Readonly<Record<string, Blob>>) {}
}

function runtime(overrides: Partial<ClipboardRuntime> = {}): ClipboardRuntime {
  return {
    ClipboardItem: TestClipboardItem as unknown as ClipboardRuntime["ClipboardItem"],
    isSecureContext: true,
    userActivationActive: true,
    write: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("writeWechatClipboard", () => {
  it("writes HTML and plain text in one ClipboardItem", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await writeWechatClipboard(
      {
        html: "<section><p>正式内容</p></section>",
        plainText: "正式内容",
      },
      runtime({ write }),
    );

    expect(result).toEqual({ ok: true });
    expect(write).toHaveBeenCalledOnce();
    const item = write.mock.calls[0]?.[0]?.[0] as TestClipboardItem;
    expect(Object.keys(item.items).sort()).toEqual(["text/html", "text/plain"]);
    expect(item.items["text/html"]?.type).toBe("text/html;charset=utf-8");
    expect(item.items["text/plain"]?.type).toBe("text/plain;charset=utf-8");
  });

  it.each([
    ["INSECURE_CONTEXT", { isSecureContext: false }],
    ["USER_ACTIVATION_REQUIRED", { userActivationActive: false }],
    ["CLIPBOARD_API_UNAVAILABLE", { ClipboardItem: undefined }],
    ["CLIPBOARD_API_UNAVAILABLE", { write: undefined }],
  ] as const)("returns %s before attempting a write", async (reason, overrides) => {
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await writeWechatClipboard(
      { html: "<p>正文</p>", plainText: "正文" },
      runtime({ write, ...overrides }),
    );

    expect(result).toEqual({ ok: false, reason });
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps a stable failure reason when the browser rejects permission", async () => {
    const result = await writeWechatClipboard(
      { html: "<p>正文</p>", plainText: "正文" },
      runtime({
        write: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      }),
    );

    expect(result).toEqual({
      ok: false,
      reason: "CLIPBOARD_WRITE_FAILED",
      detail: "NotAllowedError",
    });
  });
});

describe("selectManualCopyContent", () => {
  it("selects the complete controlled fallback region", () => {
    const element = document.createElement("div");
    element.tabIndex = 0;
    element.innerHTML = "<p>手动复制正文</p>";
    document.body.append(element);

    expect(selectManualCopyContent(element)).toBe(true);
    expect(globalThis.getSelection()?.rangeCount).toBe(1);
    expect(globalThis.getSelection()?.getRangeAt(0).commonAncestorContainer).toBe(element);
    expect(document.activeElement).toBe(element);
    element.remove();
  });
});
