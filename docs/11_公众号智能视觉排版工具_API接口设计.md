# 11_公众号智能视觉排版工具_API接口设计

> 文档版本：V1.0  
> 编制日期：2026年7月29日  
> 项目阶段：后端API详细设计  
> API风格：REST＋Server-Sent Events  
> API前缀：`/api/v1`  
> 上游依据：  
> - `00_公众号智能视觉排版工具_项目需求说明书.md`  
> - `01_公众号智能视觉排版工具_竞品分析与产品差异化设计.md`  
> - `02_公众号智能视觉排版工具_信息架构与页面清单.md`  
> - `03_公众号智能视觉排版工具_核心业务流程设计.md`  
> - `04_公众号智能视觉排版工具_编辑器与区块模型设计.md`  
> - `05_公众号智能视觉排版工具_主题系统与组件规范.md`  
> - `06_公众号智能视觉排版工具_SVG互动组件技术规范.md`  
> - `07_公众号智能视觉排版工具_多公众号品牌系统设计.md`  
> - `08_公众号智能视觉排版工具_素材更新与版本管理设计.md`  
> - `09_公众号智能视觉排版工具_系统架构设计.md`  
> - `10_公众号智能视觉排版工具_数据库字段详细设计.md`  
> 文档用途：供前后端联调、OpenAPI生成、自动化测试、Claude/Codex编码和后续浏览器扩展使用。

---

# 一、API设计目标

本系统API需要满足：

1. 支持单用户私有部署，同时预留多角色；
2. 编辑器文档使用乐观锁，避免多标签页覆盖；
3. 导入、渲染、图片处理和同步使用异步任务；
4. 所有大型操作可追踪、可重试、可取消；
5. 所有写操作可审计；
6. 对微信接口、对象存储和素材仓库采用适配器；
7. 远程素材包不直接进入浏览器安装；
8. API可通过OpenAPI生成前端类型和测试客户端；
9. 错误信息必须对用户可理解，对开发可追踪；
10. 幂等、限流、安全和版本兼容从首版纳入。

---

# 二、基础约定

# 2.1 Base URL

开发环境：

```text
http://localhost:3001/api/v1
```

生产环境：

```text
https://example.com/api/v1
```

# 2.2 Content-Type

JSON接口统一：

```http
Content-Type: application/json
Accept: application/json
```

文件上传使用：

```http
multipart/form-data
```

SSE使用：

```http
Accept: text/event-stream
```

# 2.3 字符编码

统一UTF-8。

# 2.4 时间格式

所有时间返回ISO 8601：

```text
2026-07-29T15:49:00+08:00
```

数据库保存UTC，接口可统一返回UTC或带用户时区；建议返回ISO时间并同时在客户端按时区显示。

# 2.5 ID格式

所有业务ID使用UUIDv7。

示例：

```text
01985b2f-7abc-7def-8123-123456789abc
```

# 2.6 版本号

主题、组件、SVG、品牌和素材包版本均使用语义化版本：

```text
1.2.0
```

# 2.7 API版本

首版：

```text
/api/v1
```

不兼容变更进入：

```text
/api/v2
```

同一大版本内尽量保持向后兼容。

---

# 三、通用响应格式

# 3.1 成功响应

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_01JXYZ",
    "timestamp": "2026-07-29T15:49:00+08:00"
  }
}
```

# 3.2 分页响应

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 136,
      "totalPages": 7
    }
  },
  "meta": {
    "requestId": "req_01JXYZ"
  }
}
```

# 3.3 游标分页

对日志、任务事件和文章活动流建议使用游标：

```json
{
  "success": true,
  "data": {
    "items": [],
    "nextCursor": "cursor_xxx",
    "hasMore": true
  }
}
```

# 3.4 失败响应

```json
{
  "success": false,
  "error": {
    "code": "ARTICLE_VERSION_CONFLICT",
    "message": "文章已在其他标签页更新",
    "details": {
      "currentVersion": 15,
      "submittedVersion": 14
    },
    "retryable": false
  },
  "meta": {
    "requestId": "req_01JXYZ",
    "traceId": "trace_01JXYZ"
  }
}
```

# 3.5 校验错误

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "提交内容存在错误",
    "details": {
      "fields": [
        {
          "path": "title",
          "message": "标题不能为空"
        }
      ]
    },
    "retryable": false
  }
}
```

---

# 四、HTTP状态码

| 状态码 | 用途 |
|---|---|
| 200 | 查询、更新成功 |
| 201 | 创建成功 |
| 202 | 异步任务已接受 |
| 204 | 删除、撤销成功且无返回 |
| 304 | ETag内容未变化 |
| 400 | 参数错误 |
| 401 | 未登录或会话失效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 版本冲突、状态冲突、重复资源 |
| 410 | 资源已撤销或永久失效 |
| 413 | 文件或请求体过大 |
| 415 | 不支持的文件类型 |
| 422 | 业务规则无法处理 |
| 423 | 资源被锁定 |
| 429 | 访问频率过高 |
| 500 | 服务端异常 |
| 502 | 外部服务异常 |
| 503 | 服务暂不可用 |
| 504 | 外部服务超时 |

---

# 五、鉴权与会话

# 5.1 会话机制

首版采用：

```text
HttpOnly Secure Session Cookie
+ CSRF Token
```

Cookie示例：

```text
session_id=随机值
```

客户端不得把长期访问Token存入LocalStorage。

# 5.2 CSRF

所有状态变更请求必须携带：

```http
X-CSRF-Token: token
```

登录接口和CSRF获取接口除外。

# 5.3 认证接口

## 登录

```http
POST /api/v1/auth/login
```

请求：

```json
{
  "email": "owner@example.com",
  "password": "********",
  "rememberDevice": true
}
```

响应：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "displayName": "Owner",
      "role": "owner"
    },
    "csrfToken": "csrf_xxx",
    "sessionExpiresAt": "2026-08-28T15:49:00+08:00"
  }
}
```

## 登出

```http
POST /api/v1/auth/logout
```

## 获取当前用户

```http
GET /api/v1/auth/me
```

## 获取CSRF Token

```http
GET /api/v1/auth/csrf
```

## 修改密码

```http
POST /api/v1/auth/change-password
```

## 列出设备

```http
GET /api/v1/auth/devices
```

