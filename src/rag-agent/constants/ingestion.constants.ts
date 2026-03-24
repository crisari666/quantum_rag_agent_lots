export const GLOBAL_PROJECT_ID = 'GLOBAL' as const;

/**
 * When `source` equals this value, re-ingestion appends chunks instead of replacing,
 * because the citation is not unique per document.
 */
export const INGESTION_FALLBACK_SOURCE_RAW_TEXT = 'raw-text' as const;

export const PROJECT_DOCUMENT_TYPES = [
  'images',
  'plane',
  'brochure',
  'reellVideo',
  'rut',
  'business_registration',
  'bank_certificate',
  'libertarian_certificate',
] as const;
