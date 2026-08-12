import {
  collectDocumentEntries,
  type DocNode,
  type DocumentV1,
  type ImageBlockNode,
} from "@wechat-layout/document-schema";

import { analyzeDocumentLayout, recommendedContentImageCount } from "../layout-planner";

export interface ImagePreparationTask {
  readonly taskId: string;
  readonly afterBlockId: string;
  readonly sectionLabel: string;
  readonly purposeLabel: string;
  readonly reason: string;
  readonly searchQuery: string;
  readonly aspectRatio: "landscape" | "portrait" | "square";
}

export interface PreparedImageSelection {
  readonly taskId: string;
  readonly afterBlockId: string;
  readonly resourceId: string;
  readonly alt: string;
  readonly caption?: string;
}

export interface PreparedImagesSaveResult {
  readonly document: DocumentV1;
  readonly documentVersion: number;
}

type TopLevelBlock = DocNode["content"][number];

interface AnchorCandidate {
  readonly afterBlockId: string;
  readonly aspectRatio: ImagePreparationTask["aspectRatio"];
  readonly purposeLabel: string;
  readonly reason: string;
  readonly score: number;
  readonly searchQuery: string;
  readonly sectionLabel: string;
}

function textFromNode(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  const record = node as { readonly content?: readonly unknown[]; readonly text?: unknown };
  return `${typeof record.text === "string" ? record.text : ""}${
    record.content?.map(textFromNode).join("") ?? ""
  }`;
}

function normalizedText(node: TopLevelBlock): string {
  return textFromNode(node).replaceAll(/\s+/gu, " ").trim();
}

function isGeneratedBlock(node: TopLevelBlock): boolean {
  return node.attrs.semanticRole?.startsWith("layout_plan_") === true;
}

function isValidAnchor(node: TopLevelBlock): boolean {
  return (
    node.type !== "imageBlock" &&
    !(node.type === "heading" && node.attrs.level === 1) &&
    !isGeneratedBlock(node) &&
    node.attrs.semanticRole !== "unresolved_image" &&
    normalizedText(node) !== ""
  );
}

function compactSearchText(value: string): string {
  return value
    .replaceAll(/[\p{P}\p{S}]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 48);
}

function candidateFor(
  node: TopLevelBlock,
  index: number,
  sectionLabel: string,
  articleKeywords: readonly string[],
): AnchorCandidate {
  const text = normalizedText(node);
  const hasData = /\d+(?:\.\d+)?(?:%|万|亿|倍|项|人|件|年)?/u.test(text);
  const isSection = node.type === "heading";
  const isOpening = index <= 2 && node.type === "paragraph";
  const purposeLabel = isOpening
    ? "首屏主视觉"
    : isSection
      ? "章节转场图"
      : hasData
        ? "数据与成果图"
        : "叙事配图";
  const aspectRatio = isSection ? "square" : isOpening || hasData ? "landscape" : "portrait";
  const reason = isOpening
    ? "为开篇建立真实的视觉记忆点"
    : isSection
      ? "在真实章节转折处补足阅读节奏"
      : hasData
        ? "用真实图片支撑数据或成果表达"
        : "为连续长文提供可验证的场景信息";
  const searchParts = [sectionLabel, compactSearchText(text), ...articleKeywords.slice(0, 2)]
    .filter((part, partIndex, values) => part !== "" && values.indexOf(part) === partIndex)
    .join(" ");
  return {
    afterBlockId: node.attrs.blockId,
    aspectRatio,
    purposeLabel,
    reason,
    score: (isOpening ? 40 : 0) + (isSection ? 30 : 0) + (hasData ? 20 : 0) - index / 100,
    searchQuery: searchParts.slice(0, 100),
    sectionLabel,
  };
}

function stableTaskId(anchorBlockId: string): string {
  return `image-task:${anchorBlockId}`;
}

/** Counts article content images, excluding generated decoration and built-in visual material. */
export function countRealContentImages(document: DocumentV1): number {
  return collectDocumentEntries(document.content).blocks.filter(
    ({ node }) =>
      node.type === "imageBlock" &&
      node.attrs.elementKind !== "sticker" &&
      node.attrs.elementKind !== "decoration" &&
      !node.attrs.resourceId.startsWith("builtin_") &&
      !isGeneratedBlock(node),
  ).length;
}

/**
 * Builds a deterministic preparation checklist from the saved article only.
 * It never invents an image, URL, caption or resource identifier.
 */
