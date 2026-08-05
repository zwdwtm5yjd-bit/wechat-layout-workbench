# 微信公众号后台人工测试记录

> 对应任务：`S1-TEST-001`  
> 测试对象：V0.1 正式 Renderer 输出与双格式剪贴板  
> 当前状态：待具备真实 Safari、Edge 和微信公众号后台访问条件后执行

## 测试环境

| 项目 | 记录 |
| --- | --- |
| 测试日期 | 待填写 |
| 执行人 | 待填写 |
| 应用提交 | 待填写 |
| `runLabel` | 待填写 |
| 微信公众号 | 仅记录脱敏名称，不记录 AppSecret |
| macOS / Safari | 待填写 |
| Windows / Edge | 待填写 |
| Chrome | 待填写 |
| 微信后台版本 | 待填写 |
| 公网图片域名 | 仅记录域名，不记录签名参数 |

不得在本文档记录密码、Cookie、CSRF、对象存储密钥、签名 URL、上传 Header、公众号 AppSecret
或未脱敏后台截图。

## 测试样稿

必须逐一使用 `@wechat-layout/test-fixtures` 中的固定样稿：

1. 党政巡察文章：1 图；
2. 法律文章：0 图；
3. AI 科技文章：1 图；
4. 极端样稿：50 图。

## 验收数据准备

`acceptance:seed` 支持两种 scope。两者都通过正常 API 新建带 `runLabel` 的文章，不覆盖旧文章、
不修改密码、不写复制成功记录，也不发布内容；正常登录会更新登录时间、会话和审计。失败不会
自动回滚已经完成的资源或文章，应保留脱敏失败上下文并按 `runLabel` 查找部分结果。

### Safari 法律样稿

```bash
export ACCEPTANCE_OWNER_EMAIL="<现有 active Owner 邮箱>"
read -s "ACCEPTANCE_OWNER_PASSWORD?Owner password: "
export ACCEPTANCE_OWNER_PASSWORD
ACCEPTANCE_SCOPE=safari pnpm acceptance:seed
unset ACCEPTANCE_OWNER_PASSWORD
```

预期：1 篇法律文章、0 图、高级极简与现代政务红、2 次主题应用、4 个 Renderer/Copy Payload
输出、6 个自动快照、0 条 Copy Record、0 次发布。

### 微信四篇含图样稿

API 与 seed 必须使用同一个公网 HTTPS `S3_PUBLIC_ENDPOINT`。本仓库 Docker Compose 支持宿主
变量覆盖；如果使用本地 Compose，应先用该配置重建或重启 API：

```bash
export S3_PUBLIC_ENDPOINT="https://<公网对象存储地址>"
pnpm docker:dev

export ACCEPTANCE_OWNER_EMAIL="<现有 active Owner 邮箱>"
read -s "ACCEPTANCE_OWNER_PASSWORD?Owner password: "
export ACCEPTANCE_OWNER_PASSWORD
ACCEPTANCE_SCOPE=wechat pnpm acceptance:seed
unset ACCEPTANCE_OWNER_PASSWORD
```

远程 API / Web 可另设 `ACCEPTANCE_API_BASE_URL`、`ACCEPTANCE_WEB_BASE_URL`；远程地址只允许
HTTPS。成功输出必须满足：

```text
resources.total = 52
resources.uploaded + resources.deduplicated = 52
articles = 4
themeApplications = 8
renderOutputs = 16
publicImageObjectsVerified = 52
copyRecordWritten = false
published = false
```

52 张 PNG 的摘要跨运行稳定且全部不同；首次通常上传 52 张，复跑通常全部去重，失败后复跑
可能混合。每次执行仍会新建四篇文章。脚本会从当前执行机实际读取 52 个 Payload 图片对象，
但这不证明微信服务器可访问，仍须完成后台粘贴和手机预览。Copy Payload 有效期为 15 分钟，
应在 seed 完成后尽快测试。

## Seed 结果记录

| 指标 | 预期 | 实际 |
| --- | ---: | ---: |
| 资源总数 | 52 | 待填写 |
| 本次 uploaded | 0–52 | 待填写 |
| 本次 deduplicated | 0–52 | 待填写 |
| uploaded + deduplicated | 52 | 待填写 |
| 文章 | 4 | 待填写 |
| 主题应用 | 8 | 待填写 |
| Render / Payload | 16 | 待填写 |
| 实际可读公网图片对象 | 52 | 待填写 |
| 自动快照 | 24 | 待填写 |
| Seed 写入 Copy Record | 0 | 待填写 |
| Seed 发布 | 0 | 待填写 |

