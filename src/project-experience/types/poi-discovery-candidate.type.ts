import type { ProjectLocationCategory } from './project-location.enums';

export type PoiDiscoveryCandidate = Readonly<{
  sourceId: string;
  name: string;
  category: ProjectLocationCategory;
  geometry: Readonly<{
    type: 'Point';
    coordinates: readonly [number, number];
  }>;
  distanceMeters: number;
  attribution: string;
  osmTags: Readonly<Record<string, string>>;
}>;
