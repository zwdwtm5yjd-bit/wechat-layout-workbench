import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FileInput,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const steps = [
  {
    title: "1. 创建或导入",
    description: "空白文章、粘贴正文、DOCX 和公开网页都可进入同一工作流。",
    href: "/workspace/imports/paste",
    icon: FileInput,
  },
  {
    title: "2. 确认结构",
    description: "导入内容先清洗，再逐块确认标题、正文、列表、引用和图片关系。",
    href: "/workspace/jobs",
    icon: Layers3,
  },
  {
    title: "3. 编辑与排版",
    description: "编辑器支持自动保存、组件插入、主题试穿、文本锁定和历史快照。",
    href: "/workspace/articles",
    icon: Sparkles,
  },
  {
    title: "4. 预览与复制",
    description: "在手机、平板和微信安全模式下检查，生成兼容报告后复制到公众号。",
    href: "/workspace/articles",
    icon: ClipboardCheck,
  },
] as const;

const questions = [
  [
    "素材为什么打不开永久链接？",
    "所有素材默认私有，只在预览和编辑时签发短时地址，避免对象存储被公开枚举。",
  ],
  [
    "导入任务失败怎么办？",
    "进入任务中心查看错误说明；可重试的失败任务会显示“重试”按钮，运行中的任务也可取消。",
  ],
  [
    "主题会改掉正文吗？",
    "不会。正式应用主题前会自动创建快照，并校验原文未变化；必要时可以从快照恢复。",
  ],
  [
    "是否必须授权公众号？",
    "不需要。当前正式复制工作流不依赖公众号授权，排版完成后可直接粘贴到公众号后台。",
  ],
] as const;

export function HelpCenter() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-[12px] font-medium text-accent">PRODUCT GUIDE</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">帮助中心</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
          一键视觉把导入、结构确认、编辑、主题、组件、预览和公众号复制放在一条可恢复的工作流里。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              className="group rounded-card border border-line bg-panel p-5 shadow-subtle transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-raised"
              href={step.href}
              key={step.title}
            >
              <span className="grid size-10 place-items-center rounded-control bg-accent-soft text-accent">
                <Icon aria-hidden="true" size={18} />
              </span>
              <h2 className="mt-4 text-[13px] font-semibold text-ink">{step.title}</h2>
              <p className="mt-2 text-[11px] leading-5 text-muted">{step.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                打开功能
                <ArrowRight aria-hidden="true" size={12} />
              </span>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-card border border-line bg-panel p-5 shadow-subtle sm:p-6">
          <div className="flex items-center gap-3">
            <BookOpenCheck aria-hidden="true" className="text-accent" size={18} />
            <h2 className="text-base font-semibold text-ink">常见问题</h2>
          </div>
          <dl className="mt-5 divide-y divide-line">
            {questions.map(([question, answer]) => (
              <div className="py-4 first:pt-0 last:pb-0" key={question}>
                <dt className="text-[12px] font-semibold text-ink">{question}</dt>
                <dd className="mt-1.5 text-[11px] leading-5 text-muted">{answer}</dd>
              </div>
            ))}
          </dl>
        </div>
        <aside className="rounded-card bg-[#26225f] p-6 text-white shadow-subtle">
          <span className="grid size-10 place-items-center rounded-control bg-white/10 text-indigo-100">
            <ShieldCheck aria-hidden="true" size={19} />
          </span>
          <h2 className="mt-5 text-base font-semibold">数据默认安全</h2>
          <ul className="mt-4 space-y-3 text-[11px] leading-5 text-indigo-100/80">
            <li>· 会话 Cookie、CSRF 和登录限流</li>
            <li>· 私有素材与短时签名地址</li>
            <li>· 导入内容脚本与危险链接清洗</li>
            <li>· 自动保存、快照与版本冲突保护</li>
            <li>· 所有关键修改写入审计日志</li>
          </ul>
          <Link
            className="mt-6 inline-flex h-9 items-center gap-2 rounded-control bg-white px-3 text-[11px] font-semibold text-[#26225f]"
            href="/workspace/settings"
          >
            查看工作台设置
            <ArrowRight aria-hidden="true" size={12} />
          </Link>
        </aside>
      </section>
    </div>
  );
}