## 撤销设备

```http
DELETE /api/v1/auth/devices/:deviceId
```

## 列出会话

```http
GET /api/v1/auth/sessions
```

## 撤销会话

```http
DELETE /api/v1/auth/sessions/:sessionId
```

---

# 六、用户设置

```http
GET /api/v1/settings/:group
PUT /api/v1/settings/:group
```

设置组：

- editor；
- appearance；
- import；
- preview；
- backup；
- updates；
- security。

请求示例：

```json
{
  "schemaVersion": "1.0.0",
  "settings": {
    "defaultLayoutStrength": "standard",
    "lockOriginalTextByDefault": true,
    "autosaveDelayMs": 3000
  }
}
```

---

# 七、公众号接口

# 7.1 列出公众号

```http
GET /api/v1/accounts
```

查询参数：

```text
status
contentType
search
page
pageSize
```

# 7.2 创建公众号

```http
POST /api/v1/accounts
```

请求：

```json
{
  "name": "示例公众号",
  "shortName": "示例",
  "description": "公众号说明",
  "contentTypes": ["inspection", "government"],
  "brandMode": "soft",
  "primaryColor": "#9E1B1B",
  "defaultThemeId": "uuid"
}
```

# 7.3 获取公众号

```http
GET /api/v1/accounts/:accountId
```

# 7.4 更新公众号

```http
PATCH /api/v1/accounts/:accountId
```

# 7.5 复制公众号

```http
POST /api/v1/accounts/:accountId/duplicate
```

请求：

```json
{
  "name": "示例公众号副本",
  "copyAssets": true,
  "copyThemeRules": true,
  "copyAuthors": true,
  "copyWechatConnection": false
}
```

# 7.6 停用

```http
POST /api/v1/accounts/:accountId/disable
```

# 7.7 启用

```http
POST /api/v1/accounts/:accountId/enable
```

# 7.8 归档

```http
POST /api/v1/accounts/:accountId/archive
```

# 7.9 删除预检

```http
GET /api/v1/accounts/:accountId/delete-impact
```

返回：

- 文章数量；
- 未归档文章；
- 微信草稿映射；
- 品牌资产；
- 自定义主题和组件；
- 可选迁移目标。

# 7.10 删除

```http
DELETE /api/v1/accounts/:accountId
```

请求：

```json
{
  "mode": "archive",
  "migrateArticlesToAccountId": null,
  "confirmationText": "DELETE"
}
```

---

# 八、公众号品牌接口

# 8.1 获取品牌档案

```http
GET /api/v1/accounts/:accountId/brand
```

# 8.2 更新品牌档案

```http
PUT /api/v1/accounts/:accountId/brand
```

请求：

```json
{
  "brandMode": "soft",
  "colors": {
    "primary": "#9E1B1B",
    "secondary": "#1F3A5F",
    "accent": "#C8A45D"
  },
  "typography": {
    "bodySize": 16,
    "bodyLineHeight": 1.8
  },
  "defaults": {
    "themeId": "uuid",
    "paletteId": "uuid",
    "footerTemplateId": "uuid"
  }
}
```

# 8.3 品牌预览

```http
POST /api/v1/accounts/:accountId/brand/preview
```

请求：

```json
{
  "brandDraft": {},
  "themeId": "uuid",
  "sampleArticleId": "uuid"
}
```

返回：

- 预览HTML；
- 首屏预览；
- 文末预览；
- 兼容提示；
- 对比度报告。

# 8.4 创建品牌版本

```http
POST /api/v1/accounts/:accountId/brand/versions
```

# 8.5 获取品牌版本

```http
GET /api/v1/accounts/:accountId/brand/versions
GET /api/v1/accounts/:accountId/brand/versions/:versionId
```

# 8.6 恢复品牌版本

```http
POST /api/v1/accounts/:accountId/brand/versions/:versionId/restore
```

# 8.7 导出品牌包

```http
POST /api/v1/accounts/:accountId/brand/export
```

返回异步任务：

```json
{
  "jobId": "uuid"
}
```

# 8.8 导入品牌包

```http
POST /api/v1/accounts/brand/import
```

文件上传后异步解析。

---

# 九、品牌资产接口

# 9.1 列出资产

```http
GET /api/v1/accounts/:accountId/assets
```

# 9.2 创建资产

先上传资源，再绑定：

```http
POST /api/v1/accounts/:accountId/assets
```

请求：

```json
{
  "resourceId": "uuid",
  "assetType": "logo_primary",
  "variant": "primary",
  "isDefault": true,
  "metadata": {}
}
```

# 9.3 更新资产

```http
PATCH /api/v1/accounts/:accountId/assets/:assetId
```

# 9.4 删除资产

```http
DELETE /api/v1/accounts/:accountId/assets/:assetId
```

若资产被文章Frozen版本引用，返回409并说明影响。

# 9.5 二维码检测

```http
POST /api/v1/accounts/:accountId/assets/:assetId/validate-qr
```

返回：

- 清晰度；
- 白边；
- 对比度；
- 可扫描性；
- 建议尺寸。

---

# 十、作者、版权和文末

# 10.1 作者

```http
GET    /api/v1/accounts/:accountId/authors
POST   /api/v1/accounts/:accountId/authors
PATCH  /api/v1/accounts/:accountId/authors/:authorId
DELETE /api/v1/accounts/:accountId/authors/:authorId
```

# 10.2 版权模板

```http
GET    /api/v1/accounts/:accountId/copyright-templates
POST   /api/v1/accounts/:accountId/copyright-templates
PATCH  /api/v1/accounts/:accountId/copyright-templates/:templateId
DELETE /api/v1/accounts/:accountId/copyright-templates/:templateId
```

# 10.3 文末模板

```http
GET    /api/v1/accounts/:accountId/footer-templates
POST   /api/v1/accounts/:accountId/footer-templates
PATCH  /api/v1/accounts/:accountId/footer-templates/:footerId
DELETE /api/v1/accounts/:accountId/footer-templates/:footerId
POST   /api/v1/accounts/:accountId/footer-templates/:footerId/preview
```

---

# 十一、文章接口

# 11.1 列出文章

```http
GET /api/v1/articles
```

查询参数：

```text
accountId
status
contentType
folderId
tagId
themeId
hasSvg
compatibilityStatus
search
sort
page
pageSize
```

