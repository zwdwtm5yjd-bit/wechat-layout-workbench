import { WandSparkles } from "lucide-react";

interface ProductMarkProps {
  readonly compact?: boolean;
  readonly inverse?: boolean;
}

export function ProductMark({ compact = false, inverse = false }: ProductMarkProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${
          inverse ? "bg-white text-indigo-700" : "bg-accent text-white"
        }`}
      >
        <WandSparkles aria-hidden="true" size={18} strokeWidth={2.2} />
      </span>
      {compact ? null : (
        <span
          className={
            inverse ? "text-[15px] font-semibold text-white" : "text-[15px] font-semibold text-ink"
          }
        >
          一键视觉
        </span>
      )}
    </span>
  );
}
