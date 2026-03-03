/** Maximum file size for image upload (5 MB). */
export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Allowed MIME types for project images. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

/** Default directory for project image uploads (relative to app root). */
export const DEFAULT_PROJECT_IMAGES_UPLOAD_DIR = 'uploads/projects';

/** Output format after compression (smaller size). */
export const COMPRESSED_IMAGE_FORMAT = 'webp' as const;
