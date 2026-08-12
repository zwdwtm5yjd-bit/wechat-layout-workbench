import type { AiLayoutCandidate } from "@wechat-layout/api-contracts";

import { compareAiLayoutCandidate } from "../lib/ai-layout/candidate-comparison";
import { readableTextColor } from "../lib/ai-layout/color-contrast";
import type { LayoutPlan } from "../lib/layout-planner";

interface AiLayoutCandidatePreviewProps {
  readonly candidate: AiLayoutCandidate;
  readonly plan: LayoutPlan;
}

interface MiniatureProps {
  readonly accent: string;
  readonly emphasisCount: number;
  readonly imageCount: number;
  readonly muted: string;
  readonly primary: string;
  readonly sectionCount: number;
  readonly surface: string;
}

function Line({ color, width = "100%" }: { readonly color: string; readonly width?: string }) {
  return <span className="block h-1.5 rounded-full" style={{ backgroundColor: color, width }} />;
}

function EditorialMiniature({ accent, muted, primary, surface }: MiniatureProps) {
  return (
    <div
      className="grid h-full grid-cols-[44px_1fr] gap-3 p-4"
      style={{ backgroundColor: surface }}
    >
      <div className="border-r pr-2" style={{ borderColor: `${primary}35` }}>
        <p className="text-[18px] font-black leading-none" style={{ color: primary }}>
          01
        </p>
        <div className="mt-3 space-y-2">
          <Line color={`${accent}80`} width="75%" />
          <Line color={`${muted}55`} />
          <Line color={`${muted}55`} width="65%" />
        </div>
      </div>
      <div>
        <div className="h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
        <div className="mt-3 space-y-1.5">
          <Line color={primary} width="82%" />
          <Line color={primary} width="58%" />
        </div>
        <div className="mt-4 border-l-2 pl-2" style={{ borderColor: accent }}>
          <div className="space-y-1.5">
            <Line color={`${muted}75`} />
            <Line color={`${muted}65`} width="90%" />
            <Line color={`${muted}55`} width="68%" />
          </div>
        </div>
        <div className="mt-4 h-8 border" style={{ borderColor: `${primary}28` }} />
      </div>
    </div>
  );
}

