/**
 * One grouped block of amenities for display (e.g. “Recreation” with icon and labels).
 */
export type ProjectAmenityGroup = {
  readonly icon: string;
  readonly title: string;
  readonly amenities: string[];
};
