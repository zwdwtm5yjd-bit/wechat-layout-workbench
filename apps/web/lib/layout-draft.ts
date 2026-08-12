import type { BlockNode, DocNode, DocumentV1 } from "@wechat-layout/document-schema";

function unlockBlockTree(node: BlockNode): BlockNode {
  const next = structuredClone(node) as BlockNode;
  next.attrs.locked = false;

  if ("content" in next && Array.isArray(next.content)) {
    next.content = next.content.map((child) =>
      child.type === "text" || child.type === "hardBreak" ? child : unlockBlockTree(child),
    ) as never;
  }

  return next;
}

/**
 * AI/rule layout output is a working draft, not a protected source document.
 * Keep source provenance and hashes intact while making every generated or
 * transformed block editable for the user's review pass.
 */
export function createEditableLayoutDraft(document: DocumentV1): DocumentV1 {
  const next = structuredClone(document);
  next.content = {
    type: "doc",
    content: next.content.content.map(
      (node) => unlockBlockTree(node) as DocNode["content"][number],
    ),
  };
  next.meta.updatedAt = new Date().toISOString();
  return next;
}
