import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  LotMapGeoJson,
  LotMapGeoJsonFeature,
  LotMapRing,
} from '../types/project-lot-map.type';

const LOTES_FOLDER_NAME = 'Lotes (poligonos)';

type ParsedPolygon = Readonly<{
  lotNumber: string;
  ring: LotMapRing;
  centroidLon: number;
  centroidLat: number;
}>;

/**
 * Parses lot polygon KML (folder "Lotes (poligonos)") into GeoJSON with stage keys.
 */
@Injectable()
export class ProjectLotKmlParserService {
  /**
   * Converts KML buffer into a FeatureCollection with west/east stage assignment.
   */
  public parseLotsPolygons(
    kmlText: string,
    swapStages = false,
  ): LotMapGeoJson {
    const folderXml = this.extractFolderXml(kmlText, LOTES_FOLDER_NAME);
    if (!folderXml) {
      throw new BadRequestException(
        `KML must contain a Folder named "${LOTES_FOLDER_NAME}"`,
      );
    }
    const polygons = this.parsePolygons(folderXml);
    if (polygons.length === 0) {
      throw new BadRequestException(
        'No polygons found in Lotes (poligonos) folder',
      );
    }
    const lons = polygons.map((p) => p.centroidLon);
    const midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const westKey = swapStages ? '2' : '1';
    const eastKey = swapStages ? '1' : '2';
    const westName = `Etapa ${westKey}`;
    const eastName = `Etapa ${eastKey}`;
    const westOrder = Number(westKey);
    const eastOrder = Number(eastKey);
    const features: LotMapGeoJsonFeature[] = polygons.map((poly) => {
      const isWest = poly.centroidLon < midLon;
      const stageKey = isWest ? westKey : eastKey;
      const stageName = isWest ? westName : eastName;
      const stageOrder = isWest ? westOrder : eastOrder;
      return {
        type: 'Feature',
        properties: {
          lotNumber: poly.lotNumber,
          stageKey,
          stageName,
          stageOrder,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [poly.ring],
        },
      };
    });
    return { type: 'FeatureCollection', features };
  }

  private extractFolderXml(kmlText: string, folderName: string): string | null {
    const escaped = folderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const folderRegex = new RegExp(
      `<Folder>\\s*<name>${escaped}</name>([\\s\\S]*?)(?=<Folder>|</Document>)`,
      'i',
    );
    const match = kmlText.match(folderRegex);
    return match?.[1] ?? null;
  }

  private parsePolygons(folderXml: string): ParsedPolygon[] {
    const placemarks = folderXml.match(/<Placemark>[\s\S]*?<\/Placemark>/gi) ?? [];
    const polygons: ParsedPolygon[] = [];
    for (const placemark of placemarks) {
      if (!/<Polygon>/i.test(placemark)) {
        continue;
      }
      const nameMatch = placemark.match(/<name>([\s\S]*?)<\/name>/i);
      const lotNumberRaw = (nameMatch?.[1] ?? '').trim();
      if (!lotNumberRaw || lotNumberRaw.startsWith('sin-numero')) {
        continue;
      }
      const lotNumber = this.normalizeLotNumber(lotNumberRaw);
      if (!lotNumber) {
        continue;
      }
      const coordsMatch = placemark.match(
        /<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/i,
      );
      if (!coordsMatch) {
        continue;
      }
      const ring = this.parseCoordinates(coordsMatch[1]);
      if (ring.length < 3) {
        continue;
      }
      const closedRing = this.ensureClosedRing(ring);
      const centroid = this.computeCentroid(closedRing);
      polygons.push({
        lotNumber,
        ring: closedRing,
        centroidLon: centroid.lon,
        centroidLat: centroid.lat,
      });
    }
    return polygons;
  }

  private parseCoordinates(raw: string): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    for (const token of raw.trim().split(/\s+/)) {
      if (!token) {
        continue;
      }
      const parts = token.split(',');
      if (parts.length < 2) {
        continue;
      }
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        continue;
      }
      points.push([lon, lat]);
    }
    return points;
  }

  private ensureClosedRing(ring: Array<[number, number]>): LotMapRing {
    if (ring.length === 0) {
      return ring;
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return ring;
    }
    return [...ring, first];
  }

  private computeCentroid(ring: LotMapRing): { lon: number; lat: number } {
    const points =
      ring.length > 1 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1)
        : ring;
    const lon =
      points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const lat =
      points.reduce((sum, point) => sum + point[1], 0) / points.length;
    return { lon, lat };
  }

  private normalizeLotNumber(raw: string): string {
    const trimmed = raw.trim();
    const digitMatch = trimmed.match(/(\d+)/);
    if (digitMatch) {
      return String(parseInt(digitMatch[1], 10));
    }
    return trimmed;
  }
}
