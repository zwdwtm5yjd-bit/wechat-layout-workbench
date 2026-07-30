export const RESOURCE_REPOSITORY = Symbol("RESOURCE_REPOSITORY");
export const RESOURCE_UPLOAD_SESSION_STORE = Symbol("RESOURCE_UPLOAD_SESSION_STORE");
export const RESOURCE_RUNTIME_OPTIONS = Symbol("RESOURCE_RUNTIME_OPTIONS");

export const RESOURCE_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const RESOURCE_ACCESS_PURPOSES = ["editor_preview"] as const;
export const RESOURCE_ACCESS_VARIANTS = ["original", "thumbnail"] as const;

export const RESOURCE_UPLOAD_TTL_SECONDS = 15 * 60;
export const RESOURCE_ACCESS_MIN_SECONDS = 60;
export const RESOURCE_ACCESS_MAX_SECONDS = 60 * 60;
export const RESOURCE_IMAGE_MAX_PIXELS = 40_000_000;
export const RESOURCE_THUMBNAIL_WIDTH = 320;
export const RESOURCE_TRASH_RETENTION_DAYS = 30;
