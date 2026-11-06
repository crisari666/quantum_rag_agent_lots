import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractRepresentativePoint } from '../utils/geo-distance.util';
import type { ProjectLocationRoute } from '../types/project-location-route.type';

type DirectionsRoute = {
  distance?: number;
  duration?: number;
  geometry?: {
    type?: string;
    coordinates?: number[][];
  };
};

/**
 * Loads a driving line from the project to a place and returns null when
 * Mapbox cannot build one, so saving the place still succeeds.
 */
@Injectable()
export class MapboxDrivingRouteService {
  private readonly logger = new Logger(MapboxDrivingRouteService.name);

  public constructor(private readonly configService: ConfigService) {}

  public async buildRoute(params: {
    readonly originLatitude: number;
    readonly originLongitude: number;
    readonly geometry: { readonly type: string; readonly coordinates: unknown };
  }): Promise<ProjectLocationRoute | null> {
    const destination = extractRepresentativePoint(params.geometry);
    const token = this.readToken();
    if (!destination || !token) return null;
    const path = `${params.originLongitude},${params.originLatitude};${destination.longitude},${destination.latitude}`;
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${path}` +
      `?geometries=geojson&overview=full&access_token=${token}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Mapbox Directions failed with HTTP ${response.status}`);
        return null;
      }
      const body = (await response.json()) as { routes?: DirectionsRoute[] };
      return this.toRoute(body.routes?.[0]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Mapbox Directions request failed: ${message}`);
      return null;
    }
  }

  private readToken(): string {
    return (
      this.configService.get<string>('MAPBOX_ACCESS_TOKEN')?.trim() ||
      process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
      ''
    );
  }

  private toRoute(route: DirectionsRoute | undefined): ProjectLocationRoute | null {
    const coordinates = route?.geometry?.coordinates;
    if (route?.geometry?.type !== 'LineString' || !Array.isArray(coordinates)) {
      return null;
    }
    if (coordinates.length < 2) return null;
    const distanceMeters = Math.round(Number(route.distance));
    const durationSeconds = Math.round(Number(route.duration));
    if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
      return null;
    }
    return {
      profile: 'driving',
      distanceMeters,
      durationSeconds,
      geometry: { type: 'LineString', coordinates },
    };
  }
}
