# `@wechat-layout/wechat-renderer`

从权威 `Document Schema V1` 生成微信公众号正文 HTML 的服务端渲染边界。

## 核心约束

- 只接收通过 `validateDocument` 的文档 JSON，不读取 Tiptap / ProseMirror 编辑器 DOM；
- Node Renderer 与内置 Component Renderer 均使用可冻结注册表，拒绝重复注册；
- 组件按 Manifest 中固化的 `componentId@version` 精确解析，再调用声明的内置
  `wechatRendererKey`；
- 默认注册 41 个官方组件 Renderer，覆盖标题、引用、提示、数据卡、图片、分割线与文末；
- HTML 从安全 AST 生成，不提供 Raw HTML 接口；标签、属性和 CSS 属性均按白名单序列化；
- 所有样式内联，不输出 `style`、`script`、表单、编辑器控件、Class 或事件属性；
- 图片与链接只接受不含凭据、不指向本机/私网的公网 HTTPS URL；
- 缺失或非法图片生成可读占位，缺失组件保留标题、正文和页脚；
- 输出携带 Renderer 版本、SHA-256、资源清单、组件精确版本清单和原文完整性哈希。
- Renderer Manifest 和兼容报告均绑定当前兼容规则版本。

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
  theme: officialTheme.tokens,
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

`theme` 接收完整 Theme Token 文档。正文、三级标题、引用、列表标记、图片与题注、数据卡、
分割线、文末以及根容器背景均从同一份解析结果取值；正式复制应传入文章已绑定的精确主题
版本，保证编辑器试穿、服务端预览和最终微信 HTML 使用相同资产。

## 兼容检查

`WechatCompatibilityEngine` 同时扫描 Document JSON 和最终 Renderer HTML：

```ts
import { WechatCompatibilityEngine } from "@wechat-layout/wechat-renderer";

const engine = new WechatCompatibilityEngine();
const { renderResult, report } = engine.check({
  document,
  mode: "standard",
  resources,
});

if (!report.canCopy) {
  console.log(report.issues);
}
```

报告包含：

- 0—100 兼容评分、`passed / warning / failed` 状态和严重度计数；
- 规则版本、Renderer 版本、Document/HTML 哈希；
- 确定性 Issue ID、规则 ID、分类、路径和 Block ID；
- 自动修复能力及正式复制是否允许。

严重问题会返回 `canCopy: false`。`previewFixes` 和 `previewHtmlFixes` 只生成深冻结修复预览，
不会直接修改权威文档；当前安全修复包括移除非法链接 Mark、约束超宽图片、删除危险标签和
事件属性、清理非法样式，以及展开未验证但可保留正文的 HTML 容器。

本包不负责兼容报告持久化、HTTP 接口、Clipboard API、微信素材上传或草稿同步。
