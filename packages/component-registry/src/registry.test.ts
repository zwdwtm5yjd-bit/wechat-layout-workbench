import { describe, expect, it } from "vitest";

import {
  COMPONENT_MANIFEST_SCHEMA_VERSION,
  LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION,
  OFFICIAL_COMPONENT_ASSETS,
  OFFICIAL_COMPONENT_MANIFESTS,
  ComponentManifestValidationError,
  ComponentRegistry,
  ComponentRegistryError,
  compareComponentVersions,
  createOfficialComponentRegistry,
  validateComponentManifest,
  type ComponentManifestV1_1,
  type LegacyComponentManifest,
} from "./index.js";

function componentManifest(
  overrides: Partial<LegacyComponentManifest> = {},
): LegacyComponentManifest {
  return {
    adjustableProperties: ["backgroundColor", "paddingTop"],
    category: "CARD",
    compatibilityLevel: "safe",
    componentId: "cmp_card_summary_default_001",
    defaultTokenMap: {
      backgroundColor: "#FFFFFF",
      compatibilityLevel: "safe",
      paddingTop: 16,
    },
    defaultVariantId: "default",
    description: "摘要组件",
    editorRendererKey: "SummaryCardNodeView",
    fallback: {
      kind: "semantic_card",
      preserveOriginalText: true,
      rendererKey: "safePlaceholder",
    },
    name: "摘要卡片",
    nodeType: "semanticCard",
    previewAssetId: "asset_component_summary",
    scenarios: ["summary"],
    schemaVersion: LEGACY_COMPONENT_MANIFEST_SCHEMA_VERSION,
    semanticRoles: ["summary"],
    slots: [
      {
        allowImages: false,
        allowRichText: false,
        editorBinding: "eyebrow",
        kind: "text",
        label: "眉题",
        maxLength: 40,
        required: false,
        slotId: "eyebrow",
        textLocked: false,
        wechatExport: "plain_text",
      },
      {
        allowImages: false,
        allowRichText: false,
        editorBinding: "title",
        kind: "text",
        label: "标题",
        maxLength: 80,
        minLength: 1,
        recommendedMaxLength: 40,
        required: true,
        slotId: "title",
        textLocked: true,
        wechatExport: "plain_text",
      },
      {
        allowImages: false,
        allowRichText: true,
        editorBinding: "content",
        kind: "rich_text",
        label: "正文",
        maxLength: 2_000,
        required: true,
        slotId: "body",
        textLocked: true,
        wechatExport: "rich_text",
      },
      {
        allowImages: true,
        allowRichText: false,
        editorBinding: "content",
        kind: "image",
        label: "配图",
        required: false,
        slotId: "image",
        textLocked: false,
        wechatExport: "image",
      },
      {
        allowImages: false,
        allowRichText: false,
        editorBinding: "footer",
        kind: "text",
        label: "页脚",
        maxLength: 100,
        required: false,
        slotId: "footer",
        textLocked: false,
        wechatExport: "plain_text",
      },
    ],
    supportedThemeIds: ["theme_default"],
    variants: [
      { name: "默认", variantId: "default" },
      {
        name: "强调",
        tokenMap: { borderWidth: 1, variant: "accent" },
        variantId: "accent",
      },
    ],
    version: "1.0.0",
    wechatRendererKey: "summaryCardRenderer",
    ...overrides,
  };
}

function currentComponentManifest(
  overrides: Partial<ComponentManifestV1_1> = {},
): ComponentManifestV1_1 {
  const legacy = componentManifest();
  return {
    ...legacy,
    insertionPreset: {
      attributes: { variant: "default" },
      nodeType: "semanticCard",
      slotBindings: [
        { slotId: "eyebrow", target: { attribute: "eyebrow", kind: "root_attribute" } },
        { slotId: "title", target: { attribute: "title", kind: "root_attribute" } },
        {
          slotId: "body",
          target: { index: 0, kind: "child_text", nodeType: "paragraph" },
        },
        { slotId: "image", target: { index: 1, kind: "child_image" } },
        { slotId: "footer", target: { attribute: "footer", kind: "root_attribute" } },
      ],
    },
    previewAssetId: "asset_component_summary",
    schemaVersion: COMPONENT_MANIFEST_SCHEMA_VERSION,
    ...overrides,
  };
}

