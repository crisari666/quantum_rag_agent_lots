/** Maximum length for URL slug segment. */
export const MAX_PROJECT_SLUG_LENGTH = 120;

/**
 * Lowercase kebab-case: alphanumeric segments separated by single hyphens
 * (e.g. `lote-norte`, `fraccion-2024`).
 */
export const PROJECT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
