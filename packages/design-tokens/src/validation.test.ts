import { describe, expect, it } from "vitest";

import { TOKEN_SCHEMA_VERSION } from "./types.js";
import {
  validateBrandTokenPlaceholder,
  validateResolveTokenInput,
  validateThemeTokenDocument,
} from "./validation.js";

describe("design token validation", () => {
  it("accepts controlled partial theme tokens", () => {
    expect(
      validateThemeTokenDocument({
        schemaVersion: TOKEN_SCHEMA_VERSION,
        colors: {
          primary: "#B42318",
          surface: "{colors.background}",
        },
        spacing: {
          paragraphGap: 18,
        },
        components: {
          "heading.level1": {
            background: "{colors.surface}",
            borderStyle: "solid",
            color: "{colors.primary}",
            fontSize: 22,
            variant: "leftBar",
          },
        },
      }),
    ).toMatchObject({ success: true });
  });

  it("rejects unknown tokens, unsafe CSS and out-of-range values", () => {
    const result = validateThemeTokenDocument({
      schemaVersion: TOKEN_SCHEMA_VERSION,
      colors: {
        primary: "url(javascript:alert(1))",
        unknownColor: "#FFFFFF",
      },
      spacing: {
        paragraphGap: 999,
      },
      components: {
        "card.unsafe": {
          backgroundImage: "url(https://example.com/tracker.png)",
          color: "#123456;display:none",
        },
      },
    });

    expect(result).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "UNSAFE_VALUE", path: "/theme/colors/primary" }),
        expect.objectContaining({
          code: "UNKNOWN_TOKEN",
          path: "/theme/colors/unknownColor",
        }),
        expect.objectContaining({
          code: "OUT_OF_RANGE",
          path: "/theme/spacing/paragraphGap",
        }),
        expect.objectContaining({
          code: "UNSAFE_VALUE",
          path: "/theme/components/card.unsafe/backgroundImage",
        }),
      ]),
    });
  });

  it("rejects malformed references and unsupported schema versions", () => {
    expect(
      validateThemeTokenDocument({
        schemaVersion: "2.0.0",
        image: { captionColor: "{colors.primary" },
      }),
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_SCHEMA_VERSION" }),
        expect.objectContaining({ code: "INVALID_REFERENCE" }),
      ]),
    });
  });

  it("limits brand placeholders to allowed identity fields and colors", () => {
    expect(
      validateBrandTokenPlaceholder({
        schemaVersion: TOKEN_SCHEMA_VERSION,
        version: "1.0",
        colors: { background: "#000000" },
        spacing: { paragraphGap: 0 },
      }),
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_TYPE", path: "/brand/version" }),
        expect.objectContaining({ code: "UNKNOWN_TOKEN", path: "/brand/spacing" }),
        expect.objectContaining({ code: "UNKNOWN_TOKEN", path: "/brand/colors/background" }),
      ]),
    });
  });

  it("rejects unknown resolution layers and arbitrary local style fields", () => {
    expect(
      validateResolveTokenInput({
        mode: "unsafe",
        runtimeCss: "display:none",
        node: {
          marginBottom: 16,
          cssText: "position:fixed",
        },
      }),
    ).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_TYPE", path: "/mode" }),
        expect.objectContaining({ code: "UNKNOWN_TOKEN", path: "/runtimeCss" }),
        expect.objectContaining({ code: "UNKNOWN_TOKEN", path: "/node/cssText" }),
      ]),
    });
  });
});
