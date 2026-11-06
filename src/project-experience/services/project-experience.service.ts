import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProjectsService } from '../../projects/projects.service';
import { DEFAULT_MAP_STYLE } from '../constants/experience-asset-upload.constants';
import { UpdateProjectExperienceDto } from '../dto/update-project-experience.dto';
import { UpsertExperienceScenesDto } from '../dto/upsert-experience-scenes.dto';
import {
  ProjectExperience,
  ProjectExperienceDocument,
} from '../schemas/project-experience.schema';
import { ProjectExperienceStatus } from '../types/project-experience.enums';
import type {
  ExperienceAssetPublicType,
  ExperienceLocationPublicType,
  ProjectExperienceManifestType,
} from '../types/project-experience-manifest.type';
import {
  DEFAULT_EXPERIENCE_POI,
  type ExperiencePoiSettingsType,
} from '../types/experience-poi-settings.type';
import { ProjectLocationImportance } from '../types/project-location.enums';
import { assertManifestIsPublicSafe } from '../utils/manifest-sanitize.util';
import type { PoiDiscoveryResult } from '../types/poi-discovery-result.type';
import {
  ProjectLocationCategory,
} from '../types/project-location.enums';
import { PoiDiscoveryService } from './poi-discovery.service';
import { ProjectExperienceAssetsService } from './project-experience-assets.service';
import { ProjectExperienceResourcesService } from './project-experience-resources.service';
import { ProjectLocationsService } from './project-locations.service';
import { buildLinkedResourcePublicAssets } from '../utils/linked-resource-public-asset.util';

@Injectable()
export class ProjectExperienceService {
  public constructor(
    @InjectModel(ProjectExperience.name)
    private readonly experienceModel: Model<ProjectExperienceDocument>,
    private readonly projectsService: ProjectsService,
    private readonly projectLocationsService: ProjectLocationsService,
    private readonly projectExperienceAssetsService: ProjectExperienceAssetsService,
    private readonly projectExperienceResourcesService: ProjectExperienceResourcesService,
    private readonly poiDiscoveryService: PoiDiscoveryService,
  ) {}

  public async getOrCreateDraft(
    projectId: string,
  ): Promise<ProjectExperienceDocument> {
    const project = await this.projectsService.getById(projectId);
    const existing = await this.experienceModel
      .findOne({ projectId: new Types.ObjectId(projectId) })
      .exec();
    if (existing) {
      return existing;
    }
    return this.experienceModel.create({
      projectId: new Types.ObjectId(projectId),
      status: ProjectExperienceStatus.draft,
      version: 1,
      settings: {
        styleUrl: DEFAULT_MAP_STYLE,
        defaultZoom: 14,
        pitch: 60,
        bearing: -20,
        centerLongitude: project.lng,
        centerLatitude: project.lat,
        terrainEnabled: true,
        terrainExaggeration: 1,
        buildings3DEnabled: false,
        satelliteEnabled: true,
        fogEnabled: true,
        roadsStyle: {
          color: '#38bdf8',
          width: 3,
          opacity: 0.95,
          line: 'solid',
        },
      },
      layers: {
        lots: true,
        roads: true,
        locations: true,
        assets: true,
        models3D: true,
      },
      poi: {
        publicRadiusMeters: DEFAULT_EXPERIENCE_POI.publicRadiusMeters,
        publicCategories: [...DEFAULT_EXPERIENCE_POI.publicCategories],
        liveMapboxEnabled: DEFAULT_EXPERIENCE_POI.liveMapboxEnabled,
        minImportance: DEFAULT_EXPERIENCE_POI.minImportance,
      },
      scenes: [],
      publishedSnapshot: null,
      publishedAt: null,
      publishedVersion: null,
    });
  }

