"use client";

import {
  OFFICIAL_DYNAMIC_VISUAL_ASSETS,
  OFFICIAL_STATIC_VISUAL_ASSETS,
  OFFICIAL_VISUAL_ASSETS,
  VISUAL_ASSET_EFFECT_LABELS,
  VISUAL_ASSET_FUNCTION_LABELS,
  VISUAL_ASSET_STYLE_LABELS,
  type OfficialVisualAsset,
  type VisualAssetFunction,
  type VisualAssetMotion,
} from "@wechat-layout/component-registry";
import { Eye, Film, ImageIcon, Search, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  VISUAL_ASSET_TASK_GROUPS,
  visualAssetMatchesTaskGroup,
  visualAssetTaskGroupFunctions,
  type VisualAssetTaskGroupId,
} from "../lib/visual-asset-navigation";
import { useVisualAssetPreferences } from "../lib/visual-assets/use-preferences";
import { VisualAssetPreviewDialog } from "./visual-asset-preview-dialog";

const allScenes = [...new Set(OFFICIAL_VISUAL_ASSETS.flatMap((asset) => asset.scenes))].sort(
  (left, right) => left.localeCompare(right, "zh-CN"),
);

const CATALOG_PAGE_SIZE = 24;
type AssetCollectionFilter = "all" | "favorite" | "recent";

function visualAssetSerial(asset: OfficialVisualAsset): number {
  return Number.parseInt(asset.id.match(/(\d+)$/u)?.[1] ?? "0", 10);
}

