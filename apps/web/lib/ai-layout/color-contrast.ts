function expandHex(hex: string): string | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(normalized)) {
    return normalized
      .split("")
      .map((character) => `${character}${character}`)
      .join("");
  }
  return /^[\da-f]{6}$/i.test(normalized) ? normalized : null;
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

const DARK_LUMINANCE = 0.2126 * linearize(17) + 0.7152 * linearize(24) + 0.0722 * linearize(39);

/** Chooses the higher-contrast neutral foreground for an opaque hex background. */
export function readableTextColor(background: string): "#111827" | "#FFFFFF" {
  const hex = expandHex(background);
  if (!hex) {
    return "#111827";
  }
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / (DARK_LUMINANCE + 0.05);
  return darkContrast >= whiteContrast ? "#111827" : "#FFFFFF";
}
