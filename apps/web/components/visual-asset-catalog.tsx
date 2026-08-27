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
    <article className="group self-start overflow-hidden rounded-card border border-line bg-panel shadow-subtle transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised">
      <div
        className={`relative overflow-hidden bg-[linear-gradient(45deg,#f5f3ef_25%,transparent_25%),linear-gradient(-45deg,#f5f3ef_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f5f3ef_75%),linear-gradient(-45deg,transparent_75%,#f5f3ef_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0] ${compactPreview ? "aspect-square max-h-56" : "aspect-[5/2]"}`}
      >
        <button
          aria-label={`查看大图：${asset.name}`}
          className="absolute inset-0 z-10 grid place-items-center bg-zinc-950/0 text-white transition hover:bg-zinc-950/25 focus-visible:bg-zinc-950/25 focus-visible:outline-none"
          onClick={onPreview}
          type="button"
        >
          <span className="translate-y-2 rounded-full bg-zinc-950/70 px-3 py-1.5 text-[9px] font-semibold opacity-0 backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <Eye aria-hidden="true" className="mr-1 inline" size={11} />
            查看大图
          </span>
        </button>
        <img
          alt={asset.name}
          className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
          src={asset.previewPath}
        />
        <span
          className={`pointer-events-none absolute top-2 left-2 z-20 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold text-white backdrop-blur ${
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
          className={`absolute top-2 right-2 z-20 grid size-8 place-items-center rounded-full border backdrop-blur transition ${
            favorite
              ? "border-amber-300 bg-amber-50 text-amber-600"
              : "border-white/70 bg-white/85 text-zinc-500 hover:text-amber-600"
          }`}
          onClick={onToggleFavorite}
          type="button"
        >
          <Star aria-hidden="true" fill={favorite ? "currentColor" : "none"} size={13} />
        </button>
      </div>
      <div className="p-3.5">
        <h3 className="truncate text-[12px] font-semibold text-ink">{asset.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-muted">
          {asset.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[8px] text-accent-strong">
            {VISUAL_ASSET_FUNCTION_LABELS[asset.function]}
          </span>
          {asset.effect === undefined ? null : (
            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[8px] text-violet-700">
              {VISUAL_ASSET_EFFECT_LABELS[asset.effect]}
            </span>
          )}
          {asset.scenes.slice(0, 2).map((scene) => (
            <span
              className="rounded-md bg-panel-muted px-1.5 py-0.5 text-[8px] text-faint"
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

  return (
    <section>
      <div className="overflow-hidden rounded-card border border-accent/15 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_42%),linear-gradient(135deg,#fff_0%,#faf8f4_100%)] p-5 shadow-subtle md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="text-accent" size={18} />
              <span className="text-[10px] font-semibold tracking-[0.14em] text-accent uppercase">
                Visual Library
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              让文章先有画面，再谈排版
            </h1>
            <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted">
              {OFFICIAL_STATIC_VISUAL_ASSETS.length} 个静态变体与{" "}
              {OFFICIAL_DYNAMIC_VISUAL_ASSETS.length}
              个动态变体，按照编辑任务组织。动态素材在编辑器播放，复制到微信时自动使用静态备用图。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-control border border-white/80 bg-white/75 px-3 py-2 text-center shadow-subtle backdrop-blur">
              <strong className="block text-base tabular-nums text-ink">
                {OFFICIAL_VISUAL_ASSETS.length}
              </strong>
              <span className="text-[8px] text-faint">可用变体</span>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-5 text-[11px] font-semibold text-white shadow-subtle transition hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-raised"
              href="/workspace/articles?new=1"
            >
              去编辑器使用
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-card border border-line bg-panel p-4 shadow-subtle">
        <div className="grid grid-cols-2 gap-2 rounded-control bg-panel-muted p-1 sm:w-[360px]">
          {(["static", "dynamic"] as const).map((item) => (
            <button
              aria-pressed={motion === item}
              className={`h-9 rounded-md text-[11px] font-semibold transition ${
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

        <div className="mt-3 flex flex-wrap gap-2" aria-label="素材使用记录">
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
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[9px] font-semibold transition ${
                collectionFilter === value
                  ? "border-accent/35 bg-accent-soft text-accent-strong"
                  : "border-line bg-panel text-muted hover:border-line-strong hover:text-ink"
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

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[9px] font-semibold tracking-[0.08em] text-faint uppercase">
              按编辑任务寻找
            </p>
            {taskGroup === "all" ? null : (
              <button
                className="text-[9px] font-medium text-accent hover:text-accent-strong"
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
                  className={`rounded-control border px-3 py-3 text-left transition ${
                    taskGroup === group.id
                      ? "border-accent/40 bg-accent-soft shadow-subtle"
                      : "border-line bg-panel hover:-translate-y-0.5 hover:border-line-strong hover:shadow-subtle"
                  }`}
                  key={group.id}
                  onClick={() => {
                    setTaskGroup(group.id);
                    setAssetFunction("all");
                  }}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-ink">{group.label}</span>
                    <span className="rounded-full bg-panel px-2 py-0.5 text-[8px] tabular-nums text-faint">
                      {count}
                    </span>
                  </span>
                  <span className="mt-1 block text-[9px] leading-4 text-muted">
                    {group.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2">
            <span className="sr-only">搜索素材</span>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 -translate-y-1/2 text-faint"
              size={13}
            />
            <input
              className="h-9 w-full rounded-control border border-line bg-panel pr-3 pl-9 text-[11px] text-ink outline-none focus:border-accent"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索水墨、党政、幼儿园、中秋、科技…"
              value={query}
            />
          </label>
          <select
            aria-label="按用途筛选"
            className="h-9 rounded-control border border-line bg-panel px-3 text-[10px] text-ink outline-none focus:border-accent"
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
            className="h-9 rounded-control border border-line bg-panel px-3 text-[10px] text-ink outline-none focus:border-accent"
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
            className="h-9 rounded-control border border-line bg-panel px-3 text-[10px] text-ink outline-none focus:border-accent"
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
              className="h-9 rounded-control border border-line bg-panel px-3 text-[10px] text-ink outline-none focus:border-accent md:col-start-2 xl:col-start-5"
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
        className="mt-4 flex items-center justify-between text-[10px] text-muted"
      >
        <span>
          当前显示 {visibleAssets.length} 个{motion === "static" ? "静态" : "动态"}素材
        </span>
        <span>全部为本项目原创 SVG</span>
      </div>
      {visibleAssets.length === 0 ? (
        <div className="mt-4 rounded-card border border-dashed border-line py-16 text-center text-[11px] text-muted">
          {collectionFilter === "favorite"
            ? "当前分类还没有收藏素材，可点击卡片右上角星标加入。"
            : collectionFilter === "recent"
              ? "当前分类还没有最近查看的素材，打开一次大图后会自动记录。"
              : "没有符合当前组合条件的素材，请减少一个筛选条件。"}
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
            className="inline-flex h-10 items-center justify-center rounded-control border border-line bg-panel px-5 text-[10px] font-semibold text-ink shadow-subtle transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-raised"
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
