"use client";

import {
  OFFICIAL_VISUAL_ASSETS,
  VISUAL_ASSET_EFFECT_LABELS,
  VISUAL_ASSET_FUNCTION_LABELS,
  VISUAL_ASSET_STYLE_LABELS,
  type OfficialVisualAsset,
  type VisualAssetMotion,
} from "@wechat-layout/component-registry";
import { Film, ImageIcon, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const allScenes = [...new Set(OFFICIAL_VISUAL_ASSETS.flatMap((asset) => asset.scenes))].sort(
  (left, right) => left.localeCompare(right, "zh-CN"),
);

function AssetCard({ asset }: { readonly asset: OfficialVisualAsset }) {
  return (
    <article className="group overflow-hidden rounded-card border border-line bg-panel shadow-subtle transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised">
      <div className="relative aspect-[5/2] overflow-hidden bg-[#f4f4f1]">
        <img
          alt={asset.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          src={asset.previewPath}
        />
        <span
          className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold text-white backdrop-blur ${
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
  const [motion, setMotion] = useState<VisualAssetMotion>("static");
  const [query, setQuery] = useState("");
  const [assetFunction, setAssetFunction] = useState("all");
  const [style, setStyle] = useState("all");
  const [scene, setScene] = useState("all");
  const [effect, setEffect] = useState("all");

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return OFFICIAL_VISUAL_ASSETS.filter((asset) => {
      const searchText =
        `${asset.name} ${asset.description} ${asset.tags.join(" ")}`.toLocaleLowerCase("zh-CN");
      return (
        asset.motion === motion &&
        (assetFunction === "all" || asset.function === assetFunction) &&
        (style === "all" || asset.style === style) &&
        (scene === "all" || asset.scenes.includes(scene)) &&
        (effect === "all" || asset.effect === effect) &&
        (normalized === "" || searchText.includes(normalized))
      );
    });
  }, [assetFunction, effect, motion, query, scene, style]);

  const resetSecondaryFilters = (nextMotion: VisualAssetMotion) => {
    setMotion(nextMotion);
    setAssetFunction("all");
    setStyle("all");
    setScene("all");
    setEffect("all");
  };

  return (
    <section>
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="text-accent" size={18} />
            <h1 className="text-lg font-semibold text-ink">视觉素材中心</h1>
          </div>
          <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-muted">
            100 个原创静态素材与 50
            个原创动态素材。按形态、用途、风格、场景和色系组织；动态素材在编辑器播放，复制到微信时自动使用静态备用图。
          </p>
        </div>
        <Link
          className="inline-flex h-9 items-center justify-center rounded-control bg-accent px-4 text-[11px] font-semibold text-white hover:bg-accent-strong"
          href="/workspace/articles?new=1"
        >
          去文章编辑器使用
        </Link>
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
              {item === "static" ? "静态素材 · 100" : "动态素材 · 50"}
            </button>
          ))}
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
            {Object.entries(VISUAL_ASSET_FUNCTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
              {Object.entries(VISUAL_ASSET_EFFECT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-muted">
        <span>
          当前显示 {visibleAssets.length} 个{motion === "static" ? "静态" : "动态"}素材
        </span>
        <span>全部为本项目原创 SVG</span>
      </div>
      {visibleAssets.length === 0 ? (
        <div className="mt-4 rounded-card border border-dashed border-line py-16 text-center text-[11px] text-muted">
          没有符合当前组合条件的素材，请减少一个筛选条件。
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleAssets.map((asset) => (
            <AssetCard asset={asset} key={asset.id} />
          ))}
        </div>
      )}
    </section>
  );
}
