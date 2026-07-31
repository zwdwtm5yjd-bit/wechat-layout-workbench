import { Extension, Mark, Node, mergeAttributes, type Extensions } from "@tiptap/core";
import type {
  ComponentNodeViewDescriptor,
  ExactComponentReference,
} from "@wechat-layout/component-registry";
import {
  validateTextLockEvolution,
  type DocNode,
  type TextLockViolation,
} from "@wechat-layout/document-schema";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";

export const BLOCK_NODE_NAMES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "imageBlock",
  "divider",
  "semanticCard",
  "brandFooter",
  "svgInteraction",
] as const;

export type EditorBlockNodeName = (typeof BLOCK_NODE_NAMES)[number];

export interface DocumentExtensionOptions {
  readonly componentNodeViewResolver?: (
    reference: ExactComponentReference,
  ) => ComponentNodeViewDescriptor;
  readonly onTextMutationBlocked?: (violations: readonly TextLockViolation[]) => void;
  readonly textLocked?: boolean;
}

export function createBlockId(): string {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `block_${randomId}`;
}

function styleOverridesToCss(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const styles = value as Record<string, unknown>;
  const declarations: string[] = [];
  const pixels = [
    ["fontSize", "font-size"],
    ["letterSpacing", "letter-spacing"],
    ["paddingTop", "padding-top"],
    ["paddingRight", "padding-right"],
    ["paddingBottom", "padding-bottom"],
    ["paddingLeft", "padding-left"],
    ["marginTop", "margin-top"],
    ["marginBottom", "margin-bottom"],
    ["borderWidth", "border-width"],
    ["borderRadius", "border-radius"],
  ] as const;
  const plain = [
    ["textColor", "color"],
    ["backgroundColor", "background-color"],
    ["fontWeight", "font-weight"],
    ["lineHeight", "line-height"],
    ["textAlign", "text-align"],
    ["borderStyle", "border-style"],
    ["borderColor", "border-color"],
  ] as const;

  for (const [key, property] of pixels) {
    if (typeof styles[key] === "number") {
      declarations.push(`${property}: ${String(styles[key])}px`);
    }
  }
  for (const [key, property] of plain) {
    const styleValue = styles[key];
    if (typeof styleValue === "string" || typeof styleValue === "number") {
      declarations.push(`${property}: ${String(styleValue)}`);
    }
  }

  return declarations.length > 0 ? declarations.join("; ") : undefined;
}

const ignoredAttribute = {
  default: null,
  renderHTML: () => ({}),
};

const BlockAttributes = Extension.create<{ createId: () => string }>({
  name: "documentBlockAttributes",

  addOptions() {
    return {
      createId: createBlockId,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_NODE_NAMES],
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              typeof attributes.blockId === "string" ? { "data-block-id": attributes.blockId } : {},
          },
          sourceBlockId: ignoredAttribute,
          semanticRole: {
            ...ignoredAttribute,
            renderHTML: (attributes) =>
              typeof attributes.semanticRole === "string"
                ? { "data-semantic-role": attributes.semanticRole }
                : {},
          },
          styleRef: ignoredAttribute,
          styleOverrides: {
            ...ignoredAttribute,
            renderHTML: (attributes) => {
              const style = styleOverridesToCss(attributes.styleOverrides);
              return style === undefined ? {} : { style };
            },
          },
          locked: {
            default: false,
            renderHTML: (attributes) =>
              attributes.locked === true ? { "data-locked": "true" } : {},
          },
          sourceTextHash: ignoredAttribute,
          compatibilityLevel: ignoredAttribute,
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    const createId = this.options.createId;
    const blockNames = new Set<string>(BLOCK_NODE_NAMES);

    return [
      new Plugin({
        key: new PluginKey("documentBlockIdentity"),
        appendTransaction: (_transactions, _oldState, newState) => {
          const seen = new Set<string>();
          const replacements: Array<{ readonly pos: number; readonly blockId: string }> = [];

          newState.doc.descendants((node, pos) => {
            if (!blockNames.has(node.type.name)) {
              return;
            }

            const blockId = typeof node.attrs.blockId === "string" ? node.attrs.blockId : null;
            if (blockId === null || blockId.length === 0 || seen.has(blockId)) {
              replacements.push({ pos, blockId: createId() });
              return;
            }
            seen.add(blockId);
          });

          if (replacements.length === 0) {
            return null;
          }

          const transaction = newState.tr;
          for (const replacement of replacements) {
            const node = transaction.doc.nodeAt(replacement.pos);
            if (node !== null) {
              transaction.setNodeMarkup(replacement.pos, undefined, {
                ...node.attrs,
                blockId: replacement.blockId,
              });
            }
          }

          transaction.setMeta("addToHistory", false);
          transaction.setMeta("transactionOrigin", "editor.identity");
          return transaction;
        },
      }),
      new Plugin({
        key: new PluginKey("documentBlockSelection"),
        props: {
          decorations: (state) => {
            const selectionPosition = state.selection.from;
            let selected:
              | {
                  readonly from: number;
                  readonly to: number;
                }
              | undefined;
            let pos = 0;

            state.doc.forEach((node) => {
              const to = pos + node.nodeSize;
              if (selected === undefined && selectionPosition >= pos && selectionPosition <= to) {
                selected = { from: pos, to };
              }
              pos = to;
            });

            return selected === undefined
              ? DecorationSet.empty
              : DecorationSet.create(state.doc, [
                  Decoration.node(selected.from, selected.to, {
                    "data-editor-selected": "true",
                  }),
                ]);
          },
        },
      }),
    ];
  },
});