  public async update(
    projectId: string,
    dto: UpdateProjectExperienceDto,
  ): Promise<ProjectExperienceDocument> {
    const experience = await this.getOrCreateDraft(projectId);
    if (dto.settings) {
      const { roadsStyle, ...settingsRest } = dto.settings;
      Object.assign(experience.settings, settingsRest);
      if (roadsStyle) {
        experience.settings.roadsStyle = {
          ...(experience.settings.roadsStyle ?? {
            color: '#38bdf8',
            width: 3,
            opacity: 0.95,
            line: 'solid',
          }),
          ...roadsStyle,
        };
      }
      const exaggeration = experience.settings.terrainExaggeration;
      if (typeof exaggeration === 'number' && Number.isFinite(exaggeration)) {
        experience.settings.terrainExaggeration = Math.min(
          5,
          Math.max(0, exaggeration),
        );
      } else {
        experience.settings.terrainExaggeration = 1;
      }
      experience.markModified('settings');
    }
    if (dto.layers) {
      Object.assign(experience.layers, dto.layers);
      experience.markModified('layers');
    }
    if (dto.poi) {
      Object.assign(experience.poi ?? {}, dto.poi);
      experience.markModified('poi');
    }
    if (dto.amenityCategories) {
      experience.amenityCategories = this.normalizeAmenityCategories(
        dto.amenityCategories,
      );
      experience.markModified('amenityCategories');
    }
    if (experience.status === ProjectExperienceStatus.published) {
      experience.status = ProjectExperienceStatus.draft;
    }
    await experience.save();
    return experience;
  }

  public resolvePoiSettings(
    experience: ProjectExperienceDocument,
  ): ExperiencePoiSettingsType {
    const poi = experience.poi;
    return {
      publicRadiusMeters:
        poi?.publicRadiusMeters ?? DEFAULT_EXPERIENCE_POI.publicRadiusMeters,
      publicCategories: poi?.publicCategories ?? [],
      liveMapboxEnabled:
        poi?.liveMapboxEnabled ?? DEFAULT_EXPERIENCE_POI.liveMapboxEnabled,
      minImportance:
        poi?.minImportance ?? ProjectLocationImportance.low,
    };
  }

  public async upsertScenes(
    projectId: string,
    dto: UpsertExperienceScenesDto,
  ): Promise<ProjectExperienceDocument> {
    const experience = await this.getOrCreateDraft(projectId);
    const ids = new Set<string>();
    for (const scene of dto.scenes) {
      if (ids.has(scene.id)) {
        throw new BadRequestException(`Duplicate scene id: ${scene.id}`);
      }
      ids.add(scene.id);
    }
    experience.scenes = dto.scenes.map((scene, index) => ({
      id: scene.id,
      title: scene.title.trim(),
      description: scene.description?.trim() ?? '',
      camera: scene.camera,
      durationMs: scene.durationMs ?? 4000,
      visibleLayers: scene.visibleLayers ?? [],
      locationIds: scene.locationIds ?? [],
      assetIds: scene.assetIds ?? [],
      narrative: scene.narrative
        ? {
            title: scene.narrative.title?.trim() ?? '',
            text: scene.narrative.text?.trim() ?? '',
          }
        : null,
      sortOrder: scene.sortOrder ?? index,
    }));
    if (experience.status === ProjectExperienceStatus.published) {
      experience.status = ProjectExperienceStatus.draft;
    }
    experience.markModified('scenes');
    await experience.save();
    return experience;
  }

  public async publish(
    projectId: string,
  ): Promise<ProjectExperienceDocument> {
    const experience = await this.getOrCreateDraft(projectId);
    if (
      experience.settings.centerLongitude === null ||
      experience.settings.centerLatitude === null
    ) {
      throw new BadRequestException(
        'Set map center (centerLongitude/centerLatitude) before publishing',
      );
    }
    if (!experience.scenes || experience.scenes.length === 0) {
      throw new BadRequestException(
        'Add at least one scene before publishing',
      );
    }
    const manifest = await this.buildManifestFromDraft(projectId, experience);
    assertManifestIsPublicSafe(
      manifest as unknown as Record<string, unknown>,
    );
    experience.publishedSnapshot = manifest as unknown as Record<
      string,
      unknown
    >;
    experience.status = ProjectExperienceStatus.published;
    experience.publishedAt = new Date();
    experience.publishedVersion = experience.version;
    experience.version += 1;
    experience.markModified('publishedSnapshot');
    await experience.save();
    return experience;
  }