# 11.2 新建空白文章

```http
POST /api/v1/articles
```

请求：

```json
{
  "title": "未命名文章",
  "accountId": "uuid",
  "contentType": "inspection",
  "sourceType": "blank",
  "layoutStrength": "standard"
}
```

# 11.3 获取文章详情

```http
GET /api/v1/articles/:articleId
```

返回：

- 元数据；
- 当前公众号；
- 主题；
- 文章状态；
- 字数；
- 图片数；
- SVG数；
- 兼容状态；
- 最近快照；
- 复制和同步摘要。

# 11.4 更新文章元数据

```http
PATCH /api/v1/articles/:articleId
```

可更新：

- 标题；
- 副标题；
- 内容类型；
- 文件夹；
- 标签；
- 状态；
- 发布标记。

# 11.5 复制文章

```http
POST /api/v1/articles/:articleId/duplicate
```

请求：

```json
{
  "title": "文章副本",
  "targetAccountId": "uuid",
  "copyMode": "full",
  "contentGroupMode": "same_group"
}
```

# 11.6 归档

```http
POST /api/v1/articles/:articleId/archive
```

# 11.7 恢复归档

```http
POST /api/v1/articles/:articleId/unarchive
```

# 11.8 删除至回收站

```http
DELETE /api/v1/articles/:articleId
```

# 11.9 恢复

```http
POST /api/v1/articles/:articleId/restore
```

# 11.10 永久删除预检

```http
GET /api/v1/articles/:articleId/purge-impact
```

# 11.11 永久删除

```http
DELETE /api/v1/articles/:articleId/purge
```

需要二次确认。

---

# 十二、文章文档接口

# 12.1 获取当前文档

```http
GET /api/v1/articles/:articleId/document
```

响应：

```json
{
  "success": true,
  "data": {
    "schemaVersion": "1.0.0",
    "documentVersion": 15,
    "document": {},
    "textLocked": true,
    "originalTextHash": "sha256",
    "currentTextHash": "sha256",
    "lastSavedAt": "2026-07-29T15:49:00+08:00"
  }
}
```

# 12.2 保存文档

```http
PUT /api/v1/articles/:articleId/document
```

请求：

```json
{
  "baseVersion": 15,
  "schemaVersion": "1.0.0",
  "document": {},
  "lastTransactionId": "uuid",
  "transactionOrigin": "user_style_change"
}
```

成功：

```json
{
  "documentVersion": 16,
  "lastSavedAt": "2026-07-29T15:49:03+08:00"
}
```

冲突返回409。

# 12.3 批量事务保存

可选：

```http
POST /api/v1/articles/:articleId/document/transactions
```

用于低频批量操作，不建议每个按键都调用。

# 12.4 锁定原文

```http
POST /api/v1/articles/:articleId/document/lock-original
```

# 12.5 解锁原文

```http
POST /api/v1/articles/:articleId/document/unlock-original
```

请求：

```json
{
  "scope": "section",
  "blockIds": ["blk_001"],
  "reason": "修正错别字"
}
```

# 12.6 检查原文变化

```http
POST /api/v1/articles/:articleId/document/compare-original
```

返回：

- 新增；
- 删除；
- 修改；
- 顺序变化；
- 仅样式变化。

# 12.7 迁移文档Schema

```http
POST /api/v1/articles/:articleId/document/migrate
```

一般由系统调用，不对普通用户开放。

---

# 十三、快照与版本

# 13.1 列出快照

```http
GET /api/v1/articles/:articleId/snapshots
```

# 13.2 创建快照

```http
POST /api/v1/articles/:articleId/snapshots
```

请求：

```json
{
  "reason": "manual",
  "note": "完成第一轮排版"
}
```

# 13.3 获取快照

```http
GET /api/v1/articles/:articleId/snapshots/:snapshotId
```

# 13.4 快照预览

```http
POST /api/v1/articles/:articleId/snapshots/:snapshotId/preview
```

# 13.5 比较快照

```http
GET /api/v1/articles/:articleId/snapshots/compare?from=:id&to=:id
```

返回：

- 文字差异；
- 节点差异；
- 主题差异；
- 品牌差异；
- 资源差异；
- SVG差异。

# 13.6 恢复快照

```http
POST /api/v1/articles/:articleId/snapshots/:snapshotId/restore
```

请求：

```json
{
  "mode": "replace_current"
}
```

可选：

- `replace_current`；
- `create_copy`。

---

# 十四、导入接口

# 14.1 创建DOCX导入

```http
POST /api/v1/imports/docx
```

流程：

1. 上传DOCX到资源接口；
2. 调用导入接口。

请求：

```json
{
  "resourceId": "uuid",
  "accountId": "uuid",
  "cleaningMode": "preserve_structure",
  "contentType": "inspection"
}
```

响应：

```json
{
  "jobId": "uuid",
  "articleId": "uuid"
}
```

# 14.2 粘贴导入

```http
POST /api/v1/imports/paste
```

请求：

```json
{
  "accountId": "uuid",
  "html": "<p>...</p>",
  "plainText": "备用纯文本",
  "cleaningMode": "preserve_structure",
  "detectedSourceHint": "word"
}
```

# 14.3 网页导入

```http
POST /api/v1/imports/webpage
```

请求：

```json
{
  "url": "https://example.com/article",
  "accountId": "uuid",
  "fetchMode": "auto"
}
```

`fetchMode`：

- auto；
- http；
- browser。

# 14.4 获取导入结果

```http
GET /api/v1/imports/:importId
```

返回：

- 识别来源；
- 字数；
- 图片；
- 标题；
- 警告；
- 中间结构；
- 结构识别状态。

# 14.5 确认结构

```http
POST /api/v1/imports/:importId/confirm-structure
```

请求：

```json
{
  "blocks": [
    {
      "sourceBlockId": "src_001",
      "semanticRole": "heading",
      "level": 1
    }
  ]
}
```

# 14.6 取消导入

```http
POST /api/v1/imports/:importId/cancel
```

---

# 十五、资源上传接口

# 15.1 创建上传会话

```http
POST /api/v1/resources/uploads
```

请求：

```json
{
  "filename": "image.png",
  "mimeType": "image/png",
  "fileSize": 1200345,
  "sha256": "..."
}
```

