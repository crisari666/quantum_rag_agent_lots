import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extname } from 'path';
import * as sharpNamespace from 'sharp';
import { ProjectImageStorageService } from '../../projects/services/project-image-storage.service';
import { ProjectsService } from '../../projects/projects.service';
import {
  ALLOWED_EXPERIENCE_GEOJSON_MIME_TYPES,
  ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES,
  ALLOWED_EXPERIENCE_MODEL_MIME_TYPES,
  ALLOWED_EXPERIENCE_VIDEO_MIME_TYPES,
  EXPERIENCE_ASSET_MAX_BYTES,
} from '../constants/experience-asset-upload.constants';
import { PlaceExperienceAssetDto } from '../dto/place-experience-asset.dto';
import { UpdateExperienceAssetDto } from '../dto/update-experience-asset.dto';
import {
  ProjectExperienceAsset,
  ProjectExperienceAssetDocument,
} from '../schemas/project-experience-asset.schema';
import {
  ProjectExperienceResource,
  ProjectExperienceResourceDocument,
} from '../schemas/project-experience-resource.schema';
import { ProjectExperienceAssetType } from '../types/project-experience.enums';
import { compressPanoramaUpload } from '../utils/compress-panorama-upload.util';
import {
  buildExperiencePublicFileUrl,
  isPublicHttpUrl,
} from '../utils/experience-public-file-url.util';
import type { ExperienceAssetPublicType } from '../types/project-experience-manifest.type';

@Injectable()
export class ProjectExperienceAssetsService {
  public constructor(
    @InjectModel(ProjectExperienceAsset.name)
    private readonly assetModel: Model<ProjectExperienceAssetDocument>,
    @InjectModel(ProjectExperienceResource.name)
    private readonly resourceModel: Model<ProjectExperienceResourceDocument>,
    private readonly projectsService: ProjectsService,
    private readonly projectImageStorageService: ProjectImageStorageService,
  ) {}

