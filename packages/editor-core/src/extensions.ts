import { Extension, Mark, Node, mergeAttributes, type Extensions } from "@tiptap/core";
import type {
  ComponentNodeViewDescriptor,
  ExactComponentReference,
} from "@wechat-layout/component-registry";
import {
  builtInVisualAssetPublicPath,
  findOfficialVisualAsset,
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
  "decorativeContainer",
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
  readonly resourceUrlResolver?: (resourceId: string) => string | undefined;
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
    ["fontFamily", "font-family"],
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
          componentId: {
            ...ignoredAttribute,
            renderHTML: (attributes) =>
              typeof attributes.componentId === "string"
                ? { "data-component-id": attributes.componentId }
                : {},
          },
          componentVersion: {
            ...ignoredAttribute,
            renderHTML: (attributes) =>
              typeof attributes.componentVersion === "string"
                ? { "data-component-version": attributes.componentVersion }
                : {},
          },
          componentVariantId: ignoredAttribute,
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

function createImageBlockExtension(
  resourceUrlResolver?: (resourceId: string) => string | undefined,
) {
  return Node.create({
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
        objectPositionX: ignoredAttribute,
        objectPositionY: ignoredAttribute,
        horizontalAlign: ignoredAttribute,
        offsetX: ignoredAttribute,
        offsetY: ignoredAttribute,
        rotation: ignoredAttribute,
        layer: ignoredAttribute,
        opacity: ignoredAttribute,
        elementKind: ignoredAttribute,
        freePosition: ignoredAttribute,
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

    addNodeView() {
      return ({ editor, getPos, node }) => {
        let currentNode = node;
        const dom = document.createElement("figure");
        dom.className = "editor-atom editor-image-block";
        dom.dataset.nodeType = "imageBlock";
        const image = document.createElement("img");
        image.className = "editor-visual-asset-image";
        image.draggable = false;
        const label = document.createElement("span");
        label.className = "editor-atom-label";
        const caption = document.createElement("figcaption");
        caption.className = "editor-image-caption";

        const positionStyle = (attributes: Readonly<Record<string, unknown>>) => {
          const offsetX = Number(attributes.offsetX ?? 0);
          const offsetY = Number(attributes.offsetY ?? 0);
          const rotation = Number(attributes.rotation ?? 0);
          return `translate(${String(offsetX)}px, ${String(offsetY)}px) rotate(${String(rotation)}deg)`;
        };

        const applyNode = (currentNode: typeof node) => {
          const resourceId = String(currentNode.attrs.resourceId ?? "");
          const path =
            builtInVisualAssetPublicPath(resourceId) ?? resourceUrlResolver?.(resourceId);
          dom.dataset.resourceId = resourceId;
          dom.dataset.blockId = String(currentNode.attrs.blockId ?? "");
          const widthMode = String(currentNode.attrs.widthMode ?? "full");
          dom.style.width =
            widthMode === "percent"
              ? `${String(currentNode.attrs.widthPercent ?? 80)}%`
              : widthMode === "original"
                ? "fit-content"
                : "100%";
          const horizontalAlign = String(currentNode.attrs.horizontalAlign ?? "center");
          dom.style.marginLeft = horizontalAlign === "right" ? "auto" : "0";
          dom.style.marginRight = horizontalAlign === "left" ? "auto" : "0";
          if (horizontalAlign === "center") {
            dom.style.marginLeft = "auto";
            dom.style.marginRight = "auto";
          }
          dom.style.position = "relative";
          dom.style.transform = positionStyle(currentNode.attrs);
          dom.style.transformOrigin = "center";
          dom.style.zIndex = String(currentNode.attrs.layer ?? 1);
          dom.style.opacity = String(currentNode.attrs.opacity ?? 1);
          dom.dataset.elementKind = String(currentNode.attrs.elementKind ?? "image");
          dom.dataset.freePosition = currentNode.attrs.freePosition === true ? "true" : "false";
          dom.style.cursor = currentNode.attrs.freePosition === true ? "move" : "default";
          image.style.objectFit = String(currentNode.attrs.objectFit ?? "contain");
          image.style.objectPosition = `${String(currentNode.attrs.objectPositionX ?? 50)}% ${String(
            currentNode.attrs.objectPositionY ?? 50,
          )}%`;
          image.style.aspectRatio =
            typeof currentNode.attrs.aspectRatio === "string"
              ? currentNode.attrs.aspectRatio
              : "auto";
          label.textContent =
            typeof currentNode.attrs.alt === "string" ? currentNode.attrs.alt : "图片素材";
          caption.textContent =
            typeof currentNode.attrs.caption === "string" ? currentNode.attrs.caption : "";
          caption.hidden = caption.textContent.length === 0;
          if (path === undefined) {
            image.hidden = true;
            label.hidden = false;
            image.removeAttribute("src");
            return;
          }
          image.src = path;
          image.alt = label.textContent;
          image.hidden = false;
          label.hidden = true;
        };

        const onPointerDown = (event: PointerEvent) => {
          if (event.button !== 0 || currentNode.attrs.freePosition !== true || !editor.isEditable) {
            return;
          }
          event.preventDefault();
          const startX = event.clientX;
          const startY = event.clientY;
          const initialX = Number(currentNode.attrs.offsetX ?? 0);
          const initialY = Number(currentNode.attrs.offsetY ?? 0);
          let nextX = initialX;
          let nextY = initialY;
          dom.classList.add("is-free-dragging");

          const onPointerMove = (moveEvent: PointerEvent) => {
            nextX = Math.max(
              -600,
              Math.min(600, Math.round(initialX + moveEvent.clientX - startX)),
            );
            nextY = Math.max(
              -600,
              Math.min(600, Math.round(initialY + moveEvent.clientY - startY)),
            );
            dom.style.transform = `translate(${String(nextX)}px, ${String(nextY)}px) rotate(${String(
              currentNode.attrs.rotation ?? 0,
            )}deg)`;
          };
          const onPointerUp = () => {
            globalThis.removeEventListener("pointermove", onPointerMove);
            globalThis.removeEventListener("pointerup", onPointerUp);
            dom.classList.remove("is-free-dragging");
            const pos = getPos();
            if (typeof pos !== "number") return;
            const liveNode = editor.state.doc.nodeAt(pos);
            if (liveNode === null) return;
            const transaction = editor.state.tr
              .setNodeMarkup(pos, undefined, {
                ...liveNode.attrs,
                offsetX: nextX,
                offsetY: nextY,
              })
              .setMeta("transactionOrigin", "editor.element.position");
            editor.view.dispatch(transaction);
            editor.commands.setNodeSelection(pos);
          };

          globalThis.addEventListener("pointermove", onPointerMove);
          globalThis.addEventListener("pointerup", onPointerUp, { once: true });
        };

        applyNode(node);
        dom.addEventListener("pointerdown", onPointerDown);
        dom.append(image, label, caption);
        return {
          dom,
          update(updatedNode) {
            if (updatedNode.type.name !== "imageBlock") return false;
            currentNode = updatedNode;
            applyNode(updatedNode);
            return true;
          },
          destroy() {
            dom.removeEventListener("pointerdown", onPointerDown);
          },
        };
      };
    },
  });
}

function createDecorativeContainerExtension(
  resourceUrlResolver?: (resourceId: string) => string | undefined,
) {
  return Node.create({
    name: "decorativeContainer",
    group: "block",
    content: "inline*",
    defining: true,

    addAttributes() {
      return {
        resourceId: {
          default: "resource_pending",
          renderHTML: (attributes) => ({ "data-resource-id": attributes.resourceId }),
        },
        decorationType: {
          default: "frame",
          renderHTML: (attributes) => ({ "data-decoration-type": attributes.decorationType }),
        },
        minHeight: ignoredAttribute,
      };
    },

    parseHTML() {
      return [{ tag: "section[data-node-type='decorativeContainer']" }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "section",
        mergeAttributes(HTMLAttributes, {
          class: "editor-decorative-container",
          "data-node-type": "decorativeContainer",
        }),
        0,
      ];
    },

    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement("section");
        dom.className = "editor-decorative-container";
        dom.dataset.nodeType = "decorativeContainer";
        const contentDOM = document.createElement("div");
        contentDOM.className = "editor-decorative-container__content";

        const applyNode = (currentNode: typeof node) => {
          const resourceId = String(currentNode.attrs.resourceId ?? "");
          const path =
            builtInVisualAssetPublicPath(resourceId) ?? resourceUrlResolver?.(resourceId);
          const decorationType = String(currentNode.attrs.decorationType ?? "frame");
          const customStyle = styleOverridesToCss(currentNode.attrs.styleOverrides);
          if (customStyle === undefined) {
            dom.removeAttribute("style");
          } else {
            dom.setAttribute("style", customStyle);
          }
          dom.dataset.resourceId = resourceId;
          dom.dataset.decorationType = decorationType;
          dom.style.minHeight = `${String(currentNode.attrs.minHeight ?? (decorationType === "ribbon" ? 80 : 160))}px`;
          dom.style.backgroundImage = path === undefined ? "none" : `url(${path})`;
        };

        applyNode(node);
        dom.append(contentDOM);
        return {
          contentDOM,
          dom,
          update(updatedNode) {
            if (updatedNode.type.name !== "decorativeContainer") return false;
            applyNode(updatedNode);
            return true;
          },
        };
      };
    },
  });
}

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

  function applyVisibleAttributes(
    node: { readonly attrs: Readonly<Record<string, unknown>> },
    eyebrow: HTMLElement,
    title: HTMLElement,
    footer: HTMLElement,
  ): void {
    const apply = (element: HTMLElement, value: unknown) => {
      const text = typeof value === "string" ? value : "";
      element.textContent = text;
      element.hidden = text.length === 0;
    };
    apply(eyebrow, node.attrs.eyebrow);
    apply(title, node.attrs.title);
    apply(footer, node.attrs.footer);
  }

  function applyVisualVariant(
    node: { readonly attrs: Readonly<Record<string, unknown>> },
    dom: HTMLElement,
    artwork: HTMLElement,
  ): void {
    const variant = typeof node.attrs.variant === "string" ? node.attrs.variant : "";
    if (variant === "") {
      delete dom.dataset.componentVariant;
      artwork.hidden = true;
      return;
    }
    dom.dataset.componentVariant = variant;
    artwork.hidden = ![
      "autumn_persimmon_intro",
      "bamboo_note",
      "civic_red_banner",
      "civic_red_notice",
      "cloud_scroll_heading",
      "festival_lantern_hero",
      "film_triptych",
      "ink_mountain_hero",
      "leaf_story_intro",
      "magazine_duo",
      "mist_mountain_heading",
      "tech_orbit_hero",
    ].includes(variant);
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
          ...(typeof node.attrs.variant === "string"
            ? { "data-component-variant": node.attrs.variant }
            : {}),
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
        const artwork = document.createElement("div");
        artwork.className = "editor-semantic-card__artwork";
        artwork.contentEditable = "false";
        const eyebrow = document.createElement("div");
        eyebrow.className = "editor-semantic-card__eyebrow";
        eyebrow.contentEditable = "false";
        const title = document.createElement("div");
        title.className = "editor-semantic-card__title";
        title.contentEditable = "false";
        const contentDOM = document.createElement("div");
        contentDOM.className = "editor-semantic-card__content";
        const footer = document.createElement("div");
        footer.className = "editor-semantic-card__footer";
        footer.contentEditable = "false";
        applyDescriptor(dom, label, descriptorFor(node));
        applyVisualVariant(node, dom, artwork);
        applyVisibleAttributes(node, eyebrow, title, footer);
        dom.append(artwork, label, eyebrow, title, contentDOM, footer);

        return {
          contentDOM,
          dom,
          update(updatedNode) {
            if (updatedNode.type.name !== "semanticCard") {
              return false;
            }
            applyDescriptor(dom, label, descriptorFor(updatedNode));
            applyVisualVariant(updatedNode, dom, artwork);
            applyVisibleAttributes(updatedNode, eyebrow, title, footer);
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

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("figure");
      dom.className = "editor-atom editor-svg-interaction";
      dom.dataset.nodeType = "svgInteraction";
      const image = document.createElement("img");
      image.className = "editor-visual-asset-image";
      image.draggable = false;
      const label = document.createElement("figcaption");
      label.className = "editor-visual-asset-caption";
      const status = document.createElement("span");
      status.className = "editor-visual-asset-status";
      status.textContent = "动态预览 · 微信静态降级";

      const applyNode = (currentNode: typeof node) => {
        const resourceId = String(currentNode.attrs.resourceIds?.[0] ?? "");
        const asset = findOfficialVisualAsset(resourceId);
        const path = builtInVisualAssetPublicPath(resourceId);
        dom.dataset.resourceId = resourceId;
        label.textContent = asset?.name ?? "SVG 互动组件";
        if (path === undefined) {
          image.hidden = true;
          return;
        }
        image.src = path;
        image.alt = asset?.name ?? "动态视觉素材";
        image.hidden = false;
      };

      applyNode(node);
      dom.append(image, label, status);
      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== "svgInteraction") return false;
          applyNode(updatedNode);
          return true;
        },
      };
    };
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

const FontFamily = Mark.create({
  name: "fontFamily",

  addAttributes() {
    return {
      family: {
        default: null,
        parseHTML: (element) => element.style.fontFamily || null,
        renderHTML: (attributes) =>
          typeof attributes.family === "string"
            ? { style: `font-family: ${attributes.family}` }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ style: "font-family" }];
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
    createImageBlockExtension(options.resourceUrlResolver),
    createDecorativeContainerExtension(options.resourceUrlResolver),
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
    FontFamily,
    BlockAttributes,
    OriginalTextLock.configure({
      onBlocked: options.onTextMutationBlocked ?? (() => undefined),
      textLocked: options.textLocked ?? false,
    }),
  ];
}