  public async disable(
    projectId: string,
  ): Promise<ProjectExperienceDocument> {
    const experience = await this.getOrCreateDraft(projectId);
    experience.status = ProjectExperienceStatus.disabled;
    await experience.save();
    return experience;
  }

  public async getPublicManifest(
    projectId: string,
  ): Promise<ProjectExperienceManifestType> {
    await this.projectsService.getById(projectId);
    const experience = await this.experienceModel
      .findOne({ projectId: new Types.ObjectId(projectId) })
      .exec();
    if (
      !experience ||
      experience.status !== ProjectExperienceStatus.published ||
      !experience.publishedSnapshot
    ) {
      throw new NotFoundException(
        `Published experience for project ${projectId} not found`,
      );
    }
    return experience.publishedSnapshot as unknown as ProjectExperienceManifestType;
  }

  public async getPublishedExperienceOrThrow(
    projectId: string,
  ): Promise<ProjectExperienceDocument> {
    await this.projectsService.getById(projectId);
    const experience = await this.experienceModel
      .findOne({ projectId: new Types.ObjectId(projectId) })
      .exec();
    if (
      !experience ||
      experience.status !== ProjectExperienceStatus.published
    ) {
      throw new NotFoundException(
        `Published experience for project ${projectId} not found`,
      );
    }
    return experience;
  }

  /**
   * Live Mapbox POIs for public clients. Gated by published + poi.liveMapboxEnabled.
   * Query overrides cannot widen beyond experience.poi allowlist.
   */
  public async discoverLivePublic(params: {
    readonly projectId: string;
    readonly radiusMeters?: number;
    readonly categories?: readonly ProjectLocationCategory[];
  }): Promise<PoiDiscoveryResult> {
    const experience = await this.getPublishedExperienceOrThrow(
      params.projectId,
    );
    const poi = this.resolvePoiSettings(experience);
    if (!poi.liveMapboxEnabled) {
      throw new NotFoundException(
        `Live Mapbox locations disabled for project ${params.projectId}`,
      );
    }
    const project = await this.projectsService.getById(params.projectId);
    console.log({project});
    const radiusMeters = Math.min(
      params.radiusMeters ?? poi.publicRadiusMeters,
      poi.publicRadiusMeters,
    );
    const requested =
      params.categories && params.categories.length > 0
        ? params.categories
        : poi.publicCategories;
    const categories =
      poi.publicCategories.length === 0
        ? requested
        : (requested ?? []).filter((c) =>
            poi.publicCategories.includes(c),
          );
    const effectiveCategories =
      categories && categories.length > 0
        ? categories
        : poi.publicCategories.length > 0
          ? poi.publicCategories
          : undefined;
    return this.poiDiscoveryService.discover({
      lat: project.lat,
      lng: project.lng,
      radiusMeters,
      categories: effectiveCategories,
    });
  }

