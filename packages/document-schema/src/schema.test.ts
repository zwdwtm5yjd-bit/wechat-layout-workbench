import { describe, expect, it } from "vitest";

import { documentV1Fixture } from "./fixtures/index.js";
import { MARK_TYPES } from "./marks/index.js";
import { NODE_TYPES } from "./nodes/index.js";
import { documentSchemaV1JsonSchema, serializeDocumentSchemaV1 } from "./schema.js";
import { deserializeDocument, serializeDocument } from "./serialization.js";
import { collectDocumentEntries } from "./traversal.js";
import { validateDocument } from "./validation.js";
import { DOCUMENT_SCHEMA_VERSION } from "./version.js";

function collectObjectTypes(input: unknown, types = new Set<string>()): Set<string> {
  if (Array.isArray(input)) {
    input.forEach((item) => collectObjectTypes(item, types));
    return types;
  }

  if (typeof input !== "object" || input === null) {
    return types;
  }

  if ("type" in input && typeof input.type === "string") {
    types.add(input.type);
  }

  Object.values(input).forEach((value) => collectObjectTypes(value, types));
  return types;
}

describe("Document Schema V1", () => {
  it("validates and round-trips a fixture containing every node and mark", () => {
    const validation = validateDocument(documentV1Fixture);

    expect(validation).toEqual({
      success: true,
      data: documentV1Fixture,
    });

    const restored = deserializeDocument(serializeDocument(documentV1Fixture));
    expect(restored).toEqual(documentV1Fixture);

    const fixtureTypes = collectObjectTypes(restored);
    expect(NODE_TYPES.every((type) => fixtureTypes.has(type))).toBe(true);
    expect(MARK_TYPES.every((type) => fixtureTypes.has(type))).toBe(true);
  });

  it("exports a serializable JSON Schema fixed to version 1.0.0", () => {
    const serializedSchema = serializeDocumentSchemaV1();
    const restoredSchema = JSON.parse(serializedSchema) as unknown;

    expect(documentSchemaV1JsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(documentSchemaV1JsonSchema.properties.schemaVersion).toEqual({
      const: DOCUMENT_SCHEMA_VERSION,
    });
    expect(restoredSchema).toEqual(documentSchemaV1JsonSchema);
  });

  it("accepts and round-trips exact component references on component-capable nodes", () => {
    const document = structuredClone(documentV1Fixture);
    const componentNodeTypes = new Set([
      "blockquote",
      "brandFooter",
      "divider",
      "heading",
      "imageBlock",
      "semanticCard",
    ]);
    const blocks = collectDocumentEntries(document.content).blocks.filter(({ node }) =>
      componentNodeTypes.has(node.type),
    );

    blocks.forEach(({ node }, index) => {
      node.attrs.componentId = `component_fixture_${String(index + 1)}`;
      node.attrs.componentVersion = "1.2.3";
      node.attrs.componentVariantId = "default";
    });

    expect(validateDocument(document)).toEqual({ success: true, data: document });
    const restored = deserializeDocument(serializeDocument(document));
    expect(restored).toEqual(document);
    expect(
      collectDocumentEntries(restored.content).blocks.every(
        ({ node }) =>
          !componentNodeTypes.has(node.type) ||
          (node.attrs.componentId !== undefined &&
            node.attrs.componentVersion === "1.2.3" &&
            node.attrs.componentVariantId === "default"),
      ),
    ).toBe(true);
  });

  it("rejects component references on nodes that cannot be registered components", () => {
    const document = structuredClone(documentV1Fixture);
    const paragraph = document.content.content.find((node) => node.type === "paragraph");
    if (paragraph?.type !== "paragraph") {
      throw new Error("测试样稿缺少 paragraph 节点");
    }
    Object.assign(paragraph.attrs as Record<string, unknown>, {
      componentId: "component_invalid_paragraph",
      componentVersion: "1.0.0",
    });

    const result = validateDocument(document);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "SCHEMA_INVALID",
            keyword: "additionalProperties",
          }),
        ]),
      );
    }
  });

  it("rejects unpaired component references and a variant without an exact reference", () => {
    const invalidAttributes = [
      { componentId: "component_heading_fixture" },
      { componentVersion: "1.0.0" },
      { componentVariantId: "default" },
    ] as const;

    invalidAttributes.forEach((attributes) => {
      const document = structuredClone(documentV1Fixture);
      const heading = document.content.content.find((node) => node.type === "heading");
      if (heading?.type !== "heading") {
        throw new Error("测试样稿缺少 heading 节点");
      }
      Object.assign(heading.attrs, attributes);

      const result = validateDocument(document);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "SCHEMA_INVALID",
              keyword: "dependentRequired",
            }),
          ]),
        );
      }
    });
  });

  it("rejects unknown nodes instead of silently accepting them", () => {
    const invalidDocument = {
      ...structuredClone(documentV1Fixture),
      content: {
        ...structuredClone(documentV1Fixture.content),
        content: [
          ...structuredClone(documentV1Fixture.content.content),
          {
            type: "scriptWidget",
            attrs: {
              blockId: "block_unknown",
              locked: false,
            },
          },
        ],
      },
    };

    const result = validateDocument(invalidDocument);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.code === "SCHEMA_INVALID")).toBe(true);
    }
  });

  it("rejects duplicate block IDs throughout nested content", () => {
    const invalidDocument = structuredClone(documentV1Fixture);
    invalidDocument.content.content[1]!.attrs.blockId =
      invalidDocument.content.content[0]!.attrs.blockId;

    const result = validateDocument(invalidDocument);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "DUPLICATE_BLOCK_ID",
        }),
      );
    }
  });

  it("rejects unsafe links, arbitrary styles, and external image URLs", () => {
    const invalidDocument = structuredClone(documentV1Fixture);
    const paragraph = invalidDocument.content.content.find((node) => node.type === "paragraph");
    const image = invalidDocument.content.content.find((node) => node.type === "imageBlock");

    if (paragraph?.content?.[2]?.type === "text") {
      const link = paragraph.content[2].marks?.find((mark) => mark.type === "link");
      if (link?.type === "link") {
        link.attrs.href = "javascript:alert(1)";
      }
      Object.assign(paragraph.attrs.styleOverrides ?? {}, {
        cssText: "position:fixed",
      });
    }

    if (image?.type === "imageBlock") {
      Object.assign(image.attrs, {
        url: "https://example.com/uncontrolled.png",
      });
    }

    const result = validateDocument(invalidDocument);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.errors.filter((error) => error.code === "SCHEMA_INVALID").length,
      ).toBeGreaterThan(0);
    }
  });

  it("reports malformed JSON as a document validation error", () => {
    expect(() => deserializeDocument("{")).toThrow("文档不是有效的 JSON");
  });
});
