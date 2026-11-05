import { assertManifestIsPublicSafe } from './manifest-sanitize.util';

describe('assertManifestIsPublicSafe', () => {
  it('allows a sanitized manifest', () => {
    expect(() =>
      assertManifestIsPublicSafe({
        projectId: 'abc',
        locations: [{ name: 'Hospital', distanceMeters: 1200 }],
      }),
    ).not.toThrow();
  });

  it('rejects soldBy leakage', () => {
    expect(() =>
      assertManifestIsPublicSafe({
        lots: [{ soldBy: 'customer-1' }],
      }),
    ).toThrow(/soldBy/);
  });
});
