export const SNAPSHOT_REPOSITORY = Symbol("SNAPSHOT_REPOSITORY");

export const SNAPSHOT_REASONS = [
  "manual",
  "after_import",
  "before_theme_apply",
  "before_copy",
  "before_restore",
  "restored",
] as const;

export const AUTOMATIC_SNAPSHOT_REASONS = [
  "after_import",
  "before_theme_apply",
  "before_copy",
] as const;
