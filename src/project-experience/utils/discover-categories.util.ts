import { ProjectLocationCategory } from '../types/project-location.enums';

export const DEFAULT_DISCOVER_CATEGORIES: readonly ProjectLocationCategory[] = [
  ProjectLocationCategory.hospital,
  ProjectLocationCategory.education,
  ProjectLocationCategory.shopping,
  ProjectLocationCategory.tourism,
  ProjectLocationCategory.nature,
  ProjectLocationCategory.transport,
  ProjectLocationCategory.town,
  ProjectLocationCategory.services,
];
