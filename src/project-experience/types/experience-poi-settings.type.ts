import type {
  ProjectLocationCategory,
  ProjectLocationImportance,
} from './project-location.enums';

export type ExperiencePoiSettingsType = Readonly<{
  publicRadiusMeters: number;
  publicCategories: readonly ProjectLocationCategory[];
  liveMapboxEnabled: boolean;
  minImportance: ProjectLocationImportance;
}>;

export const DEFAULT_EXPERIENCE_POI: ExperiencePoiSettingsType = {
  publicRadiusMeters: 10_000,
  publicCategories: [],
  liveMapboxEnabled: false,
  minImportance: 'low' as ProjectLocationImportance,
};

const IMPORTANCE_RANK: Readonly<Record<ProjectLocationImportance, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  featured: 3,
};

export function meetsMinImportance(
  importance: string,
  minImportance: ProjectLocationImportance,
): boolean {
  const rank =
    IMPORTANCE_RANK[importance as ProjectLocationImportance] ?? 0;
  return rank >= IMPORTANCE_RANK[minImportance];
}
