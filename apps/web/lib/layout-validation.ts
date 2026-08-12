import {
  collectDocumentEntries,
  validateDocument,
  validateSourceBlockIdStability,
  validateTextLockEvolution,
  type DocumentV1,
} from "@wechat-layout/document-schema";

export class LayoutValidationError extends Error {
  override readonly name = "LayoutValidationError";
}

function isGeneratedImage(resourceId: string, semanticRole: string | undefined): boolean {
  return (
    resourceId === "component_slot_image_pending" ||
    semanticRole?.startsWith("layout_plan_generated") === true
  );
}

function assertSourceImagesPreserved(previous: DocumentV1, planned: DocumentV1): void {
  const sourceImages = collectDocumentEntries(previous.content).blocks.flatMap((entry) => {
    const node = entry.node;
    return node.type === "imageBlock" &&
      !isGeneratedImage(node.attrs.resourceId, node.attrs.semanticRole)
      ? [{ ...entry, node }]
      : [];
  });
  const plannedSourceImageIds = collectDocumentEntries(planned.content).blocks.flatMap(
    ({ node }) =>
      node.type === "imageBlock" &&
      !isGeneratedImage(node.attrs.resourceId, node.attrs.semanticRole)
        ? [node.attrs.blockId]
        : [],
  );
  const expectedSourceImageIds = sourceImages.map(({ node }) => node.attrs.blockId);
  if (
    plannedSourceImageIds.length !== expectedSourceImageIds.length ||
    plannedSourceImageIds.some((blockId) => !expectedSourceImageIds.includes(blockId))
  ) {
    throw new LayoutValidationError("AI 成稿新增、复制或删除了原稿图片");
  }
  const plannedByBlockId = new Map(
    collectDocumentEntries(planned.content).blocks.map(({ node }) => [node.attrs.blockId, node]),
  );
  for (const { node } of sourceImages) {
    const current = plannedByBlockId.get(node.attrs.blockId);
    if (current?.type !== "imageBlock") {
      throw new LayoutValidationError(`AI 成稿删除了原稿图片“${node.attrs.blockId}”`);
    }
    if (
      current.attrs.resourceId !== node.attrs.resourceId ||
      current.attrs.originalResourceId !== node.attrs.originalResourceId ||
      current.attrs.alt !== node.attrs.alt ||
      current.attrs.caption !== node.attrs.caption
    ) {
      throw new LayoutValidationError(`AI 成稿替换或改写了原稿图片“${node.attrs.blockId}”`);
    }
  }
}

export function assertValidPlannedLayout(previous: DocumentV1, planned: DocumentV1): void {
  const schema = validateDocument(planned);
  if (!schema.success) {
    const first = schema.errors[0];
    throw new LayoutValidationError(
      first === undefined
        ? "AI 成稿未通过文档校验"
        : `AI 成稿未保存：${first.path} ${first.message}`,
    );
  }

  const sourceIds = validateSourceBlockIdStability(previous, schema.data);
  if (!sourceIds.success) {
    const first = sourceIds.errors[0];
    throw new LayoutValidationError(first?.message ?? "AI 成稿改变了原文块标识");
  }

  const textLock = validateTextLockEvolution(
    previous.content,
    schema.data.content,
    previous.meta.textLocked,
  );
  if (!textLock.success) {
    const first = textLock.violations[0];
    throw new LayoutValidationError(first?.message ?? "AI 成稿改变了已锁定原文");
  }

  assertSourceImagesPreserved(previous, schema.data);
}