响应：

```json
{
  "uploadId": "uuid",
  "uploadUrl": "signed-url",
  "headers": {},
  "expiresAt": "..."
}
```

# 15.2 完成上传

```http
POST /api/v1/resources/uploads/:uploadId/complete
```

请求：

```json
{
  "etag": "..."
}
```

返回资源对象。

# 15.3 直接小文件上传

开发环境或小文件可支持：

```http
POST /api/v1/resources
Content-Type: multipart/form-data
```

生产优先直传对象存储。

# 15.4 获取资源

```http
GET /api/v1/resources/:resourceId
```

# 15.5 获取签名访问地址

```http
POST /api/v1/resources/:resourceId/access-url
```

请求：

```json
{
  "purpose": "editor_preview",
  "expiresInSeconds": 900
}
```

# 15.6 图片处理

```http
POST /api/v1/resources/:resourceId/process
```

请求：

```json
{
  "operations": [
    {
      "type": "resize",
      "width": 1500
    },
    {
      "type": "compress",
      "quality": 86
    }
  ],
  "variantType": "wechat_optimized"
}
```

返回异步任务。

# 15.7 图片裁剪

```http
POST /api/v1/resources/:resourceId/crop
```

# 15.8 删除资源

```http
DELETE /api/v1/resources/:resourceId
```

若被引用返回409。

# 15.9 查询引用

```http
GET /api/v1/resources/:resourceId/references
```

---

# 十六、主题接口

# 16.1 列出主题

```http
GET /api/v1/themes
```

查询：

```text
category
contentType
accountId
status
compatibilityLevel
search
installed
favorite
page
pageSize
```

# 16.2 获取主题

```http
GET /api/v1/themes/:themeId
```

# 16.3 获取主题版本

```http
GET /api/v1/themes/:themeId/versions
GET /api/v1/themes/:themeId/versions/:version
```

# 16.4 主题试穿

```http
POST /api/v1/articles/:articleId/themes/:themeId/preview
```

请求：

```json
{
  "themeVersion": "1.2.0",
  "paletteId": "uuid",
  "scope": "full",
  "brandMode": "soft"
}
```

# 16.5 应用主题

```http
POST /api/v1/articles/:articleId/themes/:themeId/apply
```

请求：

```json
{
  "baseDocumentVersion": 15,
  "themeVersion": "1.2.0",
  "paletteId": "uuid",
  "scope": "full",
  "preserveLockedBlocks": true
}
```

# 16.6 一键换色

```http
POST /api/v1/articles/:articleId/theme/palette
```

# 16.7 保存为个人主题

```http
POST /api/v1/themes/user-themes
```

# 16.8 更新个人主题

```http
PATCH /api/v1/themes/user-themes/:userThemeId
```

# 16.9 混搭检查

```http
POST /api/v1/articles/:articleId/theme/mix-check
```

---

# 十七、组件接口

# 17.1 列出组件

```http
GET /api/v1/components
```

查询：

```text
category
semanticRole
themeId
contentType
compatibilityLevel
favorite
recent
search
```

# 17.2 获取组件

```http
GET /api/v1/components/:componentId
```

# 17.3 组件预览

```http
POST /api/v1/components/:componentId/preview
```

请求：

```json
{
  "componentVersion": "1.0.0",
  "variant": "left-line",
  "themeId": "uuid",
  "brandVersionId": "uuid",
  "slotSample": {}
}
```

# 17.4 插入组件

```http
POST /api/v1/articles/:articleId/components/:componentId/insert
```

请求：

```json
{
  "baseDocumentVersion": 15,
  "position": {
    "afterBlockId": "blk_001"
  },
  "componentVersion": "1.0.0",
  "variant": "default",
  "slotData": {}
}
```

# 17.5 替换组件

```http
POST /api/v1/articles/:articleId/blocks/:blockId/replace-component
```

# 17.6 保存为个人组件

```http
POST /api/v1/components/user-components
```

# 17.7 收藏

```http
POST   /api/v1/favorites
DELETE /api/v1/favorites/:favoriteId
```

请求：

```json
{
  "targetType": "component",
  "targetId": "uuid",
  "targetVersion": "1.0.0"
}
```

---

# 十八、SVG互动接口

# 18.1 列出模板

```http
GET /api/v1/svg/templates
```

查询：

```text
interactionType
sceneType
difficulty
compatibilityLevel
favorite
search
```

# 18.2 获取模板

```http
GET /api/v1/svg/templates/:templateId
```

# 18.3 创建SVG实例

```http
POST /api/v1/articles/:articleId/svg-interactions
```

请求：

```json
{
  "baseDocumentVersion": 15,
  "templateId": "uuid",
  "templateVersion": "1.0.0",
  "sceneType": "inspection_result",
  "configuration": {},
  "resourceIds": [],
  "insertPosition": {
    "afterBlockId": "blk_001"
  }
}
```

# 18.4 更新SVG实例

```http
PUT /api/v1/articles/:articleId/svg-interactions/:interactionId
```

# 18.5 渲染预览

```http
POST /api/v1/svg-interactions/:interactionId/render-preview
```

# 18.6 生成静态降级

```http
POST /api/v1/svg-interactions/:interactionId/generate-fallback
```

返回异步任务。

# 18.7 兼容检查

```http
POST /api/v1/svg-interactions/:interactionId/check
```

# 18.8 删除

```http
DELETE /api/v1/articles/:articleId/svg-interactions/:interactionId
```

# 18.9 复制SVG实例

```http
POST /api/v1/svg-interactions/:interactionId/duplicate
```

# 18.10 升级模板版本

```http
POST /api/v1/svg-interactions/:interactionId/upgrade-preview
POST /api/v1/svg-interactions/:interactionId/upgrade
```

---

# 十九、公众号切换与品牌副本

# 19.1 切换预览

```http
POST /api/v1/articles/:articleId/switch-account/preview
```

请求：

```json
{
  "targetAccountId": "uuid",
  "mode": "full_brand"
}
```

返回：

- 颜色变化；
- Logo变化；
- 二维码变化；
- 文末变化；
- SVG品牌冲突；
- 封面变化；
- 推荐方案；
- 预览HTML。

# 19.2 应用切换

```http
POST /api/v1/articles/:articleId/switch-account/apply
```

请求：

