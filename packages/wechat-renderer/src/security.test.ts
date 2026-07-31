import { describe, expect, it } from "vitest";

import {
  htmlElement,
  serializeInlineStyles,
  serializeSafeHtml,
  sanitizeWechatUrl,
  type SafeHtmlElement,
  type WechatStyleMap,
} from "./index.js";

describe("微信输出安全边界", () => {
  it("只接受不含凭据的公网 HTTPS URL", () => {
    expect(sanitizeWechatUrl("https://cdn.example.com/assets/image.png#preview", "image")).toEqual({
      normalized: "https://cdn.example.com/assets/image.png",
      success: true,
    });
    expect(sanitizeWechatUrl("https://example.com/article#part", "link")).toEqual({
      normalized: "https://example.com/article#part",
      success: true,
    });

    for (const blocked of [
      "javascript:alert(1)",
      "http://example.com/plain",
      "https://user:secret@example.com/private",
      "https://localhost/file",
      "https://127.0.0.1/file",
      "https://10.0.0.8/file",
      "https://192.168.1.8/file",
      "https://[::1]/file",
      "https://service.local/file",
    ]) {
      expect(sanitizeWechatUrl(blocked, "link")).toMatchObject({
        success: false,
      });
    }
  });

  it("按模式序列化确定性的内联样式并移除危险值", () => {
    const style = {
      background: "#FFFFFF",
      "background-image": "linear-gradient(90deg,#FFFFFF,#F2F4F7)",
      "border-left": "4px solid #B42318",
      "box-shadow": "0 4px 16px rgba(16,24,40,0.10)",
      color: "#1D2939",
      position: "relative",
    } satisfies WechatStyleMap;

    expect(serializeInlineStyles(style, "standard")).toMatchInlineSnapshot(`
      {
        "css": "background:#FFFFFF;background-image:linear-gradient(90deg,#FFFFFF,#F2F4F7);border-left:4px solid #B42318;box-shadow:0 4px 16px rgba(16,24,40,0.10);color:#1D2939;position:relative;",
        "warnings": [],
      }
    `);
    expect(serializeInlineStyles(style, "wechat_safe")).toEqual({
      css: "border-left:4px solid #B42318;color:#1D2939;",
      warnings: [
        {
          message: "当前输出模式已移除高风险样式",
          property: "background",
        },
        {
          message: "当前输出模式已移除高风险样式",
          property: "background-image",
        },
        {
          message: "当前输出模式已移除高风险样式",
          property: "box-shadow",
        },
        {
          message: "当前输出模式已移除高风险样式",
          property: "position",
        },
      ],
    });

    const unsafe = {
      color: "red;position:fixed",
      position: "STICKY",
      unknown: "value",
    } as unknown as WechatStyleMap;
    expect(serializeInlineStyles(unsafe, "standard")).toEqual({
      css: "",
      warnings: [
        {
          message: "CSS 值不安全或格式不合法",
          property: "color",
        },
        {
          message: "当前输出模式已移除高风险样式",
          property: "position",
        },
        {
          message: "CSS 属性不在白名单中",
          property: "unknown",
        },
      ],
    });
  });

  it("从安全 AST 生成 HTML，转义文本并丢弃非白名单结构", () => {
    const unknownElement = {
      children: ["保留正文"],
      tag: "script",
    } as unknown as SafeHtmlElement;
    const result = serializeSafeHtml(
      [
        htmlElement("p", {
          children: ["<script>alert('x')</script>"],
          style: { color: "#1D2939" },
        }),
        unknownElement,
        htmlElement("a", {
          attributes: { href: "http://example.com" },
          children: ["不安全链接"],
        }),
      ],
      "standard",
    );

    expect(result.html).toBe(
      '<p style="color:#1D2939;">&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;</p>保留正文<a>不安全链接</a>',
    );
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("http://");
    expect(result.warnings).toHaveLength(2);
  });
});
