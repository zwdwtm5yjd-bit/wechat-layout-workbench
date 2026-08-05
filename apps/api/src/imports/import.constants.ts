export const IMPORT_REPOSITORY = Symbol("IMPORT_REPOSITORY");
export const DOCX_IMPORT_REPOSITORY = Symbol("DOCX_IMPORT_REPOSITORY");
export const WEBPAGE_IMPORT_REPOSITORY = Symbol("WEBPAGE_IMPORT_REPOSITORY");

export const IMPORT_CLEANING_MODES = [
  "preserve_structure",
  "plain_text",
  "preserve_compatible",
] as const;

export const IMPORT_SOURCE_HINTS = [
  "auto",
  "word",
  "wps",
  "web",
  "wechat",
  "markdown",
  "plain_text",
  "chatgpt",
  "claude",
] as const;

export const IMPORT_BLOCK_ROLES = [
  "title",
  "subtitle",
  "heading_1",
  "heading_2",
  "heading_3",
  "paragraph",
  "quote",
  "bullet_item",
  "ordered_item",
  "image_reference",
  "excluded",
] as const;

export const IMPORT_WARNING_CODES = [
  "SECURITY_CONTENT_REMOVED",
  "HIDDEN_CONTENT_REMOVED",
  "UNSAFE_LINK_REMOVED",
  "STYLE_CLEANED",
  "UNSUPPORTED_STRUCTURE_FLATTENED",
  "EXTERNAL_IMAGE_REFERENCE",
  "EMPTY_CONTENT_SKIPPED",
] as const;

export const IMPORT_MAX_CONTENT_CHARACTERS = 1_000_000;
