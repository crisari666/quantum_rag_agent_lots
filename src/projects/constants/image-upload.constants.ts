/** Maximum file size for image upload (5 MB). */
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
/** Maximum file size for project documents (20 MB). */
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 20 * 1024 * 1024;
/** Maximum file size for project reel video (100 MB). */
export const MAX_REEL_VIDEO_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** Allowed MIME types for project images. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;
/** Allowed MIME types for project reel video uploads. */
export const ALLOWED_REEL_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
] as const;
/** Allowed MIME types for project plane uploads. */
export const ALLOWED_PLANE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;
/** Allowed MIME types for project brochure uploads. */
export const ALLOWED_BROCHURE_MIME_TYPES = ['application/pdf'] as const;

/** Output format after compression (smaller size). */
export const COMPRESSED_IMAGE_FORMAT = 'webp' as const;
