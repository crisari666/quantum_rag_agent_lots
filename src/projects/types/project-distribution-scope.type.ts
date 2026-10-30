/**
 * Which projects a listing may return:
 * - `internal`: `externalDistribution` false or missing (default consumers).
 * - `external`: only `externalDistribution: true` (allowlisted partner origins).
 * - `all`: no distribution filter (authenticated admin tooling).
 */
export type ProjectDistributionScope = 'internal' | 'external' | 'all';