| 样稿 | 图片数 | Article ID | `editorUrl` |
| --- | ---: | --- | --- |
| 党政巡察 | 1 | 待填写 | 待填写 |
| 法律 | 0 | 待填写 | 待填写 |
| AI 科技 | 1 | 待填写 | 待填写 |
| 极端 | 50 | 待填写 | 待填写 |

## 16 个正式输出与人工结果

在“输出 ID / 快照 ID”栏只记录 UUID，不粘贴 Payload HTML 或签名 URL。Chrome、Safari、Edge
栏填写“通过 / 失败 / 未执行”，失败详情进入缺陷记录。

| 样稿 | 主题 | 模式 | 图片 | 输出 ID / 快照 ID | Chrome | Safari | Edge |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| 党政巡察 | 高级极简 | standard | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| 党政巡察 | 高级极简 | wechat_safe | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| 党政巡察 | 现代政务红 | standard | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| 党政巡察 | 现代政务红 | wechat_safe | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| 法律 | 高级极简 | standard | 0 | 待填写 | 未执行 | 未执行 | 未执行 |
| 法律 | 高级极简 | wechat_safe | 0 | 待填写 | 未执行 | 未执行 | 未执行 |
| 法律 | 现代政务红 | standard | 0 | 待填写 | 未执行 | 未执行 | 未执行 |
| 法律 | 现代政务红 | wechat_safe | 0 | 待填写 | 未执行 | 未执行 | 未执行 |
| AI 科技 | 高级极简 | standard | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| AI 科技 | 高级极简 | wechat_safe | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| AI 科技 | 现代政务红 | standard | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| AI 科技 | 现代政务红 | wechat_safe | 1 | 待填写 | 未执行 | 未执行 | 未执行 |
| 极端 | 高级极简 | standard | 50 | 待填写 | 未执行 | 未执行 | 未执行 |
| 极端 | 高级极简 | wechat_safe | 50 | 待填写 | 未执行 | 未执行 | 未执行 |
| 极端 | 现代政务红 | standard | 50 | 待填写 | 未执行 | 未执行 | 未执行 |
| 极端 | 现代政务红 | wechat_safe | 50 | 待填写 | 未执行 | 未执行 | 未执行 |

每个浏览器至少逐篇完成以下操作：

| 步骤 | Chrome | Safari | Edge | 证据或备注 |
| --- | --- | --- | --- | --- |
| 打开 seed 输出的文章并生成正式内容 | 待执行 | 待执行 | 待执行 | 记录 Renderer 与规则版本 |
| 点击“写入剪贴板” | 待执行 | 待执行 | 待执行 | 记录成功或手动复制兜底 |
| 粘贴到微信公众号后台 | 待执行 | 待执行 | 待执行 | 不保存敏感内容 |
| 标题、正文、列表和引用正常 | 待执行 | 待执行 | 待执行 | 截图必须脱敏 |
| 图片数量、尺寸与顺序正常 | 待执行 | 待执行 | 待执行 | 极端样稿必须检查 50 图 |
| 手机预览无横向溢出 | 待执行 | 待执行 | 待执行 | 记录异常 Block ID |
| 微信后台保存草稿 | 待执行 | 待执行 | 待执行 | 不执行自动发布 |

## 判定标准

- 四篇样稿均可粘贴、保存草稿并进入微信后台手机预览；
- 原文没有缺字、改字或乱序；
- 1 / 0 / 1 / 50 张图片的数量、顺序、尺寸和可访问性正确；
- 不包含脚本、编辑器类名、`contenteditable` 或危险链接；
- 严重兼容问题必须在复制前阻断；
- Safari 无法写入富文本剪贴板时，手动复制兜底必须可用；
- 只有浏览器真实点击复制成功后才允许写 Copy Record；seed 结果不得冒充剪贴板成功；
- “复制成功”只表示写入系统剪贴板，不得声称已经发布；
- seed 的 Endpoint 和对象 GET 验证不得代替微信服务器抓图与公众号后台人工结果。

## 缺陷记录

| 编号 | 样稿 | 浏览器 | 严重度 | 问题 | Block ID | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 尚未执行人工测试 | — | 待执行 |
