import { metersToMapboxRadiusDegrees } from './mapbox-radius.util';

describe('metersToMapboxRadiusDegrees', () => {
  it('converts 10km to ~0.09 degrees', () => {
    const actual = metersToMapboxRadiusDegrees(10_000);
    expect(actual).toBeCloseTo(10_000 / 111_320, 5);
  });

  it('clamps below minimum', () => {
    expect(metersToMapboxRadiusDegrees(0)).toBe(0.000_01);
  });

  it('clamps above maximum', () => {
    expect(metersToMapboxRadiusDegrees(5_000_000)).toBe(10);
  });
});
