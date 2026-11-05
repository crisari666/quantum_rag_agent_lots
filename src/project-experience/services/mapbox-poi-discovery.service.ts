import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_MAPBOX_TIMEOUT_MS,
  MAPBOX_ATTRIBUTION,
  MAPBOX_CATEGORY_IDS,
  MAPBOX_CATEGORY_LIMIT,
  MAPBOX_RATE_LIMIT_RETRY_MS,
  MAPBOX_REQUEST_GAP_MS,
  MAPBOX_SEARCH_BOX_CATEGORY_URL,
} from '../constants/mapbox-poi.constants';
import { ProjectLocationCategory } from '../types/project-location.enums';
import type { PoiDiscoveryCandidate } from '../types/poi-discovery-candidate.type';
import { DEFAULT_DISCOVER_CATEGORIES } from '../utils/discover-categories.util';
import { computeHaversineMeters } from '../utils/geo-distance.util';

type MapboxSearchFeature = {
  readonly type?: string;
  readonly geometry?: {
    readonly type?: string;
    readonly coordinates?: readonly number[];
  };
  readonly properties?: {
    readonly name?: string;
    readonly mapbox_id?: string;
    readonly feature_type?: string;
    readonly poi_category?: readonly string[];
    readonly full_address?: string;
    readonly coordinates?: {
      readonly longitude?: number;
      readonly latitude?: number;
    };
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
};

type MapboxSearchResponse = {
  readonly type?: string;
  readonly features?: readonly MapboxSearchFeature[];
  readonly attribution?: string;
};

type CategoryJob = Readonly<{
  category: ProjectLocationCategory;
  canonicalId: string;
}>;

/**
 * Discovers nearby POIs via Mapbox Search Box category API (not persisted).
 * One sequential request per marketing category to avoid HTTP 429.
 */
@Injectable()
export class MapboxPoiDiscoveryService {
  private readonly logger = new Logger(MapboxPoiDiscoveryService.name);

  public constructor(private readonly configService: ConfigService) {}

  public async discover(params: {
    readonly lat: number;
    readonly lng: number;
    readonly radiusMeters: number;
    readonly categories?: readonly ProjectLocationCategory[];
  }): Promise<readonly PoiDiscoveryCandidate[]> {
    if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
      throw new BadRequestException(
        'Project map coordinates are missing; set project lat/lng first',
      );
    }
    const categories =
      params.categories && params.categories.length > 0
        ? params.categories
        : DEFAULT_DISCOVER_CATEGORIES;
    const jobs = this.buildCategoryJobs(categories);
    if (jobs.length === 0) {
      throw new BadRequestException(
        'No Mapbox category filters available for the selected categories',
      );
    }
    const token = this.resolveAccessToken();
    const failures: string[] = [];
    const features: Array<{
      feature: MapboxSearchFeature;
      category: ProjectLocationCategory;
      attribution: string;
    }> = [];
    for (let i = 0; i < jobs.length; i++) {
      if (i > 0) {
        await this.sleep(MAPBOX_REQUEST_GAP_MS);
      }
      const job = jobs[i];
      try {
        const response = await this.fetchCategoryWithRetry({
          token,
          canonicalId: job.canonicalId,
          lat: params.lat,
          lng: params.lng,
        });
        for (const feature of response.features ?? []) {
          features.push({
            feature,
            category: job.category,
            attribution: response.attribution ?? MAPBOX_ATTRIBUTION,
          });
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        failures.push(`${job.canonicalId}: ${message}`);
        this.logger.warn(
          `Mapbox category ${job.canonicalId} skipped: ${message}`,
        );
      }
    }
    if (features.length === 0 && failures.length === jobs.length) {
      throw new ServiceUnavailableException(
        `Mapbox Search Box failed for all categories (${failures.slice(0, 3).join(' | ')})`,
      );
    }
    const seen = new Set<string>();
    const candidates: PoiDiscoveryCandidate[] = [];
    for (const row of features) {
      const candidate = this.toCandidate({
        feature: row.feature,
        category: row.category,
        attribution: row.attribution,
        origin: params,
      });
      if (!candidate) continue;
      if (candidate.distanceMeters > params.radiusMeters) continue;
      if (seen.has(candidate.sourceId)) continue;
      seen.add(candidate.sourceId);
      candidates.push(candidate);
    }
    return candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  public buildCategoryJobs(
    categories: readonly ProjectLocationCategory[],
  ): readonly CategoryJob[] {
    return categories.flatMap((category) =>
      (MAPBOX_CATEGORY_IDS[category] ?? []).map((canonicalId) => ({
        category,
        canonicalId,
      })),
    );
  }

  private resolveAccessToken(): string {
    const token =
      this.configService.get<string>('MAPBOX_ACCESS_TOKEN')?.trim() ||
      process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
      '';
    if (token === '') {
      throw new ServiceUnavailableException(
        'MAPBOX_ACCESS_TOKEN is not configured on omega_rag (restart yarn start:dev after adding it to .env)',
      );
    }
    return token;
  }

  private async fetchCategoryWithRetry(params: {
    readonly token: string;
    readonly canonicalId: string;
    readonly lat: number;
    readonly lng: number;
  }): Promise<MapboxSearchResponse> {
    try {
      return await this.fetchCategory(params);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (!message.includes('HTTP 429')) {
        throw error;
      }
      this.logger.warn(
        `Mapbox 429 on ${params.canonicalId}; waiting ${MAPBOX_RATE_LIMIT_RETRY_MS}ms then retry once`,
      );
      await this.sleep(MAPBOX_RATE_LIMIT_RETRY_MS);
      return this.fetchCategory(params);
    }
  }

  private async fetchCategory(params: {
    readonly token: string;
    readonly canonicalId: string;
    readonly lat: number;
    readonly lng: number;
  }): Promise<MapboxSearchResponse> {
    const search = new URLSearchParams({
      access_token: params.token,
      proximity: `${params.lng},${params.lat}`,
      limit: String(MAPBOX_CATEGORY_LIMIT),
      language: 'es',
    });
    const url = `${MAPBOX_SEARCH_BOX_CATEGORY_URL}/${encodeURIComponent(params.canonicalId)}?${search.toString()}`;
    const timeoutMs = Number(
      this.configService.get<string>('MAPBOX_TIMEOUT_MS') ??
        DEFAULT_MAPBOX_TIMEOUT_MS,
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        const bodyPreview = (await response.text()).slice(0, 180);
        throw new Error(
          `HTTP ${response.status}${bodyPreview ? `: ${bodyPreview}` : ''}`,
        );
      }
      return (await response.json()) as MapboxSearchResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private toCandidate(params: {
    readonly feature: MapboxSearchFeature;
    readonly category: ProjectLocationCategory;
    readonly attribution: string;
    readonly origin: { readonly lat: number; readonly lng: number };
  }): PoiDiscoveryCandidate | null {
    const { feature, category } = params;
    const point = this.resolveFeaturePoint(feature);
    if (!point) return null;
    const { longitude, latitude } = point;
    const props = feature.properties ?? {};
    const sourceId =
      props.mapbox_id?.trim() ||
      `${category}:${longitude.toFixed(5)},${latitude.toFixed(5)}`;
    const name =
      props.name?.trim() ||
      props.full_address?.split(',')[0]?.trim() ||
      `${category} ${sourceId}`;
    const osmTags: Record<string, string> = {
      mapbox_id: sourceId,
      feature_type: props.feature_type ?? 'poi',
      ...(props.poi_category
        ? { poi_category: props.poi_category.join(',') }
        : {}),
    };
    return {
      sourceId,
      name,
      category,
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
      distanceMeters: Math.round(
        computeHaversineMeters({
          fromLat: params.origin.lat,
          fromLng: params.origin.lng,
          toLat: latitude,
          toLng: longitude,
        }),
      ),
      attribution: params.attribution || MAPBOX_ATTRIBUTION,
      osmTags,
    };
  }

  private resolveFeaturePoint(
    feature: MapboxSearchFeature,
  ): { longitude: number; latitude: number } | null {
    const coords = feature.geometry?.coordinates;
    if (
      feature.geometry?.type === 'Point' &&
      coords &&
      coords.length >= 2 &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      return { longitude: coords[0], latitude: coords[1] };
    }
    const propCoords = feature.properties?.coordinates;
    if (
      typeof propCoords?.longitude === 'number' &&
      typeof propCoords?.latitude === 'number'
    ) {
      return {
        longitude: propCoords.longitude,
        latitude: propCoords.latitude,
      };
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