```json
{
  "baseDocumentVersion": 15,
  "targetAccountId": "uuid",
  "mode": "full_brand",
  "createSnapshot": true
}
```

# 19.3 创建品牌副本

```http
POST /api/v1/articles/:articleId/create-brand-copy
```

请求：

```json
{
  "targetAccountId": "uuid",
  "syncMode": "original_only"
}
```

# 19.4 获取同源版本

```http
GET /api/v1/content-groups/:contentGroupId/articles
```

# 19.5 同步原文到同源版本

```http
POST /api/v1/content-groups/:contentGroupId/sync-original
```

需要先预览差异。

---

# 二十、兼容检查接口

# 20.1 创建完整检查

```http
POST /api/v1/articles/:articleId/compatibility-checks
```

请求：

```json
{
  "documentVersion": 15,
  "outputMode": "standard",
  "deviceProfiles": ["ios", "android"],
  "fullCheck": true
}
```

响应：

```json
{
  "jobId": "uuid",
  "reportId": "uuid"
}
```

# 20.2 增量检查

```http
POST /api/v1/articles/:articleId/compatibility-checks/incremental
```

请求：

```json
{
  "documentVersion": 15,
  "changedBlockIds": ["blk_001", "blk_002"]
}
```

# 20.3 获取报告

```http
GET /api/v1/articles/:articleId/compatibility-reports
GET /api/v1/articles/:articleId/compatibility-reports/:reportId
```

# 20.4 自动修复预览

```http
POST /api/v1/articles/:articleId/compatibility-reports/:reportId/fix-preview
```

# 20.5 应用自动修复

```http
POST /api/v1/articles/:articleId/compatibility-reports/:reportId/apply-fixes
```

请求：

```json
{
  "baseDocumentVersion": 15,
  "issueIds": ["uuid"],
  "mode": "safe_only"
}
```

# 20.6 忽略问题

```http
POST /api/v1/articles/:articleId/compatibility-issues/:issueId/ignore
```

严重问题需记录理由。

# 20.7 恢复修复

```http
POST /api/v1/articles/:articleId/compatibility-fixes/:fixId/revert
```

---

# 二十一、预览接口

# 21.1 编辑器实时预览

客户端可本地快速预览。

正式预览接口：

```http
POST /api/v1/articles/:articleId/previews
```

请求：

```json
{
  "snapshotId": null,
  "documentVersion": 15,
  "deviceProfile": "iphone_large",
  "outputMode": "standard"
}
```

# 21.2 获取预览

```http
GET /api/v1/previews/:previewId
```

# 21.3 创建临时预览链接

```http
POST /api/v1/articles/:articleId/preview-links
```

请求：

```json
{
  "snapshotId": "uuid",
  "expiresInMinutes": 60,
  "maxViews": 10,
  "accessMode": "token"
}
```

# 21.4 撤销预览链接

```http
DELETE /api/v1/articles/:articleId/preview-links/:previewLinkId
```

# 21.5 二维码

```http
GET /api/v1/preview-links/:previewLinkId/qr-code
```

---

# 二十二、微信HTML渲染与复制

# 22.1 创建正式渲染

```http
POST /api/v1/articles/:articleId/render-wechat
```

请求：

```json
{
  "documentVersion": 15,
  "snapshotReason": "before_copy",
  "outputMode": "standard",
  "runCompatibilityCheck": true
}
```

返回202：

```json
{
  "jobId": "uuid",
  "renderOutputId": "uuid"
}
```

# 22.2 获取渲染结果

```http
GET /api/v1/articles/:articleId/render-outputs/:renderOutputId
```

返回：

- HTML；
- 哈希；
- 主题版本；
- 品牌版本；
- 兼容规则版本；
- 报告；
- 是否允许复制。

# 22.3 获取复制Payload

```http
POST /api/v1/articles/:articleId/copy-payload
```

请求：

```json
{
  "renderOutputId": "uuid"
}
```

响应：

```json
{
  "html": "<section>...</section>",
  "plainText": "...",
  "expiresAt": "..."
}
```

# 22.4 记录复制成功

浏览器写入剪贴板后调用：

```http
POST /api/v1/articles/:articleId/copy-records
```

请求：

```json
{
  "renderOutputId": "uuid",
  "status": "success",
  "browserInfo": {}
}
```

# 22.5 记录复制失败

同一接口，状态`failed`并提供原因。

---

# 二十三、微信连接与授权

# 23.1 获取连接状态

```http
GET /api/v1/accounts/:accountId/wechat/connection
```

# 23.2 发起授权

```http
POST /api/v1/accounts/:accountId/wechat/connect
```

响应：

```json
{
  "authorizationUrl": "https://...",
  "state": "..."
}
```

# 23.3 授权回调

```http
GET /api/v1/wechat/oauth/callback
```

由服务端处理。

# 23.4 刷新凭据

```http
POST /api/v1/accounts/:accountId/wechat/refresh
```

# 23.5 撤销授权

```http
POST /api/v1/accounts/:accountId/wechat/revoke
```

# 23.6 获取能力

```http
GET /api/v1/accounts/:accountId/wechat/capabilities
```

# 23.7 重新检测

```http
POST /api/v1/accounts/:accountId/wechat/capabilities/check
```

---

# 二十四、微信草稿同步

# 24.1 同步预检

```http
POST /api/v1/articles/:articleId/wechat/sync-preview
```

请求：

```json
{
  "accountId": "uuid",
  "mode": "create",
  "title": "文章标题",
  "authorId": "uuid",
  "summary": "摘要",
  "coverResourceId": "uuid",
  "outputMode": "standard"
}
```

返回：

- 授权状态；
- 可用能力；
- 图片数量；
- 待上传图片；
- 兼容问题；
- 标题、作者、摘要和封面校验；
- 预计操作。

# 24.2 创建草稿

```http
POST /api/v1/articles/:articleId/wechat/drafts
```

Header：

```http
Idempotency-Key: draft-create-article-uuid-v15
```

请求：

```json
{
  "accountId": "uuid",
  "documentVersion": 15,
  "title": "文章标题",
  "authorId": "uuid",
  "summary": "摘要",
  "coverResourceId": "uuid",
  "originalUrl": null,
  "outputMode": "standard"
}
```

返回异步任务。

# 24.3 更新草稿

