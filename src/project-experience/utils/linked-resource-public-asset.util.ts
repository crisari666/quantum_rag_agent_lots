import { ProjectExperienceAssetType } from '../types/project-experience.enums';
import type {
  ExperienceAssetPublicType,
  ExperienceLocationPublicType,
} from '../types/project-experience-manifest.type';
import { buildExperiencePublicFileUrl } from './experience-public-file-url.util';

const LINKED_RESOURCE_ASSET_PREFIX = 'linked-resource-';

type LinkedModelResource = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly fileName: string;
  readonly thumbnailFileName: string;
};

/**
 * Places each linked library GLB on its place point for the public manifest.
 */
export function buildLinkedResourcePublicAssets(
  locations: readonly ExperienceLocationPublicType[],
  resources: readonly LinkedModelResource[],
): ExperienceAssetPublicType[] {
  const resourcesById = new Map(
    resources.map((resource) => [resource.id, resource]),
  );
  return locations.flatMap((location) => {
    const asset = toLinkedResourceAsset(location, resourcesById);
    return asset ? [asset] : [];
  });
}

function toLinkedResourceAsset(
  location: ExperienceLocationPublicType,
  resourcesById: ReadonlyMap<string, LinkedModelResource>,
): ExperienceAssetPublicType | null {
  if (location.geometry.type !== 'Point') return null;
  const resourceId = location.linkedResourceId.trim();
  const resource = resourcesById.get(resourceId);
  if (!resource || resource.type !== ProjectExperienceAssetType.model_3d) {
    return null;
  }
  const point = readPointCoordinates(location.geometry.coordinates);
  const url = buildExperiencePublicFileUrl(resource.fileName);
  if (!point || !url) return null;
  return {
    id: `${LINKED_RESOURCE_ASSET_PREFIX}${location.id}`,
    name: resource.name,
    type: ProjectExperienceAssetType.model_3d,
    url,
    thumbnailUrl: toThumbnailUrl(resource.thumbnailFileName),
    position: {
      longitude: point.longitude,
      latitude: point.latitude,
      altitude: Number(location.modelAltitude) || 0,
    },
    transform: {
      rotation: readModelRotation(location.modelRotation),
      scale: 1,
    },
    sortOrder: location.sortOrder,
  };
}

function readModelRotation(
  rotation: readonly number[] | undefined,
): [number, number, number] {
  return [
    Number(rotation?.[0]) || 0,
    Number(rotation?.[1]) || 0,
    Number(rotation?.[2]) || 0,
  ];
}

function toThumbnailUrl(fileName: string): string | null {
  const url = buildExperiencePublicFileUrl(fileName);
  return url || null;
}

function readPointCoordinates(
  coordinates: unknown,
): { longitude: number; latitude: number } | null {
  if (!Array.isArray(coordinates)) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { longitude, latitude };
}
