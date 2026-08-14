/**
 * Office JWT `level` values from omega_office_back UserLevel.
 */
export const OFFICE_USER_LEVEL = {
  admin: 0,
  subadmin: 1,
  commercialDirector: 2,
  lead: 3,
  ventor: 4,
  coach: 5,
  office: 6,
  finance: 7,
  secretary: 8,
  content: 9,
} as const;

export type OfficeUserLevel =
  (typeof OFFICE_USER_LEVEL)[keyof typeof OFFICE_USER_LEVEL];
