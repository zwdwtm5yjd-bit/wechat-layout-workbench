# Python DOCX Worker

将 Word/WPS 保存的 `.docx` 安全解析为 `DOCX Intermediate v1`，作为后续角色识别、Tiptap 文档构建和图片资源入库的稳定边界。

## 命令行

```bash
PYTHONPATH=services/docx-worker-python/src \
  python3 -m docx_worker article.docx \
  --extract-dir /tmp/docx-images \
  --retain-original-dir /tmp/docx-original \
  --pretty
```

成功时 stdout 输出 `{"success":true,"data":...}`；可预期失败时 stderr 输出带稳定 `error.code` 的 JSON，进程返回码为 `2`。

## 中间结构

[`contracts/docx-intermediate-v1.schema.json`](contracts/docx-intermediate-v1.schema.json) 是权威约定。顶层固定包含：

- `sourceBlocks`：按文档顺序编号的标题、段落、列表、图片引用和表格块；
- `resources`：去重后的内嵌图片清单，含摘要、MIME、OOXML 路径和首次出现位置；
- `tables`：保留行列中间结构和合并单元格标记；
- `warnings`：非致命的兼容性降级；
- `original`：原文件的文件名、大小、SHA-256 和留存位置。

`sourceBlockId` 由顺序、块类型和内容摘要稳定生成；同一份文档重试解析会得到相同 ID。

### Source Block 映射

| OOXML 输入                  | `sourceType`            | `role`            | 关键元数据                                 |
| --------------------------- | ----------------------- | ----------------- | ------------------------------------------ |
| Title / Subtitle 段落样式   | `title` / `subtitle`    | 同左              | `paragraphStyleId`、`inlineContent`        |
| Heading 1–9 或 `outlineLvl` | `heading_1`–`heading_3` | 同左，4–9 降到 3  | 原段落样式                                 |
| `numPr` 项目符号            | `bullet_item`           | `bullet_item`     | 级别、编号 ID、原编号文本                  |
| `numPr` 有序编号            | `ordered_item`          | `ordered_item`    | 级别、起始值、原编号文本                   |
| 普通段落                    | `paragraph`             | `paragraph`       | 受控行内 marks 和安全链接                  |
| Drawing / VML 图片出现位置  | `image`                 | `image_reference` | `resourceKey`、关系 ID、替代文本           |
| 表格                        | `table`                 | `paragraph`       | `tableId`、展平单元格；行列保存于 `tables` |

`DOCX Intermediate v1` 与上表由本 Worker 单一负责。v1 只允许不破坏现有消费者的
修正；任何字段删除、语义变更或枚举收紧都必须新建 schema 版本，并同步更新 Node
Worker 边界校验与回归样本。

## 安全边界

解析器在读取正文前检查 ZIP 路径、重复成员、加密成员、符号链接、解压体积、压缩比、文件数、宏、ActiveX、OLE 嵌入对象和 XML DTD/实体。只接受标准 `.docx`，不接受 `.docm`。

Worker 容器中的 Node 进程会对 Python stdout 设置 64MB 上限和 2 分钟超时，再次校验
schema 版本、Source Block 顺序/摘要、图片路径/摘要和统计一致性。原始 DOCX 作为私有
`document` 资源保留，不通过公网静态路由暴露。
