import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { Model, Types } from 'mongoose';
import { ProjectImageStorageService } from '../../projects/services/project-image-storage.service';
import { ProjectsService } from '../../projects/projects.service';
import {
  DEFAULT_STAGE_KEY,
  ProjectLot,
  ProjectLotDocument,
} from '../schemas/project-lot.schema';
import { ProjectLotKind, ProjectLotStatus } from '../types/project-lot.enums';
import type {
  LotMapGeoJson,
  LotMapGeoJsonFeature,
  LotMapPaintResult,
  LotMapUploadResult,
} from '../types/project-lot-map.type';
import { ProjectLotKmlParserService } from './project-lot-kml-parser.service';

/**
 * Uploads lot-map KML, persists GeoJSON, and paints polygons from live lot status.
 */
@Injectable()
export class ProjectLotMapService {
  public constructor(
    @InjectModel(ProjectLot.name)
    private readonly projectLotModel: Model<ProjectLotDocument>,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly projectImageStorageService: ProjectImageStorageService,
    private readonly kmlParser: ProjectLotKmlParserService,
  ) {}

  public async uploadKml(params: {
    readonly projectId: string;
    readonly buffer: Buffer;
    readonly originalName: string;
    readonly swapStages?: boolean;
  }): Promise<LotMapUploadResult> {
    const project = await this.projectsService.getById(params.projectId);
    const swapStages = Boolean(params.swapStages);
    const kmlText = params.buffer.toString('utf8');
    if (!kmlText.includes('<kml')) {
      throw new BadRequestException('Uploaded file is not a valid KML document');
    }
    const geojson = this.kmlParser.parseLotsPolygons(kmlText, swapStages);
    const timestamp = Date.now();
    const baseName = this.sanitizeProjectName(project.title);
    const kmlFileName = `lots_map_${baseName}_${timestamp}.kml`;
    const geojsonFileName = `lots_map_${baseName}_${timestamp}.geojson`;
    if (project.lotsMapKml) {
      await this.projectImageStorageService.deleteFile(project.lotsMapKml);
    }
    if (project.lotsMapGeojson) {
      await this.projectImageStorageService.deleteFile(project.lotsMapGeojson);
    }
    await this.projectImageStorageService.saveFile(params.buffer, kmlFileName);
    await this.projectImageStorageService.saveFile(
      Buffer.from(JSON.stringify(geojson), 'utf8'),
      geojsonFileName,
    );
    await this.projectsService.setLotsMapFiles(params.projectId, {
      lotsMapKml: kmlFileName,
      lotsMapGeojson: geojsonFileName,
    });
    const createdLots = await this.upsertMissingLots({
      projectId: params.projectId,
      geojson,
      baseLotArea: project.baseLotArea ?? 0,
      defaultPrice:
        project.defaultLotPrice > 0
          ? project.defaultLotPrice
          : project.priceSell,
    });
    const stageCounts = new Map<string, { stageName: string; count: number }>();
    for (const feature of geojson.features) {
      const key = feature.properties.stageKey;
      const existing = stageCounts.get(key) ?? {
        stageName: feature.properties.stageName,
        count: 0,
      };
      existing.count += 1;
      stageCounts.set(key, existing);
    }
    return {
      projectId: params.projectId,
      lotsMapKml: kmlFileName,
      lotsMapGeojson: geojsonFileName,
      featureCount: geojson.features.length,
      createdLots,
      stages: [...stageCounts.entries()].map(([stageKey, value]) => ({
        stageKey,
        stageName: value.stageName,
        count: value.count,
      })),
      swapStages,
    };
  }

