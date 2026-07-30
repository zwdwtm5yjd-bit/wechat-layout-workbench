"use client";

import { Check, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Checkbox } from "radix-ui";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAppToast } from "./ui/app-toast";

export function LoginForm() {
  const { pushToast } = useAppToast();
  const timer = useRef<number | undefined>(undefined);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(
    () => () => {
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    timer.current = window.setTimeout(() => {
      setSubmitting(false);
      pushToast({
        description: "登录接口、会话和 CSRF 将在 S1-AUTH-001 接入；当前不会发送账号信息。",
        title: "登录服务尚未接入",
        tone: "warning",
      });
    }, 450);
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-[13px] font-medium text-ink" htmlFor="email">
          邮箱
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
            size={17}
          />
          <input
            autoComplete="username"
            className="h-11 w-full rounded-control border border-line bg-panel pr-3 pl-10 text-sm text-ink shadow-subtle outline-none transition placeholder:text-faint hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-indigo-100"
            id="email"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[13px] font-medium text-ink" htmlFor="password">
            密码
          </label>
          <button
            className="text-[12px] font-medium text-accent transition hover:text-accent-strong"
            onClick={() => {
              pushToast({
                description: "密码重置流程将在认证任务中与邮件服务一并接入。",
                title: "忘记密码暂未开放",
              });
            }}
            type="button"
          >
            忘记密码？
          </button>
        </div>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
            size={17}
          />
          <input
            autoComplete="current-password"
            className="h-11 w-full rounded-control border border-line bg-panel pr-11 pl-10 text-sm text-ink shadow-subtle outline-none transition placeholder:text-faint hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-indigo-100"
            id="password"
            minLength={12}
            name="password"
            placeholder="输入你的密码"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="absolute top-1/2 right-2.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-faint transition hover:bg-hover hover:text-ink"
            onClick={() => {
              setShowPassword((visible) => !visible);
            }}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" size={16} />
            ) : (
              <Eye aria-hidden="true" size={16} />
            )}
          </button>
        </div>
      </div>
      <label className="flex w-fit items-center gap-2.5 text-[13px] text-muted">
        <Checkbox.Root
          aria-label="记住这台设备"
          checked={rememberDevice}
          className="grid size-[18px] place-items-center rounded-[5px] border border-line-strong bg-panel text-white outline-none transition data-[state=checked]:border-accent data-[state=checked]:bg-accent"
          onCheckedChange={(checked) => {
            setRememberDevice(checked === true);
          }}
        >
          <Checkbox.Indicator>
            <Check aria-hidden="true" size={13} strokeWidth={3} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        记住这台设备
      </label>
      <button
        className="flex h-11 w-full items-center justify-center rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-subtle transition hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "正在登录…" : "登录"}
      </button>
      <div className="rounded-control border border-indigo-100 bg-accent-soft px-3.5 py-3 text-[12px] leading-5 text-indigo-800">
        当前是基础框架阶段。登录表单不会发送或保存你的账号信息。
      </div>
    </form>
  );
}
