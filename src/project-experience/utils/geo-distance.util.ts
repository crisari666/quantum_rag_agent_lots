const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Haversine straight-line distance in meters between two WGS84 points.
 */
export function computeHaversineMeters(params: {
  readonly fromLat: number;
  readonly fromLng: number;
  readonly toLat: number;
  readonly toLng: number;
}): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(params.toLat - params.fromLat);
  const dLng = toRad(params.toLng - params.fromLng);
  const lat1 = toRad(params.fromLat);
  const lat2 = toRad(params.toLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Extracts a representative Point from GeoJSON geometry for distance calc.
 */
export function extractRepresentativePoint(geometry: {
  readonly type: string;
  readonly coordinates: unknown;
}): { latitude: number; longitude: number } | null {
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates as number[];
    if (typeof lng === 'number' && typeof lat === 'number') {
      return { longitude: lng, latitude: lat };
    }
  }
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const coords = geometry.coordinates as number[][];
    if (coords.length === 0) return null;
    const mid = coords[Math.floor(coords.length / 2)];
    if (!mid || typeof mid[0] !== 'number' || typeof mid[1] !== 'number') {
      return null;
    }
    return { longitude: mid[0], latitude: mid[1] };
  }
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const rings = geometry.coordinates as number[][][];
    const ring = rings[0];
    if (!ring || ring.length === 0) return null;
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    for (const pair of ring) {
      if (typeof pair[0] === 'number' && typeof pair[1] === 'number') {
        sumLng += pair[0];
        sumLat += pair[1];
        count += 1;
      }
    }
    if (count === 0) return null;
    return { longitude: sumLng / count, latitude: sumLat / count };
  }
  return null;
}
