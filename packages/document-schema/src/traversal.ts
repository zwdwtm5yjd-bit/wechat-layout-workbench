import type { BlockNode, DocNode, InlineNode, TextNode } from "./nodes/index.js";

export interface BlockEntry {
  node: BlockNode;
  path: string;
}

export interface TextEntry {
  node: TextNode;
  path: string;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported document node: ${JSON.stringify(value)}`);
}

function visitInlineNodes(
  nodes: InlineNode[] | undefined,
  path: string,
  textEntries: TextEntry[],
): void {
  nodes?.forEach((node, index) => {
    if (node.type === "text") {
      textEntries.push({
        node,
        path: `${path}/${index}`,
      });
    }
  });
}

function visitBlock(node: BlockNode, path: string, blocks: BlockEntry[], texts: TextEntry[]): void {
  blocks.push({
    node,
    path,
  });

  switch (node.type) {
    case "paragraph":
    case "heading":
      visitInlineNodes(node.content, `${path}/content`, texts);
      return;
    case "blockquote":
    case "bulletList":
    case "orderedList":
    case "listItem":
    case "semanticCard":
    case "brandFooter":
      node.content?.forEach((child, index) => {
        visitBlock(child, `${path}/content/${index}`, blocks, texts);
      });
      return;
    case "imageBlock":
    case "divider":
    case "svgInteraction":
      return;
    default:
      return assertNever(node);
  }
}

export function collectDocumentEntries(document: DocNode): {
  blocks: BlockEntry[];
  texts: TextEntry[];
} {
  const blocks: BlockEntry[] = [];
  const texts: TextEntry[] = [];

  document.content.forEach((node, index) => {
    visitBlock(node, `/content/content/${index}`, blocks, texts);
  });

  return {
    blocks,
    texts,
  };
}
