/**
 * Which projects a listing may return:
 * - `internal`: La Ceiba channel on (`laCeibaDistribution` true, or legacy non-external).
 * - `external`: `externalDistribution: true` (allowlisted partner origins).
 * - `all`: no distribution filter (authenticated admin tooling).
 */
export type ProjectDistributionScope = 'internal' | 'external' | 'all';
