"use client";

import { Check, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Checkbox } from "radix-ui";
import { useRef, useState, type FormEvent } from "react";

import { AuthClientError, login } from "../lib/auth/client";
import { useAppToast } from "./ui/app-toast";

export function LoginForm() {
  const { pushToast } = useAppToast();
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"identifier" | "password" | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const identifier = String(formData.get("identifier") ?? "");
    const password = String(formData.get("password") ?? "");
    const passwordInput = form.elements.namedItem("password");

    setErrorMessage(null);
    setInvalidField(null);
    setSubmitting(true);

    try {
      await login({
        identifier,
        password,
        rememberDevice,
      });

      pushToast({
        description: "会话已建立，正在进入工作台。",
        title: "登录成功",
        tone: "success",
      });

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const destination =
        requestedPath?.startsWith("/workspace") === true ? requestedPath : "/workspace";
      window.location.assign(destination);
    } catch (error) {
      if (passwordInput instanceof HTMLInputElement) {
        passwordInput.value = "";
      }

      if (error instanceof AuthClientError) {
        const relatedField =
          error.code === "AUTH_INVALID_CREDENTIALS"
            ? "password"
            : error.status === 400
              ? "identifier"
              : null;

        setInvalidField(relatedField);
        setErrorMessage(
          error.retryAfterSeconds === undefined
            ? error.message
            : `${error.message}（约 ${Math.ceil(error.retryAfterSeconds / 60)} 分钟）`,
        );

        if (relatedField !== null) {
          window.requestAnimationFrame(() => {
            const input =
              relatedField === "password" ? passwordInputRef.current : identifierInputRef.current;
            input?.focus();
          });
        }
      } else {
        setInvalidField(null);
        setErrorMessage("无法连接认证服务，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-5" method="post" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-[13px] font-medium text-ink" htmlFor="identifier">
          邮箱或用户名
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
            size={17}
          />
          <input
            ref={identifierInputRef}
            aria-describedby={errorMessage === null ? undefined : "login-error"}
            aria-invalid={invalidField === "identifier"}
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            className="h-11 w-full rounded-control border border-line bg-panel pr-3 pl-10 text-base text-ink shadow-subtle outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent/15"
            disabled={submitting}
            id="identifier"
            maxLength={320}
            name="identifier"
            onChange={() => {
              if (invalidField === "identifier") {
                setInvalidField(null);
                setErrorMessage(null);
              }
            }}
            placeholder="owner@example.com"
            required
            spellCheck={false}
            type="text"
          />
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-start justify-between gap-4">
          <label className="text-[13px] font-medium text-ink" htmlFor="password">
            密码
          </label>
          <p className="max-w-[240px] text-right text-[12px] leading-5 text-muted">
            忘记密码？请联系系统管理员重置。
          </p>
        </div>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
            size={17}
          />
          <input
            ref={passwordInputRef}
            aria-describedby={errorMessage === null ? undefined : "login-error"}
            aria-invalid={invalidField === "password"}
            autoCapitalize="none"
            autoComplete="current-password"
            autoCorrect="off"
            className="h-11 w-full rounded-control border border-line bg-panel pr-12 pl-10 text-base text-ink shadow-subtle outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent/15"
            id="password"
            disabled={submitting}
            maxLength={256}
            minLength={8}
            name="password"
            onChange={() => {
              if (invalidField === "password") {
                setInvalidField(null);
                setErrorMessage(null);
              }
            }}
            placeholder="输入你的密码"
            required
            spellCheck={false}
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-0.5 grid size-10 -translate-y-1/2 place-items-center rounded-control text-faint transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-95"
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
      <label className="flex min-h-10 w-fit cursor-pointer items-center gap-2.5 text-[13px] text-muted">
        <Checkbox.Root
          aria-label="记住这台设备"
          checked={rememberDevice}
          className="grid size-[18px] place-items-center rounded-[5px] border border-line-strong bg-panel text-white outline-none transition-[background-color,border-color,transform] duration-150 active:scale-95 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
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
      {errorMessage === null ? null : (
        <p
          className="rounded-control border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12px] leading-5 text-danger"
          id="login-error"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
      <button
        className="flex h-11 w-full items-center justify-center rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-subtle transition-[background-color,opacity,transform] duration-150 hover:bg-accent-strong active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 disabled:active:scale-100"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "正在登录…" : "登录"}
      </button>
      <div className="rounded-control border border-accent/15 bg-accent-soft px-3.5 py-3 text-[12px] leading-5 text-accent-strong">
        密码只发送到私有部署的认证服务；浏览器仅保存 HttpOnly Session Cookie。
      </div>
    </form>
  );
}
