import {
  computeHaversineMeters,
  extractRepresentativePoint,
} from './geo-distance.util';

describe('geo-distance.util', () => {
  it('computes ~0m for identical points', () => {
    const meters = computeHaversineMeters({
      fromLat: 4.6,
      fromLng: -74.08,
      toLat: 4.6,
      toLng: -74.08,
    });
    expect(meters).toBe(0);
  });

  it('computes roughly 1km north of equator-scale step', () => {
    const meters = computeHaversineMeters({
      fromLat: 4.6,
      fromLng: -74.08,
      toLat: 4.609,
      toLng: -74.08,
    });
    expect(meters).toBeGreaterThan(900);
    expect(meters).toBeLessThan(1100);
  });

  it('extracts Point coordinates', () => {
    const point = extractRepresentativePoint({
      type: 'Point',
      coordinates: [-75.1, 4.2],
    });
    expect(point).toEqual({ longitude: -75.1, latitude: 4.2 });
  });

  it('extracts Polygon centroid-ish of ring', () => {
    const point = extractRepresentativePoint({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    });
    expect(point).not.toBeNull();
    expect(point!.longitude).toBeCloseTo(0.8, 5);
    expect(point!.latitude).toBeCloseTo(0.8, 5);
  });
});