```http
PUT /api/v1/articles/:articleId/wechat/drafts/:draftMappingId
```

需二次确认。

# 24.4 获取草稿映射

```http
GET /api/v1/articles/:articleId/wechat/drafts
```

# 24.5 获取同步记录

```http
GET /api/v1/articles/:articleId/wechat/sync-records
```

# 24.6 重试同步

```http
POST /api/v1/wechat/sync-records/:recordId/retry
```

# 24.7 降级为复制

```http
POST /api/v1/wechat/sync-records/:recordId/fallback-to-copy
```

---

# 二十五、素材更新接口

# 25.1 检查更新

```http
GET /api/v1/materials/updates
```

查询：

```text
channel
type
installedOnly
securityOnly
```

# 25.2 获取素材包

```http
GET /api/v1/materials/packages/:packageKey
GET /api/v1/materials/packages/:packageKey/versions
GET /api/v1/materials/packages/:packageKey/versions/:version
```

# 25.3 安装

```http
POST /api/v1/materials/packages/:packageKey/install
```

请求：

```json
{
  "version": "1.2.0",
  "channel": "stable"
}
```

返回异步任务。

# 25.4 启用

```http
POST /api/v1/materials/packages/:packageKey/enable
```

# 25.5 停用

```http
POST /api/v1/materials/packages/:packageKey/disable
```

# 25.6 卸载预检

```http
GET /api/v1/materials/packages/:packageKey/uninstall-impact
```

# 25.7 卸载

```http
DELETE /api/v1/materials/packages/:packageKey
```

# 25.8 回滚

```http
POST /api/v1/materials/packages/:packageKey/rollback
```

# 25.9 文章升级预览

```http
POST /api/v1/articles/:articleId/materials/upgrade-preview
```

# 25.10 应用升级

```http
POST /api/v1/articles/:articleId/materials/upgrade
```

# 25.11 获取撤销状态

```http
GET /api/v1/materials/revocations
```

---

# 二十六、任务接口

# 26.1 获取任务

```http
GET /api/v1/jobs/:jobId
```

响应：

```json
{
  "id": "uuid",
  "type": "import-docx",
  "status": "running",
  "progress": 65,
  "message": "正在提取图片",
  "attemptCount": 1,
  "maxAttempts": 3,
  "startedAt": "...",
  "estimatedRemainingSeconds": null
}
```

不承诺精确剩余时间；可返回阶段信息。

# 26.2 列出任务

```http
GET /api/v1/jobs
```

查询：

```text
status
type
articleId
accountId
page
pageSize
```

# 26.3 取消任务

```http
POST /api/v1/jobs/:jobId/cancel
```

只有可取消任务支持。

# 26.4 重试

```http
POST /api/v1/jobs/:jobId/retry
```

# 26.5 任务事件SSE

```http
GET /api/v1/jobs/:jobId/events
Accept: text/event-stream
```

事件示例：

```text
event: progress
data: {"jobId":"...","progress":50,"stage":"image_extract"}

event: warning
data: {"code":"IMAGE_FAILED","message":"1张图片提取失败"}

event: completed
data: {"jobId":"...","resultRef":"..."}
```

# 26.6 SSE重连

支持：

```http
Last-Event-ID
```

服务端可从`job_events`继续发送。

---

# 二十七、通知接口

```http
GET    /api/v1/notifications
POST   /api/v1/notifications/:notificationId/read
POST   /api/v1/notifications/read-all
DELETE /api/v1/notifications/:notificationId
```

可选SSE：

```http
GET /api/v1/notifications/events
```

---

# 二十八、备份与恢复

# 28.1 创建备份

```http
POST /api/v1/backups
```

请求：

```json
{
  "backupType": "full",
  "scopeType": "system"
}
```

返回任务。

# 28.2 列出备份

```http
GET /api/v1/backups
```

# 28.3 下载备份

```http
POST /api/v1/backups/:backupId/download-url
```

# 28.4 恢复预检

```http
POST /api/v1/backups/:backupId/restore-preview
```

# 28.5 执行恢复

```http
POST /api/v1/backups/:backupId/restore
```

需要二次确认和幂等键。

---

# 二十九、审计接口

首版仅Owner可访问。

```http
GET /api/v1/audit/logs
GET /api/v1/audit/security-events
GET /api/v1/audit/security-events/:eventId
POST /api/v1/audit/security-events/:eventId/resolve
```

查询：

```text
actorId
action
targetType
targetId
articleId
accountId
dateFrom
dateTo
severity
```

---

# 三十、健康与系统信息

# 30.1 存活检查

```http
GET /health/live
```

# 30.2 就绪检查

```http
GET /health/ready
```

检查：

- PostgreSQL；
- Redis；
- 对象存储；
- Worker心跳；
- 当前数据库迁移版本。

# 30.3 系统版本

```http
GET /api/v1/system/version
```

返回：

- 应用版本；
- 文档Schema版本；
- SVG协议版本；
- 兼容规则版本；
- 素材仓库状态；
- 构建信息。

# 30.4 存储状态

```http
GET /api/v1/system/storage
```

---

# 三十一、幂等规则

# 31.1 Header

使用：

```http
Idempotency-Key: unique-string
```

适用于：

- 创建导入；
- 创建微信草稿；
- 更新微信草稿；
- 创建备份；
- 安装素材；
- 生成正式渲染；
- 批量兼容修复；
- 品牌切换应用。

# 31.2 服务端规则

保存：

- 用户；
- 接口；
- 幂等键；
- 请求体哈希；
- 响应；
- 状态；
- 到期时间。

同一键请求体不同，返回409：

```text
IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
```

# 31.3 有效期

建议：

- 普通创建任务：24小时；
- 微信草稿创建：7天；
- 备份：24小时；
- 素材安装：24小时。

---

# 三十二、缓存与条件请求

# 32.1 ETag

适合：

- 主题详情；
- 组件详情；
- 品牌档案；
- 文章元数据；
- 素材Manifest。

客户端发送：

```http
If-None-Match
```

# 32.2 文档保存

编辑器文档不使用普通ETag替代乐观锁，仍使用`documentVersion`。

# 32.3 Cache-Control

私有内容：

```http
Cache-Control: private, no-store
```

公开素材预览可使用：

```http
Cache-Control: public, max-age=3600
```

