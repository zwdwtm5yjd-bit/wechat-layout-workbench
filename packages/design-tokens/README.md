# `@wechat-layout/design-tokens`

公众号文章主题 Token 的唯一解析边界。

## Token Schema

当前版本为 `1.0.0`，由 `TOKEN_SCHEMA_VERSION` 固定。主题文档允许覆盖以下受控分组：

- `colors`
- `typography`
- `spacing`
- `radius`
- `border`
- `shadow`
- `image`
- `motion`
- `compatibility`
- `components`

未知分组、未知属性、任意 CSS、URL 背景、越界数字、非法引用和不支持的 Schema 版本会被
拒绝。Token 引用使用 `{group.name}`，引用目标必须是全局标量 Token；组件对象不能成为
引用目标。

## 优先级

`TokenEngine` 按以下顺序解析，后者覆盖前者：

```text
系统安全默认值
< 主题 Token
< 公众号品牌 Token 占位
< 组件 Token
< 文章级覆盖
< 节点局部覆盖
< 行内覆盖
< 微信安全模式强制降级
```

品牌占位当前只能覆盖允许品牌化的颜色，并携带资源与默认引用；不会修改间距、结构或
兼容参数。品牌数据库接入属于后续任务。

## 使用

```ts
import { TOKEN_SCHEMA_VERSION, TokenEngine } from "@wechat-layout/design-tokens";

const engine = new TokenEngine();
const result = engine.resolve({
  theme: {
    schemaVersion: TOKEN_SCHEMA_VERSION,
    colors: {
      primary: "#B42318",
    },
    components: {
      "heading.level1": {
        color: "{colors.primary}",
        fontSize: 22,
        variant: "leftBar",
      },
    },
  },
  component: {
    ref: "heading.level1",
  },
  node: {
    marginBottom: 24,
  },
  mode: "wechat_safe",
});
```

`resolve` 在校验失败时抛出 `TokenValidationError`；`tryResolve` 返回可判别联合类型。
成功结果经过键排序和深冻结，相同输入由有界 LRU 缓存返回同一结果对象。

## 官方主题包

本包内置两套发布状态的不可变 `1.0.0` 主题：

- `高级极简`：默认通用长文主题，强调留白、字阶和细线；
- `现代政务红`：面向政务、巡察和国企内容的深红米金主题。

每套主题都固化 Manifest、Token、组件引用、配色版本、预览文案、兼容能力、Renderer 最低
版本、迁移策略和 Changelog。通过 `listOfficialThemes` 查询目录，使用 `getOfficialTheme` 获取
指定主题或精确版本，使用 `getOfficialThemeVersions` 列出不可变版本。调用方不得原地修改返回
资产；所有官方包均已深冻结。

## 安全模式

`wechat_safe` 在所有普通优先级之后执行，强制：

- 移除复杂背景；
- 阴影降级为 `none`；
- 字体降级为微信系统字体栈；
- 多列降级为单列；
- 定位降级为 `static`；
- 最大嵌套深度限制为 3；
- 关闭自定义字体、复杂背景、阴影和高风险布局能力。

本包不负责主题应用事务、编辑器 UI、数据库品牌接入或微信 HTML Renderer。