export function createImagePreparationTasks(document: DocumentV1): readonly ImagePreparationTask[] {
  const analysis = analyzeDocumentLayout(document);
  const recommendedImageCount = recommendedContentImageCount(
    analysis.characterCount,
    analysis.gene.articleType,
  );
  const taskCount = Math.min(
    5,
    Math.max(0, recommendedImageCount - countRealContentImages(document)),
  );
  if (taskCount === 0) return [];

  let currentSection = "文章导读";
  const candidates: AnchorCandidate[] = [];
  document.content.content.forEach((node, index) => {
    const text = normalizedText(node);
    if (node.type === "heading" && node.attrs.level > 1 && !isGeneratedBlock(node) && text !== "") {
      currentSection = text.slice(0, 60);
    }
    if (!isValidAnchor(node)) return;
    candidates.push(candidateFor(node, index, currentSection, analysis.gene.keywords));
  });

  const selected: AnchorCandidate[] = [];
  const remaining = [...candidates];
  while (selected.length < taskCount && remaining.length > 0) {
    const target =
      taskCount === 1
        ? 0
        : (selected.length * Math.max(0, document.content.content.length - 1)) / (taskCount - 1);
    remaining.sort((left, right) => {
      const leftIndex = document.content.content.findIndex(
        (node) => node.attrs.blockId === left.afterBlockId,
      );
      const rightIndex = document.content.content.findIndex(
        (node) => node.attrs.blockId === right.afterBlockId,
      );
      const leftRank = Math.abs(leftIndex - target) * 3 - left.score;
      const rightRank = Math.abs(rightIndex - target) * 3 - right.score;
      return leftRank - rightRank || leftIndex - rightIndex;
    });
    const next = remaining.shift();
    if (next !== undefined) selected.push(next);
  }

  return selected
    .toSorted((left, right) => {
      const leftIndex = document.content.content.findIndex(
        (node) => node.attrs.blockId === left.afterBlockId,
      );
      const rightIndex = document.content.content.findIndex(
        (node) => node.attrs.blockId === right.afterBlockId,
      );
      return leftIndex - rightIndex;
    })
    .map((candidate) => ({
      taskId: stableTaskId(candidate.afterBlockId),
      afterBlockId: candidate.afterBlockId,
      sectionLabel: candidate.sectionLabel,
      purposeLabel: candidate.purposeLabel,
      reason: candidate.reason,
      searchQuery: candidate.searchQuery,
      aspectRatio: candidate.aspectRatio,
    }));
}

function defaultImageBlockId(): string {
  const value =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `block_${value}`;
}

function looksLikeUuidV7(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

/** Inserts only user-resolved, private resource selections. Unresolved tasks remain outside the document. */
export function insertPreparedImages(
  document: DocumentV1,
  selections: readonly PreparedImageSelection[],
  idFactory: () => string = defaultImageBlockId,
): DocumentV1 {
  if (selections.length === 0) return structuredClone(document);

  const anchors = new Map(
    document.content.content.filter(isValidAnchor).map((node) => [node.attrs.blockId, node]),
  );
  const usedTaskIds = new Set<string>();
  const documentEntries = collectDocumentEntries(document.content).blocks;
  const usedResourceIds = new Set(
    documentEntries.flatMap(({ node }) =>
      node.type === "imageBlock" ? [node.attrs.resourceId] : [],
    ),
  );
  const usedBlockIds = new Set(documentEntries.map(({ node }) => node.attrs.blockId));
  const afterAnchor = new Map<string, ImageBlockNode[]>();

  for (const selection of selections) {
    const taskId = selection.taskId.trim();
    const resourceId = selection.resourceId.trim();
    if (
      taskId === "" ||
      usedTaskIds.has(taskId) ||
      usedResourceIds.has(resourceId) ||
      !looksLikeUuidV7(resourceId) ||
      !anchors.has(selection.afterBlockId)
    ) {
      continue;
    }
    const blockId = idFactory();
    if (blockId === "" || usedBlockIds.has(blockId)) continue;
    usedTaskIds.add(taskId);
    usedResourceIds.add(resourceId);
    usedBlockIds.add(blockId);
    const alt = selection.alt.trim().slice(0, 500);
    const caption = selection.caption?.trim().slice(0, 2_000);
    const image: ImageBlockNode = {
      type: "imageBlock",
      attrs: {
        blockId,
        locked: false,
        compatibilityLevel: "safe",
        resourceId,
        ...(alt === "" ? {} : { alt }),
        ...(caption === undefined || caption === "" ? {} : { caption }),
        widthMode: "full",
        widthPercent: 100,
        objectFit: "contain",
        horizontalAlign: "center",
        elementKind: "image",
      },
    };
    afterAnchor.set(selection.afterBlockId, [
      ...(afterAnchor.get(selection.afterBlockId) ?? []),
      image,
    ]);
  }

  if (afterAnchor.size === 0) return structuredClone(document);

  const next = structuredClone(document);
  next.content = {
    type: "doc",
    content: document.content.content.flatMap((node) => [
      structuredClone(node),
      ...(afterAnchor.get(node.attrs.blockId) ?? []),
    ]),
  };
  next.meta.updatedAt = new Date().toISOString();
  return next;
}