签名URL按对象存储规则。

---

# 三十三、限流

# 33.1 登录

- 单IP：5次/分钟；
- 单账号：10次/15分钟；
- 超限进入临时锁定。

# 33.2 普通API

个人系统可宽松：

- 300次/分钟/会话。

# 33.3 文件上传

- 20次/分钟；
- 单文件大小限制；
- 总并发限制。

# 33.4 网页导入

- 10次/小时；
- 防止成为开放代理。

# 33.5 微信同步

- 以微信官方接口限制为基础；
- 服务端内部再设置队列限速；
- 同一公众号串行或低并发。

# 33.6 素材安装

- 同时只允许1至2个安装任务；
- 避免磁盘与数据库竞争。

---

# 三十四、权限模型

首版角色：

| 角色 | 能力 |
|---|---|
| owner | 全部 |
| editor | 文章、主题、组件和SVG |
| publisher | 复制、同步和发布记录 |
| viewer | 只读和预览 |

接口通过装饰器或Guard声明权限：

```typescript
@RequirePermissions('article:write')
```

首版仅Owner实际使用，但不能在代码中写死。

---

# 三十五、输入安全

# 35.1 JSON校验

所有接口请求通过Zod或DTO Schema校验。

# 35.2 HTML输入

粘贴和网页HTML：

- 服务端清洗；
- 删除脚本；
- 删除事件属性；
- URL白名单；
- 转为文档JSON。

# 35.3 URL输入

网页导入和外链：

- 只允许HTTP/HTTPS；
- 防SSRF；
- 校验DNS；
- 禁止私网；
- 限制重定向；
- 限制体积和超时。

# 35.4 文件

- MIME和文件头双校验；
- 扩展名不作为唯一依据；
- DOCX检查ZIP结构；
- 图片实际解码；
- SVG按静态资源清洗；
- 上传隔离；
- 限制大小。

# 35.5 微信回调

- 校验State；
- 防重放；
- 校验来源；
- 限制有效期；
- 不在URL中暴露长期凭据。

---

# 三十六、错误码

# 36.1 通用

| 错误码 | 说明 |
|---|---|
| VALIDATION_FAILED | 参数校验失败 |
| AUTH_REQUIRED | 未登录 |
| SESSION_EXPIRED | 会话到期 |
| PERMISSION_DENIED | 权限不足 |
| RESOURCE_NOT_FOUND | 资源不存在 |
| RATE_LIMITED | 频率过高 |
| INTERNAL_ERROR | 系统异常 |
| SERVICE_UNAVAILABLE | 服务不可用 |
| IDEMPOTENCY_CONFLICT | 幂等冲突 |

# 36.2 文章

| 错误码 | 说明 |
|---|---|
| ARTICLE_NOT_FOUND | 文章不存在 |
| ARTICLE_VERSION_CONFLICT | 文档版本冲突 |
| ARTICLE_LOCKED | 文章被锁定 |
| ARTICLE_STATE_CONFLICT | 当前状态不允许操作 |
| ARTICLE_PURGE_BLOCKED | 存在引用不能永久删除 |
| ORIGINAL_TEXT_MODIFIED | 原文发生未授权修改 |
| ORIGINAL_TEXT_LOCKED | 锁定原文不可修改 |

# 36.3 导入

| 错误码 | 说明 |
|---|---|
| IMPORT_FILE_UNSUPPORTED | 文件类型不支持 |
| IMPORT_FILE_CORRUPTED | 文件损坏 |
| IMPORT_FILE_TOO_LARGE | 文件过大 |
| IMPORT_PARSE_FAILED | 解析失败 |
| IMPORT_STRUCTURE_REQUIRED | 需确认结构 |
| IMPORT_WEBPAGE_BLOCKED | 网页禁止抓取或不可访问 |
| IMPORT_SSRF_BLOCKED | 地址被安全策略阻止 |

# 36.4 资源

| 错误码 | 说明 |
|---|---|
| RESOURCE_UPLOAD_FAILED | 上传失败 |
| RESOURCE_HASH_MISMATCH | 哈希不一致 |
| RESOURCE_IN_USE | 资源被引用 |
| RESOURCE_PROCESSING_FAILED | 图片处理失败 |
| RESOURCE_FORMAT_UNSUPPORTED | 格式不支持 |

# 36.5 主题和组件

| 错误码 | 说明 |
|---|---|
| THEME_NOT_INSTALLED | 主题未安装 |
| THEME_VERSION_INCOMPATIBLE | 版本不兼容 |
| THEME_APPLY_FAILED | 应用失败 |
| COMPONENT_NOT_AVAILABLE | 组件不可用 |
| COMPONENT_SCHEMA_INVALID | 组件Schema非法 |
| DESIGN_MIX_CONFLICT | 风格冲突 |

# 36.6 SVG

| 错误码 | 说明 |
|---|---|
| SVG_PROTOCOL_INVALID | 互动协议非法 |
| SVG_TEMPLATE_REVOKED | 模板已撤销 |
| SVG_RENDER_FAILED | 渲染失败 |
| SVG_SECURITY_REJECTED | 安全校验拒绝 |
| SVG_FALLBACK_MISSING | 缺少静态降级 |
| SVG_COMPATIBILITY_FAILED | 兼容检查失败 |

# 36.7 兼容

| 错误码 | 说明 |
|---|---|
| COMPATIBILITY_CHECK_FAILED | 检查失败 |
| COMPATIBILITY_REPORT_STALE | 报告已过期 |
| CRITICAL_ISSUES_EXIST | 存在严重问题 |
| AUTO_FIX_FAILED | 自动修复失败 |

# 36.8 微信

| 错误码 | 说明 |
|---|---|
| WECHAT_NOT_CONNECTED | 未连接微信 |
| WECHAT_AUTH_EXPIRED | 授权过期 |
| WECHAT_PERMISSION_DENIED | 权限不足 |
| WECHAT_CAPABILITY_UNAVAILABLE | 当前账号不支持 |
| WECHAT_MEDIA_UPLOAD_FAILED | 图片上传失败 |
| WECHAT_DRAFT_CREATE_FAILED | 草稿创建失败 |
| WECHAT_DRAFT_UPDATE_FAILED | 草稿更新失败 |
| WECHAT_RATE_LIMITED | 微信接口限流 |
| WECHAT_SERVICE_ERROR | 微信服务异常 |

