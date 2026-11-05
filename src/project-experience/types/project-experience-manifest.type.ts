import type { ExperiencePoiSettingsType } from './experience-poi-settings.type';
import type { ProjectLocationCategory } from './project-location.enums';

export type ExperienceCameraType = Readonly<{
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}>;

export type ExperienceScenePublicType = Readonly<{
  id: string;
  title: string;
  description: string;
  camera: ExperienceCameraType;
  durationMs: number;
  visibleLayers: readonly string[];
  locationIds: readonly string[];
  assetIds: readonly string[];
  narrative: Readonly<{ title: string; text: string }> | null;
  sortOrder: number;
}>;

export type ExperienceAssetPublicType = Readonly<{
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnailUrl: string | null;
  position: Readonly<{
    longitude: number;
    latitude: number;
    altitude: number | null;
  }>;
  transform: Readonly<{
    rotation: readonly [number, number, number];
    scale: number;
  }>;
  sortOrder: number;
}>;

export type ExperienceLocationPublicType = Readonly<{
  id: string;
  name: string;
  description: string;
  subtitle: string;
  category: ProjectLocationCategory;
  categoryKey: string;
  categoryLabel: string;
  panoramaAssetId: string;
  geometry: Readonly<{
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: unknown;
  }>;
  importance: string;
  distanceMeters: number | null;
  estimatedTravelMinutes: number | null;
  media: Readonly<{
    cover: string | null;
    gallery: readonly string[];
    video: string | null;
  }>;
  attribution: string;
  sortOrder: number;
}>;

export type ProjectExperienceManifestType = Readonly<{
  projectId: string;
  version: number;
  status: 'published';
  map: Readonly<{
    provider: 'mapbox';
    style: string;
    terrain: boolean;
    terrainExaggeration: number;
    buildings3D: boolean;
    fog: boolean;
    roadsStyle: Readonly<{
      color: string;
      width: number;
      opacity: number;
    }>;
    initialCamera: ExperienceCameraType;
  }>;
  layers: Readonly<{
    lots: boolean;
    roads: boolean;
    locations: boolean;
    assets: boolean;
    models3D: boolean;
  }>;
  poi: ExperiencePoiSettingsType;
  amenityCategories: readonly {
    key: string;
    label: string;
    sortOrder: number;
    color: string;
  }[];
  resources: Readonly<{
    locations: string;
    lots: string;
    locationsLive: string;
    scenes: string;
  }>;
  scenes: readonly ExperienceScenePublicType[];
  locations: readonly ExperienceLocationPublicType[];
  assets: readonly ExperienceAssetPublicType[];
  publishedAt: string | null;
}>;
