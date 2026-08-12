import type {
  AiLayoutBlockDecision,
  AiLayoutCandidate,
  AiLayoutRhythm,
  AiLayoutVisualIntensity,
} from "@wechat-layout/api-contracts";

import { compareAiLayoutCandidate } from "../lib/ai-layout/candidate-comparison";
import { readableTextColor } from "../lib/ai-layout/color-contrast";
import type { LayoutPlan } from "../lib/layout-planner";

interface AiLayoutCandidatePreviewProps {
  readonly candidate: AiLayoutCandidate;
  readonly plan: LayoutPlan;
}

interface PreviewPalette {
  readonly accent: string;
  readonly muted: string;
  readonly primary: string;
  readonly surface: string;
}

const RHYTHM_LAYOUT: Readonly<
  Record<
    AiLayoutRhythm,
    { readonly gap: number; readonly maxBlocks: number; readonly padding: number }
  >
> = {
  airy: { gap: 6, maxBlocks: 4, padding: 10 },
  balanced: { gap: 4, maxBlocks: 6, padding: 8 },
  compact: { gap: 2, maxBlocks: 8, padding: 6 },
};

const INTENSITY_LAYOUT: Readonly<
  Record<
    AiLayoutVisualIntensity,
    { readonly accentAlpha: string; readonly borderWidth: number; readonly surfaceAlpha: string }
  >
> = {
  balanced: { accentAlpha: "2e", borderWidth: 2, surfaceAlpha: "12" },
  bold: { accentAlpha: "52", borderWidth: 3, surfaceAlpha: "20" },
  restrained: { accentAlpha: "22", borderWidth: 1, surfaceAlpha: "0b" },
};

function withAlpha(color: string, alpha: string): string {
  return /^#[\da-f]{6}$/iu.test(color) ? `${color}${alpha}` : color;
}

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return hash;
}

function lineWidth(text: string, minimum: number, maximum: number): string {
  const length = [...text].length;
  return `${String(Math.min(maximum, Math.max(minimum, minimum + (length % 13) * 3)))}%`;
}

function Line({
  color,
  height = 4,
  width = "100%",
}: {
  readonly color: string;
  readonly height?: number;
  readonly width?: string;
}) {
  return <span className="block rounded-full" style={{ backgroundColor: color, height, width }} />;
}

function HeroPreview({
  candidate,
  palette,
  variant,
}: {
  readonly candidate: AiLayoutCandidate;
  readonly palette: PreviewPalette;
  readonly variant: number;
}) {
  const { hero, visualIntensity } = candidate.decision;
  const intensity = INTENSITY_LAYOUT[visualIntensity];
  const heroVariant = stableHash(`${hero.componentId}:${variant.toString()}`) % 4;
  const titleWidth = lineWidth(hero.title, 54, 92);
  const footerWidth = lineWidth(hero.footer, 32, 68);
  const commonProps = {
    "data-hero-component": hero.componentId,
    "data-hero-variant": heroVariant,
  } as const;

  if (heroVariant === 1) {
    const foreground = readableTextColor(palette.primary);
    return (
      <div
        {...commonProps}
        className="grid min-h-10 grid-cols-[1fr_auto] items-end gap-2 rounded-sm px-2.5 py-2"
        style={{ backgroundColor: palette.primary }}
      >
        <div className="space-y-1.5">
          <Line color={foreground} height={5} width={titleWidth} />
          <Line color={withAlpha(foreground, "a8")} height={3} width={footerWidth} />
        </div>
        <span
          className="rounded-full px-1.5 py-0.5 text-[7px] font-bold"
          style={{ backgroundColor: palette.accent, color: readableTextColor(palette.accent) }}
        >
          {hero.eyebrow.trim() === "" ? "AI" : "TOP"}
        </span>
      </div>
    );
  }

  if (heroVariant === 2) {
    return (
      <div
        {...commonProps}
        className="min-h-10 border-t px-1 py-2"
        style={{ borderColor: palette.accent, borderTopWidth: intensity.borderWidth + 1 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-6 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: palette.accent }}
          />
          <div className="flex-1 space-y-1.5">
            <Line color={palette.primary} height={5} width={titleWidth} />
            <Line color={withAlpha(palette.muted, "82")} height={3} width={footerWidth} />
          </div>
        </div>
      </div>
    );
  }

  if (heroVariant === 3) {
    return (
      <div
        {...commonProps}
        className="grid min-h-10 grid-cols-[36px_1fr] overflow-hidden rounded-sm border"
        style={{ borderColor: withAlpha(palette.primary, intensity.accentAlpha) }}
      >
        <div
          className="grid place-items-center text-[13px] font-black"
          style={{
            backgroundColor: withAlpha(palette.accent, intensity.surfaceAlpha),
            color: palette.accent,
          }}
        >
          {String((variant % 9) + 1).padStart(2, "0")}
        </div>
        <div className="space-y-1.5 px-2 py-2">
          <Line color={palette.primary} height={5} width={titleWidth} />
          <Line color={withAlpha(palette.muted, "78")} height={3} width={footerWidth} />
        </div>
      </div>
    );
  }

  return (
    <div
      {...commonProps}
      className="min-h-10 border-l px-2.5 py-2"
      style={{
        backgroundColor: withAlpha(palette.accent, intensity.surfaceAlpha),
        borderColor: palette.accent,
        borderLeftWidth: intensity.borderWidth + 1,
      }}
    >
      <div className="space-y-1.5">
        <Line color={palette.primary} height={5} width={titleWidth} />
        <Line color={withAlpha(palette.muted, "78")} height={3} width={footerWidth} />
      </div>
    </div>
  );
}

