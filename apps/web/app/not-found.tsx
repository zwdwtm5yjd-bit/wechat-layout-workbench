import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <section className="w-full max-w-md rounded-card border border-line bg-panel p-8 text-center shadow-subtle">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <SearchX aria-hidden="true" size={22} />
        </span>
        <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-accent uppercase">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">没有找到这个页面</h1>
        <p className="mt-3 text-sm leading-6 text-muted">地址可能已改变，或者功能尚未开放。</p>
        <Link
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-panel px-4 text-sm font-semibold text-ink transition hover:bg-hover"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          返回入口
        </Link>
      </section>
    </main>
  );
}
