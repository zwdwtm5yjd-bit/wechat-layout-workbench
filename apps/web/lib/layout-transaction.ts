const layoutTransactionOrigins = {
  ai: "layout.ai.apply",
  rule: "layout.rule.apply",
} as const;

export function layoutTransactionOrigin(mode: keyof typeof layoutTransactionOrigins): string {
  return layoutTransactionOrigins[mode];
}

export function layoutDraftTransactionOrigin(mode: keyof typeof layoutTransactionOrigins): string {
  return `layout.${mode}.draft`;
}

export function layoutDraftModeFromOrigin(
  origin: string,
): keyof typeof layoutTransactionOrigins | null {
  if (origin === layoutDraftTransactionOrigin("ai")) return "ai";
  if (origin === layoutDraftTransactionOrigin("rule")) return "rule";
  return null;
}
