/**
 * Root folder for all uploaded files (relative to process.cwd() unless absolute).
 * Override with UPLOADS_BUCKET_PATH.
 */
export const UPLOADS_BUCKET_PATH_ENV_KEY = 'UPLOADS_BUCKET_PATH' as const;

/** Default uploads root when UPLOADS_BUCKET_PATH is unset. */
export const DEFAULT_UPLOADS_BUCKET_RELATIVE_PATH = 'uploads' as const;

/** URL prefix for static file serving (maps to the uploads bucket root). */
export const UPLOADS_STATIC_URL_PREFIX = '/rag/uploads/' as const;

/** Max request body and multipart file size (100 MiB). */
export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;