describe("component manifest", () => {
  it("accepts a declarative manifest and rejects unknown executable fields", () => {
    expect(validateComponentManifest(componentManifest())).toMatchObject({ success: true });

    const unsafe = {
      ...componentManifest(),
      rendererCode: "globalThis.fetch('https://example.com')",
    };
    const result = validateComponentManifest(unsafe);
    expect(result).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "UNKNOWN_FIELD",
          path: "/manifest/rendererCode",
        }),
      ]),
    });
    expect(() => new ComponentRegistry().register(unsafe)).toThrow(
      ComponentManifestValidationError,
    );
    expect(
      validateComponentManifest(componentManifest({ componentId: "unscoped_component" })),
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([expect.objectContaining({ path: "/manifest/componentId" })]),
    });
    expect(validateComponentManifest(componentManifest({ version: "01.0.0" }))).toMatchObject({
      success: false,
      issues: expect.arrayContaining([expect.objectContaining({ path: "/manifest/version" })]),
    });
  });

  it("rejects duplicate slots, invalid bindings and unsafe component tokens", () => {
    const base = componentManifest();
    const result = validateComponentManifest({
      ...base,
      defaultTokenMap: { cssText: "position: fixed" },
      slots: [
        ...base.slots,
        {
          ...base.slots[1],
          editorBinding: "title",
          kind: "image",
          slotId: "title",
        },
      ],
    });
    expect(result).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "DUPLICATE_VALUE" }),
        expect.objectContaining({ code: "INVALID_RELATION" }),
        expect.objectContaining({ code: "UNSAFE_VALUE" }),
      ]),
    });
  });

  it("accepts legacy 1.0.0 while requiring a strict native insertion preset in 1.1.0", () => {
    expect(validateComponentManifest(componentManifest())).toMatchObject({ success: true });
    expect(validateComponentManifest(currentComponentManifest())).toMatchObject({ success: true });

    const withoutPreset: Record<string, unknown> = { ...currentComponentManifest() };
    Reflect.deleteProperty(withoutPreset, "insertionPreset");
    expect(validateComponentManifest(withoutPreset)).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_TYPE", path: "/manifest/insertionPreset" }),
      ]),
    });
    expect(
      validateComponentManifest({
        ...currentComponentManifest(),
        insertionPreset: {
          attributes: { level: 1, onclick: "run()" },
          nodeType: "heading",
          slotBindings: [{ slotId: "title", target: { kind: "root_text" } }],
        },
        nodeType: "heading",
        slots: [
          {
            allowImages: false,
            allowRichText: false,
            editorBinding: "content",
            kind: "text",
            label: "标题",
            required: true,
            slotId: "title",
            textLocked: true,
            wechatExport: "plain_text",
          },
        ],
      }),
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "UNKNOWN_FIELD",
          path: "/manifest/insertionPreset/attributes/onclick",
        }),
      ]),
    });
    expect(
      validateComponentManifest({
        ...currentComponentManifest(),
        insertionPreset: {
          ...currentComponentManifest().insertionPreset,
          nodeType: "blockquote",
        },
      }),
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_RELATION",
          path: "/manifest/insertionPreset/nodeType",
        }),
      ]),
    });
  });
});

