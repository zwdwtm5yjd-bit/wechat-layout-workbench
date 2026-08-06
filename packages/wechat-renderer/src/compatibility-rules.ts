import { createHash } from "node:crypto";

import type {
  CompatibilityIssue,
  CompatibilityIssueCode,
  CompatibilityIssueSource,
  CompatibilityRuleDefinition,
} from "./compatibility-types.js";

const RULE_DEFINITIONS = [
  {
    category: "document",
    code: "DOCUMENT_INVALID",
    description: "权威文档必须通过 Document Schema V1 校验。",
    penalty: 30,
    ruleId: "wechat.document.schema-valid",
    severity: "critical",
    title: "文档结构不合法",
  },
  {
    category: "renderer",
    code: "RENDER_FAILED",
    description: "正式复制前必须成功生成服务端 Renderer 输出。",
    penalty: 30,
    ruleId: "wechat.renderer.completed",
    severity: "critical",
    title: "微信 HTML 生成失败",
  },
  {
    autoFixAction: "remove_dangerous_element",
    category: "html",
    code: "HTML_DANGEROUS_TAG",
    description: "脚本、表单、嵌入对象和外部样式标签不得进入微信正文。",
    penalty: 25,
    ruleId: "wechat.html.no-dangerous-tags",
    severity: "critical",
    title: "包含危险 HTML 标签",
  },
  {
    autoFixAction: "unwrap_unsupported_element",
    category: "html",
    code: "HTML_UNSUPPORTED_TAG",
    description: "非白名单标签需要转换为已验证的稳定结构。",
    penalty: 6,
    ruleId: "wechat.html.allowed-tags",
    severity: "warning",
    title: "包含未验证 HTML 标签",
  },
  {
    autoFixAction: "remove_unsafe_attribute",
    category: "html",
    code: "HTML_EVENT_ATTRIBUTE",
    description: "任何 HTML 事件属性都不得进入微信正文。",
    penalty: 25,
    ruleId: "wechat.html.no-event-attributes",
    severity: "critical",
    title: "包含事件属性",
  },
  {
    autoFixAction: "remove_unsafe_attribute",
    category: "html",
    code: "HTML_UNSUPPORTED_ATTRIBUTE",
    description: "只保留当前规则包允许的 HTML 属性。",
    penalty: 3,
    ruleId: "wechat.html.allowed-attributes",
    severity: "warning",
    title: "包含未验证 HTML 属性",
  },
  {
    autoFixAction: "wrap_text_leaf",
    category: "html",
    code: "HTML_TEXT_LEAF_MISSING",
    description: "可编辑文字应放在带 leaf 标记的 span 中，避免复制到微信后样式丢失。",
    penalty: 3,
    ruleId: "wechat.html.text-leaf",
    severity: "warning",
    title: "文字缺少叶子节点标记",
  },
  {
    autoFixAction: "remove_unsafe_attribute",
    category: "url",
    code: "HTML_URL_ATTRIBUTE_UNSAFE",
    description: "非白名单 URL 属性可能绕过链接和资源安全策略。",
    penalty: 20,
    ruleId: "wechat.html.no-unknown-url-attributes",
    severity: "critical",
    title: "包含高风险 URL 属性",
  },
  {
    autoFixAction: "filter_inline_style",
    category: "css",
    code: "CSS_PROPERTY_FORBIDDEN",
    description: "内联 CSS 只能使用当前规则包的属性白名单。",
    penalty: 6,
    ruleId: "wechat.css.allowed-properties",
    severity: "warning",
    title: "包含未验证 CSS 属性",
  },
  {
    autoFixAction: "filter_inline_style",
    category: "css",
    code: "CSS_VALUE_UNSAFE",
    description: "CSS 值不得包含脚本、远程 URL、表达式或结构注入。",
    penalty: 20,
    ruleId: "wechat.css.safe-values",
    severity: "critical",
    title: "包含不安全 CSS 值",
  },
  {
    autoFixAction: "filter_inline_style",
    category: "layout",
    code: "CSS_POSITION_UNSAFE",
    description: "fixed、sticky 和安全模式中的非 static 定位会导致正文布局失控。",
    penalty: 20,
    ruleId: "wechat.css.safe-position",
    severity: "critical",
    title: "包含高风险定位",
  },
  {
    autoFixAction: "remove_unsafe_link",
    category: "url",
    code: "LINK_URL_INVALID",
    description: "正文链接只允许不含凭据、不指向本机或私网的公网 HTTPS URL。",
    penalty: 20,
    ruleId: "wechat.url.safe-link",
    severity: "critical",
    title: "链接地址不安全",
  },
  {
    category: "image",
    code: "IMAGE_SOURCE_MISSING",
    description: "图片必须存在已发布的资源地址，空图会阻止正式复制。",
    penalty: 25,
    ruleId: "wechat.image.source-present",
    severity: "critical",
    title: "图片资源缺失",
  },
  {
    autoFixAction: "remove_unsafe_attribute",
    category: "image",
    code: "IMAGE_URL_INVALID",
    description: "图片只允许不含凭据、不指向本机或私网的公网 HTTPS URL。",
    penalty: 25,
    ruleId: "wechat.image.safe-url",
    severity: "critical",
    title: "图片地址不安全",
  },
  {
    autoFixAction: "clamp_image_width",
    category: "image",
    code: "IMAGE_WIDTH_OVERFLOW",
    description: "图片不得超过微信正文容器宽度。",
    penalty: 20,
    ruleId: "wechat.image.no-overflow",
    severity: "critical",
    title: "图片宽度溢出",
  },
  {
    autoFixAction: "clamp_image_width",
    category: "image",
    code: "IMAGE_MAX_WIDTH_MISSING",
    description: "图片应使用 max-width:100% 避免窄屏溢出。",
    penalty: 6,
    ruleId: "wechat.image.max-width",
    severity: "warning",
    title: "图片缺少最大宽度保护",
  },
  {
    category: "image",
    code: "IMAGE_ALT_MISSING",
    description: "图片应提供替代文字，便于无障碍阅读和资源失效时理解内容。",
    penalty: 2,
    ruleId: "wechat.image.alt-text",
    severity: "suggestion",
    title: "图片缺少替代文字",
  },
  {
    autoFixAction: "ensure_image_draggable",
    category: "image",
    code: "IMAGE_DRAGGABLE_MISSING",
    description: "图片应固定为 draggable=false，避免复制和编辑时出现意外拖拽行为。",
    penalty: 2,
    ruleId: "wechat.image.not-draggable",
    severity: "suggestion",
    title: "图片未关闭拖拽",
  },
  {
    category: "svg",
    code: "SVG_FALLBACK_MISSING",
    description: "互动内容必须提供可发布的静态备用图。",
    penalty: 25,
    ruleId: "wechat.svg.fallback-present",
    severity: "critical",
    title: "互动内容缺少静态备用图",
  },
  {
    category: "layout",
    code: "NESTING_EXCESSIVE",
    description: "过深嵌套在微信客户端可能产生不可预测的间距和布局。",
    penalty: 8,
    ruleId: "wechat.layout.nesting-depth",
    severity: "warning",
    title: "内容嵌套过深",
  },
  {
    category: "renderer",
    code: "RENDERER_POLICY_DROPPED",
    description: "Renderer 已按安全策略移除不受支持的输出。",
    penalty: 4,
    ruleId: "wechat.renderer.policy-drop",
    severity: "warning",
    title: "部分输出已被安全清理",
  },
  {
    category: "renderer",
    code: "TOKEN_REFERENCE_MISSING",
    description: "缺失的样式 Token 已回退到安全基础样式。",
    penalty: 4,
    ruleId: "wechat.renderer.token-reference",
    severity: "warning",
    title: "样式 Token 不可用",
  },
  {
    category: "renderer",
    code: "COMPONENT_UNAVAILABLE",
    description: "组件缺失或对应 Renderer 不可用时不能确认正式视觉结果。",
    penalty: 25,
    ruleId: "wechat.renderer.component-available",
    severity: "critical",
    title: "组件无法正常渲染",
  },
  {
    category: "svg",
    code: "SVG_STATIC_FALLBACK",
    description: "互动内容已转换为静态备用图。",
    penalty: 2,
    ruleId: "wechat.svg.static-fallback",
    severity: "suggestion",
    title: "互动内容已静态降级",
  },
] as const satisfies readonly CompatibilityRuleDefinition[];

