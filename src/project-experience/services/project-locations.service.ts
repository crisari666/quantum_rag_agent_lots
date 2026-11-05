import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { basename, extname } from 'path';
import { UPLOADS_STATIC_URL_PREFIX } from '../../config/upload-bucket.constants';
import { ProjectImageStorageService } from '../../projects/services/project-image-storage.service';
import { ProjectsService } from '../../projects/projects.service';
import { MAPBOX_ATTRIBUTION } from '../constants/mapbox-poi.constants';
import { ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES } from '../constants/experience-asset-upload.constants';
import { CreateProjectLocationDto } from '../dto/create-project-location.dto';
import { DiscoverLocationsDto } from '../dto/discover-locations.dto';
import { ReorderLocationsDto } from '../dto/reorder-locations.dto';
import { UpdateProjectLocationDto } from '../dto/update-project-location.dto';
import {
  ProjectLocation,
  ProjectLocationDocument,
} from '../schemas/project-location.schema';
import {
  ProjectLocationCategory,
  ProjectLocationGeometryType,
  ProjectLocationImportance,
  ProjectLocationSource,
} from '../types/project-location.enums';
import type { ExperienceLocationPublicType } from '../types/project-experience-manifest.type';
import type { ExperiencePoiSettingsType } from '../types/experience-poi-settings.type';
import { meetsMinImportance } from '../types/experience-poi-settings.type';
import {
  computeHaversineMeters,
  extractRepresentativePoint,
} from '../utils/geo-distance.util';
import { PoiDiscoveryService } from './poi-discovery.service';
import type { PoiDiscoveryResult } from '../types/poi-discovery-result.type';

@Injectable()
export class ProjectLocationsService {
  public constructor(
    @InjectModel(ProjectLocation.name)
    private readonly locationModel: Model<ProjectLocationDocument>,
    private readonly projectsService: ProjectsService,
    private readonly poiDiscoveryService: PoiDiscoveryService,
    private readonly projectImageStorageService: ProjectImageStorageService,
  ) {}

