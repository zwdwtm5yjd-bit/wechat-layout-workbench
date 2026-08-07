import {
  validateDocument,
  validateSourceBlockIdStability,
  validateTextLockEvolution,
  type DocumentV1,
} from "@wechat-layout/document-schema";

export class LayoutValidationError extends Error {
  override readonly name = "LayoutValidationError";
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
}
