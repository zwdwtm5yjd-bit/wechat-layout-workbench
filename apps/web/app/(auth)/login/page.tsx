import type { Metadata } from "next";

import { LoginForm } from "../../../components/login-form";
import { ProductMark } from "../../../components/product-mark";

export const metadata: Metadata = {
  title: "登录",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-panel lg:grid-cols-[minmax(360px,40%)_1fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#29246d] px-10 py-10 text-white lg:flex lg:flex-col xl:px-14 xl:py-12">
        <div className="login-visual-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-32 -left-28 size-80 rounded-full bg-indigo-400/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-80px] bottom-12 size-72 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative z-10">
          <ProductMark inverse />
        </div>
        <div className="relative z-10 my-auto max-w-[520px] py-16">
          <p className="text-[12px] font-semibold tracking-[0.18em] text-indigo-200 uppercase">
            Content design workspace
          </p>
          <h1 className="mt-5 text-[clamp(32px,4vw,56px)] leading-[1.08] font-semibold tracking-[-0.045em]">
            让定稿文章，
            <br />
            更快成为好设计。
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-indigo-100/80">
            在一个克制、清晰的工作台里完成结构确认、主题应用、组件编排和微信发布准备。
          </p>
          <div aria-hidden="true" className="relative mt-12 h-[290px] max-w-[510px]">
            <div className="absolute top-0 left-8 w-[72%] rotate-[-3deg] rounded-[14px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
              <div className="mb-5 flex items-center gap-2">
                <span className="size-2 rounded-full bg-indigo-200/80" />
                <span className="h-1.5 w-16 rounded-full bg-white/20" />
              </div>
              <div className="h-3 w-[76%] rounded-full bg-white/80" />
              <div className="mt-3 h-2 w-[48%] rounded-full bg-white/25" />
              <div className="mt-7 space-y-2.5">
                <div className="h-2 rounded-full bg-white/20" />
                <div className="h-2 w-[92%] rounded-full bg-white/20" />
                <div className="h-2 w-[84%] rounded-full bg-white/20" />
              </div>
              <div className="mt-7 grid grid-cols-3 gap-2.5">
                <div className="h-16 rounded-lg bg-indigo-300/20" />
                <div className="h-16 rounded-lg bg-violet-300/20" />
                <div className="h-16 rounded-lg bg-fuchsia-300/15" />
              </div>
            </div>
            <div className="absolute right-0 bottom-0 w-[48%] rotate-[4deg] rounded-[14px] border border-white/15 bg-white/95 p-4 text-zinc-900 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold">兼容检查</span>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                  96 分
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-[92%] rounded-full bg-indigo-500" />
              </div>
              <p className="mt-3 text-[10px] leading-4 text-zinc-500">
                内容结构与微信环境兼容，可继续预览。
              </p>
            </div>
          </div>
        </div>
        <p className="relative z-10 text-[11px] text-indigo-200/65">
          私有云端部署 · 内容与凭据由你掌控
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-panel px-6 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-12 lg:hidden">
            <ProductMark />
          </div>
          <p className="text-[12px] font-semibold tracking-[0.12em] text-accent uppercase">
            欢迎回来
          </p>
          <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-ink">
            登录你的工作台
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">使用私有部署中配置的 Owner 账号继续。</p>
          <LoginForm />
          <p className="mt-8 text-center text-[11px] text-faint">一键视觉 · V0.1 基础框架</p>
        </div>
      </section>
    </main>
  );
}
