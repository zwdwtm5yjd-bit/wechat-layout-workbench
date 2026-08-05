import { Check } from "lucide-react";

const steps = ["导入原稿", "检查结构", "选择成稿", "完善并发布"] as const;

export function CreationProgress({ current }: { readonly current: 1 | 2 | 3 | 4 }) {
  return (
    <nav
      aria-label="公众号文章制作进度"
      className="grid grid-cols-2 gap-2 rounded-card border border-line bg-panel p-3 shadow-subtle sm:grid-cols-4"
    >
      {steps.map((label, index) => {
        const number = (index + 1) as 1 | 2 | 3 | 4;
        const complete = number < current;
        const active = number === current;
        return (
          <div
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-2 rounded-control px-3 py-2 ${
              active ? "bg-accent-soft text-accent" : "text-muted"
            }`}
            key={label}
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${
                complete
                  ? "bg-success text-white"
                  : active
                    ? "bg-accent text-white"
                    : "bg-panel-muted text-faint"
              }`}
            >
              {complete ? <Check aria-hidden="true" size={10} /> : number}
            </span>
            <span className="text-[10px] font-medium">{label}</span>
          </div>
        );
      })}
    </nav>
  );
}