const OriginalTextLock = Extension.create<{
  onBlocked: (violations: readonly TextLockViolation[]) => void;
  textLocked: boolean;
}>({
  name: "originalTextLock",

  addOptions() {
    return {
      onBlocked: () => undefined,
      textLocked: false,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey("originalTextLock"),
        filterTransaction: (transaction, state) => {
          if (!transaction.docChanged || !options.textLocked) {
            return true;
          }

          const validation = validateTextLockEvolution(
            state.doc.toJSON() as DocNode,
            transaction.doc.toJSON() as DocNode,
            true,
          );
          if (validation.success) {
            return true;
          }

          queueMicrotask(() => options.onBlocked(validation.violations));
          return false;
        },
      }),
    ];
  },
});

const DocumentRoot = Node.create({
  name: "doc",
  topNode: true,
  content: "block*",
});

const Paragraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      indentMode: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "p" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { class: "editor-paragraph" }), 0];
  },
});

const Heading = Node.create({
  name: "heading",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      level: {
        default: 1,
      },
      numbering: ignoredAttribute,
    };
  },

  parseHTML() {
    return [1, 2, 3].map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    }));
  },

  renderHTML({ node, HTMLAttributes }) {
    const level =
      typeof node.attrs.level === "number" && node.attrs.level >= 1 && node.attrs.level <= 3
        ? node.attrs.level
        : 1;
    return [
      `h${String(level)}`,
      mergeAttributes(HTMLAttributes, { class: `editor-heading editor-heading-${String(level)}` }),
      0,
    ];
  },
});

const Blockquote = Node.create({
  name: "blockquote",
  group: "block",
  content: "(paragraph|heading|bulletList|orderedList)+",
  defining: true,

  addAttributes() {
    return {
      quoteType: ignoredAttribute,
      source: ignoredAttribute,
      variant: ignoredAttribute,
      showQuotes: ignoredAttribute,
      showSource: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "blockquote" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["blockquote", mergeAttributes(HTMLAttributes, { class: "editor-blockquote" }), 0];
  },
});

const BulletList = Node.create({
  name: "bulletList",
  group: "block",
  content: "listItem+",

  addAttributes() {
    return {
      bulletStyle: ignoredAttribute,
      indentLevel: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "ul" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["ul", mergeAttributes(HTMLAttributes, { class: "editor-list" }), 0];
  },
});

const OrderedList = Node.create({
  name: "orderedList",
  group: "block",
  content: "listItem+",

  addAttributes() {
    return {
      start: {
        default: 1,
        parseHTML: (element) => Number.parseInt(element.getAttribute("start") ?? "1", 10),
        renderHTML: (attributes) =>
          attributes.start === 1 ? {} : { start: String(attributes.start) },
      },
      numberingStyle: ignoredAttribute,
      indentLevel: ignoredAttribute,
      preserveOriginalNumbering: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "ol" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["ol", mergeAttributes(HTMLAttributes, { class: "editor-list" }), 0];
  },
});

const ListItem = Node.create({
  name: "listItem",
  content: "(paragraph|bulletList|orderedList)+",
  defining: true,

  addAttributes() {
    return {
      originalNumberText: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "li" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["li", HTMLAttributes, 0];
  },
});

const ImageBlock = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      resourceId: {
        default: "resource_pending",
        renderHTML: (attributes) => ({ "data-resource-id": attributes.resourceId }),
      },
      originalResourceId: ignoredAttribute,
      alt: ignoredAttribute,
      caption: ignoredAttribute,
      widthMode: ignoredAttribute,
      widthPercent: ignoredAttribute,
      aspectRatio: ignoredAttribute,
      objectFit: ignoredAttribute,
      watermarkId: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-node-type='imageBlock']" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = typeof node.attrs.alt === "string" ? node.attrs.alt : "图片素材";
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        class: "editor-atom editor-image-block",
        "data-node-type": "imageBlock",
      }),
      ["span", { class: "editor-atom-label" }, label],
    ];
  },
});

