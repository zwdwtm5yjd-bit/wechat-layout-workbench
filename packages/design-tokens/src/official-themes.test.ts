import { describe, expect, it } from "vitest";

import { TokenEngine } from "./engine.js";
import {
  OFFICIAL_THEME_IDS,
  OFFICIAL_THEME_PACKAGES,
  getOfficialTheme,
  getOfficialThemeVersions,
  listOfficialThemes,
} from "./official-themes.js";
import { validateThemeTokenDocument } from "./validation.js";

describe("official theme packages", () => {
  it("publishes ten immutable, complete and valid first-party themes", () => {
    expect(OFFICIAL_THEME_PACKAGES).toHaveLength(10);
    expect(OFFICIAL_THEME_PACKAGES.filter((theme) => theme.manifest.isDefault)).toHaveLength(1);

    for (const theme of OFFICIAL_THEME_PACKAGES) {
      expect(validateThemeTokenDocument(theme.tokens)).toEqual({
        success: true,
        data: theme.tokens,
      });
      expect(theme.componentRefs).toEqual(
        expect.arrayContaining([
          "paragraph.default",
          "heading.level1.default",
          "heading.level2.default",
          "heading.level3.default",
          "quote.default",
          "image.default",
          "card.data.default",
          "divider.default",
          "footer.brand.default",
        ]),
      );
      expect(theme.compatibility.preserveOriginalText).toBe(true);
      expect(theme.preview.wechatContentWidth).toBe(677);
      expect(theme.preview.mobileViewportWidth).toBe(375);
      expect(Object.isFrozen(theme)).toBe(true);
      expect(Object.isFrozen(theme.tokens.components)).toBe(true);
    }
  });

  it("resolves safe-mode tokens and supports deterministic catalog queries", () => {
    const civic = getOfficialTheme(OFFICIAL_THEME_IDS.modernCivic);
    expect(civic?.manifest.name).toBe("现代政务红");
    expect(listOfficialThemes({ search: "政务" })).toEqual([civic]);
    expect(listOfficialThemes({ contentType: "opinion" })[0]?.manifest.name).toBe("高级极简");
    expect(getOfficialThemeVersions(OFFICIAL_THEME_IDS.editorialMinimal)).toHaveLength(1);

    const resolved = new TokenEngine().resolve({
      mode: "wechat_safe",
      theme: civic!.tokens,
    });
    expect(resolved.tokens.compatibility).toMatchObject({
      allowComplexBackground: false,
      allowCustomFont: false,
      allowRiskyLayout: false,
      allowShadow: false,
      maxNestingDepth: 3,
    });
    expect(resolved.tokens.image.shadow).toBe("none");
  });
});