  public async listByProject(
    projectId: string,
  ): Promise<ProjectLocationDocument[]> {
    await this.projectsService.getById(projectId);
    return this.locationModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ sortOrder: 1, createdAt: 1 })
      .exec();
  }

  public async listPublicVisible(
    projectId: string,
    poi?: ExperiencePoiSettingsType,
    amenityCategories: readonly { key: string; label: string }[] = [],
  ): Promise<readonly ExperienceLocationPublicType[]> {
    await this.projectsService.getById(projectId);
    const rows = await this.locationModel
      .find({
        projectId: new Types.ObjectId(projectId),
        isVisible: true,
        isVerified: true,
      })
      .sort({ sortOrder: 1, createdAt: 1 })
      .exec();
    const mapped = rows.map((row) =>
      this.toPublicLocation(row, amenityCategories),
    );
    if (!poi) {
      return mapped;
    }
    const allowCategories = poi.publicCategories ?? [];
    return mapped.filter((location) => {
      if (
        location.distanceMeters != null &&
        location.distanceMeters > poi.publicRadiusMeters
      ) {
        return false;
      }
      if (
        allowCategories.length > 0 &&
        !allowCategories.includes(location.category)
      ) {
        return false;
      }
      return meetsMinImportance(location.importance, poi.minImportance);
    });
  }

  public async create(
    projectId: string,
    dto: CreateProjectLocationDto,
  ): Promise<ProjectLocationDocument> {
    const project = await this.projectsService.getById(projectId);
    this.assertValidGeometry(dto.geometry);
    const distanceMeters = this.computeDistanceFromProject(
      project.lat,
      project.lng,
      dto.geometry,
    );
    const source = dto.source ?? ProjectLocationSource.manual;
    const doc = await this.locationModel.create({
      projectId: new Types.ObjectId(projectId),
      name: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      subtitle: dto.subtitle?.trim() ?? '',
      category: dto.category,
      geometry: dto.geometry,
      source,
      sourceId: dto.sourceId?.trim() ?? '',
      importance: dto.importance ?? ProjectLocationImportance.medium,
      estimatedTravelMinutes: dto.estimatedTravelMinutes ?? null,
      isVisible: dto.isVisible ?? true,
      sortOrder: dto.sortOrder ?? 0,
      attribution:
        dto.attribution?.trim() ||
        (source === ProjectLocationSource.mapbox
          ? MAPBOX_ATTRIBUTION
          : source === ProjectLocationSource.osm
            ? '© OpenStreetMap contributors'
            : ''),
      distanceMeters,
      isVerified: false,
      verifiedAt: null,
      verifiedByUserId: '',
      media: { cover: '', gallery: [], video: '' },
    });
    return doc;
  }

  public async update(
    projectId: string,
    locationId: string,
    dto: UpdateProjectLocationDto,
  ): Promise<ProjectLocationDocument> {
    const project = await this.projectsService.getById(projectId);
    const location = await this.findOwnedLocation(projectId, locationId);
    if (dto.name !== undefined) location.name = dto.name.trim();
    if (dto.description !== undefined) {
      location.description = dto.description.trim();
    }
    if (dto.subtitle !== undefined) {
      location.subtitle = dto.subtitle.trim();
    }
    if (dto.category !== undefined) location.category = dto.category;
    if (dto.categoryKey !== undefined) {
      location.categoryKey = dto.categoryKey.trim().toLowerCase();
    }
    if (dto.panoramaAssetId !== undefined) {
      location.panoramaAssetId = dto.panoramaAssetId.trim();
    }
    if (dto.gallery !== undefined) {
      location.media = location.media ?? { cover: '', gallery: [], video: '' };
      location.media.gallery = dto.gallery.map((name) =>
        this.sanitizeGalleryFileName(name),
      );
      if (
        location.media.cover &&
        !location.media.gallery.includes(location.media.cover)
      ) {
        location.media.cover = location.media.gallery[0] ?? '';
      }
      if (!location.media.cover && location.media.gallery[0]) {
        location.media.cover = location.media.gallery[0];
      }
      location.markModified('media');
    }
    if (dto.importance !== undefined) location.importance = dto.importance;
    if (dto.estimatedTravelMinutes !== undefined) {
      location.estimatedTravelMinutes = dto.estimatedTravelMinutes;
    }
    if (dto.roadDistanceMeters !== undefined) {
      location.roadDistanceMeters = dto.roadDistanceMeters;
    }
    if (dto.isVisible !== undefined) location.isVisible = dto.isVisible;
    if (dto.sortOrder !== undefined) location.sortOrder = dto.sortOrder;
    if (dto.geometry !== undefined) {
      this.assertValidGeometry(dto.geometry);
      location.geometry = dto.geometry as ProjectLocation['geometry'];
      location.distanceMeters = this.computeDistanceFromProject(
        project.lat,
        project.lng,
        dto.geometry,
      );
      location.isVerified = false;
      location.verifiedAt = null;
      location.verifiedByUserId = '';
    }
    await location.save();
    return location;
  }

  public async remove(
    projectId: string,
    locationId: string,
  ): Promise<{ deleted: true }> {
    const location = await this.findOwnedLocation(projectId, locationId);
    await location.deleteOne();
    return { deleted: true };
  }

  public async verify(
    projectId: string,
    locationId: string,
    verifiedByUserId: string,
  ): Promise<ProjectLocationDocument> {
    const location = await this.findOwnedLocation(projectId, locationId);
    location.isVerified = true;
    location.verifiedAt = new Date();
    location.verifiedByUserId = verifiedByUserId;
    await location.save();
    return location;
  }

  public async reorder(
    projectId: string,
    dto: ReorderLocationsDto,
  ): Promise<ProjectLocationDocument[]> {
    await this.projectsService.getById(projectId);
    const ops = dto.items.map((item) => ({
      updateOne: {
        filter: {
          _id: new Types.ObjectId(item.locationId),
          projectId: new Types.ObjectId(projectId),
        },
        update: { $set: { sortOrder: item.sortOrder } },
      },
    }));
    if (ops.length > 0) {
      await this.locationModel.bulkWrite(ops);
    }
    return this.listByProject(projectId);
  }

  public async discover(
    projectId: string,
    dto: DiscoverLocationsDto,
  ): Promise<PoiDiscoveryResult> {
    const project = await this.projectsService.getById(projectId);
    if (
      typeof project.lat !== 'number' ||
      typeof project.lng !== 'number' ||
      !Number.isFinite(project.lat) ||
      !Number.isFinite(project.lng)
    ) {
      throw new BadRequestException(
        'Project lat/lng required for Mapbox place discovery',
      );
    }
    return this.poiDiscoveryService.discover({
      lat: project.lat,
      lng: project.lng,
      radiusMeters: dto.radiusMeters,
      categories: dto.categories,
    });
  }

  public async importGeoJson(params: {
    readonly projectId: string;
    readonly buffer: Buffer;
  }): Promise<{ created: number; locations: ProjectLocationDocument[] }> {
    const project = await this.projectsService.getById(params.projectId);
    let parsed: unknown;
    try {
      parsed = JSON.parse(params.buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid GeoJSON file');
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { type?: string }).type !== 'FeatureCollection' ||
      !Array.isArray((parsed as { features?: unknown }).features)
    ) {
      throw new BadRequestException(
        'GeoJSON must be a FeatureCollection with features[]',
      );
    }
    const features = (parsed as { features: unknown[] }).features;
    const created: ProjectLocationDocument[] = [];
    let sortOrder = await this.locationModel.countDocuments({
      projectId: new Types.ObjectId(params.projectId),
    });
    for (const feature of features) {
      if (!feature || typeof feature !== 'object') continue;
      const feat = feature as {
        type?: string;
        properties?: Record<string, unknown>;
        geometry?: { type?: string; coordinates?: unknown };
      };
      if (feat.type !== 'Feature' || !feat.geometry?.type) continue;
      const geometryType = feat.geometry.type;
      if (
        geometryType !== 'Point' &&
        geometryType !== 'LineString' &&
        geometryType !== 'Polygon'
      ) {
        continue;
      }
      const geometry = {
        type: geometryType as ProjectLocationGeometryType,
        coordinates: feat.geometry.coordinates,
      };
      this.assertValidGeometry(geometry);
      const props = feat.properties ?? {};
      const name =
        (typeof props.name === 'string' && props.name.trim()) ||
        (typeof props.title === 'string' && props.title.trim()) ||
        `Imported ${geometryType}`;
      const category = this.parseCategory(props.category) ??
        (geometryType === 'LineString'
          ? ProjectLocationCategory.road
          : ProjectLocationCategory.other);
      const distanceMeters = this.computeDistanceFromProject(
        project.lat,
        project.lng,
        geometry,
      );
      const doc = await this.locationModel.create({
        projectId: new Types.ObjectId(params.projectId),
        name,
        description:
          typeof props.description === 'string' ? props.description : '',
        subtitle: typeof props.subtitle === 'string' ? props.subtitle : '',
        category,
        geometry,
        source: ProjectLocationSource.manual,
        sourceId: '',
        importance: ProjectLocationImportance.medium,
        distanceMeters,
        isVisible: true,
        isVerified: false,
        verifiedAt: null,
        verifiedByUserId: '',
        sortOrder,
        attribution: '',
        media: { cover: '', gallery: [], video: '' },
      });
      created.push(doc);
      sortOrder += 1;
    }
    return { created: created.length, locations: created };
  }

  public toPublicLocation(
    row: ProjectLocationDocument,
    amenityCategories: readonly { key: string; label: string }[] = [],
  ): ExperienceLocationPublicType {
    const categoryKey = row.categoryKey ?? '';
    const categoryLabel =
      amenityCategories.find((rowCategory) => rowCategory.key === categoryKey)
        ?.label ?? '';
    const gallery = (row.media?.gallery ?? [])
      .map((fileName) => this.toPublicMediaUrl(fileName))
      .filter((url): url is string => Boolean(url));
    const cover = this.toPublicMediaUrl(row.media?.cover ?? '') ?? gallery[0] ?? null;
    return {
      id: String(row._id),
      name: row.name,
      description: row.description ?? '',
      subtitle: row.subtitle ?? '',
      category: row.category,
      categoryKey,
      categoryLabel,
      panoramaAssetId: row.panoramaAssetId ?? '',
      geometry: {
        type: row.geometry.type,
        coordinates: row.geometry.coordinates,
      },
      importance: row.importance,
      distanceMeters: row.distanceMeters,
      estimatedTravelMinutes: row.estimatedTravelMinutes,
      media: {
        cover,
        gallery,
        video: row.media?.video || null,
      },
      attribution: row.attribution ?? '',
      sortOrder: row.sortOrder,
    };
  }

  /**
   * Appends image files to the amenity gallery and sets the cover when empty.
   */
  public async appendGallery(
    projectId: string,
    locationId: string,
    files: readonly Express.Multer.File[],
  ): Promise<ProjectLocationDocument> {
    if (files.length === 0) {
      throw new BadRequestException('No images uploaded');
    }
    const location = await this.findOwnedLocation(projectId, locationId);
    const names: string[] = [];
    for (const file of files) {
      if (
        !ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES.includes(
          file.mimetype as (typeof ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES)[number],
        )
      ) {
        throw new BadRequestException('Gallery files must be jpeg, png, or webp');
      }
      const extension = extname(file.originalname || '').toLowerCase() || '.jpg';
      const fileName = `amenity_${locationId}_${Date.now()}_${names.length}${extension}`;
      await this.projectImageStorageService.saveFile(file.buffer, fileName);
      names.push(fileName);
    }
    location.media = location.media ?? { cover: '', gallery: [], video: '' };
    location.media.gallery = [...(location.media.gallery ?? []), ...names];
    if (!location.media.cover) {
      location.media.cover = names[0] ?? '';
    }
    location.markModified('media');
    await location.save();
    return location;
  }

  private toPublicMediaUrl(fileName: string): string | null {
    const trimmed = fileName.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) return trimmed;
    return `${UPLOADS_STATIC_URL_PREFIX}projects/${trimmed}`;
  }

  private sanitizeGalleryFileName(fileName: string): string {
    const trimmed = fileName.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return basename(trimmed);
    }
    return basename(trimmed);
  }

  private async findOwnedLocation(
    projectId: string,
    locationId: string,
  ): Promise<ProjectLocationDocument> {
    if (!Types.ObjectId.isValid(locationId)) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
    const location = await this.locationModel
      .findOne({
        _id: new Types.ObjectId(locationId),
        projectId: new Types.ObjectId(projectId),
      })
      .exec();
    if (!location) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
    return location;
  }

  private computeDistanceFromProject(
    projectLat: number,
    projectLng: number,
    geometry: { readonly type: string; readonly coordinates: unknown },
  ): number | null {
    const point = extractRepresentativePoint(geometry);
    if (!point) return null;
    return computeHaversineMeters({
      fromLat: projectLat,
      fromLng: projectLng,
      toLat: point.latitude,
      toLng: point.longitude,
    });
  }

  private assertValidGeometry(geometry: {
    readonly type: string;
    readonly coordinates: unknown;
  }): void {
    if (
      geometry.type !== 'Point' &&
      geometry.type !== 'LineString' &&
      geometry.type !== 'Polygon'
    ) {
      throw new BadRequestException(
        'geometry.type must be Point, LineString, or Polygon',
      );
    }
    if (geometry.coordinates === undefined || geometry.coordinates === null) {
      throw new BadRequestException('geometry.coordinates is required');
    }
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as unknown[];
      if (
        !Array.isArray(coords) ||
        coords.length < 2 ||
        typeof coords[0] !== 'number' ||
        typeof coords[1] !== 'number'
      ) {
        throw new BadRequestException(
          'Point coordinates must be [longitude, latitude]',
        );
      }
    }
  }

  private parseCategory(value: unknown): ProjectLocationCategory | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return Object.values(ProjectLocationCategory).includes(
      normalized as ProjectLocationCategory,
    )
      ? (normalized as ProjectLocationCategory)
      : null;
  }
}
