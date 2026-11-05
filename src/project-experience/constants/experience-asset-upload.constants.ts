import { ProjectExperienceAssetType } from '../types/project-experience.enums';

export const MAX_EXPERIENCE_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_EXPERIENCE_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_EXPERIENCE_MODEL_BYTES = 80 * 1024 * 1024;
export const MAX_EXPERIENCE_GEOJSON_BYTES = 20 * 1024 * 1024;

export const ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_EXPERIENCE_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ALLOWED_EXPERIENCE_MODEL_MIME_TYPES = [
  'model/gltf-binary',
  'model/gltf+json',
  'application/octet-stream',
] as const;

export const ALLOWED_EXPERIENCE_GEOJSON_MIME_TYPES = [
  'application/geo+json',
  'application/json',
  'application/octet-stream',
  'text/plain',
] as const;

export const EXPERIENCE_ASSET_MAX_BYTES: Readonly<
  Record<ProjectExperienceAssetType, number>
> = {
  [ProjectExperienceAssetType.image]: MAX_EXPERIENCE_IMAGE_BYTES,
  [ProjectExperienceAssetType.video]: MAX_EXPERIENCE_VIDEO_BYTES,
  [ProjectExperienceAssetType.panorama]: MAX_EXPERIENCE_IMAGE_BYTES,
  [ProjectExperienceAssetType.model_3d]: MAX_EXPERIENCE_MODEL_BYTES,
  [ProjectExperienceAssetType.geojson]: MAX_EXPERIENCE_GEOJSON_BYTES,
};

export const DEFAULT_MAP_STYLE =
  'mapbox://styles/mapbox/satellite-streets-v12';
