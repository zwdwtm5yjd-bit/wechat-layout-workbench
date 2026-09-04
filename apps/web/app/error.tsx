"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";

interface ApplicationErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ApplicationError({ error, reset }: ApplicationErrorProps) {
  const reference = error.digest;

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <section className="w-full max-w-md rounded-card border border-line bg-panel p-8 text-center shadow-raised">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
          <CircleAlert aria-hidden="true" size={23} />
        </span>
        <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-danger uppercase">
          页面暂时不可用
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-ink">
          这部分没有正常加载
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          已保存的内容不会受影响。请先重新尝试；如果仍然失败，可返回工作台后重新进入。
        </p>
        {reference === undefined ? null : (
          <p className="mt-3 text-[11px] text-faint">问题编号：{reference}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.98]"
            onClick={reset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
            重新尝试
          </button>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-control border border-line bg-panel px-4 text-sm font-semibold text-ink transition-[background-color,border-color,transform] duration-150 hover:border-line-strong hover:bg-hover active:scale-[0.98]"
            href="/workspace"
          >
            返回工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