  public async listByProject(
    projectId: string,
  ): Promise<ProjectExperienceAssetDocument[]> {
    await this.projectsService.getById(projectId);
    const rows = await this.assetModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ sortOrder: 1, createdAt: 1 })
      .exec();
    await Promise.all(rows.map((row) => this.persistPublicUrls(row)));
    return rows;
  }

  public async listVisible(
    projectId: string,
  ): Promise<ProjectExperienceAssetDocument[]> {
    return this.assetModel
      .find({
        projectId: new Types.ObjectId(projectId),
        visible: true,
      })
      .sort({ sortOrder: 1, createdAt: 1 })
      .exec();
  }

  public async upload(params: {
    readonly projectId: string;
    readonly file: Express.Multer.File;
    readonly type: ProjectExperienceAssetType;
    readonly name?: string;
    readonly longitude?: number;
    readonly latitude?: number;
    readonly altitude?: number | null;
  }): Promise<ProjectExperienceAssetDocument> {
    const project = await this.projectsService.getById(params.projectId);
    const file = await this.prepareUploadFile(params.type, params.file);
    this.assertUploadAllowed(params.type, file);
    const extension = this.resolveExtension(file);
    const timestamp = Date.now();
    const safeTitle = project.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'project';
    const fileName = `exp_${params.type}_${safeTitle}_${timestamp}${extension}`;
    await this.projectImageStorageService.saveFile(file.buffer, fileName);
    let thumbnailFileName = '';
    if (
      params.type === ProjectExperienceAssetType.image ||
      params.type === ProjectExperienceAssetType.panorama
    ) {
      thumbnailFileName = await this.createThumbnail(
        file.buffer,
        safeTitle,
        timestamp,
      );
    }
    const longitude =
      typeof params.longitude === 'number' ? params.longitude : project.lng;
    const latitude =
      typeof params.latitude === 'number' ? params.latitude : project.lat;
    const count = await this.assetModel.countDocuments({
      projectId: new Types.ObjectId(params.projectId),
    });
    return this.assetModel.create({
      projectId: new Types.ObjectId(params.projectId),
      resourceId: null,
      name: (params.name?.trim() || file.originalname || fileName).slice(0, 200),
      type: params.type,
      fileName,
      url: buildExperiencePublicFileUrl(fileName),
      thumbnailFileName,
      thumbnailUrl: thumbnailFileName
        ? buildExperiencePublicFileUrl(thumbnailFileName)
        : '',
      position: {
        longitude,
        latitude,
        altitude: params.altitude ?? null,
      },
      transform: { rotation: [0, 0, 0], scale: 1 },
      visible: true,
      sortOrder: count,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    });
  }

  public async placeFromResource(
    projectId: string,
    dto: PlaceExperienceAssetDto,
  ): Promise<ProjectExperienceAssetDocument> {
    await this.projectsService.getById(projectId);
    if (
      typeof dto.longitude !== 'number' ||
      typeof dto.latitude !== 'number' ||
      !Number.isFinite(dto.longitude) ||
      !Number.isFinite(dto.latitude)
    ) {
      throw new BadRequestException(
        'longitude and latitude are required to place a resource',
      );
    }
    if (!Types.ObjectId.isValid(dto.resourceId)) {
      throw new NotFoundException(`Resource ${dto.resourceId} not found`);
    }
    const resource = await this.resourceModel
      .findOne({
        _id: new Types.ObjectId(dto.resourceId),
        projectId: new Types.ObjectId(projectId),
      })
      .exec();
    if (!resource) {
      throw new NotFoundException(`Resource ${dto.resourceId} not found`);
    }
    const count = await this.assetModel.countDocuments({
      projectId: new Types.ObjectId(projectId),
    });
    const url = buildExperiencePublicFileUrl(resource.fileName);
    const thumbnailUrl = resource.thumbnailFileName
      ? buildExperiencePublicFileUrl(resource.thumbnailFileName)
      : '';
    if (resource.url !== url || resource.thumbnailUrl !== thumbnailUrl) {
      resource.url = url;
      resource.thumbnailUrl = thumbnailUrl;
      await resource.save();
    }
    return this.assetModel.create({
      projectId: new Types.ObjectId(projectId),
      resourceId: resource._id,
      name: (dto.name?.trim() || resource.name).slice(0, 200),
      type: resource.type,
      fileName: resource.fileName,
      url,
      thumbnailFileName: resource.thumbnailFileName,
      thumbnailUrl,
      position: {
        longitude: dto.longitude,
        latitude: dto.latitude,
        altitude: dto.altitude ?? null,
      },
      transform: { rotation: [0, 0, 0], scale: 1 },
      visible: true,
      sortOrder: count,
      sizeBytes: resource.sizeBytes,
      mimeType: resource.mimeType,
    });
  }

  public async update(
    projectId: string,
    assetId: string,
    dto: UpdateExperienceAssetDto,
  ): Promise<ProjectExperienceAssetDocument> {
    const asset = await this.findOwnedAsset(projectId, assetId);
    if (dto.name !== undefined) asset.name = dto.name.trim();
    if (dto.visible !== undefined) asset.visible = dto.visible;
    if (dto.sortOrder !== undefined) asset.sortOrder = dto.sortOrder;
    if (dto.position) {
      if (dto.position.longitude !== undefined) {
        asset.position.longitude = dto.position.longitude;
      }
      if (dto.position.latitude !== undefined) {
        asset.position.latitude = dto.position.latitude;
      }
      if (dto.position.altitude !== undefined) {
        asset.position.altitude = dto.position.altitude;
      }
      asset.markModified('position');
    }
    if (dto.transform) {
      if (dto.transform.rotation !== undefined) {
        if (dto.transform.rotation.length !== 3) {
          throw new BadRequestException(
            'transform.rotation must be [x, y, z]',
          );
        }
        asset.transform.rotation = dto.transform.rotation;
      }
      if (dto.transform.scale !== undefined) {
        asset.transform.scale = dto.transform.scale;
      }
      asset.markModified('transform');
    }
    await asset.save();
    return asset;
  }

  public async remove(
    projectId: string,
    assetId: string,
  ): Promise<{ deleted: true }> {
    const asset = await this.findOwnedAsset(projectId, assetId);
    // Library-backed placements share the file — only delete disk for legacy inline uploads.
    if (!asset.resourceId) {
      await this.projectImageStorageService.deleteFile(asset.fileName);
      if (asset.thumbnailFileName) {
        await this.projectImageStorageService.deleteFile(
          asset.thumbnailFileName,
        );
      }
    }
    await asset.deleteOne();
    return { deleted: true };
  }

  public async toPublicAsset(
    asset: ProjectExperienceAssetDocument,
  ): Promise<ExperienceAssetPublicType> {
    let fileName = asset.fileName;
    let thumbnailFileName = asset.thumbnailFileName;
    if (asset.resourceId) {
      const resource = await this.resourceModel
        .findById(asset.resourceId)
        .exec();
      if (resource) {
        fileName = resource.fileName;
        thumbnailFileName = resource.thumbnailFileName;
      }
    }
    return {
      id: String(asset._id),
      name: asset.name,
      type: asset.type,
      url: buildExperiencePublicFileUrl(
        isPublicHttpUrl(asset.url) ? asset.url : fileName,
      ),
      thumbnailUrl: thumbnailFileName
        ? buildExperiencePublicFileUrl(
            isPublicHttpUrl(asset.thumbnailUrl)
              ? asset.thumbnailUrl
              : thumbnailFileName,
          )
        : null,
      position: {
        longitude: asset.position.longitude,
        latitude: asset.position.latitude,
        altitude: asset.position.altitude,
      },
      transform: {
        rotation: [
          asset.transform.rotation[0] ?? 0,
          asset.transform.rotation[1] ?? 0,
          asset.transform.rotation[2] ?? 0,
        ],
        scale: asset.transform.scale,
      },
      sortOrder: asset.sortOrder,
    };
  }

  private async persistPublicUrls(
    asset: ProjectExperienceAssetDocument,
  ): Promise<void> {
    const url = buildExperiencePublicFileUrl(asset.fileName);
    const thumbnailUrl = asset.thumbnailFileName
      ? buildExperiencePublicFileUrl(asset.thumbnailFileName)
      : '';
    if (asset.url === url && asset.thumbnailUrl === thumbnailUrl) return;
    asset.url = url;
    asset.thumbnailUrl = thumbnailUrl;
    await asset.save();
  }

  private async findOwnedAsset(
    projectId: string,
    assetId: string,
  ): Promise<ProjectExperienceAssetDocument> {
    if (!Types.ObjectId.isValid(assetId)) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    const asset = await this.assetModel
      .findOne({
        _id: new Types.ObjectId(assetId),
        projectId: new Types.ObjectId(projectId),
      })
      .exec();
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    return asset;
  }

  private async prepareUploadFile(
    type: ProjectExperienceAssetType,
    file: Express.Multer.File,
  ): Promise<Express.Multer.File> {
    if (type !== ProjectExperienceAssetType.panorama) return file;
    try {
      return await compressPanoramaUpload(file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      throw new BadRequestException(
        `Panorama image could not be compressed: ${detail}`,
      );
    }
  }

  private assertUploadAllowed(
    type: ProjectExperienceAssetType,
    file: Express.Multer.File,
  ): void {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const maxBytes = EXPERIENCE_ASSET_MAX_BYTES[type];
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds max size of ${maxBytes} bytes for type ${type}`,
      );
    }
    const mime = (file.mimetype ?? '').toLowerCase();
    const name = (file.originalname ?? '').toLowerCase();
    const ok = this.isMimeAllowed(type, mime, name);
    if (!ok) {
      throw new BadRequestException(
        `MIME/extension not allowed for asset type ${type}`,
      );
    }
  }

  private isMimeAllowed(
    type: ProjectExperienceAssetType,
    mime: string,
    name: string,
  ): boolean {
    switch (type) {
      case ProjectExperienceAssetType.image:
      case ProjectExperienceAssetType.panorama:
        return (
          (ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.jpg') ||
          name.endsWith('.jpeg') ||
          name.endsWith('.png') ||
          name.endsWith('.webp')
        );
      case ProjectExperienceAssetType.video:
        return (
          (ALLOWED_EXPERIENCE_VIDEO_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.mp4') ||
          name.endsWith('.webm') ||
          name.endsWith('.mov')
        );
      case ProjectExperienceAssetType.model_3d:
        return (
          (ALLOWED_EXPERIENCE_MODEL_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.glb') ||
          name.endsWith('.gltf')
        );
      case ProjectExperienceAssetType.geojson:
        return (
          (ALLOWED_EXPERIENCE_GEOJSON_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.geojson') ||
          name.endsWith('.json')
        );
      default:
        return false;
    }
  }

  private resolveExtension(file: Express.Multer.File): string {
    const fromName = extname(file.originalname ?? '').toLowerCase();
    if (fromName) return fromName;
    if (file.mimetype.includes('png')) return '.png';
    if (file.mimetype.includes('webp')) return '.webp';
    if (file.mimetype.includes('jpeg') || file.mimetype.includes('jpg')) {
      return '.jpg';
    }
    if (file.mimetype.includes('webm')) return '.webm';
    if (file.mimetype.includes('mp4')) return '.mp4';
    if (file.mimetype.includes('gltf')) return '.gltf';
    return '.bin';
  }

  private async createThumbnail(
    buffer: Buffer,
    safeTitle: string,
    timestamp: number,
  ): Promise<string> {
    const thumbName = `exp_thumb_${safeTitle}_${timestamp}.webp`;
    const sharp =
      (sharpNamespace as unknown as { default?: typeof sharpNamespace })
        .default ?? sharpNamespace;
    const thumbBuffer = await sharp(buffer)
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await this.projectImageStorageService.saveFile(thumbBuffer, thumbName);
    return thumbName;
  }
}