  public async buildManifestFromDraft(
    projectId: string,
    experience: ProjectExperienceDocument,
  ): Promise<ProjectExperienceManifestType> {
    const poi = this.resolvePoiSettings(experience);
    const locations = await this.projectLocationsService.listPublicVisible(
      projectId,
      poi,
      experience.amenityCategories ?? [],
    );
    const assets =
      await this.projectExperienceAssetsService.listVisible(projectId);
    const placedAssets = await Promise.all(
      assets.map((asset) =>
        this.projectExperienceAssetsService.toPublicAsset(asset),
      ),
    );
    const publicAssets = await this.appendLinkedResourceAssets(
      projectId,
      locations,
      placedAssets,
    );
    const settings = experience.settings;
    const sortedScenes = [...experience.scenes].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    return {
      projectId,
      version: experience.publishedVersion ?? experience.version,
      status: 'published',
      map: {
        provider: 'mapbox',
        style: settings.styleUrl || DEFAULT_MAP_STYLE,
        terrain: settings.terrainEnabled,
        terrainExaggeration: settings.terrainExaggeration,
        buildings3D: settings.buildings3DEnabled,
        fog: settings.fogEnabled,
        roadsStyle: {
          color: settings.roadsStyle?.color ?? '#38bdf8',
          width: settings.roadsStyle?.width ?? 3,
          opacity: settings.roadsStyle?.opacity ?? 0.95,
          line: settings.roadsStyle?.line ?? 'solid',
        },
        initialCamera: {
          longitude: settings.centerLongitude ?? 0,
          latitude: settings.centerLatitude ?? 0,
          zoom: settings.defaultZoom,
          pitch: settings.pitch,
          bearing: settings.bearing,
        },
      },
      layers: {
        lots: experience.layers.lots,
        roads: experience.layers.roads,
        locations: experience.layers.locations,
        assets: experience.layers.assets,
        models3D: experience.layers.models3D,
      },
      poi,
      amenityCategories: [...(experience.amenityCategories ?? [])]
        .map((row) => ({
          key: row.key,
          label: row.label,
          sortOrder: row.sortOrder ?? 0,
          color:
            typeof row.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(row.color)
              ? row.color.toUpperCase()
              : '',
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      resources: {
        locations: `/rag/projects/${projectId}/experience/locations/public`,
        lots: `/rag/projects/${projectId}/lots/map/public`,
        locationsLive: `/rag/projects/${projectId}/experience/locations/live/public`,
        scenes: `/rag/projects/${projectId}/experience/public`,
      },
      scenes: sortedScenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        description: scene.description ?? '',
        camera: {
          longitude: scene.camera.longitude,
          latitude: scene.camera.latitude,
          zoom: scene.camera.zoom,
          pitch: scene.camera.pitch,
          bearing: scene.camera.bearing,
        },
        durationMs: scene.durationMs,
        visibleLayers: scene.visibleLayers ?? [],
        locationIds: scene.locationIds ?? [],
        assetIds: scene.assetIds ?? [],
        narrative: scene.narrative
          ? {
              title: scene.narrative.title ?? '',
              text: scene.narrative.text ?? '',
            }
          : null,
        sortOrder: scene.sortOrder,
      })),
      locations,
      assets: publicAssets,
      publishedAt: experience.publishedAt
        ? experience.publishedAt.toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Adds a model_3d asset at each place that links a library GLB.
   */
  private async appendLinkedResourceAssets(
    projectId: string,
    locations: readonly ExperienceLocationPublicType[],
    placedAssets: readonly ExperienceAssetPublicType[],
  ): Promise<ExperienceAssetPublicType[]> {
    const resourceIds = locations
      .map((location) => location.linkedResourceId.trim())
      .filter((resourceId) => resourceId.length > 0);
    if (resourceIds.length === 0) return [...placedAssets];
    const resources =
      await this.projectExperienceResourcesService.findModelsByIds(
        projectId,
        resourceIds,
      );
    const linkedAssets = buildLinkedResourcePublicAssets(
      locations,
      resources.map((resource) => ({
        id: String(resource._id),
        name: resource.name,
        type: resource.type,
        fileName: resource.fileName,
        thumbnailFileName: resource.thumbnailFileName,
      })),
    );
    return [...placedAssets, ...linkedAssets];
  }

  private normalizeAmenityCategories(
    rows: readonly {
      key: string;
      label: string;
      sortOrder?: number;
      color?: string;
    }[],
  ): { key: string; label: string; sortOrder: number; color: string }[] {
    const seen = new Set<string>();
    return rows.map((row, index) => {
      const key = row.key.trim().toLowerCase();
      const label = row.label.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
        throw new BadRequestException(
          `Invalid amenity category key "${row.key}"`,
        );
      }
      if (!label) {
        throw new BadRequestException('Amenity category label is required');
      }
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate amenity category key "${key}"`,
        );
      }
      seen.add(key);
      const color =
        typeof row.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(row.color)
          ? row.color.toUpperCase()
          : '';
      return { key, label, sortOrder: row.sortOrder ?? index, color };
    });
  }
}
