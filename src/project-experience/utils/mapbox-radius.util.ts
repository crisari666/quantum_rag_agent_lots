import {
  MAPBOX_RADIUS_DEG_MAX,
  MAPBOX_RADIUS_DEG_MIN,
  METERS_PER_DEGREE_LAT,
} from '../constants/mapbox-poi.constants';

/** Convert meters to Search Box `radius` (degrees), clamped to API bounds. */
export function metersToMapboxRadiusDegrees(meters: number): number {
  const degrees = meters / METERS_PER_DEGREE_LAT;
  return Math.min(
    MAPBOX_RADIUS_DEG_MAX,
    Math.max(MAPBOX_RADIUS_DEG_MIN, degrees),
  );
}
