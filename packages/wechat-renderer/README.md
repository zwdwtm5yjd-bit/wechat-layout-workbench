# `@wechat-layout/wechat-renderer`

从权威 `Document Schema V1` 生成微信公众号正文 HTML 的服务端渲染边界。

## 核心约束

- 只接收通过 `validateDocument` 的文档 JSON，不读取 Tiptap / ProseMirror 编辑器 DOM；
- Node Renderer 与内置 Component Renderer 均使用可冻结注册表，拒绝重复注册；
- 组件按 Manifest 中固化的 `componentId@version` 精确解析，再调用声明的内置
  `wechatRendererKey`；
- HTML 从安全 AST 生成，不提供 Raw HTML 接口；标签、属性和 CSS 属性均按白名单序列化；
- 所有样式内联，不输出 `style`、`script`、表单、编辑器控件、Class 或事件属性；
- 图片与链接只接受不含凭据、不指向本机/私网的公网 HTTPS URL；
- 缺失或非法图片生成可读占位，缺失组件保留标题、正文和页脚；
- 输出携带 Renderer 版本、SHA-256、资源清单、组件精确版本清单和原文完整性哈希。

## 输出模式

- `standard`：保留已进入受控 Token 的标准视觉样式；
- `wechat_safe`：移除复杂背景和阴影，将高风险定位降级；
- `static`：继承安全模式，并将互动内容转换为静态备用图。

当前 SVG 安全执行引擎尚未接入，因此三种模式都会使用 `fallbackResourceId`；标准模式会返回
明确的降级提示。SVG 协议和动态执行属于后续任务。

## 使用

```ts
import { renderWechatHtml } from "@wechat-layout/wechat-renderer";

const result = renderWechatHtml({
  document,
  mode: "wechat_safe",
  resources: {
    resource_cover: {
      alt: "文章封面",
      url: "https://cdn.example.com/article/cover.png",
    },
  },
});

console.log(result.html);
console.log(result.outputHash);
console.log(result.textIntegrity.unchanged);
```

调用方若要避免渲染错版本，可把上次确认的 `sourceTextHash` 传入
`expectedSourceTextHash`。无效文档、Token 或原文哈希不匹配时，`tryRender` 返回结构化问题，
`render` 抛出 `WechatRenderError`。

本包不负责兼容评分、问题自动修复、Clipboard API、微信素材上传或草稿同步。
