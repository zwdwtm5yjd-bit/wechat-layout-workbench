"use client";

import {
  VISUAL_ASSET_EFFECT_LABELS,
  VISUAL_ASSET_FUNCTION_LABELS,
  VISUAL_ASSET_STYLE_LABELS,
  type OfficialVisualAsset,
} from "@wechat-layout/component-registry";
import { Check, Film, ImageIcon, Sparkles, Star, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";

export interface VisualAssetPreviewDialogProps {
  readonly asset: OfficialVisualAsset | null;
  readonly favorite: boolean;
  readonly inserted?: boolean;
  readonly insertionLabel?: string;
  readonly onClose: () => void;
  readonly onInsert?: (asset: OfficialVisualAsset) => void;
  readonly onToggleFavorite: (asset: OfficialVisualAsset) => void;
}

export function VisualAssetPreviewDialog({
  asset,
  favorite,
  inserted = false,
  insertionLabel = "插入当前段落后",
  onClose,
  onInsert,
  onToggleFavorite,
}: VisualAssetPreviewDialogProps) {
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={asset !== null}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-zinc-950/40 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[70] grid max-h-[92dvh] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-white/70 bg-panel shadow-raised lg:grid-cols-[minmax(0,1.45fr)_320px]">
          {asset === null ? null : (
            <>
              <div className="grid min-h-[320px] place-items-center overflow-hidden bg-[linear-gradient(45deg,#f3f1ec_25%,transparent_25%),linear-gradient(-45deg,#f3f1ec_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f1ec_75%),linear-gradient(-45deg,transparent_75%,#f3f1ec_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-5 sm:min-h-[430px]">
                <img
                  alt={`${asset.name}大图预览`}
                  className="max-h-[68dvh] w-full rounded-control border border-line bg-panel object-contain drop-shadow-sm"
                  src={asset.previewPath}
                />
              </div>
              <div className="flex min-h-[320px] flex-col border-t border-line p-5 lg:border-t-0 lg:border-l">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                        asset.motion === "dynamic"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-panel-muted text-muted"
                      }`}
                    >
                      {asset.motion === "dynamic" ? (
                        <Film aria-hidden="true" size={11} />
                      ) : (
                        <ImageIcon aria-hidden="true" size={11} />
                      )}
                      {asset.motion === "dynamic" ? "动态 SVG" : "静态 SVG"}
                    </span>
                    <Dialog.Title className="mt-3 text-lg font-semibold tracking-tight text-ink">
                      {asset.name}
                    </Dialog.Title>
                  </div>
                  <Dialog.Close
                    aria-label="关闭素材预览"
                    className="grid size-10 shrink-0 place-items-center rounded-control border border-transparent text-faint transition-[background-color,border-color,color,transform] duration-150 hover:border-line hover:bg-hover hover:text-ink active:scale-[0.96]"
                    type="button"
                  >
                    <X aria-hidden="true" size={17} />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="mt-3 text-[11px] leading-5 text-muted">
                  {asset.description}
                </Dialog.Description>

                <dl className="mt-5 space-y-3 rounded-control bg-panel-muted p-4 text-[11px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-faint">用途</dt>
                    <dd className="font-medium text-ink">
                      {VISUAL_ASSET_FUNCTION_LABELS[asset.function]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-faint">视觉风格</dt>
                    <dd className="font-medium text-ink">
                      {VISUAL_ASSET_STYLE_LABELS[asset.style]}
                    </dd>
                  </div>
                  {asset.effect === undefined ? null : (
                    <div className="flex justify-between gap-4">
                      <dt className="text-faint">动效</dt>
                      <dd className="font-medium text-violet-700">
                        {VISUAL_ASSET_EFFECT_LABELS[asset.effect]}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-faint">适用场景</dt>
                    <dd className="text-right font-medium text-ink">{asset.scenes.join("、")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-faint">微信兼容</dt>
                    <dd className="inline-flex items-center gap-1 font-medium text-success">
                      <Check aria-hidden="true" size={11} />
                      {asset.motion === "dynamic" ? "自动使用静态备用图" : "可安全复制"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {asset.tags.slice(0, 8).map((tag) => (
                    <span
                      className="rounded-full border border-line px-2 py-1 text-[11px] text-muted"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto grid gap-2 pt-6">
                  <button
                    aria-label={favorite ? `取消收藏${asset.name}` : `收藏${asset.name}`}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-control border text-[11px] font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] ${
                      favorite
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-line text-ink hover:border-amber-300 hover:bg-amber-50"
                    }`}
                    onClick={() => onToggleFavorite(asset)}
                    type="button"
                  >
                    <Star aria-hidden="true" fill={favorite ? "currentColor" : "none"} size={14} />
                    {favorite ? "已收藏，点击取消" : "收藏到常用素材"}
                  </button>
                  {onInsert === undefined ? (
                    <Link
                      className="flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.96]"
                      href="/workspace/articles?new=1"
                    >
                      <Sparkles aria-hidden="true" size={14} />
                      进入编辑器使用
                    </Link>
                  ) : (
                    <button
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 active:scale-[0.96] ${
                        inserted ? "bg-emerald-600" : "bg-accent hover:bg-accent-strong"
                      }`}
                      onClick={() => onInsert(asset)}
                      type="button"
                    >
                      {inserted ? (
                        <Check aria-hidden="true" size={14} />
                      ) : (
                        <Sparkles aria-hidden="true" size={14} />
                      )}
                      {inserted ? "已插入画布" : insertionLabel}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
