import { SetMetadata } from '@nestjs/common';
import type { OfficeUserLevel } from '../constants/office-user-level.constants';

export const ROLES_METADATA_KEY = 'officeRoles';

/**
 * Restricts a route to the given office JWT levels (see UserLevel in office back).
 */
export const Roles = (
  ...levels: readonly OfficeUserLevel[]
): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_METADATA_KEY, levels);