const Divider = Node.create({
  name: "divider",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      variant: ignoredAttribute,
      widthPercent: ignoredAttribute,
      align: ignoredAttribute,
      icon: ignoredAttribute,
      spacingBefore: ignoredAttribute,
      spacingAfter: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "div[data-node-type='divider']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "editor-divider",
        "data-node-type": "divider",
      }),
      ["hr"],
    ];
  },
});

function createSemanticCardExtension(
  resolver: DocumentExtensionOptions["componentNodeViewResolver"],
) {
  function descriptorFor(node: {
    readonly attrs: Readonly<Record<string, unknown>>;
  }): ComponentNodeViewDescriptor {
    const componentId =
      typeof node.attrs.componentId === "string" ? node.attrs.componentId : "component_unknown";
    const version =
      typeof node.attrs.componentVersion === "string" ? node.attrs.componentVersion : "0.0.0";
    return (
      resolver?.({ componentId, version }) ?? {
        componentId,
        label: componentId,
        rendererKey: "GenericSemanticCardNodeView",
        state: "available",
        version,
      }
    );
  }

  function applyDescriptor(
    dom: HTMLElement,
    label: HTMLElement,
    descriptor: ComponentNodeViewDescriptor,
  ): void {
    dom.dataset.componentId = descriptor.componentId;
    dom.dataset.componentRenderer = descriptor.rendererKey;
    dom.dataset.componentState = descriptor.state;
    if (descriptor.version === undefined) {
      delete dom.dataset.componentVersion;
    } else {
      dom.dataset.componentVersion = descriptor.version;
    }
    label.textContent =
      descriptor.state === "available" && descriptor.version !== undefined
        ? `${descriptor.label} · ${descriptor.version}`
        : descriptor.label;
  }

  return Node.create({
    name: "semanticCard",
    group: "block",
    content: "(paragraph|heading|blockquote|bulletList|orderedList|imageBlock|divider)*",
    defining: true,

    addAttributes() {
      return {
        componentId: {
          default: "component_basic_card",
          renderHTML: () => ({}),
        },
        componentVersion: {
          default: "1.0.0",
          renderHTML: () => ({}),
        },
        variant: ignoredAttribute,
        eyebrow: ignoredAttribute,
        title: ignoredAttribute,
        footer: ignoredAttribute,
      };
    },

    parseHTML() {
      return [{ tag: "section[data-node-type='semanticCard']" }];
    },

    renderHTML({ HTMLAttributes, node }) {
      const descriptor = descriptorFor(node);
      return [
        "section",
        mergeAttributes(HTMLAttributes, {
          class: "editor-semantic-card",
          "data-component-id": descriptor.componentId,
          "data-component-renderer": descriptor.rendererKey,
          "data-component-state": descriptor.state,
          ...(descriptor.version === undefined
            ? {}
            : { "data-component-version": descriptor.version }),
          "data-node-type": "semanticCard",
        }),
        0,
      ];
    },

    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement("section");
        dom.className = "editor-semantic-card";
        dom.dataset.nodeType = "semanticCard";
        const label = document.createElement("div");
        label.className = "editor-semantic-card__label";
        label.contentEditable = "false";
        const contentDOM = document.createElement("div");
        contentDOM.className = "editor-semantic-card__content";
        applyDescriptor(dom, label, descriptorFor(node));
        dom.append(label, contentDOM);

        return {
          contentDOM,
          dom,
          update(updatedNode) {
            if (updatedNode.type.name !== "semanticCard") {
              return false;
            }
            applyDescriptor(dom, label, descriptorFor(updatedNode));
            return true;
          },
        };
      };
    },
  });
}