# 36.9 素材更新

| 错误码 | 说明 |
|---|---|
| MATERIAL_SIGNATURE_INVALID | 签名无效 |
| MATERIAL_HASH_MISMATCH | 文件哈希不一致 |
| MATERIAL_REVOKED | 素材包已撤销 |
| MATERIAL_DEPENDENCY_CONFLICT | 依赖冲突 |
| MATERIAL_APP_VERSION_UNSUPPORTED | 应用版本不支持 |
| MATERIAL_INSTALL_FAILED | 安装失败 |
| MATERIAL_ROLLBACK_FAILED | 回滚失败 |

---

# 三十七、OpenAPI规范

# 37.1 文档地址

开发环境：

```text
/api/docs
/api/openapi.json
```

生产环境默认关闭Swagger UI，保留受保护的OpenAPI JSON。

# 37.2 代码生成

从OpenAPI生成：

- 前端TypeScript类型；
- API Client；
- 测试Mock；
- 后端契约测试；
- 后续浏览器扩展SDK。

# 37.3 Schema命名

统一：

```text
CreateArticleRequest
ArticleResponse
UpdateDocumentRequest
JobResponse
ErrorResponse
```

# 37.4 不直接暴露数据库结构

API DTO与数据库实体分离。

---

# 三十八、接口日志与审计

每个写接口记录：

- requestId；
- traceId；
- userId；
- action；
- targetType；
- targetId；
- articleId；
- accountId；
- 状态；
- 耗时；
- 错误码；
- 变更摘要。

不得记录：

- 完整文章正文；
- 密码；
- 微信Secret；
- Session；
- 完整签名URL；
- 签名私钥。

---

# 三十九、测试要求

# 39.1 单元测试

覆盖：

- DTO校验；
- 权限；
- 错误码；
- 幂等；
- 乐观锁；
- 状态转换；
- 原文锁定；
- 主题应用；
- 品牌切换；
- 微信能力判断。

# 39.2 集成测试

使用Testcontainers：

- PostgreSQL；
- Redis；
- MinIO；
- API；
- Worker。

# 39.3 契约测试

前端和后端共同使用OpenAPI Schema。

必须测试：

- 请求字段；
- 响应字段；
- 错误响应；
- 分页；
- SSE事件；
- 文件上传。

# 39.4 E2E

使用Playwright测试：

- 登录；
- 新建文章；
- DOCX导入；
- 应用主题；
- SVG插入；
- 公众号切换；
- 兼容检查；
- 一键复制；
- 草稿同步Mock；
- 素材更新。

---

# 四十、首版接口优先级

# 40.1 V0.1

必须完成：

- auth；
- articles；
- document；
- snapshots；
- paste import；
- resources；
- themes；
- components；
- compatibility；
- render-wechat；
- copy-records；
- jobs SSE；
- settings。

# 40.2 V0.5

增加：

- DOCX导入；
- 网页导入；
- accounts；
- brand；
- SVG；
- preview links；
- materials；
- backups；
- notifications。

# 40.3 V1.0

增加：

- 微信授权；
- 能力检测；
- 草稿同步；
- 品牌包导入导出；
- 素材签名和撤销；
- 高级审计；
- Feature Flag。

---

# 四十一、API验收标准

# 41.1 基础

- 所有接口有OpenAPI；
- 所有错误有错误码；
- 所有写接口有权限和CSRF；
- 所有耗时任务返回Job ID；
- 所有任务可通过SSE查看；
- 所有资源ID使用UUID。

# 41.2 文档

- 保存有乐观锁；
- 版本冲突返回409；
- 原文锁定有效；
- 快照可恢复；
- 大型操作自动创建快照。

# 41.3 导入和资源

- DOCX、粘贴和网页导入异步可追踪；
- 文件上传有哈希校验；
- 资源可查询引用；
- 删除不会破坏文章。

# 41.4 主题和SVG

- 主题可试穿后应用；
- 组件插入可保持内容；
- SVG可预览、检查和降级；
- 撤销模板不能新建。

# 41.5 微信

- 能力不可用时接口明确返回；
- 同步有幂等；
- 图片映射按公众号隔离；
- 同步失败可重试或降级复制。

# 41.6 素材

- 签名失败不可安装；
- 新旧版本并存；
- 安装失败不影响旧版；
- 回滚可执行；
- 历史文章精确引用。

---

# 四十二、API设计冻结

本文件正式冻结以下API规则：

1. API统一使用`/api/v1`；
2. 首版采用REST，不使用GraphQL；
3. 异步任务进度使用SSE；
4. 成功和失败响应格式统一；
5. 编辑器文档使用`documentVersion`乐观锁；
6. 所有大型写操作必须支持快照或回滚；
7. 登录使用HttpOnly Session Cookie；
8. 写请求使用CSRF Token；
9. 长期Token不得存入LocalStorage；
10. 文件上传优先使用对象存储直传；
11. 正式微信HTML由服务端异步生成；
12. 复制结果由浏览器完成后回写记录；
13. 微信草稿创建和更新必须支持幂等；
14. 微信能力必须通过接口动态检测；
15. 同步失败必须支持重试和复制降级；
16. 远程素材安装只在服务端完成；
17. 素材包签名、哈希、版本和撤销状态必须验证；
18. 所有输入使用Schema校验；
19. 网页导入必须进行SSRF防护；
20. SVG输入必须经过安全清洗；
21. 错误码必须稳定、可测试、可国际化；
22. 所有写操作进入审计；
23. OpenAPI是前后端接口契约的唯一依据；
24. 后续页面原型、测试和开发任务必须以本API设计为准。

---

# 四十三、下一份开发文件

下一步进入：

> `12_公众号智能视觉排版工具_前端页面原型与交互说明.md`

该文件应详细明确：

- 工作台页面布局；
- 文章管理页面；
- 导入向导；
- 编辑器三栏详细交互；
- 快速排版面板；
- 主题中心；
- 组件中心；
- SVG向导与专业编辑器；
- 多公众号品牌管理；
- 素材更新中心；
- 预览、兼容检查和复制同步弹窗；
- 响应式规则；
- 空状态、加载、错误和通知；
- 页面尺寸、间距、组件状态和快捷键。
