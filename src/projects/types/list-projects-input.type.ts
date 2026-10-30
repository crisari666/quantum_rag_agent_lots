import type { ListProjectsEnableFilter } from './list-projects-enable-filter.type';
import type { ProjectDistributionScope } from './project-distribution-scope.type';

/** Filters for {@link ProjectsService.list}. */
export type ListProjectsInput = {
  readonly enableFilter: ListProjectsEnableFilter;
  readonly distributionScope: ProjectDistributionScope;
};
