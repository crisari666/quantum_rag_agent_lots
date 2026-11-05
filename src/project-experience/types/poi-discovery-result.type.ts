import type { PoiDiscoveryCandidate } from './poi-discovery-candidate.type';

export type PoiDiscoveryProvider = 'mapbox';

export type PoiDiscoveryResult = Readonly<{
  provider: PoiDiscoveryProvider;
  candidates: readonly PoiDiscoveryCandidate[];
  /** Non-fatal notes for the client UI. */
  warnings: readonly string[];
}>;
