# `@wechat-layout/component-registry`

组件 Manifest、Slot、版本和 Renderer Key 的唯一注册与查询边界。

## 核心约束

- `componentId@version` 是不可变精确引用；同一 ID 和版本不能用不同内容覆盖；
- 多版本并存，未指定版本时只为新插入解析最新可用版本，实例会保存精确版本；
- Manifest 只接受声明式白名单字段，Renderer 只保存应用内置 Key，不接收远程脚本或任意
  HTML/CSS；
- Slot 在插入前检查必填、类型、长度、未知字段和 Variant；
- 编辑器和微信 Renderer 从同一个 Manifest 获得各自 Renderer Key；
- 缺失、未安装或停用的组件返回安全占位，并保留可提取的原始文字；
- 收藏字段目前是明确的不可用占位，不在本任务中持久化用户偏好。

## 示例

```ts
const registry = new ComponentRegistry();
registry.register(manifest);

const cards = registry.query({ category: "CARD" });
const insertion = registry.prepareInsertion({
  componentId: "cmp_card_summary_default_001",
  slots: { title: "摘要", body: "正文" },
});
```

远程组件包下载、签名、审核、迁移执行和组件商城属于后续任务。
