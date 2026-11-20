import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXTERNAL_DISTRIBUTION_ORIGINS_ENV } from '../config/external-distribution-origins.config';
import { ProjectDistributionScopeService } from './project-distribution-scope.service';

function createService(originsEnv = 'https://gtower.cloud'): ProjectDistributionScopeService {
  const configService = {
    get: (key: string) =>
      key === EXTERNAL_DISTRIBUTION_ORIGINS_ENV ? originsEnv : undefined,
  } as ConfigService;
  return new ProjectDistributionScopeService(configService);
}

describe('ProjectDistributionScopeService', () => {
  it('honors distribution=external without JWT or Origin', () => {
    const service = createService();
    expect(service.resolveScope({ requestedDistribution: 'external' })).toBe('external');
  });

  it('honors distribution=internal even when Origin is allowlisted', () => {
    const service = createService();
    expect(
      service.resolveScope({
        requestedDistribution: 'internal',
        origin: 'https://gtower.cloud',
      }),
    ).toBe('internal');
  });

  it('returns external for allowlisted Origin when distribution is omitted', () => {
    const service = createService();
    expect(service.resolveScope({ origin: 'https://gtower.cloud' })).toBe('external');
  });

  it('returns internal when Origin is missing and distribution is omitted', () => {
    const service = createService();
    expect(service.resolveScope({})).toBe('internal');
  });

  it('requires JWT for distribution=all', () => {
    const service = createService();
    expect(() => service.resolveScope({ requestedDistribution: 'all' })).toThrow(
      ForbiddenException,
    );
    expect(
      service.resolveScope({
        requestedDistribution: 'all',
        officeJwtUser: { userId: 'u1' },
      }),
    ).toBe('all');
  });
});