const BrandFooter = Node.create({
  name: "brandFooter",
  group: "block",
  content: "(paragraph|imageBlock|divider)*",
  defining: true,

  addAttributes() {
    return {
      accountId: {
        default: "account_pending",
        renderHTML: () => ({}),
      },
      templateId: {
        default: "footer_default",
        renderHTML: () => ({}),
      },
      mode: {
        default: "linked",
        renderHTML: () => ({}),
      },
      autoUpdate: {
        default: true,
        renderHTML: () => ({}),
      },
      frozenVersion: ignoredAttribute,
    };
  },

  parseHTML() {
    return [{ tag: "footer[data-node-type='brandFooter']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "footer",
      mergeAttributes(HTMLAttributes, {
        class: "editor-brand-footer",
        "data-node-type": "brandFooter",
      }),
      0,
    ];
  },
});

const SvgInteraction = Node.create({
  name: "svgInteraction",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      interactionId: {
        default: "interaction_pending",
        renderHTML: () => ({}),
      },
      templateId: {
        default: "svg_placeholder",
        renderHTML: () => ({}),
      },
      templateVersion: {
        default: "1.0.0",
        renderHTML: () => ({}),
      },
      interactionType: {
        default: "placeholder",
        renderHTML: () => ({}),
      },
      configuration: {
        default: {},
        renderHTML: () => ({}),
      },
      resourceIds: {
        default: [],
        renderHTML: () => ({}),
      },
      fallbackResourceId: {
        default: "resource_pending",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-node-type='svgInteraction']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "editor-atom editor-svg-interaction",
        "data-node-type": "svgInteraction",
      }),
      ["span", { class: "editor-atom-label" }, "SVG 互动组件"],
    ];
  },
});

function colorMark(name: "textColor" | "backgroundColor", property: string) {
  return Mark.create({
    name,

    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (element) => element.style.getPropertyValue(property) || null,
          renderHTML: (attributes) =>
            typeof attributes.color === "string"
              ? { style: `${property}: ${attributes.color}` }
              : {},
        },
      };
    },

    parseHTML() {
      return [{ style: property }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["span", HTMLAttributes, 0];
    },
  });
}

const FontSize = Mark.create({
  name: "fontSize",

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) => Number.parseFloat(element.style.fontSize),
        renderHTML: (attributes) =>
          typeof attributes.size === "number"
            ? { style: `font-size: ${String(attributes.size)}px` }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ style: "font-size" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

const Link = Mark.create({
  name: "link",
  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null,
      },
      openInNewTab: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[href]" }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: mark.attrs.href,
        rel: mark.attrs.openInNewTab === true ? "noopener noreferrer" : undefined,
        target: mark.attrs.openInNewTab === true ? "_blank" : undefined,
      }),
      0,
    ];
  },
});

function simpleMark(name: "underline" | "strike", tag: "u" | "s") {
  return Mark.create({
    name,

    parseHTML() {
      return [{ tag }];
    },

    renderHTML({ HTMLAttributes }) {
      return [tag, HTMLAttributes, 0];
    },
  });
}

export function createDocumentExtensions(options: DocumentExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      document: false,
      heading: false,
      horizontalRule: false,
      link: false,
      listItem: false,
      orderedList: false,
      paragraph: false,
      strike: false,
      trailingNode: false,
      underline: false,
    }),
    DocumentRoot,
    Paragraph,
    Heading,
    Blockquote,
    BulletList,
    OrderedList,
    ListItem,
    ImageBlock,
    Divider,
    createSemanticCardExtension(options.componentNodeViewResolver),
    BrandFooter,
    SvgInteraction,
    simpleMark("underline", "u"),
    simpleMark("strike", "s"),
    colorMark("textColor", "color"),
    colorMark("backgroundColor", "background-color"),
    Link,
    FontSize,
    BlockAttributes,
    OriginalTextLock.configure({
      onBlocked: options.onTextMutationBlocked ?? (() => undefined),
      textLocked: options.textLocked ?? false,
    }),
  ];
}
