import { Injectable } from '@nestjs/common';
import { ProjectLocationCategory } from '../types/project-location.enums';
import type { PoiDiscoveryResult } from '../types/poi-discovery-result.type';
import { MapboxPoiDiscoveryService } from './mapbox-poi-discovery.service';

/**
 * Nearby-POI discovery via Mapbox Search Box. Candidates are not persisted
 * here — admin selects pins explicitly for project_locations.
 */
@Injectable()
export class PoiDiscoveryService {
  public constructor(
    private readonly mapbox: MapboxPoiDiscoveryService,
  ) {}

  public async discover(params: {
    readonly lat: number;
    readonly lng: number;
    readonly radiusMeters: number;
    readonly categories?: readonly ProjectLocationCategory[];
  }): Promise<PoiDiscoveryResult> {
    const candidates = await this.mapbox.discover(params);
    return { provider: 'mapbox', candidates, warnings: [] };
  }
}