function AssetCard({
  asset,
  favorite,
  onPreview,
  onToggleFavorite,
}: {
  readonly asset: OfficialVisualAsset;
  readonly favorite: boolean;
  readonly onPreview: () => void;
  readonly onToggleFavorite: () => void;
}) {
  const compactPreview =
    asset.function === "sticker" || asset.function === "corner" || asset.function === "badge";
  return (
    <article className="ui-interactive group self-start overflow-hidden rounded-card bg-panel shadow-subtle hover:-translate-y-0.5 hover:shadow-subtle-hover">
      <div
        className={`relative overflow-hidden bg-[linear-gradient(45deg,#f5f3ef_25%,transparent_25%),linear-gradient(-45deg,#f5f3ef_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f5f3ef_75%),linear-gradient(-45deg,transparent_75%,#f5f3ef_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0] ${compactPreview ? "aspect-square max-h-56" : "aspect-[5/2]"}`}
      >
        <button
          aria-label={`查看大图：${asset.name}`}
          className="absolute inset-0 z-10 grid place-items-center bg-zinc-950/0 text-white transition-[background-color] hover:bg-zinc-950/25 focus-visible:bg-zinc-950/25"
          onClick={onPreview}
          type="button"
        >
          <span className="translate-y-2 rounded-full bg-zinc-950/75 px-3 py-1.5 text-[11px] font-semibold opacity-0 backdrop-blur transition-[translate,opacity] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <Eye aria-hidden="true" className="mr-1 inline" size={11} />
            查看大图
          </span>
        </button>
        <img
          alt={asset.name}
          className="ui-media h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.02]"
          loading="lazy"
          src={asset.previewPath}
        />
        <span
          className={`pointer-events-none absolute top-2 left-2 z-20 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white backdrop-blur ${
            asset.motion === "dynamic" ? "bg-violet-600/85" : "bg-zinc-900/75"
          }`}
        >
          {asset.motion === "dynamic" ? (
            <Film aria-hidden="true" size={10} />
          ) : (
            <ImageIcon aria-hidden="true" size={10} />
          )}
          {asset.motion === "dynamic" ? "动态 SVG" : "静态 SVG"}
        </span>
        <button
          aria-label={favorite ? `取消收藏${asset.name}` : `收藏${asset.name}`}
          className={`ui-interactive absolute top-1 right-1 z-20 grid size-10 place-items-center rounded-full backdrop-blur ${
            favorite
              ? "bg-warning-soft text-warning shadow-subtle"
              : "bg-white/90 text-zinc-600 shadow-subtle hover:text-warning"
          }`}
          onClick={onToggleFavorite}
          type="button"
        >
          <Star aria-hidden="true" fill={favorite ? "currentColor" : "none"} size={13} />
        </button>
      </div>
      <div className="p-4">
        <h3 className="truncate text-[13px] font-semibold text-ink" title={asset.name}>
          {asset.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-[12px] leading-5 text-muted">
          {asset.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          <span className="rounded-md bg-accent-soft px-2 py-1 text-[11px] text-accent-strong">
            {VISUAL_ASSET_FUNCTION_LABELS[asset.function]}
          </span>
          {asset.effect === undefined ? null : (
            <span className="rounded-md bg-accent-soft px-2 py-1 text-[11px] text-accent-strong">
              {VISUAL_ASSET_EFFECT_LABELS[asset.effect]}
            </span>
          )}
          {asset.scenes.slice(0, 2).map((scene) => (
            <span
              className="rounded-md bg-panel-sunken px-2 py-1 text-[11px] text-faint"
              key={scene}
            >
              {scene}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function VisualAssetCatalog() {
  const { preferences, recordRecent, toggleFavorite } = useVisualAssetPreferences();
  const [motion, setMotion] = useState<VisualAssetMotion>("static");
  const [collectionFilter, setCollectionFilter] = useState<AssetCollectionFilter>("all");
  const [taskGroup, setTaskGroup] = useState<VisualAssetTaskGroupId>("all");
  const [query, setQuery] = useState("");
  const [assetFunction, setAssetFunction] = useState("all");
  const [style, setStyle] = useState("all");
  const [scene, setScene] = useState("all");
  const [effect, setEffect] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(CATALOG_PAGE_SIZE);
  const [selectedAsset, setSelectedAsset] = useState<OfficialVisualAsset | null>(null);
  const taskFunctions = useMemo(() => visualAssetTaskGroupFunctions(taskGroup), [taskGroup]);
  const favorites = useMemo(
    () => new Set(preferences.favoriteVariantIds),
    [preferences.favoriteVariantIds],
  );
  const recents = useMemo(
    () => new Map(preferences.recentVariantIds.map((assetId, index) => [assetId, index])),
    [preferences.recentVariantIds],
  );
  const collectionCounts = useMemo(
    () => ({
      favorite: OFFICIAL_VISUAL_ASSETS.filter(
        (asset) => asset.motion === motion && favorites.has(asset.id),
      ).length,
      recent: OFFICIAL_VISUAL_ASSETS.filter(
        (asset) => asset.motion === motion && recents.has(asset.id),
      ).length,
    }),
    [favorites, motion, recents],
  );

  const availableFunctionCounts = useMemo(
    () =>
      Object.fromEntries(
        taskFunctions.map((assetFunctionId) => [
          assetFunctionId,
          OFFICIAL_VISUAL_ASSETS.filter(
            (asset) =>
              asset.motion === motion &&
              visualAssetMatchesTaskGroup(asset, taskGroup) &&
              asset.function === assetFunctionId,
          ).length,
        ]),
      ),
    [motion, taskFunctions, taskGroup],
  );

  const availableEffectCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(VISUAL_ASSET_EFFECT_LABELS).map((effectId) => [
          effectId,
          OFFICIAL_VISUAL_ASSETS.filter(
            (asset) =>
              asset.motion === motion &&
              visualAssetMatchesTaskGroup(asset, taskGroup) &&
              asset.effect === effectId,
          ).length,
        ]),
      ),
    [motion, taskGroup],
  );

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    const matches = OFFICIAL_VISUAL_ASSETS.filter((asset) => {
      const searchText =
        `${asset.name} ${asset.description} ${asset.tags.join(" ")}`.toLocaleLowerCase("zh-CN");
      return (
        asset.motion === motion &&
        visualAssetMatchesTaskGroup(asset, taskGroup) &&
        (assetFunction === "all" || asset.function === assetFunction) &&
        (style === "all" || asset.style === style) &&
        (scene === "all" || asset.scenes.includes(scene)) &&
        (effect === "all" || asset.effect === effect) &&
        (collectionFilter === "all" ||
          (collectionFilter === "favorite" ? favorites.has(asset.id) : recents.has(asset.id))) &&
        (normalized === "" || searchText.includes(normalized))
      );
    });
    return matches.sort((left, right) => {
      if (collectionFilter === "recent") {
        return (
          (recents.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (recents.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        );
      }
      const favoriteDifference = Number(favorites.has(right.id)) - Number(favorites.has(left.id));
      return favoriteDifference === 0
        ? visualAssetSerial(right) - visualAssetSerial(left)
        : favoriteDifference;
    });
  }, [
    assetFunction,
    collectionFilter,
    effect,
    favorites,
    motion,
    query,
    recents,
    scene,
    style,
    taskGroup,
  ]);

  const displayedAssets = visibleAssets.slice(0, visibleLimit);

  useEffect(() => {
    setVisibleLimit(CATALOG_PAGE_SIZE);
  }, [assetFunction, collectionFilter, effect, motion, query, scene, style, taskGroup]);

  const resetSecondaryFilters = (nextMotion: VisualAssetMotion) => {
    setMotion(nextMotion);
    setTaskGroup("all");
    setAssetFunction("all");
    setStyle("all");
    setScene("all");
    setEffect("all");
  };

  const openPreview = (asset: OfficialVisualAsset): void => {
    recordRecent(asset.id);
    setSelectedAsset(asset);
  };

  const clearFilters = (): void => {
    setCollectionFilter("all");
    setTaskGroup("all");
    setQuery("");
    setAssetFunction("all");
    setStyle("all");
    setScene("all");
    setEffect("all");
  };

  return (
    <section>
      <div className="relative overflow-hidden rounded-card bg-sidebar-bg p-6 text-sidebar-text shadow-raised md:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 right-10 size-48 rounded-full bg-accent/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-20 size-44 rounded-full bg-highlight/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="text-highlight" size={18} />
              <span className="text-[12px] font-semibold tracking-[0.12em] text-sidebar-muted uppercase">
                官方视觉素材
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-sidebar-text">
              按创作任务找素材，不必记住素材名字
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-sidebar-muted">
              {OFFICIAL_STATIC_VISUAL_ASSETS.length} 个静态变体与{" "}
              {OFFICIAL_DYNAMIC_VISUAL_ASSETS.length}
              个动态变体，按标题、分隔、配图和互动场景组织；先预览，再带着明确用途进入编辑器。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-control bg-sidebar-raised px-4 py-2.5 text-center shadow-subtle">
              <strong className="block text-lg tabular-nums text-sidebar-text">
                {OFFICIAL_VISUAL_ASSETS.length}
              </strong>
              <span className="text-[11px] text-sidebar-muted">可用变体</span>
            </div>
            <Link
              className="ui-interactive inline-flex h-11 items-center justify-center rounded-control bg-panel px-5 text-[12px] font-semibold text-ink shadow-subtle hover:-translate-y-0.5 hover:bg-accent-soft"
              href="/workspace/articles?new=1"
            >
              去编辑器使用
            </Link>
          </div>
        </div>
      </div>

      <div className="ui-surface mt-6 p-5">
        <div className="grid grid-cols-2 gap-1.5 rounded-[14px] bg-panel-sunken p-1.5 sm:w-[400px]">
          {(["static", "dynamic"] as const).map((item) => (
            <button
              aria-pressed={motion === item}
              className={`ui-interactive h-10 rounded-control text-[12px] font-semibold ${
                motion === item ? "bg-panel text-ink shadow-subtle" : "text-muted hover:text-ink"
              }`}
              key={item}
              onClick={() => resetSecondaryFilters(item)}
              type="button"
            >
              {item === "static"
                ? `静态素材 · ${String(OFFICIAL_STATIC_VISUAL_ASSETS.length)}`
                : `动态素材 · ${String(OFFICIAL_DYNAMIC_VISUAL_ASSETS.length)}`}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="素材使用记录">
          {(
            [
              [
                "all",
                "全部素材",
                OFFICIAL_VISUAL_ASSETS.filter((asset) => asset.motion === motion).length,
              ],
              ["favorite", "我的收藏", collectionCounts.favorite],
              ["recent", "最近查看", collectionCounts.recent],
            ] as const
          ).map(([value, label, count]) => (
            <button
              aria-pressed={collectionFilter === value}
              className={`ui-interactive inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold shadow-subtle ${
                collectionFilter === value
                  ? "bg-accent-soft text-accent-strong"
                  : "bg-panel text-muted hover:text-ink"
              }`}
              key={value}
              onClick={() => setCollectionFilter(value)}
              type="button"
            >
              {value === "favorite" ? (
                <Star
                  aria-hidden="true"
                  fill={collectionFilter === value ? "currentColor" : "none"}
                  size={11}
                />
              ) : value === "recent" ? (
                <Eye aria-hidden="true" size={11} />
              ) : (
                <Sparkles aria-hidden="true" size={11} />
              )}
              {label} · {count}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-faint uppercase">
              按编辑任务寻找
            </p>
            {taskGroup === "all" ? null : (
              <button
                className="text-[12px] font-medium text-accent underline decoration-transparent underline-offset-4 hover:decoration-current hover:text-accent-strong"
                onClick={() => {
                  setTaskGroup("all");
                  setAssetFunction("all");
                }}
                type="button"
              >
                查看全部
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {VISUAL_ASSET_TASK_GROUPS.map((group) => {
              const count = OFFICIAL_VISUAL_ASSETS.filter(
                (asset) => asset.motion === motion && visualAssetMatchesTaskGroup(asset, group.id),
              ).length;
              return (
                <button
                  aria-pressed={taskGroup === group.id}
                  className={`ui-interactive min-h-20 rounded-control px-4 py-3 text-left shadow-subtle ${
                    taskGroup === group.id
                      ? "bg-accent-soft shadow-subtle-hover"
                      : "bg-panel hover:-translate-y-0.5 hover:shadow-subtle-hover"
                  }`}
                  key={group.id}
                  onClick={() => {
                    setTaskGroup(group.id);
                    setAssetFunction("all");
                  }}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{group.label}</span>
                    <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] tabular-nums text-faint">
                      {count}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-5 text-muted">
                    {group.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-line-subtle pt-5 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2">
            <span className="sr-only">搜索素材</span>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
              size={13}
            />
            <input
              aria-label="搜索官方视觉素材"
              className="h-11 w-full rounded-control border border-line bg-panel-sunken pr-3 pl-10 text-base text-ink focus:border-accent sm:text-[13px]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索水墨、党政、幼儿园、中秋、科技…"
              value={query}
            />
          </label>
          <select
            aria-label="按用途筛选"
            className="h-11 rounded-control border border-line bg-panel-sunken px-3 text-base text-ink focus:border-accent sm:text-[13px]"
            onChange={(event) => setAssetFunction(event.target.value)}
            value={assetFunction}
          >
            <option value="all">全部用途</option>
            {Object.entries(VISUAL_ASSET_FUNCTION_LABELS)
              .filter(
                ([value]) =>
                  taskFunctions.includes(value as VisualAssetFunction) &&
                  (availableFunctionCounts[value] ?? 0) > 0,
              )
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label} · {availableFunctionCounts[value]}
                </option>
              ))}
          </select>
          <select
            aria-label="按风格筛选"
            className="h-11 rounded-control border border-line bg-panel-sunken px-3 text-base text-ink focus:border-accent sm:text-[13px]"
            onChange={(event) => setStyle(event.target.value)}
            value={style}
          >
            <option value="all">全部风格</option>
            {Object.entries(VISUAL_ASSET_STYLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="按场景筛选"
            className="h-11 rounded-control border border-line bg-panel-sunken px-3 text-base text-ink focus:border-accent sm:text-[13px]"
            onChange={(event) => setScene(event.target.value)}
            value={scene}
          >
            <option value="all">全部场景</option>
            {allScenes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {motion === "dynamic" ? (
            <select
              aria-label="按动效筛选"
              className="h-11 rounded-control border border-line bg-panel-sunken px-3 text-base text-ink focus:border-accent sm:text-[13px] md:col-start-2 xl:col-start-5"
              onChange={(event) => setEffect(event.target.value)}
              value={effect}
            >
              <option value="all">全部动效</option>
              {Object.entries(VISUAL_ASSET_EFFECT_LABELS)
                .filter(([value]) => (availableEffectCounts[value] ?? 0) > 0)
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} · {availableEffectCounts[value]}
                  </option>
                ))}
            </select>
          ) : null}
        </div>
      </div>

      <div
        aria-live="polite"
        className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted"
      >
        <span>
          当前显示 {visibleAssets.length} 个{motion === "static" ? "静态" : "动态"}素材
        </span>
        <span>全部为本项目原创 SVG</span>
      </div>
      {visibleAssets.length === 0 ? (
        <div className="ui-surface mt-4 px-6 py-16 text-center">
          <Sparkles aria-hidden="true" className="mx-auto text-faint" size={24} />
          <h2 className="mt-4 text-[15px] font-semibold text-ink">当前条件下没有素材</h2>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-5 text-muted">
            {collectionFilter === "favorite"
              ? "这里还没有收藏。先查看全部素材，再用卡片右上角的星标保存常用项。"
              : collectionFilter === "recent"
                ? "这里还没有浏览记录。先查看全部素材，打开大图后会自动加入最近查看。"
                : "筛选条件组合得太具体了，清除条件后可以重新开始选择。"}
          </p>
          <button
            className="ui-interactive mt-5 inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-[12px] font-semibold text-white shadow-subtle hover:bg-accent-strong"
            onClick={clearFilters}
            type="button"
          >
            查看全部素材
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {displayedAssets.map((asset) => (
            <AssetCard
              asset={asset}
              favorite={favorites.has(asset.id)}
              key={asset.id}
              onPreview={() => openPreview(asset)}
              onToggleFavorite={() => toggleFavorite(asset.id)}
            />
          ))}
        </div>
      )}
      {displayedAssets.length < visibleAssets.length ? (
        <div className="mt-5 flex justify-center">
          <button
            className="ui-interactive inline-flex h-10 items-center justify-center rounded-control bg-panel px-5 text-[12px] font-semibold text-ink shadow-subtle hover:-translate-y-0.5 hover:shadow-subtle-hover"
            onClick={() => setVisibleLimit((current) => current + CATALOG_PAGE_SIZE)}
            type="button"
          >
            再显示 {Math.min(CATALOG_PAGE_SIZE, visibleAssets.length - displayedAssets.length)} 个
          </button>
        </div>
      ) : null}
      <VisualAssetPreviewDialog
        asset={selectedAsset}
        favorite={selectedAsset !== null && favorites.has(selectedAsset.id)}
        onClose={() => setSelectedAsset(null)}
        onToggleFavorite={(asset) => toggleFavorite(asset.id)}
      />
    </section>
  );
}
