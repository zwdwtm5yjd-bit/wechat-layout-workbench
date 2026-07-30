import { DOCUMENT_SOURCE_TYPES } from "./document.js";
import { DOCUMENT_SCHEMA_VERSION } from "./version.js";

type JsonSchema = Record<string, unknown>;

const identifierSchema = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
} as const;

const versionSchema = {
  type: "string",
  minLength: 5,
  maxLength: 32,
  pattern: "^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$",
} as const;

const colorSchema = {
  type: "string",
  pattern: "^#[0-9A-Fa-f]{6}$",
} as const;

const blockAttributeProperties = {
  blockId: identifierSchema,
  sourceBlockId: identifierSchema,
  semanticRole: {
    type: "string",
    minLength: 1,
    maxLength: 128,
    pattern: "^[A-Za-z][A-Za-z0-9._-]*$",
  },
  styleRef: {
    type: "string",
    minLength: 1,
    maxLength: 160,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
  },
  styleOverrides: {
    $ref: "#/$defs/styleOverrides",
  },
  locked: {
    type: "boolean",
  },
  sourceTextHash: {
    type: "string",
    pattern: "^sha256:[0-9a-f]{64}$",
  },
  compatibilityLevel: {
    enum: ["safe", "conditional", "static"],
  },
} as const;

function strictObject(properties: Record<string, unknown>, required: string[] = []): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function blockAttributes(
  properties: Record<string, unknown> = {},
  required: string[] = [],
): JsonSchema {
  return strictObject(
    {
      ...blockAttributeProperties,
      ...properties,
    },
    ["blockId", "locked", ...required],
  );
}

function nodeSchema(type: string, attrs: JsonSchema, content?: JsonSchema): JsonSchema {
  const properties: Record<string, unknown> = {
    type: {
      const: type,
    },
    attrs,
  };
  const required = ["type", "attrs"];

  if (content !== undefined) {
    properties.content = content;
    required.push("content");
  }

  return strictObject(properties, required);
}

function optionalContentNodeSchema(
  type: string,
  attrs: JsonSchema,
  itemRefs: string[],
): JsonSchema {
  return strictObject(
    {
      type: {
        const: type,
      },
      attrs,
      content: {
        type: "array",
        maxItems: 2_000,
        items: {
          oneOf: itemRefs.map(($ref) => ({ $ref })),
        },
      },
    },
    ["type", "attrs"],
  );
}

const paragraphNodeSchema = optionalContentNodeSchema(
  "paragraph",
  blockAttributes({
    indentMode: {
      enum: ["none", "firstLine", "hanging"],
    },
  }),
  ["#/$defs/textNode", "#/$defs/hardBreakNode"],
);

const headingNodeSchema = optionalContentNodeSchema(
  "heading",
  blockAttributes(
    {
      level: {
        enum: [1, 2, 3],
      },
      numbering: {
        type: "string",
        maxLength: 32,
      },
    },
    ["level"],
  ),
  ["#/$defs/textNode", "#/$defs/hardBreakNode"],
);

const blockquoteContentRefs = [
  "#/$defs/paragraphNode",
  "#/$defs/headingNode",
  "#/$defs/bulletListNode",
  "#/$defs/orderedListNode",
];

const semanticCardContentRefs = [
  ...blockquoteContentRefs,
  "#/$defs/blockquoteNode",
  "#/$defs/imageBlockNode",
  "#/$defs/dividerNode",
];

const rootBlockRefs = [
  ...semanticCardContentRefs,
  "#/$defs/semanticCardNode",
  "#/$defs/brandFooterNode",
  "#/$defs/svgInteractionNode",
];

