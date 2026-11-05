import { ConfigService } from '@nestjs/config';
import { MapboxPoiDiscoveryService } from './mapbox-poi-discovery.service';
import { ProjectLocationCategory } from '../types/project-location.enums';

describe('MapboxPoiDiscoveryService', () => {
  const service = new MapboxPoiDiscoveryService(
    new ConfigService({ MAPBOX_ACCESS_TOKEN: 'pk.test' }),
  );

  it('builds one Mapbox job per marketing category', () => {
    const jobs = service.buildCategoryJobs([
      ProjectLocationCategory.hospital,
      ProjectLocationCategory.education,
      ProjectLocationCategory.road,
    ]);
    expect(jobs).toEqual([
      { category: ProjectLocationCategory.hospital, canonicalId: 'health_services' },
      { category: ProjectLocationCategory.education, canonicalId: 'education' },
    ]);
  });
});