function BriefingMiniature({ accent, muted, primary, surface }: MiniatureProps) {
  return (
    <div className="h-full p-4" style={{ backgroundColor: surface }}>
      <div className="rounded-md border-2 px-3 py-2" style={{ borderColor: primary }}>
        <Line color={primary} width="72%" />
        <div className="mt-2">
          <Line color={`${muted}65`} width="46%" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            className="rounded-md border p-2"
            key={index}
            style={{
              backgroundColor: index === 0 ? `${accent}12` : surface,
              borderColor: `${primary}26`,
            }}
          >
            <span
              className="block size-3 rounded-sm"
              style={{ backgroundColor: index === 0 ? accent : `${primary}35` }}
            />
            <div className="mt-2 space-y-1.5">
              <Line color={`${primary}80`} width={index % 2 === 0 ? "80%" : "65%"} />
              <Line color={`${muted}55`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceMiniature({
  accent,
  emphasisCount,
  imageCount,
  muted,
  primary,
  sectionCount,
  surface,
}: MiniatureProps) {
  const metrics = [
    { label: "章节", value: sectionCount },
    { label: "重点", value: emphasisCount },
    { label: "原图", value: imageCount },
  ] as const;
  return (
    <div className="h-full p-4" style={{ backgroundColor: surface }}>
      <div className="flex items-end gap-2">
        <span className="text-[20px] font-black leading-none" style={{ color: accent }}>
          {String(sectionCount).padStart(2, "0")}
        </span>
        <div className="mb-0.5 flex-1 border-b-2 pb-1.5" style={{ borderColor: accent }}>
          <Line color={primary} width="76%" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {metrics.map(({ label, value }) => (
          <div
            className="rounded-md p-2 text-center"
            key={label}
            style={{ backgroundColor: `${primary}0d` }}
          >
            <p className="text-[11px] font-black" style={{ color: primary }}>
              {value}
            </p>
            <p className="mt-1 text-[9px] font-medium" style={{ color: muted }}>
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-2">
        <div className="space-y-2 border-l-2 pl-2" style={{ borderColor: accent }}>
          <Line color={`${primary}75`} />
          <Line color={`${muted}60`} width="90%" />
          <Line color={`${muted}50`} width="72%" />
        </div>
        <div
          className="grid place-items-center rounded-md border border-dashed px-1 text-center"
          style={{ borderColor: `${primary}35` }}
        >
          <span className="text-[9px] font-semibold" style={{ color: muted }}>
            真实结构计数
          </span>
        </div>
      </div>
    </div>
  );
}

function MinimalMiniature({ accent, muted, primary, surface }: MiniatureProps) {
  return (
    <div className="h-full px-7 py-5" style={{ backgroundColor: surface }}>
      <div className="mx-auto h-0.5 w-7" style={{ backgroundColor: accent }} />
      <div className="mx-auto mt-4 space-y-2 text-center">
        <Line color={primary} width="70%" />
        <Line color={`${primary}72`} width="48%" />
      </div>
      <div className="mt-7 space-y-2.5">
        <Line color={`${muted}65`} width="94%" />
        <Line color={`${muted}58`} />
        <Line color={`${muted}52`} width="87%" />
      </div>
      <div className="mt-7 flex items-center gap-3">
        <span className="h-px flex-1" style={{ backgroundColor: `${primary}22` }} />
        <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
        <span className="h-px flex-1" style={{ backgroundColor: `${primary}22` }} />
      </div>
    </div>
  );
}

function DocumentaryMiniature({ accent, imageCount, muted, primary, surface }: MiniatureProps) {
  return (
    <div className="h-full p-3" style={{ backgroundColor: surface }}>
      <div
        className="relative grid h-[84px] place-items-center overflow-hidden rounded-sm border border-dashed px-3 text-center"
        style={{ backgroundColor: `${accent}0d`, borderColor: `${primary}40` }}
      >
        <span
          className="absolute top-2 left-2 rounded-sm px-1.5 py-1 text-[9px] font-bold"
          style={{ backgroundColor: primary, color: readableTextColor(primary) }}
        >
          纪实图文
        </span>
        <span className="mt-5 text-[10px] font-semibold" style={{ color: muted }}>
          {imageCount > 0 ? `原图位置 · ${imageCount} 张` : "原文无图 · 保持留白"}
        </span>
      </div>
      <div className="mt-2 flex items-start gap-2">
        <span className="mt-0.5 block h-7 w-1 shrink-0" style={{ backgroundColor: accent }} />
        <div className="flex-1 space-y-1.5">
          <Line color={primary} width="74%" />
          <Line color={`${muted}60`} />
          <Line color={`${muted}50`} width="82%" />
        </div>
      </div>
    </div>
  );
}

function RoadmapMiniature({ accent, muted, primary, sectionCount, surface }: MiniatureProps) {
  const stepCount = Math.min(3, sectionCount);
  return (
    <div className="h-full p-4" style={{ backgroundColor: surface }}>
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-1 text-[9px] font-black"
          style={{ backgroundColor: primary, color: readableTextColor(primary) }}
        >
          行动路线
        </span>
        <Line color={primary} width="52%" />
      </div>
      <div className="relative mt-4 space-y-2.5 pl-1">
        {stepCount === 0 ? (
          <div
            className="rounded-md border border-dashed px-3 py-4 text-center text-[10px] font-medium"
            style={{ borderColor: `${primary}35`, color: muted }}
          >
            原文暂无章节
          </div>
        ) : (
          <span
            className="absolute top-2 bottom-2 left-[12px] w-px"
            style={{ backgroundColor: `${accent}60` }}
          />
        )}
        {Array.from({ length: stepCount }, (_, index) => String(index + 1).padStart(2, "0")).map(
          (step, index) => (
            <div className="relative flex items-center gap-2" key={step}>
              <span
                className="z-10 grid size-6 shrink-0 place-items-center rounded-full text-[9px] font-black"
                style={{
                  backgroundColor: index === 0 ? accent : primary,
                  color: readableTextColor(index === 0 ? accent : primary),
                }}
              >
                {step}
              </span>
              <div
                className="flex-1 rounded-md border px-2 py-1.5"
                style={{ borderColor: `${primary}22` }}
              >
                <Line color={`${primary}85`} width={index === 1 ? "62%" : "76%"} />
                <div className="mt-1">
                  <Line color={`${muted}50`} width="90%" />
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function AiLayoutCandidatePreview({ candidate, plan }: AiLayoutCandidatePreviewProps) {
  const comparison = compareAiLayoutCandidate(candidate);
  const props: MiniatureProps = {
    accent: plan.designTokens.accentColor,
    emphasisCount: comparison.emphasisCount,
    imageCount: comparison.imageCount,
    muted: plan.designTokens.mutedColor,
    primary: plan.designTokens.primaryColor,
    sectionCount: comparison.sectionCount,
    surface: plan.designTokens.surfaceColor,
  };
  const preview = (() => {
    switch (candidate.profileId) {
      case "editorial-index":
        return <EditorialMiniature {...props} />;
      case "briefing-cards":
        return <BriefingMiniature {...props} />;
      case "evidence-led":
        return <EvidenceMiniature {...props} />;
      case "minimal-longread":
        return <MinimalMiniature {...props} />;
      case "documentary-visual":
        return <DocumentaryMiniature {...props} />;
      case "action-roadmap":
        return <RoadmapMiniature {...props} />;
    }
  })();

  return (
    <div
      aria-label={`${candidate.structureLabel}结构预演`}
      className="h-[164px] overflow-hidden rounded-control border border-line shadow-subtle"
      role="img"
    >
      <div className="flex h-6 items-center justify-between border-b border-line bg-panel-soft px-2.5 text-[9px] font-semibold text-muted">
        <span>结构预演 · 当前文章</span>
        <span>
          {comparison.sectionCount} 章节 · {comparison.imageCount} 图
        </span>
      </div>
      <div className="h-[138px]">{preview}</div>
    </div>
  );
}
