/** Env var holding the comma-separated partner origins that receive external projects. */
export const EXTERNAL_DISTRIBUTION_ORIGINS_ENV = 'EXTERNAL_DISTRIBUTION_ORIGINS';

/**
 * Lowercases an origin and strips trailing slashes so `https://a.com/` matches `https://a.com`.
 */
export function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Parses the comma-separated `EXTERNAL_DISTRIBUTION_ORIGINS` value into normalized origins.
 */
export function parseExternalDistributionOrigins(rawValue: string = ''): ReadonlySet<string> {
  const origins = rawValue
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => origin.length > 0);
  return new Set(origins);
}
