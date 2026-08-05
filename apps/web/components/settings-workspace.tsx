"use client";

import {
  Bell,
  CircleUserRound,
  Keyboard,
  Palette,
  Radio,
  Save,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import {
  applyWorkspacePreferences,
  defaultWorkspacePreferences,
  readWorkspacePreferences,
  type WorkspacePreferences,
  writeWorkspacePreferences,
} from "../lib/preferences";
import { useAppToast } from "./ui/app-toast";

const sections: readonly {
  readonly icon: LucideIcon;
  readonly id: string;
  readonly label: string;
}[] = [
  { id: "preferences", icon: Palette, label: "编辑偏好" },
  { id: "account", icon: CircleUserRound, label: "账号" },
  { id: "wechat", icon: Radio, label: "公众号" },
  { id: "notifications", icon: Bell, label: "通知" },
  { id: "shortcuts", icon: Keyboard, label: "快捷键" },
];

const shortcuts = [
  ["⌘ K", "打开命令面板"],
  ["⌘ N", "新建空白排版"],
  ["⌘ O", "打开粘贴导入"],
  ["⌘ P", "预览当前文章"],
  ["⇧ ⌘ C", "兼容检查"],
  ["⇧ ⌘ P", "一键复制"],
] as const;

export function SettingsWorkspace() {
  const { pushToast } = useAppToast();
  const [activeSection, setActiveSection] = useState("preferences");
  const [preferences, setPreferences] = useState<WorkspacePreferences>(defaultWorkspacePreferences);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readWorkspacePreferences();
    setPreferences(saved);
    applyWorkspacePreferences(saved);
    setHydrated(true);
  }, []);

  const save = () => {
    try {
      writeWorkspacePreferences(preferences);
      pushToast({
        title: "本机偏好已保存",
        description: "这些设置只保存在当前浏览器，不会伪装成云端账号配置。",
        tone: "success",
      });
    } catch {
      pushToast({
        title: "当前浏览器禁止本机存储",
        description: "偏好会保留到本次页面关闭，不影响文章和正式输出。",
        tone: "warning",
      });
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[12px] font-medium text-accent">WORKSPACE PREFERENCES</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">设置</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
          管理本机编辑偏好，并快速进入账号会话、公众号品牌空间和任务通知中心。
        </p>
      </section>

      <section className="grid overflow-hidden rounded-card border border-line bg-panel shadow-subtle lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label="设置分类"
          className="border-b border-line bg-panel-muted p-3 lg:border-r lg:border-b-0"
        >
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                aria-current={activeSection === section.id ? "page" : undefined}
                className={`flex h-10 w-full items-center gap-3 rounded-control px-3 text-[12px] font-medium transition ${
                  activeSection === section.id
                    ? "bg-panel text-accent shadow-subtle"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={15} />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-[470px] p-5 sm:p-7">
          {activeSection === "preferences" ? (
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold text-ink">编辑偏好</h2>
              <p className="mt-1 text-[11px] text-muted">保存于当前浏览器，可随时修改。</p>
              <div className="mt-6 space-y-6">
                <label className="block">
                  <span className="text-[12px] font-medium text-ink">默认公众号输出模式</span>
                  <select
                    className="mt-2 h-10 w-full rounded-control border border-line bg-panel px-3 text-[12px] text-ink sm:w-64"
                    disabled={!hydrated}
                    onChange={(event) =>
                      setPreferences({
                        ...preferences,
                        copyMode: event.target.value as WorkspacePreferences["copyMode"],
                      })
                    }
                    value={preferences.copyMode}
                  >
                    <option value="standard">标准</option>
                    <option value="wechat_safe">微信安全</option>
                    <option value="static">静态</option>
                  </select>
                </label>
                <PreferenceSwitch
                  checked={preferences.compactEditor}
                  description="打开文章时优先收起工作台主导航，为画布保留更多宽度。"
                  label="紧凑编辑器"
                  onChange={(checked) => setPreferences({ ...preferences, compactEditor: checked })}
                />
                <PreferenceSwitch
                  checked={preferences.reduceMotion}
                  description="减少卡片位移、抽屉与弹窗的过渡动画。"
                  label="减少动效"
                  onChange={(checked) => setPreferences({ ...preferences, reduceMotion: checked })}
                />
              </div>
              <button
                className="mt-8 inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[12px] font-semibold text-white hover:bg-accent-strong"
                onClick={save}
                type="button"
              >
                <Save aria-hidden="true" size={14} />
                保存本机偏好
              </button>
            </div>
          ) : activeSection === "shortcuts" ? (
            <div className="max-w-2xl">
              <h2 className="text-base font-semibold text-ink">快捷键</h2>
              <p className="mt-1 text-[11px] text-muted">在输入框内不会拦截普通文字输入。</p>
              <dl className="mt-6 divide-y divide-line rounded-control border border-line">
                {shortcuts.map(([keys, description]) => (
                  <div className="flex items-center justify-between gap-4 px-4 py-3" key={keys}>
                    <dt className="text-[12px] text-ink">{description}</dt>
                    <dd>
                      <kbd className="rounded-md border border-line bg-panel-muted px-2 py-1 font-mono text-[10px] text-muted">
                        {keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <ConnectedSettings section={activeSection} />
          )}
        </div>
      </section>
    </div>
  );
}

function PreferenceSwitch({
  checked,
  description,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5">
      <span>
        <span className="block text-[12px] font-medium text-ink">{label}</span>
        <span className="mt-1 block text-[11px] leading-5 text-muted">{description}</span>
      </span>
      <input
        checked={checked}
        className="peer sr-only"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30 ${
          checked ? "bg-accent" : "bg-zinc-200"
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-4 rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </label>
  );
}

function ConnectedSettings({ section }: { readonly section: string }) {
  const content: Readonly<
    Record<
      string,
      {
        readonly action: string;
        readonly description: string;
        readonly href: string;
        readonly title: string;
      }
    >
  > = {
    account: {
      title: "账号会话已接通",
      description: "当前账号通过安全 Cookie 会话登录，支持 CSRF 防护、登录限流和一键退出。",
      href: "/workspace/help",
      action: "查看安全说明",
    },
    notifications: {
      title: "任务通知已接通",
      description: "DOCX 解析、网页抓取的进度和失败消息会集中显示在任务中心。",
      href: "/workspace/jobs",
      action: "打开任务中心",
    },
    wechat: {
      title: "公众号品牌空间已接通",
      description:
        "可创建多个公众号空间、设置默认账号并管理状态；公众号平台 OAuth 同步仍保持关闭。",
      href: "/workspace/accounts",
      action: "管理公众号",
    },
  };
  const selected = content[section] ?? content.account!;
  return (
    <div className="grid min-h-[360px] place-items-center text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-panel-muted text-muted">
          {section === "account" ? (
            <CircleUserRound aria-hidden="true" size={20} />
          ) : section === "wechat" ? (
            <Radio aria-hidden="true" size={20} />
          ) : (
            <Bell aria-hidden="true" size={20} />
          )}
        </span>
        <h2 className="mt-4 text-sm font-semibold text-ink">{selected.title}</h2>
        <p className="mt-2 text-[12px] leading-5 text-muted">{selected.description}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[10px] text-success">
          <ShieldCheck aria-hidden="true" size={12} />
          已启用的能力真实可用
        </span>
        <Link
          className="mx-auto mt-5 flex h-9 w-fit items-center rounded-control bg-accent px-4 text-[11px] font-semibold text-white"
          href={selected.href}
        >
          {selected.action}
        </Link>
      </div>
    </div>
  );
}