  public async getPaintedMap(
    projectId: string,
    options: { readonly includeSoldBy: boolean } = { includeSoldBy: true },
  ): Promise<LotMapPaintResult> {
    const project = await this.projectsService.getById(projectId);
    if (!project.lotsMapGeojson) {
      throw new NotFoundException(
        `Project ${projectId} has no lot map GeoJSON. Upload a KML first.`,
      );
    }
    const geojson = await this.readStoredGeoJson(project.lotsMapGeojson);
    const lots = await this.projectLotModel
      .find({
        projectId: new Types.ObjectId(projectId),
        kind: ProjectLotKind.lot,
      })
      .exec();
    const byKey = new Map<string, ProjectLotDocument>();
    for (const lot of lots) {
      byKey.set(`${lot.stageKey}::${lot.number}`, lot);
    }
    let matchedCount = 0;
    const features: LotMapGeoJsonFeature[] = geojson.features.map((feature) => {
      const lot = this.resolveLotForFeature(byKey, feature);
      if (!lot) {
        return {
          ...feature,
          properties: {
            ...feature.properties,
            status: null,
            lotId: null,
            area: null,
            price: null,
            ventorName: null,
            holdUntil: null,
            ...(options.includeSoldBy ? { soldBy: null } : {}),
          },
        };
      }
      matchedCount += 1;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          status: lot.status,
          lotId: String(lot._id),
          area: lot.area,
          price: lot.price,
          ventorName: lot.ventorName ?? '',
          holdUntil: lot.holdUntil
            ? new Date(lot.holdUntil).toISOString()
            : null,
          ...(options.includeSoldBy
            ? { soldBy: lot.soldBy ?? '' }
            : {}),
        },
      };
    });
    return {
      projectId,
      projectTitle: project.title,
      lotsMapKml: project.lotsMapKml ?? '',
      lotsMapGeojson: project.lotsMapGeojson,
      geojson: { type: 'FeatureCollection', features },
      featureCount: features.length,
      matchedCount,
    };
  }

  public async clearMap(projectId: string): Promise<{ cleared: true }> {
    const project = await this.projectsService.getById(projectId);
    if (project.lotsMapKml) {
      await this.projectImageStorageService.deleteFile(project.lotsMapKml);
    }
    if (project.lotsMapGeojson) {
      await this.projectImageStorageService.deleteFile(project.lotsMapGeojson);
    }
    await this.projectsService.setLotsMapFiles(projectId, {
      lotsMapKml: '',
      lotsMapGeojson: '',
    });
    return { cleared: true };
  }

  private async readStoredGeoJson(fileName: string): Promise<LotMapGeoJson> {
    const filePath = this.projectImageStorageService.resolveFilePath(fileName);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as LotMapGeoJson;
      if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
        throw new BadRequestException('Stored lot map GeoJSON is invalid');
      }
      return parsed;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        throw new NotFoundException(`Lot map GeoJSON file ${fileName} not found`);
      }
      throw error;
    }
  }

  private async upsertMissingLots(params: {
    readonly projectId: string;
    readonly geojson: LotMapGeoJson;
    readonly baseLotArea: number;
    readonly defaultPrice: number;
  }): Promise<number> {
    const existing = await this.projectLotModel
      .find({
        projectId: new Types.ObjectId(params.projectId),
        kind: ProjectLotKind.lot,
      })
      .select('stageKey number')
      .lean()
      .exec();
    const existingKeys = new Set(
      existing.map((row) => `${row.stageKey}::${row.number}`),
    );
    const toCreate: Partial<ProjectLot>[] = [];
    const seen = new Set<string>();
    for (const feature of params.geojson.features) {
      const key = `${feature.properties.stageKey}::${feature.properties.lotNumber}`;
      const defaultAliasKey =
        feature.properties.stageKey === '1'
          ? `${DEFAULT_STAGE_KEY}::${feature.properties.lotNumber}`
          : null;
      if (
        existingKeys.has(key) ||
        (defaultAliasKey !== null && existingKeys.has(defaultAliasKey)) ||
        seen.has(key)
      ) {
        continue;
      }
      seen.add(key);
      toCreate.push({
        projectId: new Types.ObjectId(params.projectId),
        kind: ProjectLotKind.lot,
        number: feature.properties.lotNumber,
        stageKey: feature.properties.stageKey,
        stageName: feature.properties.stageName,
        stageOrder: feature.properties.stageOrder,
        area: params.baseLotArea > 0 ? params.baseLotArea : 0,
        price: params.defaultPrice > 0 ? params.defaultPrice : 0,
        status: ProjectLotStatus.available,
        soldBy: '',
        ventorName: '',
        holdUntil: null,
      });
    }
    if (toCreate.length === 0) {
      return 0;
    }
    await this.projectLotModel.insertMany(toCreate);
    return toCreate.length;
  }

  /**
   * Join map polygon → inventory lot.
   * Exact `${stageKey}::${number}` first; stage `1` also tries legacy `default`.
   * If both exist, prefer the non-available row (Excel sold/hold/locked over KML upsert).
   */
  private resolveLotForFeature(
    byKey: Map<string, ProjectLotDocument>,
    feature: LotMapGeoJsonFeature,
  ): ProjectLotDocument | undefined {
    const number = feature.properties.lotNumber;
    const stageKey = feature.properties.stageKey;
    const exact = byKey.get(`${stageKey}::${number}`);
    const legacyDefault =
      stageKey === '1'
        ? byKey.get(`${DEFAULT_STAGE_KEY}::${number}`)
        : undefined;
    if (!exact) {
      return legacyDefault;
    }
    if (!legacyDefault) {
      return exact;
    }
    if (
      exact.status === ProjectLotStatus.available &&
      legacyDefault.status !== ProjectLotStatus.available
    ) {
      return legacyDefault;
    }
    return exact;
  }

  private sanitizeProjectName(title: string): string {
    return title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'project';
  }
}
