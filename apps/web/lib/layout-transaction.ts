const layoutTransactionOrigins = {
  ai: "layout.ai.apply",
  rule: "layout.rule.apply",
} as const;

export function layoutTransactionOrigin(mode: keyof typeof layoutTransactionOrigins): string {
  return layoutTransactionOrigins[mode];
}
