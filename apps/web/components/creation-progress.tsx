import { Check } from "lucide-react";

const steps = ["导入原稿", "检查结构", "选择成稿", "完善并发布"] as const;

export function CreationProgress({ current }: { readonly current: 1 | 2 | 3 | 4 }) {
  return (
    <nav
      aria-label="公众号文章制作进度"
      className="-mx-1 overflow-x-auto px-1 pb-1 overscroll-x-contain"
    >
      <ol className="grid min-w-[620px] snap-x snap-mandatory grid-cols-4 gap-2 rounded-card bg-panel p-3 shadow-subtle sm:min-w-0">
        {steps.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3 | 4;
          const complete = number < current;
          const active = number === current;
          return (
            <li
              aria-current={active ? "step" : undefined}
              className={`flex snap-start items-center gap-2 rounded-control px-3 py-2.5 ${
                active ? "bg-accent-soft text-accent" : "text-muted"
              }`}
              key={label}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                  complete
                    ? "bg-success text-white"
                    : active
                      ? "bg-accent text-white"
                      : "bg-panel-muted text-muted"
                }`}
              >
                {complete ? <Check aria-hidden="true" size={12} /> : number}
              </span>
              <span className="text-xs font-medium">
                <span className="sr-only">
                  {complete ? "已完成：" : active ? "当前步骤：" : ""}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