export const WECHAT_COMPATIBILITY_RULES: readonly CompatibilityRuleDefinition[] = Object.freeze(
  RULE_DEFINITIONS.map((rule) => Object.freeze({ ...rule })),
);

const RULES_BY_CODE = new Map<CompatibilityIssueCode, CompatibilityRuleDefinition>(
  WECHAT_COMPATIBILITY_RULES.map((rule) => [rule.code, rule]),
);

export interface CreateCompatibilityIssueInput {
  readonly blockId?: string;
  readonly code: CompatibilityIssueCode;
  readonly details?: Readonly<Record<string, boolean | number | string>>;
  readonly message?: string;
  readonly path: string;
  readonly source: CompatibilityIssueSource;
}

function issueFingerprint(ruleId: string, input: CreateCompatibilityIssueInput): string {
  return JSON.stringify({
    blockId: input.blockId ?? null,
    details: input.details ?? {},
    path: input.path,
    ruleId,
    source: input.source,
  });
}

export function createCompatibilityIssue(input: CreateCompatibilityIssueInput): CompatibilityIssue {
  const rule = RULES_BY_CODE.get(input.code);
  if (rule === undefined) {
    throw new TypeError(`兼容规则 “${input.code}” 未注册`);
  }
  const issueId = createHash("sha256")
    .update(issueFingerprint(rule.ruleId, input))
    .digest("hex")
    .slice(0, 24);
  return {
    ...(rule.autoFixAction === undefined ? {} : { autoFixAction: rule.autoFixAction }),
    autoFixable: rule.autoFixAction !== undefined,
    ...(input.blockId === undefined ? {} : { blockId: input.blockId }),
    category: rule.category,
    code: rule.code,
    details: input.details ?? {},
    issueId: `compat_${issueId}`,
    message: input.message ?? rule.description,
    path: input.path,
    ruleId: rule.ruleId,
    severity: rule.severity,
    source: input.source,
    title: rule.title,
  };
}

export function compatibilityRule(code: CompatibilityIssueCode): CompatibilityRuleDefinition {
  const rule = RULES_BY_CODE.get(code);
  if (rule === undefined) {
    throw new TypeError(`兼容规则 “${code}” 未注册`);
  }
  return rule;
}
