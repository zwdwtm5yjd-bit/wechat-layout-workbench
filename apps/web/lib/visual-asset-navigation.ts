import type { OfficialVisualAsset, VisualAssetFunction } from "@wechat-layout/component-registry";

export const VISUAL_ASSET_TASK_GROUPS = [
  {
    description: "封面、开场和通栏氛围",
    functions: ["background", "hero"],
    id: "hero",
    label: "头图与背景",
  },
  {
    description: "标题、重点和段落过渡",
    functions: ["heading", "divider", "badge", "ribbon"],
    id: "information",
    label: "标题与信息",
  },
  {
    description: "相框、图集和图片组织",
    functions: ["frame", "gallery"],
    id: "imagery",
    label: "图片呈现",
  },
  {
    description: "贴纸、边角和视觉点睛",
    functions: ["corner", "sticker"],
    id: "decoration",
    label: "贴纸与点缀",
  },
] as const satisfies readonly {
  readonly description: string;
  readonly functions: readonly VisualAssetFunction[];
  readonly id: string;
  readonly label: string;
}[];

export type VisualAssetTaskGroupId = "all" | (typeof VISUAL_ASSET_TASK_GROUPS)[number]["id"];

export function visualAssetMatchesTaskGroup(
  asset: OfficialVisualAsset,
  groupId: VisualAssetTaskGroupId,
): boolean {
  if (groupId === "all") return true;
  const group = VISUAL_ASSET_TASK_GROUPS.find((item) => item.id === groupId);
  return (
    (group?.functions as readonly VisualAssetFunction[] | undefined)?.includes(asset.function) ??
    false
  );
}

export function visualAssetTaskGroupFunctions(
  groupId: VisualAssetTaskGroupId,
): readonly VisualAssetFunction[] {
  return groupId === "all"
    ? VISUAL_ASSET_TASK_GROUPS.flatMap((group) => [...group.functions])
    : (VISUAL_ASSET_TASK_GROUPS.find((group) => group.id === groupId)?.functions ?? []);
}
