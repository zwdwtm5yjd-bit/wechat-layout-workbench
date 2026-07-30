import { describe, expect, it } from "vitest";

import { SYSTEM_THEME_TOKENS, WECHAT_SYSTEM_FONT } from "./defaults.js";
import { TokenEngine, TokenValidationError, resolveTokens } from "./engine.js";
import { TOKEN_SCHEMA_VERSION, type ResolveTokenInput } from "./types.js";

describe("TokenEngine", () => {
  it("resolves complete system defaults and component references", () => {
    const result = resolveTokens({
      component: { ref: "paragraph.default" },
    });

    expect(result.schemaVersion).toBe(TOKEN_SCHEMA_VERSION);
    expect(result.style).toMatchObject({
      color: "#1D2939",
      fontFamily: WECHAT_SYSTEM_FONT,
      fontSize: 16,
      lineHeight: 1.8,
      marginBottom: 16,
    });
    expect(result.tokens.image.captionColor).toBe("#98A2B3");
    expect(result.tokens.image.shadow).toBe("none");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.tokens.colors)).toBe(true);
    expect(resolveTokens({ component: { ref: "quote.default" } }).style.backgroundColor).toBe(
      "#F9FAFB",
    );
    for (const componentRef of [
      "component.legal.focus",
      "divider.default",
      "footer.brand.default",
      "heading.level1.default",
      "image.default",
      "paragraph.default",
      "svg.default",
    ]) {
      expect(() => resolveTokens({ component: { ref: componentRef } })).not.toThrow();
    }
  });

  it("applies the frozen priority from theme through inline style", () => {
    const globalLayers = {
      theme: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        colors: { primary: "#AA0000" },
        components: {
          "notice.default": {
            color: "{colors.primary}",
            fontSize: 18,
            variant: "theme",
          },
        },
      },
      brand: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        version: "1.0.0",
        colors: { primary: "#0000AA" },
      },
      component: {
        ref: "notice.default",
      },
    } as const satisfies ResolveTokenInput;
    expect(resolveTokens(globalLayers).style.color).toBe("#0000AA");

    const result = resolveTokens({
      ...globalLayers,
      component: {
        ref: "notice.default",
        tokens: { color: "#111111", variant: "component" },
      },
      article: {
        tokens: { colors: { primary: "#AA00AA" } },
        style: { color: "#222222", fontSize: 19 },
      },
      node: { color: "#333333", fontSize: 20 },
      inline: { color: "#444444" },
    });

    expect(result.tokens.colors.primary).toBe("#AA00AA");
    expect(result.style).toMatchObject({
      color: "#444444",
      fontSize: 20,
      variant: "component",
    });
    expect(result.trace.map(({ layer }) => layer)).toEqual([
      "system",
      "theme",
      "brand",
      "component",
      "article",
      "node",
      "inline",
    ]);
  });

  it("keeps node-local style isolated from theme tokens and input objects", () => {
    const input: ResolveTokenInput = {
      component: { ref: "paragraph.default" },
      node: { marginBottom: 48 },
      theme: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        spacing: { paragraphGap: 20 },
      },
    };
    const before = structuredClone(input);
    const result = resolveTokens(input);

    expect(result.style.marginBottom).toBe(48);
    expect(result.tokens.spacing.paragraphGap).toBe(20);
    expect(result.tokens.components["paragraph.default"]?.marginBottom).toBe(20);
    expect(input).toEqual(before);
  });

  it("forces risky attributes to safe values in WeChat safe mode", () => {
    const result = resolveTokens({
      mode: "wechat_safe",
      theme: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        compatibility: {
          allowComplexBackground: true,
          allowCustomFont: true,
          allowRiskyLayout: true,
          allowShadow: true,
          maxNestingDepth: 8,
        },
        shadow: {
          soft: "0 8px 24px rgba(16,24,40,0.20)",
        },
        typography: {
          fontFamilyWechat: "Georgia, serif",
        },
        components: {
          "card.risky": {
            backgroundImage: "linear-gradient(90deg, #112233, #445566)",
            boxShadow: "{shadow.soft}",
            columns: 4,
            compatibilityLevel: "risky",
            fontFamily: "Georgia, serif",
            position: "absolute",
          },
        },
      },
      component: { ref: "card.risky" },
    });

    expect(result.style).toMatchObject({
      boxShadow: "none",
      columns: 1,
      fontFamily: WECHAT_SYSTEM_FONT,
      position: "static",
    });
    expect(result.style).not.toHaveProperty("backgroundImage");
    expect(result.tokens.shadow).toEqual({
      medium: "none",
      none: "none",
      soft: "none",
    });
    expect(result.tokens.compatibility).toEqual({
      allowComplexBackground: false,
      allowCustomFont: false,
      allowRiskyLayout: false,
      allowShadow: false,
      maxNestingDepth: 3,
    });
    expect(result.trace.at(-1)?.layer).toBe("safety");
  });

  it("rejects missing and cyclic references", () => {
    expect(() =>
      resolveTokens({
        theme: {
          schemaVersion: TOKEN_SCHEMA_VERSION,
          image: { captionColor: "{colors.notFound}" },
        },
      }),
    ).toThrowError(TokenValidationError);

    const engine = new TokenEngine();
    const cyclic = engine.tryResolve({
      theme: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        colors: {
          primary: "{colors.secondary}",
          secondary: "{colors.primary}",
        },
      },
    });

    expect(cyclic).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "REFERENCE_CYCLE",
        }),
      ]),
    });
  });

  it("canonicalizes inputs for deterministic LRU caching", () => {
    const engine = new TokenEngine({ maxEntries: 2 });
    const first = engine.resolve({
      theme: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        colors: { accent: "#445566", primary: "#112233" },
      },
      component: { ref: "paragraph.default" },
    });
    const same = engine.resolve({
      component: { ref: "paragraph.default" },
      theme: {
        colors: { primary: "#112233", accent: "#445566" },
        schemaVersion: TOKEN_SCHEMA_VERSION,
      },
    });

    expect(same).toBe(first);
    expect(JSON.stringify(same)).toBe(JSON.stringify(first));
    expect(engine.stats).toEqual({
      hits: 1,
      maxEntries: 2,
      misses: 1,
      size: 1,
    });

    engine.resolve({
      theme: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        colors: { primary: "#223344" },
      },
    });
    engine.resolve({
      theme: {
        schemaVersion: TOKEN_SCHEMA_VERSION,
        colors: { primary: "#334455" },
      },
    });
    expect(engine.stats.size).toBe(2);
  });

  it("preserves the brand placeholder without allowing it to rewrite structural tokens", () => {
    const result = resolveTokens({
      brand: {
        accountId: "account_001",
        assets: {
          logoResourceId: "res_logo_001",
          qrCodeResourceId: "res_qr_001",
        },
        colors: { primary: "#123456" },
        defaults: {
          footerComponentId: "footer_001",
          themeId: "theme_001",
        },
        schemaVersion: TOKEN_SCHEMA_VERSION,
        version: "1.2.0",
      },
      component: { ref: "heading.level1.default" },
    });

    expect(result.tokens.colors.primary).toBe("#123456");
    expect(result.tokens.spacing).toEqual(SYSTEM_THEME_TOKENS.spacing);
    expect(result.brand).toEqual({
      accountId: "account_001",
      assets: {
        logoResourceId: "res_logo_001",
        qrCodeResourceId: "res_qr_001",
      },
      defaults: {
        footerComponentId: "footer_001",
        themeId: "theme_001",
      },
      version: "1.2.0",
    });
  });
});