describe("official component assets", () => {
  it("ships exactly 29 immutable, uniquely versioned assets in the audited category split", () => {
    expect(OFFICIAL_COMPONENT_ASSETS).toHaveLength(29);
    expect(OFFICIAL_COMPONENT_MANIFESTS).toHaveLength(29);
    expect(
      OFFICIAL_COMPONENT_ASSETS.reduce<Record<string, number>>((counts, asset) => {
        const key =
          asset.manifest.category === "HEAD"
            ? `${asset.manifest.category}:${
                asset.manifest.insertionPreset.nodeType === "heading"
                  ? asset.manifest.insertionPreset.attributes.level
                  : "invalid"
              }`
            : asset.manifest.category;
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({
      "HEAD:1": 4,
      "HEAD:2": 4,
      DATA: 4,
      DIVIDER: 3,
      FOOTER: 2,
      IMAGE: 4,
      NOTICE: 4,
      QUOTE: 4,
    });
    expect(
      new Set(
        OFFICIAL_COMPONENT_MANIFESTS.map(
          (manifest) => `${manifest.componentId}@${manifest.version}`,
        ),
      ).size,
    ).toBe(29);
    expect(Object.isFrozen(OFFICIAL_COMPONENT_ASSETS)).toBe(true);
    expect(Object.isFrozen(OFFICIAL_COMPONENT_ASSETS[0]?.manifest.insertionPreset)).toBe(true);
    expect(Object.isFrozen(OFFICIAL_COMPONENT_ASSETS[0]?.preview.sample)).toBe(true);
  });

  it("registers every manifest and validates every preview default insertion", () => {
    OFFICIAL_COMPONENT_ASSETS.forEach((asset) => {
      const result = validateComponentManifest(asset.manifest);
      expect(result.success, `${asset.manifest.componentId}: ${JSON.stringify(result)}`).toBe(true);
    });
    const registry = createOfficialComponentRegistry();
    expect(registry.query()).toHaveLength(29);

    OFFICIAL_COMPONENT_ASSETS.forEach((asset) => {
      expect(asset.preview.name).toBe(asset.manifest.name);
      expect(asset.preview.description).toBe(asset.manifest.description);
      expect(asset.manifest.previewAssetId.length).toBeGreaterThan(0);
      expect(
        asset.manifest.slots.every((slot) => slot.textLocked === false),
        `${asset.manifest.componentId} 的用户填写槽不应被当作导入原文锁定`,
      ).toBe(true);
      expect(
        registry.prepareInsertion({
          componentId: asset.manifest.componentId,
          slots: asset.defaultSlots,
          version: asset.manifest.version,
        }),
      ).toMatchObject({
        success: true,
        descriptor: {
          componentId: asset.manifest.componentId,
          version: asset.manifest.version,
        },
      });
    });
  });
});

describe("ComponentRegistry", () => {
  it("queries deterministic catalog entries by category and semantic role", () => {
    const registry = new ComponentRegistry();
    registry.register(componentManifest());
    registry.register(
      componentManifest({
        category: "NOTICE",
        componentId: "cmp_notice_tip_default_001",
        name: "提示卡片",
        semanticRoles: ["notice"],
      }),
    );

    expect(registry.query({ category: "CARD" })).toHaveLength(1);
    expect(registry.query({ semanticRole: "notice" })[0]).toMatchObject({
      favorite: { available: false, value: false },
      manifest: { componentId: "cmp_notice_tip_default_001" },
    });
  });

  it("keeps exact immutable versions and resolves latest semantic version", () => {
    const registry = new ComponentRegistry();
    const first = registry.register(componentManifest());
    registry.register(componentManifest({ name: "摘要卡片 1.2", version: "1.2.0" }));
    registry.register(componentManifest({ name: "摘要卡片 2.0 RC", version: "2.0.0-rc.1" }));

    expect(registry.getExact({ componentId: first.componentId, version: "1.0.0" })).toBe(first);
    expect(registry.getLatest(first.componentId)?.version).toBe("2.0.0-rc.1");
    expect(Object.isFrozen(first)).toBe(true);
    expect(compareComponentVersions("2.0.0", "2.0.0-rc.1")).toBeGreaterThan(0);
    expect(
      registry.setEnabled({ componentId: first.componentId, version: "2.0.0-rc.1" }, false),
    ).toBe(true);
    expect(registry.resolve({ componentId: first.componentId })).toMatchObject({
      status: "available",
      descriptor: { version: "1.2.0" },
    });

    expect(() =>
      registry.register(componentManifest({ name: "冲突内容", version: "1.0.0" })),
    ).toThrow(ComponentRegistryError);
  });

  it("validates required, unknown, typed and length-limited slots before insertion", () => {
    const registry = new ComponentRegistry();
    registry.register(componentManifest());

    const invalid = registry.prepareInsertion({
      componentId: "cmp_card_summary_default_001",
      slots: {
        image: "不是图片资源",
        title: "超长标题".repeat(30),
        unknown: "未声明",
      },
      variantId: "missing",
    });
    expect(invalid).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_TYPE", path: "/slots/image" }),
        expect.objectContaining({ code: "INVALID_LENGTH", path: "/slots/title" }),
        expect.objectContaining({ code: "MISSING_REQUIRED_SLOT", path: "/slots/body" }),
        expect.objectContaining({ code: "UNKNOWN_SLOT", path: "/slots/unknown" }),
        expect.objectContaining({ code: "UNKNOWN_VARIANT", path: "/variantId" }),
      ]),
    });

    expect(
      registry.prepareInsertion({
        componentId: "cmp_card_summary_default_001",
        slots: {
          body: "正文",
          image: { alt: "说明图", resourceId: "resource_image_001" },
          title: "摘要",
        },
        variantId: "accent",
      }),
    ).toMatchObject({
      success: true,
      descriptor: {
        componentId: "cmp_card_summary_default_001",
        editorRendererKey: "SummaryCardNodeView",
        variantId: "accent",
        version: "1.0.0",
        wechatRendererKey: "summaryCardRenderer",
      },
    });
  });

  it("returns safe placeholders with original text for missing and disabled components", () => {
    const registry = new ComponentRegistry();
    registry.register(componentManifest());

    expect(
      registry.resolve(
        { componentId: "cmp_card_missing_default_001", version: "9.9.9" },
        { body: "必须保留的原文", title: "标题" },
      ),
    ).toMatchObject({
      status: "missing",
      placeholder: {
        originalText: "必须保留的原文\n标题",
        rendererKey: "safePlaceholder",
        requestedVersion: "9.9.9",
      },
    });

    expect(
      registry.setEnabled({ componentId: "cmp_card_summary_default_001", version: "1.0.0" }, false),
    ).toBe(true);
    expect(
      registry.describeNodeView({
        componentId: "cmp_card_summary_default_001",
        version: "1.0.0",
      }),
    ).toMatchObject({
      rendererKey: "safePlaceholder",
      state: "disabled",
    });
    expect(registry.query()).toHaveLength(0);
    expect(registry.query({ includeDisabled: true })[0]?.enabled).toBe(false);
  });
});