export const documentSchemaV1JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://wechat-layout.local/schemas/document/1.0.0",
  title: "Wechat Layout Document Schema V1",
  description: "公众号智能视觉排版工具的权威文档 JSON Schema。",
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: {
      const: DOCUMENT_SCHEMA_VERSION,
    },
    documentId: identifierSchema,
    articleId: identifierSchema,
    accountId: {
      anyOf: [identifierSchema, { type: "null" }],
    },
    themeId: identifierSchema,
    themeVersion: versionSchema,
    brandVersion: versionSchema,
    content: {
      $ref: "#/$defs/docNode",
    },
    meta: {
      $ref: "#/$defs/documentMetadata",
    },
  },
  required: ["schemaVersion", "documentId", "articleId", "content", "meta"],
  $defs: {
    styleOverrides: strictObject({
      textColor: colorSchema,
      backgroundColor: colorSchema,
      fontSize: {
        type: "number",
        minimum: 10,
        maximum: 48,
      },
      fontWeight: {
        enum: [300, 400, 500, 600, 700],
      },
      lineHeight: {
        type: "number",
        minimum: 1,
        maximum: 3,
      },
      letterSpacing: {
        type: "number",
        minimum: -2,
        maximum: 10,
      },
      textAlign: {
        enum: ["left", "center", "right", "justify"],
      },
      paddingTop: {
        type: "number",
        minimum: 0,
        maximum: 96,
      },
      paddingRight: {
        type: "number",
        minimum: 0,
        maximum: 96,
      },
      paddingBottom: {
        type: "number",
        minimum: 0,
        maximum: 96,
      },
      paddingLeft: {
        type: "number",
        minimum: 0,
        maximum: 96,
      },
      marginTop: {
        type: "number",
        minimum: 0,
        maximum: 128,
      },
      marginBottom: {
        type: "number",
        minimum: 0,
        maximum: 128,
      },
      borderWidth: {
        type: "number",
        minimum: 0,
        maximum: 12,
      },
      borderStyle: {
        enum: ["none", "solid", "dashed", "dotted"],
      },
      borderColor: colorSchema,
      borderRadius: {
        type: "number",
        minimum: 0,
        maximum: 64,
      },
    }),
    documentMetadata: strictObject(
      {
        sourceType: {
          enum: DOCUMENT_SOURCE_TYPES,
        },
        originalFileId: identifierSchema,
        originalTextHash: {
          type: "string",
          pattern: "^sha256:[0-9a-f]{64}$",
        },
        textLocked: {
          type: "boolean",
        },
        createdAt: {
          type: "string",
          minLength: 20,
          maxLength: 40,
        },
        updatedAt: {
          type: "string",
          minLength: 20,
          maxLength: 40,
        },
      },
      ["sourceType", "textLocked", "createdAt", "updatedAt"],
    ),
    mark: {
      oneOf: [
        strictObject({ type: { const: "bold" } }, ["type"]),
        strictObject({ type: { const: "italic" } }, ["type"]),
        strictObject({ type: { const: "underline" } }, ["type"]),
        strictObject({ type: { const: "strike" } }, ["type"]),
        strictObject(
          {
            type: {
              const: "textColor",
            },
            attrs: strictObject({ color: colorSchema }, ["color"]),
          },
          ["type", "attrs"],
        ),
        strictObject(
          {
            type: {
              const: "backgroundColor",
            },
            attrs: strictObject({ color: colorSchema }, ["color"]),
          },
          ["type", "attrs"],
        ),
        strictObject(
          {
            type: {
              const: "link",
            },
            attrs: strictObject(
              {
                href: {
                  type: "string",
                  minLength: 1,
                  maxLength: 2_048,
                  pattern: "^(?:https?://|mailto:)[^\\s]+$",
                },
                openInNewTab: {
                  type: "boolean",
                },
              },
              ["href"],
            ),
          },
          ["type", "attrs"],
        ),
        strictObject(
          {
            type: {
              const: "fontSize",
            },
            attrs: strictObject(
              {
                size: {
                  type: "number",
                  minimum: 10,
                  maximum: 48,
                },
              },
              ["size"],
            ),
          },
          ["type", "attrs"],
        ),
      ],
    },
    textNode: strictObject(
      {
        type: {
          const: "text",
        },
        text: {
          type: "string",
          minLength: 1,
          maxLength: 100_000,
        },
        marks: {
          type: "array",
          maxItems: 8,
          uniqueItems: true,
          items: {
            $ref: "#/$defs/mark",
          },
        },
      },
      ["type", "text"],
    ),
    hardBreakNode: strictObject(
      {
        type: {
          const: "hardBreak",
        },
      },
      ["type"],
    ),
    paragraphNode: paragraphNodeSchema,
    headingNode: headingNodeSchema,
    blockquoteNode: nodeSchema(
      "blockquote",
      blockAttributes({
        quoteType: {
          enum: ["standard", "citation", "warning"],
        },
        source: {
          type: "string",
          maxLength: 500,
        },
        variant: {
          type: "string",
          minLength: 1,
          maxLength: 128,
        },
        showQuotes: {
          type: "boolean",
        },
        showSource: {
          type: "boolean",
        },
      }),
      {
        type: "array",
        minItems: 1,
        maxItems: 2_000,
        items: {
          oneOf: blockquoteContentRefs.map(($ref) => ({ $ref })),
        },
      },
    ),
    bulletListNode: nodeSchema(
      "bulletList",
      blockAttributes({
        bulletStyle: {
          enum: ["disc", "square", "check", "arrow", "brand"],
        },
        indentLevel: {
          type: "integer",
          minimum: 0,
          maximum: 6,
        },
      }),
      {
        type: "array",
        minItems: 1,
        maxItems: 2_000,
        items: {
          $ref: "#/$defs/listItemNode",
        },
      },
    ),
    orderedListNode: nodeSchema(
      "orderedList",
      blockAttributes(
        {
          start: {
            type: "integer",
            minimum: 1,
            maximum: 99_999,
          },
          numberingStyle: {
            enum: ["decimal", "chinese", "roman", "legal"],
          },
          indentLevel: {
            type: "integer",
            minimum: 0,
            maximum: 6,
          },
          preserveOriginalNumbering: {
            type: "boolean",
          },
        },
        ["start"],
      ),
      {
        type: "array",
        minItems: 1,
        maxItems: 2_000,
        items: {
          $ref: "#/$defs/listItemNode",
        },
      },
    ),
    listItemNode: nodeSchema(
      "listItem",
      blockAttributes({
        originalNumberText: {
          type: "string",
          maxLength: 64,
        },
      }),
      {
        type: "array",
        minItems: 1,
        maxItems: 2_000,
        items: {
          oneOf: [
            {
              $ref: "#/$defs/paragraphNode",
            },
            {
              $ref: "#/$defs/bulletListNode",
            },
            {
              $ref: "#/$defs/orderedListNode",
            },
          ],
        },
      },
    ),
    imageBlockNode: nodeSchema(
      "imageBlock",
      blockAttributes(
        {
          resourceId: identifierSchema,
          originalResourceId: identifierSchema,
          alt: {
            type: "string",
            maxLength: 500,
          },
          caption: {
            type: "string",
            maxLength: 2_000,
          },
          widthMode: {
            enum: ["full", "percent", "original"],
          },
          widthPercent: {
            type: "number",
            minimum: 1,
            maximum: 100,
          },
          aspectRatio: {
            type: "string",
            maxLength: 32,
          },
          objectFit: {
            enum: ["contain", "cover", "fill"],
          },
          watermarkId: identifierSchema,
        },
        ["resourceId"],
      ),
    ),
    dividerNode: nodeSchema(
      "divider",
      blockAttributes({
        variant: {
          enum: ["solid", "dashed", "dotted", "ornament"],
        },
        widthPercent: {
          type: "number",
          minimum: 1,
          maximum: 100,
        },
        align: {
          enum: ["left", "center", "right"],
        },
        icon: {
          type: "string",
          maxLength: 64,
        },
        spacingBefore: {
          type: "number",
          minimum: 0,
          maximum: 128,
        },
        spacingAfter: {
          type: "number",
          minimum: 0,
          maximum: 128,
        },
      }),
    ),
    semanticCardNode: optionalContentNodeSchema(
      "semanticCard",
      blockAttributes(
        {
          componentId: identifierSchema,
          componentVersion: versionSchema,
          variant: {
            type: "string",
            minLength: 1,
            maxLength: 128,
          },
          eyebrow: {
            type: "string",
            maxLength: 200,
          },
          title: {
            type: "string",
            maxLength: 500,
          },
          footer: {
            type: "string",
            maxLength: 1_000,
          },
        },
        ["componentId", "componentVersion"],
      ),
      semanticCardContentRefs,
    ),
    brandFooterNode: optionalContentNodeSchema(
      "brandFooter",
      blockAttributes(
        {
          accountId: identifierSchema,
          templateId: identifierSchema,
          mode: {
            enum: ["linked", "frozen"],
          },
          autoUpdate: {
            type: "boolean",
          },
          frozenVersion: versionSchema,
        },
        ["accountId", "templateId", "mode", "autoUpdate"],
      ),
      ["#/$defs/paragraphNode", "#/$defs/imageBlockNode", "#/$defs/dividerNode"],
    ),
    jsonValue: {
      oneOf: [
        {
          type: "null",
        },
        {
          type: "boolean",
        },
        {
          type: "number",
        },
        {
          type: "string",
          maxLength: 100_000,
        },
        {
          type: "array",
          maxItems: 1_000,
          items: {
            $ref: "#/$defs/jsonValue",
          },
        },
        {
          type: "object",
          maxProperties: 1_000,
          additionalProperties: {
            $ref: "#/$defs/jsonValue",
          },
        },
      ],
    },
    svgInteractionNode: nodeSchema(
      "svgInteraction",
      blockAttributes(
        {
          interactionId: identifierSchema,
          templateId: identifierSchema,
          templateVersion: versionSchema,
          interactionType: {
            type: "string",
            minLength: 1,
            maxLength: 128,
            pattern: "^[A-Za-z][A-Za-z0-9._-]*$",
          },
          configuration: {
            type: "object",
            maxProperties: 1_000,
            additionalProperties: {
              $ref: "#/$defs/jsonValue",
            },
          },
          resourceIds: {
            type: "array",
            maxItems: 500,
            uniqueItems: true,
            items: identifierSchema,
          },
          fallbackResourceId: identifierSchema,
        },
        [
          "interactionId",
          "templateId",
          "templateVersion",
          "interactionType",
          "configuration",
          "resourceIds",
          "fallbackResourceId",
        ],
      ),
    ),
    docNode: strictObject(
      {
        type: {
          const: "doc",
        },
        content: {
          type: "array",
          maxItems: 10_000,
          items: {
            oneOf: rootBlockRefs.map(($ref) => ({ $ref })),
          },
        },
      },
      ["type", "content"],
    ),
  },
} satisfies JsonSchema;

export function serializeDocumentSchemaV1(): string {
  return JSON.stringify(documentSchemaV1JsonSchema, null, 2);
}