function selectPreviewBlocks(
  blocks: readonly AiLayoutBlockDecision[],
  dividerBlockIds: ReadonlySet<string>,
  limit: number,
): readonly AiLayoutBlockDecision[] {
  if (blocks.length <= limit) return blocks;
  const significant = blocks.filter(
    (block) => block.treatment !== "body" || dividerBlockIds.has(block.blockId),
  );
  const selected = new Map<string, AiLayoutBlockDecision>();
  for (const block of significant) {
    if (selected.size >= limit) break;
    selected.set(block.blockId, block);
  }
  const interval = Math.max(1, Math.floor(blocks.length / Math.max(1, limit - selected.size)));
  for (let index = 0; index < blocks.length && selected.size < limit; index += interval) {
    const block = blocks[index];
    if (block !== undefined) selected.set(block.blockId, block);
  }
  return blocks.filter((block) => selected.has(block.blockId)).slice(0, limit);
}

function BlockPreview({
  block,
  index,
  palette,
  variant,
  visualIntensity,
}: {
  readonly block: AiLayoutBlockDecision;
  readonly index: number;
  readonly palette: PreviewPalette;
  readonly variant: number;
  readonly visualIntensity: AiLayoutVisualIntensity;
}) {
  const intensity = INTENSITY_LAYOUT[visualIntensity];
  const primarySoft = withAlpha(palette.primary, "72");
  const mutedSoft = withAlpha(palette.muted, "58");
  const accentSoft = withAlpha(palette.accent, intensity.surfaceAlpha);
  const componentVariant = stableHash(block.componentId ?? block.treatment) % 3;

  return (
    <div
      data-block-component={block.componentId ?? "none"}
      data-block-id={block.blockId}
      data-block-treatment={block.treatment}
    >
      {block.treatment === "title" ? (
        <div className="space-y-1">
          <Line color={palette.primary} height={5} width={index % 2 === 0 ? "86%" : "72%"} />
          <Line color={withAlpha(palette.primary, "44")} height={2} width="38%" />
        </div>
      ) : null}
      {block.treatment === "section" ? (
        <div
          className="flex items-center gap-1.5 border-b pb-1"
          style={{ borderColor: palette.accent, borderBottomWidth: intensity.borderWidth }}
        >
          <span
            className={`${componentVariant === 0 ? "rounded-sm" : "rounded-full"} grid size-4 shrink-0 place-items-center text-[6px] font-black`}
            style={{ backgroundColor: palette.accent, color: readableTextColor(palette.accent) }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <Line color={palette.primary} height={4} width={`${String(58 + (variant % 4) * 7)}%`} />
        </div>
      ) : null}
      {block.treatment === "lead" ? (
        <div className="space-y-1 rounded-sm px-2 py-1.5" style={{ backgroundColor: accentSoft }}>
          <Line color={primarySoft} width="94%" />
          <Line color={mutedSoft} width="74%" />
        </div>
      ) : null}
      {block.treatment === "body" ? (
        <div className="space-y-1">
          <Line color={primarySoft} width={index % 2 === 0 ? "96%" : "88%"} />
          <Line color={mutedSoft} width={`${String(66 + ((index + variant) % 4) * 7)}%`} />
        </div>
      ) : null}
      {block.treatment === "quote" ? (
        <div
          className="space-y-1 border-l pl-2"
          style={{ borderColor: palette.accent, borderLeftWidth: intensity.borderWidth + 1 }}
        >
          <Line color={palette.primary} width="82%" />
          <Line color={mutedSoft} width="62%" />
        </div>
      ) : null}
      {block.treatment === "data" ? (
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((metric) => (
            <span
              className="grid h-7 place-items-center rounded-sm"
              key={metric}
              style={{
                backgroundColor:
                  metric === variant % 3 ? accentSoft : withAlpha(palette.primary, "0a"),
              }}
            >
              <Line color={metric === variant % 3 ? palette.accent : primarySoft} width="52%" />
            </span>
          ))}
        </div>
      ) : null}
      {block.treatment === "callout" ? (
        <div
          className="space-y-1 rounded-sm border px-2 py-1.5"
          style={{ borderColor: withAlpha(palette.accent, intensity.accentAlpha) }}
        >
          <Line color={palette.accent} width="42%" />
          <Line color={mutedSoft} width="88%" />
        </div>
      ) : null}
      {block.treatment === "image" ? (
        <div
          className="grid h-8 place-items-center rounded-sm border border-dashed"
          style={{
            backgroundColor: withAlpha(palette.accent, "08"),
            borderColor: withAlpha(palette.primary, intensity.accentAlpha),
          }}
        >
          <span className="text-[7px] font-semibold" style={{ color: palette.muted }}>
            原稿图片
          </span>
        </div>
      ) : null}
      {block.treatment === "list" ? (
        <div className="space-y-1">
          {[0, 1].map((item) => (
            <span className="flex items-center gap-1" key={item}>
              <span className="size-1 rounded-full" style={{ backgroundColor: palette.accent }} />
              <Line
                color={item === 0 ? primarySoft : mutedSoft}
                width={item === 0 ? "84%" : "68%"}
              />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DividerPreview({
  color,
  componentId,
}: {
  readonly color: string;
  readonly componentId: string;
}) {
  const variant = stableHash(componentId) % 3;
  return (
    <div
      className="flex h-1.5 items-center justify-center gap-1"
      data-divider-component={componentId}
      data-divider-variant={variant}
    >
      <span className="h-px flex-1" style={{ backgroundColor: withAlpha(color, "45") }} />
      {variant === 0 ? (
        <span className="size-1 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      {variant === 1 ? (
        <span className="h-1 w-3 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      {variant === 2 ? (
        <>
          <span className="size-1 rotate-45" style={{ backgroundColor: color }} />
          <span className="size-1 rotate-45" style={{ backgroundColor: color }} />
        </>
      ) : null}
      <span className="h-px flex-1" style={{ backgroundColor: withAlpha(color, "45") }} />
    </div>
  );
}

export function AiLayoutCandidatePreview({ candidate, plan }: AiLayoutCandidatePreviewProps) {
  const comparison = compareAiLayoutCandidate(candidate);
  const { decision } = candidate;
  const palette: PreviewPalette = {
    accent: plan.designTokens.accentColor,
    muted: plan.designTokens.mutedColor,
    primary: plan.designTokens.primaryColor,
    surface: plan.designTokens.surfaceColor,
  };
  const structureKey =
    candidate.structureFingerprint ?? candidate.templateId ?? candidate.candidateId;
  const previewVariant =
    stableHash(
      [
        structureKey,
        decision.hero.componentId,
        decision.dividerComponentId,
        decision.blocks
          .map((block) => `${block.treatment}:${block.componentId ?? "none"}`)
          .join("|"),
        decision.rhythm,
        decision.visualIntensity,
      ].join("::"),
    ) % 12;
  const rhythm = RHYTHM_LAYOUT[decision.rhythm];
  const dividerBlockIds = new Set(decision.dividerAfterBlockIds);
  const blocks = selectPreviewBlocks(decision.blocks, dividerBlockIds, rhythm.maxBlocks);
  const columns = previewVariant % 3;

  return (
    <div
      aria-label={`${candidate.structureLabel}结构预演`}
      className="h-[164px] overflow-hidden rounded-control border border-line shadow-subtle"
      data-block-pattern={decision.blocks.map((block) => block.treatment).join(",")}
      data-divider-count={decision.dividerAfterBlockIds.length}
      data-preview-variant={previewVariant}
      data-rhythm={decision.rhythm}
      data-structure-key={structureKey}
      data-template-id={candidate.templateId ?? "legacy"}
      data-visual-intensity={decision.visualIntensity}
      role="img"
    >
      <div className="flex h-6 items-center justify-between border-b border-line bg-panel-soft px-2.5 text-[9px] font-semibold text-muted">
        <span>结构预演 · 当前文章</span>
        <span>
          {comparison.sectionCount} 章节 · {comparison.imageCount} 图 ·{" "}
          {decision.dividerAfterBlockIds.length} 转场
        </span>
      </div>
      <div
        className="grid h-[138px] overflow-hidden"
        data-preview-layout={columns === 0 ? "single" : columns === 1 ? "lead-wide" : "rail-wide"}
        style={{
          backgroundColor: palette.surface,
          gap: rhythm.gap,
          gridTemplateColumns:
            columns === 0 ? "1fr" : columns === 1 ? "1.2fr 0.8fr" : "0.78fr 1.22fr",
          padding: rhythm.padding,
        }}
      >
        <HeroPreview candidate={candidate} palette={palette} variant={previewVariant} />
        <div
          className="grid min-h-0 content-start overflow-hidden"
          data-testid="decision-block-flow"
          style={{ gap: rhythm.gap }}
        >
          {blocks.map((block, index) => (
            <div key={block.blockId}>
              <BlockPreview
                block={block}
                index={index}
                palette={palette}
                variant={previewVariant}
                visualIntensity={decision.visualIntensity}
              />
              {dividerBlockIds.has(block.blockId) ? (
                <DividerPreview color={palette.accent} componentId={decision.dividerComponentId} />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
