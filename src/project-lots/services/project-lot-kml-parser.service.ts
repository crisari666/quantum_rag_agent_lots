import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  LotMapGeoJson,
  LotMapGeoJsonFeature,
  LotMapRing,
} from '../types/project-lot-map.type';

const LOTES_FOLDER_NAME = 'Lotes (poligonos)';
/** Placemark names like `1-12` / `2-3` (stage-lot). */
const STAGE_LOT_NAME_REGEX = /^(\d+)\s*[-–_]\s*(.+)$/;

type ParsedPolygon = Readonly<{
  lotNumber: string;
  stageKey: string | null;
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
   * Converts KML buffer into a FeatureCollection.
   * Stage assignment priority:
   * 1) ExtendedData stageKey + lotNumber
   * 2) Placemark name `{stage}-{lot}` (e.g. 1-1, 2-3)
   * 3) Legacy plain lot numbers → west/east by centroid lon
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
    const needsGeoStage = polygons.some((poly) => poly.stageKey === null);
    const midLon = needsGeoStage
      ? (Math.min(...polygons.map((p) => p.centroidLon)) +
          Math.max(...polygons.map((p) => p.centroidLon))) /
        2
      : 0;
    const westKey = swapStages ? '2' : '1';
    const eastKey = swapStages ? '1' : '2';
    const features: LotMapGeoJsonFeature[] = polygons.map((poly) => {
      const stageKey = this.resolveStageKey({
        explicitStageKey: poly.stageKey,
        centroidLon: poly.centroidLon,
        midLon,
        westKey,
        eastKey,
        swapStages,
      });
      return {
        type: 'Feature',
        properties: {
          lotNumber: poly.lotNumber,
          stageKey,
          stageName: `Etapa ${stageKey}`,
          stageOrder: Number(stageKey) || 0,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [poly.ring],
        },
      };
    });
    return { type: 'FeatureCollection', features };
  }

  private resolveStageKey(params: {
    readonly explicitStageKey: string | null;
    readonly centroidLon: number;
    readonly midLon: number;
    readonly westKey: string;
    readonly eastKey: string;
    readonly swapStages: boolean;
  }): string {
    if (params.explicitStageKey !== null) {
      return this.applyStageSwap(params.explicitStageKey, params.swapStages);
    }
    const isWest = params.centroidLon < params.midLon;
    return isWest ? params.westKey : params.eastKey;
  }

  private applyStageSwap(stageKey: string, swapStages: boolean): string {
    if (!swapStages) {
      return stageKey;
    }
    if (stageKey === '1') {
      return '2';
    }
    if (stageKey === '2') {
      return '1';
    }
    return stageKey;
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
      const nameRaw = (nameMatch?.[1] ?? '').trim();
      if (!nameRaw || nameRaw.toLowerCase().startsWith('sin-numero')) {
        continue;
      }
      const identity = this.resolveLotIdentity(placemark, nameRaw);
      if (!identity.lotNumber) {
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
        lotNumber: identity.lotNumber,
        stageKey: identity.stageKey,
        ring: closedRing,
        centroidLon: centroid.lon,
        centroidLat: centroid.lat,
      });
    }
    return polygons;
  }

  /**
   * Prefers ExtendedData, then `{stage}-{lot}` name, else legacy plain lot number.
   */
  private resolveLotIdentity(
    placemark: string,
    nameRaw: string,
  ): { lotNumber: string; stageKey: string | null } {
    const stageFromData = this.readSimpleData(placemark, 'stageKey');
    const lotFromData = this.readSimpleData(placemark, 'lotNumber');
    if (stageFromData && lotFromData) {
      return {
        stageKey: this.normalizeStageKey(stageFromData),
        lotNumber: this.normalizeLotNumber(lotFromData),
      };
    }
    const stageLotMatch = nameRaw.match(STAGE_LOT_NAME_REGEX);
    if (stageLotMatch) {
      return {
        stageKey: this.normalizeStageKey(stageLotMatch[1]),
        lotNumber: this.normalizeLotNumber(stageLotMatch[2]),
      };
    }
    return {
      stageKey: null,
      lotNumber: this.normalizeLotNumber(nameRaw),
    };
  }

  private readSimpleData(placemark: string, fieldName: string): string | null {
    const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `<SimpleData\\s+name="${escaped}"\\s*>([\\s\\S]*?)<\\/SimpleData>`,
      'i',
    );
    const match = placemark.match(regex);
    const value = (match?.[1] ?? '').trim();
    return value !== '' ? value : null;
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

  private normalizeStageKey(raw: string): string {
    const trimmed = raw.trim();
    const digitMatch = trimmed.match(/(\d+)/);
    if (digitMatch) {
      return String(parseInt(digitMatch[1], 10));
    }
    return trimmed.toLowerCase().replace(/\s+/g, '-') || 'default';
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
